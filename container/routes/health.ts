// GET /health - BabySteps checks this before letting a deployment go live and as part of
// ongoing availability checks (container/docs/app-launch-integration.md).
//
// Must return 2xx *directly* - BabySteps' health check does not follow redirects, and it
// holds a deployment back on anything other than a clean 2xx. A plain liveness check is
// sufficient: the hosted app has no database or external worker to probe - progress lives
// in the browser's localStorage (override this handler if a hosted app needs deeper probes).
export async function GET(): Promise<Response> {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}
