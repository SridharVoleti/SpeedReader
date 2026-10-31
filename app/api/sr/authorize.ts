// Container-owned guard for the /api/sr learner routes (APP-PLAT-004, APP-PRIV-004): the learner comes from the
// signed BabySteps session, never from the request. Anonymous callers are refused unless a non-production
// environment explicitly opts in (SR_ALLOW_ANONYMOUS_LEARNER=true); a Vercel production deployment can never opt in.
import { SESSION_COOKIE, verifySessionToken, sessionTokenProblem } from "../../../container/launch/session";
import { logLaunch } from "../../../container/launch/log";

/** What the platform has authorised for this session. Derived from the verified launch grant; never includes the token. */
export type Entitlement = { active: boolean; scopes: string[] };

export type LearnerAuth =
  | { ok: true; learnerId: string | null; sessionId: string | null; entitlement: Entitlement | null }
  | { ok: false; response: Response };

const deny = (status: number, error: string): LearnerAuth => ({
  ok: false,
  response: new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } })
});

/** What the browser actually sent, for 401/403 diagnosis. Cookie names only, never values. */
export function requestFacts(req: Request): Record<string, unknown> {
  const url = new URL(req.url);
  return {
    method: req.method,
    path: url.pathname,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    secFetchMode: req.headers.get("sec-fetch-mode"),
    userAgent: req.headers.get("user-agent"),
    hasDeviceId: req.headers.get("x-sr-device-id") !== null,
    cookieNames: (req.headers.get("cookie") ?? "").split(";").map((p) => p.trim().split("=")[0]).filter(Boolean)
  };
}

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
    if (session) {
      const entitlement = session.grant ? { active: session.grant.active, scopes: [...session.grant.scopes] } : null;
      return { ok: true, learnerId: session.learnerId, sessionId: session.learnerSessionId, entitlement };
    }
    logLaunch("warn", "authorize.401-invalid-session", { ...requestFacts(req), reason: await sessionTokenProblem(token), sessionTokenChars: token.length });
    return deny(401, "invalid session");
  }
  if (anonymousAllowed(env)) return { ok: true, learnerId: null, sessionId: null, entitlement: null };
  logLaunch("warn", "authorize.401-no-session-cookie", requestFacts(req));
  return deny(401, "learner session required");
}

/**
 * A launch grant the platform has revoked means the learner is no longer entitled to a session: refuse politely
 * instead of continuing on stale authority. No grant at all (standalone/test) is not a denial. Assumption: a grant
 * with `active:false` is the platform's way of withdrawing entitlement.
 */
export function entitlementDenied(auth: { entitlement: Entitlement | null }): Response | null {
  if (auth.entitlement && !auth.entitlement.active) {
    return new Response(JSON.stringify({ error: "ENTITLEMENT_INACTIVE" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  return null;
}
