export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /health - BabySteps checks this before letting a deployment go live and as part of
// ongoing availability checks (docs/app-launch-integration.md).
//
// Must return 2xx *directly* - BabySteps' health check does not follow redirects, and it
// holds a deployment back on anything other than a clean 2xx. A plain liveness check is
// sufficient: Speed Reading has no database or external worker to probe - progress lives
// entirely in the browser's localStorage.
export async function GET(): Promise<Response> {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}
