// GET /health - BabySteps checks this before letting a deployment go live and as part of
// ongoing availability checks (container/docs/app-launch-integration.md).
//
// Must return 2xx *directly* - BabySteps' health check does not follow redirects, and it
// holds a deployment back on anything other than a clean 2xx. A plain liveness check is
// sufficient at this layer. SpeedReader's own readiness probe (app/health/route.ts) wraps this handler and
// additionally fails closed (503 CONFIGURATION_ERROR) when production persistence is not configured.
export async function GET(): Promise<Response> {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}
