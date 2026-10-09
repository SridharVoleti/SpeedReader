export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { GET as liveness } from "../../container/routes/health";
import { persistenceFromEnv } from "../../hosted-app/lib/v2/persistence-config";

// Readiness: a production deployment without valid Supabase persistence is NOT ready (503 CONFIGURATION_ERROR), so
// BabySteps holds it back instead of letting learners start sessions on transient storage. Missing learning content is
// a different condition (CONTENT_UNAVAILABLE, reported per request by /api/v3) and does not fail health.
export async function GET(): Promise<Response> {
  const persistence = persistenceFromEnv();
  if (!persistence.ok) {
    return new Response(JSON.stringify({ status: "CONFIGURATION_ERROR", component: persistence.component }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
  return liveness();
}
