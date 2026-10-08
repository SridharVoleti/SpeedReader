export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { postAttempt } from "../../../../hosted-app/api/sr-explain";

export function POST(req: Request) {
  return postAttempt(req);
}
