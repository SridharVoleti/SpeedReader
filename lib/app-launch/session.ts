// Starts "our own session for the child" after a verified BabySteps launch (the final step of
// docs/app-launch-integration.md). Unlike ChessMaster, SpeedReader has no backend database -
// progress lives in the browser's localStorage - so there is no student/booking table to
// write to. Instead we mint a self-contained, signed session token and hand it back as a
// cookie; nothing server-side needs to be persisted to trust it on the next request.
//
// Signed with its own SESSION_SECRET, deliberately NOT the APP_LAUNCH_BOOTSTRAP_SECRET:
// that secret is shared with BabySteps for verifying *their* tokens, and must never also be
// usable to forge *ours*.

import { SignJWT, jwtVerify } from "jose";
import { AppLaunchError } from "./errors";
import type { LearnerBootstrap } from "./bootstrap-assertion";

export const SESSION_COOKIE = "speedreader_session";
/** Non-httpOnly, display-only fields the client reads to greet the learner and namespace
 *  their localStorage progress. Never put anything sensitive in this one. */
export const LEARNER_COOKIE = "speedreader_learner";

const DEFAULT_SESSION_HOURS = 6;

export interface LearnerSession {
  learnerId: string;
  learnerSessionId: string;
  displayName: string;
  avatarId?: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new AppLaunchError("LAUNCH_MISCONFIGURED", "SESSION_SECRET must be set (32+ characters) to start a learner session.");
  }
  return new TextEncoder().encode(secret);
}

export async function mintSessionToken(
  learner: LearnerBootstrap,
  opts: { centralSessionExpiresAt?: string; now?: () => Date } = {}
): Promise<{ token: string; expiresAt: string }> {
  const now = (opts.now ?? (() => new Date()))();
  const fallback = new Date(now.getTime() + DEFAULT_SESSION_HOURS * 60 * 60 * 1000);
  const central = opts.centralSessionExpiresAt ? new Date(opts.centralSessionExpiresAt) : null;
  // Never trust BabySteps to hand us a ceiling further out than our own default session length.
  const expiresAt = central && central.getTime() < fallback.getTime() ? central : fallback;

  try {
    const token = await new SignJWT({
      learner_id: learner.learnerId,
      learner_session_id: learner.learnerSessionId,
      display_name: learner.displayName,
      avatar_id: learner.avatarId ?? null
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(secretKey());
    return { token, expiresAt: expiresAt.toISOString() };
  } catch (e) {
    if (e instanceof AppLaunchError) throw e;
    throw new AppLaunchError("PROVISION_FAILED", `Could not mint a session token: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

export async function verifySessionToken(token: string): Promise<LearnerSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const learnerId = typeof payload.learner_id === "string" ? payload.learner_id : "";
    const learnerSessionId = typeof payload.learner_session_id === "string" ? payload.learner_session_id : "";
    const displayName = typeof payload.display_name === "string" ? payload.display_name : "";
    if (!learnerId || !learnerSessionId || !displayName) return null;
    return {
      learnerId,
      learnerSessionId,
      displayName,
      avatarId: typeof payload.avatar_id === "string" ? payload.avatar_id : undefined
    };
  } catch {
    return null;
  }
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
