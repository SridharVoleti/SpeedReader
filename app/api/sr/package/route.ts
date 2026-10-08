export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getPackage } from "../../../../hosted-app/api/sr-explain";

export function GET(req: Request) {
  return getPackage(req);
}
