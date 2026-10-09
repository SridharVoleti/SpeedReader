// Calls BabySteps' internal "platform API" - the contract that lets an embedded app persist
// a learner's progress summary centrally on the Babysteps side (separate from SpeedReader's own
// server-authoritative learner state). Reverse-engineered directly from the BabySteps source
// (src/lib/authorization/platform-api-contracts.ts, src/lib/app-authorization/service.ts,
// src/lib/app-progress/service.ts) - no app (ChessMasters included) had implemented this
// before SpeedReader, so there is no reference handler to copy.
//
// Every call here is "LA-002 dual proof": a short-lived (max 5 minutes) access token BabySteps
// issued us (the "grant"), PLUS a fresh Ed25519 app-assertion proving the call is really from
// SpeedReader - same mechanism as the /launch exchange, different `aud` per endpoint. The
// grant starts "provisional" (scoped only to confirm the launch actually rendered) and must be
// activated via confirmUsableLaunch before any progress call is allowed - and activating it is
// also what starts the learner's session clock on BabySteps' side, so it must only happen once
// the app is genuinely about to show the learner something, not speculatively.
//
// Every function here throws on failure. Callers (see app/api/babysteps-progress/route.ts and
// handle-app-launch.ts) always treat that as "sync skipped this time", never as a reason to
// block gameplay - SpeedReader's own learner state is unaffected by what BabySteps says.

import { randomUUID } from "crypto";
import { AppLaunchError } from "./errors";
import { mintAppAssertion, PLATFORM_API_AUDIENCE, GRANT_RENEW_AUDIENCE } from "./app-assertion";
import type { AppLaunchConfig } from "./config";
import type { PlatformApiAccess } from "./exchange";

export type PlatformGrant = PlatformApiAccess & {
  /** true once confirmUsableLaunch has succeeded - false means "don't bother calling progress
   *  endpoints, they'll just be refused" (we don't retry activation mid-session). */
  active: boolean;
};

function platformOrigin(cfg: AppLaunchConfig): string {
  try {
    return new URL(cfg.exchangeUrl).origin;
  } catch {
    return "https://www.babystepsindia.com";
  }
}

