// HTTP handlers for the approved-package learner experience (issue #14). Mounted by thin route shims in /app/api/sr.
// Roots are configurable so deployments (and the end-to-end tests) can point at a real approved package set.

import { join } from "node:path";
import { createStore } from "../lib/sr/pipeline/storage";
import { loadApprovedPackage } from "../lib/sr/runtime/package-loader";
import { learnerView, readLedger, ledgerPath, revisitFor, submitAttempt, type AttemptInput } from "../lib/sr/runtime/attempt-service";

const roots = () => {
  const cwd = process.cwd();
  return {
    approved: process.env.SR_APPROVED_ROOT ?? join(cwd, "hosted-app", "pipeline", "approved"),
    wip: process.env.SR_WIP_ROOT ?? join(cwd, "hosted-app", "pipeline", "wip"),
    data: process.env.SR_DATA_DIR ?? join(cwd, ".data")
  };
};
const store = () => { const r = roots(); return createStore({ wipRoot: r.wip, approvedRoot: r.approved, qaActors: [] }); };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export function getPackage(req: Request): Response {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const loaded = loadApprovedPackage(store(), id);
  if (!loaded.ok) return json({ error: "package unavailable" }, 404);
  const learnerId = url.searchParams.get("learnerId");
  return json({ ...learnerView(loaded.pkg), revisit: learnerId ? revisitFor(readLedger(ledgerPath(roots().data)), learnerId) : [] });
}

export async function postAttempt(req: Request): Promise<Response> {
  let body: AttemptInput;
  try { body = (await req.json()) as AttemptInput; } catch { return json({ error: "invalid JSON body" }, 400); }
  const r = submitAttempt(store(), roots().data, body);
  return r.ok ? json(r) : json({ error: r.error }, r.status);
}
