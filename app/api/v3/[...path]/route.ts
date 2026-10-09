export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { handleV3, json } from "../../../../hosted-app/api/v3";
import { authorizeLearner, entitlementDenied } from "../../sr/authorize";

// Container-owned shim: authenticates the signed BabySteps session, derives the learner/session/device, then hands
// over to the hosted-app handler. The learner is never taken from the request body or query (APP-PRIV-004).
async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const auth = await authorizeLearner(req);
  if (!auth.ok) return auth.response;
  const denied = entitlementDenied(auth);
  if (denied) return denied;
  const learnerId = auth.learnerId ?? req.headers.get("x-sr-test-learner"); // anonymous callers exist only in explicit non-production opt-in
  const sessionId = auth.sessionId ?? req.headers.get("x-sr-test-session");
  const deviceId = req.headers.get("x-sr-device-id");
  if (!learnerId || !sessionId || !deviceId) return json({ error: "learner, session and x-sr-device-id are required" }, 400);
  const { path } = await ctx.params;
  return handleV3(req, path, { learnerId, sessionId, deviceId, entitlement: auth.entitlement });
}

export const GET = handle;
export const POST = handle;
