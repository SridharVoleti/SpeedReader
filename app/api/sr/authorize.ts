// Container-owned guard for the /api/sr learner routes (APP-PLAT-004, APP-PRIV-004): the learner comes from the
// signed BabySteps session, never from the request. Anonymous callers are refused unless a non-production
// environment explicitly opts in (SR_ALLOW_ANONYMOUS_LEARNER=true); a Vercel production deployment can never opt in.
import { SESSION_COOKIE, verifySessionToken } from "../../../container/launch/session";

export type LearnerAuth = { ok: true; learnerId: string | null; sessionId: string | null } | { ok: false; response: Response };

const deny = (status: number, error: string): LearnerAuth => ({
  ok: false,
  response: new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } })
});

export function anonymousAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.SR_ALLOW_ANONYMOUS_LEARNER === "true" && env.VERCEL_ENV !== "production";
}

export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function authorizeLearner(req: Request, env: Record<string, string | undefined> = process.env): Promise<LearnerAuth> {
  const token = cookieValue(req.headers.get("cookie"), SESSION_COOKIE);
  if (token) {
    const session = await verifySessionToken(token);
    if (session) return { ok: true, learnerId: session.learnerId, sessionId: session.learnerSessionId };
    return deny(401, "invalid session");
  }
  return anonymousAllowed(env) ? { ok: true, learnerId: null, sessionId: null } : deny(401, "learner session required");
}
