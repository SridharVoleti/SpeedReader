// Starts "our own session for the child" after a verified BabySteps launch (the final step of
// docs/app-launch-integration.md). Unlike ChessMaster, SpeedReader has no backend database -
// progress lives in the browser's localStorage - so there is no student/booking table to
// write to. Instead we mint a self-contained, signed session token and hand it back as a
// cookie; nothing server-side needs to be persisted to trust it on the next request.
//
// Signed with its own SESSION_SECRET, deliberately NOT the APP_LAUNCH_BOOTSTRAP_SECRET:
// that secret is shared with BabySteps for verifying *their* tokens, and must never also be
// usable to forge *ours*.
//
// The same cookie also carries the BabySteps "platform API" grant (see platform-api.ts) once
// one exists: the rotating access token, and our own running progressVersion/
// checkpointSequence counters. There's no database to keep that state in either, so it rides
// along in this same signed, httpOnly cookie and gets re-signed (see reissueSessionToken)
// every time a progress call changes it.

import { SignJWT, jwtVerify } from "jose";
import identity from "../../hosted-app/app.identity";
import { AppLaunchError } from "./errors";
import type { LearnerBootstrap } from "./bootstrap-assertion";
import type { PlatformGrant } from "./platform-api";

export const SESSION_COOKIE = `${identity.cookiePrefix}_session`;
/** Non-httpOnly, display-only fields the client reads to greet the learner and namespace
 *  their localStorage progress. Never put anything sensitive in this one. */
export const LEARNER_COOKIE = `${identity.cookiePrefix}_learner`;

const DEFAULT_SESSION_HOURS = 6;

export interface LearnerSession {
  learnerId: string;
  learnerSessionId: string;
  displayName: string;
  avatarId?: string;
  /** Present once the /launch exchange returned a platform-API grant. Absent entirely means
   *  "don't attempt to sync progress to BabySteps for this session" (misconfigured, or the
   *  exchange didn't include one). */
  grant?: PlatformGrant;
  /** Our own tracking of BabySteps' learner_app_progress.progress_version - required on every
   *  write as an optimistic-concurrency guard. Undefined until the first read/write. */
  progressVersion?: number;
  /** Strictly increasing within this BabySteps session; two increments per level pass
   *  (checkpoint, then completeLesson). */
  checkpointSequence?: number;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new AppLaunchError("LAUNCH_MISCONFIGURED", "SESSION_SECRET must be set (32+ characters) to start a learner session.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(session: LearnerSession, expiresAt: Date): Promise<string> {
  try {
    return await new SignJWT({
      learner_id: session.learnerId,
      learner_session_id: session.learnerSessionId,
      display_name: session.displayName,
      avatar_id: session.avatarId ?? null,
      grant: session.grant ?? null,
      progress_version: session.progressVersion ?? null,
      checkpoint_sequence: session.checkpointSequence ?? null
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey());
  } catch (e) {
    if (e instanceof AppLaunchError) throw e;
    throw new AppLaunchError("PROVISION_FAILED", `Could not sign the session token: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

export async function mintSessionToken(
  learner: LearnerBootstrap,
  opts: { centralSessionExpiresAt?: string; now?: () => Date; grant?: PlatformGrant } = {}
): Promise<{ token: string; expiresAt: string }> {
  const now = (opts.now ?? (() => new Date()))();
  const fallback = new Date(now.getTime() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000);
  const central = opts.centralSessionExpiresAt ? new Date(opts.centralSessionExpiresAt) : null;
  // Never trust BabySteps to hand us a ceiling further out than our own default session length.
  const expiresAt = central && central.getTime() < fallback.getTime() ? central : fallback;

  const token = await signSessionToken(
    {
      learnerId: learner.learnerId,
      learnerSessionId: learner.learnerSessionId,
      displayName: learner.displayName,
      avatarId: learner.avatarId,
      grant: opts.grant
    },
    expiresAt
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function verifySessionToken(token: string): Promise<(LearnerSession & { expiresAt: string }) | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const learnerId = typeof payload.learner_id === "string" ? payload.learner_id : "";
    const learnerSessionId = typeof payload.learner_session_id === "string" ? payload.learner_session_id : "";
    const displayName = typeof payload.display_name === "string" ? payload.display_name : "";
    if (!learnerId || !learnerSessionId || !displayName || typeof payload.exp !== "number") return null;
    return {
      learnerId,
      learnerSessionId,
      displayName,
      avatarId: typeof payload.avatar_id === "string" ? payload.avatar_id : undefined,
      grant: isPlatformGrant(payload.grant) ? payload.grant : undefined,
      progressVersion: typeof payload.progress_version === "number" ? payload.progress_version : undefined,
      checkpointSequence: typeof payload.checkpoint_sequence === "number" ? payload.checkpoint_sequence : undefined,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    };
  } catch {
    return null;
  }
}

function isPlatformGrant(value: unknown): value is PlatformGrant {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.grantId === "string" &&
    typeof v.accessToken === "string" &&
    typeof v.accessTokenExpiresAt === "string" &&
    Array.isArray(v.scopes) &&
    typeof v.active === "boolean"
  );
}

/** The small, non-secret payload the client-side learner cookie carries (JSON, URL-safe). */
export function learnerCookieValue(learner: LearnerBootstrap): string {
  return encodeURIComponent(
    JSON.stringify({
      learnerId: learner.learnerId,
      displayName: learner.displayName,
      avatarId: learner.avatarId ?? null
    })
  );
}
