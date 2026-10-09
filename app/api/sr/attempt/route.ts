export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { postAttempt } from "../../../../hosted-app/api/sr-explain";
import { authorizeLearner, entitlementDenied } from "../authorize";

export async function POST(req: Request) {
  const auth = await authorizeLearner(req);
  if (!auth.ok) return auth.response;
  const denied = entitlementDenied(auth);
  if (denied) return denied;
  return postAttempt(req, auth.learnerId);
}