async function callPlatformApi(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  path: string;
  method: "GET" | "POST" | "PUT";
  body?: unknown;
  audience?: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const { cfg, grant, path, method, body, audience = PLATFORM_API_AUDIENCE, now, fetchImpl = fetch } = params;
  const assertion = await mintAppAssertion(cfg, { now, audience });

  let res: Response;
  try {
    res = await fetchImpl(`${platformOrigin(cfg)}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${grant.accessToken}`,
        "x-babysteps-app-assertion": assertion,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch (e) {
    throw new AppLaunchError("EXCHANGE_FAILED", `Platform API request to ${path} failed: ${e instanceof Error ? e.message : "network error"}`);
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = res.status === 204 ? {} : await res.json();
  } catch {
    // fall through to the !res.ok check below with an empty body
  }

  if (!res.ok) {
    const code = typeof parsed.error === "string" ? parsed.error : `HTTP_${res.status}`;
    throw new AppLaunchError("EXCHANGE_FAILED", `Platform API ${path} returned ${res.status} ${code}`);
  }

  return parsed;
}

/**
 * Activates the provisional grant from the /launch exchange into one that can actually read
 * and write progress, and - on BabySteps' side - flips the learner's session from "starting"
 * to "active" (this is what starts their session clock). Call this exactly once, right after a
 * successful launch, before ever touching a progress endpoint with this grant.
 *
 * `expectedSessionVersion` is not returned anywhere in the /launch exchange response - a real
 * gap in what BabySteps hands the app. 1 is correct for a freshly dispatched session (nothing
 * touches learner_sessions.version between dispatch and exchange), which covers the normal
 * "parent just tapped Open" path; a resumed/reconnected session could plausibly differ, in
 * which case this call fails harmlessly and progress sync is simply skipped for that session.
 */
export async function confirmUsableLaunch(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  learnerSessionId: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<PlatformGrant> {
  const { cfg, grant, learnerSessionId, now, fetchImpl } = params;
  await callPlatformApi({
    cfg,
    grant,
    path: `/v1/internal/learner-sessions/${encodeURIComponent(learnerSessionId)}/usable-launch`,
    method: "POST",
    body: {
      runtimeInitializationId: randomUUID(),
      runtimeVersion: 1,
      expectedSessionVersion: 1,
      idempotencyKey: randomUUID()
    },
    now,
    fetchImpl
  });
  // The route doesn't hand back the widened scope list, but activation only ever adds scopes
  // (never revokes) - authorizeAppRequest re-reads them live from the grant row on every call,
  // so this access token keeps working immediately.
  return { ...grant, active: true };
}

/** Renews the access token before a protected call. Always call this first - the token is
 *  only valid for ~5 minutes, and renewal accepts an already-expired one as long as the
 *  underlying learner session hasn't ended, so there's no benefit to tracking exact expiry. */
export async function renewGrant(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<PlatformGrant> {
  const { cfg, grant, now, fetchImpl } = params;
  const assertion = await mintAppAssertion(cfg, { now, audience: GRANT_RENEW_AUDIENCE });
  const nowFn = now ?? (() => new Date());

  let res: Response;
  try {
    res = await (fetchImpl ?? fetch)(`${platformOrigin(cfg)}/v1/internal/app-session-grants/${encodeURIComponent(grant.grantId)}/renew`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${grant.accessToken}`,
        "x-babysteps-app-assertion": assertion,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({ renewalIdempotencyKey: randomUUID() }),
      cache: "no-store"
    });
  } catch (e) {
    throw new AppLaunchError("EXCHANGE_FAILED", `Grant renewal failed: ${e instanceof Error ? e.message : "network error"}`);
  }

  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || typeof body.accessToken !== "string" || typeof body.accessTokenExpiresAt !== "string") {
    throw new AppLaunchError("EXCHANGE_FAILED", `Grant renewal returned ${res.status}`);
  }
  void nowFn;
  return {
    ...grant,
    accessToken: body.accessToken,
    accessTokenExpiresAt: body.accessTokenExpiresAt,
    scopes: Array.isArray(body.scopes) ? (body.scopes as string[]) : grant.scopes
  };
}

export type CurrentProgress = {
  exists: boolean;
  progressVersion: number;
  currentLevelKey?: string;
};

export async function getCurrentProgress(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<CurrentProgress> {
  const body = await callPlatformApi({
    ...params,
    path: "/v1/internal/learner-app-progress/current",
    method: "GET"
  });
  return {
    exists: body.exists === true,
    progressVersion: typeof body.progressVersion === "number" ? body.progressVersion : 0,
    currentLevelKey: typeof body.currentLevelKey === "string" ? body.currentLevelKey : undefined
  };
}

export type ProgressSummary = {
  currentLevel: string;
  efficiencyStars: number;
  milestone: string | null;
  nextDestination: string;
};

/** Sets the session's current checkpoint. Required once (levelKey="1") before the first
 *  completeLesson call ever succeeds for a learner - completeLesson refuses to complete a
 *  lesson the session isn't already "on". */
export async function saveCheckpoint(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  expectedProgressVersion: number;
  checkpointSequence: number;
  levelKey: string;
  progressSummary?: ProgressSummary;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<{ progressVersion: number }> {
  const body = await callPlatformApi({
    cfg: params.cfg,
    grant: params.grant,
    path: "/v1/internal/learner-app-progress/current",
    method: "PUT",
    body: {
      expectedProgressVersion: params.expectedProgressVersion,
      checkpointSequence: params.checkpointSequence,
      stateSchemaVersion: 1,
      currentLevelKey: params.levelKey,
      currentLessonKey: params.levelKey,
      currentState: { v: 1 },
      checkpointIdempotencyKey: randomUUID(),
      ...(params.progressSummary ? { progressSummary: params.progressSummary } : {})
    },
    now: params.now,
    fetchImpl: params.fetchImpl
  });
  const progress = (body.progress ?? {}) as Record<string, unknown>;
  return { progressVersion: typeof progress.progressVersion === "number" ? progress.progressVersion : params.expectedProgressVersion + 1 };
}

/** Reports a passed level. Never call this for a level that hasn't actually been passed - a
 *  completion is permanent per lessonKey on BabySteps' side (retrying an already-completed
 *  lessonKey just comes back as a no-op, it can't be un-completed). */
export async function completeLesson(params: {
  cfg: AppLaunchConfig;
  grant: PlatformGrant;
  expectedProgressVersion: number;
  checkpointSequence: number;
  levelKey: string;
  nextLevelKey: string;
  progressSummary?: ProgressSummary;
  journeyTitle: string;
  journeyShortDescription: string;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<{ progressVersion: number; alreadyCompleted: boolean }> {
  const body = await callPlatformApi({
    cfg: params.cfg,
    grant: params.grant,
    path: `/v1/internal/learner-app-progress/lessons/${encodeURIComponent(params.levelKey)}/complete`,
    method: "POST",
    body: {
      levelKey: params.levelKey,
      expectedProgressVersion: params.expectedProgressVersion,
      checkpointSequence: params.checkpointSequence,
      stateSchemaVersion: 1,
      nextLevelKey: params.nextLevelKey,
      nextLessonKey: params.nextLevelKey,
      nextState: { v: 1 },
      completionOutcomeCode: "passed",
      completionIdempotencyKey: randomUUID(),
      journeyContractVersion: "1.0",
      journeyTitle: params.journeyTitle,
      journeyShortDescription: params.journeyShortDescription,
      journeyIconAssetKey: null,
      ...(params.progressSummary ? { progressSummary: params.progressSummary } : {})
    },
    now: params.now,
    fetchImpl: params.fetchImpl
  });
  const progress = (body.progress ?? {}) as Record<string, unknown>;
  return {
    progressVersion: typeof progress.progressVersion === "number" ? progress.progressVersion : params.expectedProgressVersion + 1,
    alreadyCompleted: body.alreadyCompleted === true
  };
}
