import type { AppManifest } from "../container/app-contract";
import { diagnosticsEnabled } from "./lib/diagnostics-gate";

// APP-NFR-007 / APP-PRIV-004: only the learner experience is routable in production. Every demo/diagnostic
// page exposes internal learner states and is mounted only where diagnostics are explicitly enabled.
const learnerPages: AppManifest["pages"] = {};

const diagnosticPages: AppManifest["pages"] = {
    // the legacy /explain journey shows question counts, correctness and readiness states (issue #18)
    "explain": () => import("./ui/explain/page"),
    "legacy-demo": () => import("./ui/legacy-demo/page"),
    "adaptive-speed-demo": () => import("./ui/adaptive-speed-demo/page"),
    "book-mode-demo": () => import("./ui/book-mode-demo/page"),
    "certification-demo": () => import("./ui/certification-demo/page"),
    "frozen-v2-demo": () => import("./ui/frozen-v2-demo/page"),
    "evidence-demo": () => import("./ui/evidence-demo/page"),
    "item-types-demo": () => import("./ui/item-types-demo/page"),
    "meaningful-chunking-demo": () => import("./ui/meaningful-chunking-demo/page"),
    "personal-reading-model-demo": () => import("./ui/personal-reading-model-demo/page"),
    "retention-demo": () => import("./ui/retention-demo/page"),
    "rs-diagnosis-demo": () => import("./ui/rs-diagnosis-demo/page"),
    "sustained-reading-demo": () => import("./ui/sustained-reading-demo/page"),
    "training-demo": () => import("./ui/training-demo/page")
};

export const DIAGNOSTIC_ROUTES: readonly string[] = Object.keys(diagnosticPages);

/** The pages routable for this environment. Production exposes the V3 learner experience (the Home page) only. */
export function routablePages(env: Record<string, string | undefined> = process.env): AppManifest["pages"] {
  return diagnosticsEnabled(env) ? { ...learnerPages, ...diagnosticPages } : learnerPages;
}
