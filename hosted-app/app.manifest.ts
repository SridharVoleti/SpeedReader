// SpeedReader's declaration to the BabySteps container (see container/app-contract.ts).
// With app.identity.ts, one of the only two files the container imports from /hosted-app.

import type { AppManifest } from "../container/app-contract";
import RootLayout, { metadata } from "./ui/layout";
import Home from "./ui/page";
import identity from "./app.identity";
import { diagnosticsEnabled } from "./lib/diagnostics-gate";


// APP-NFR-007 / APP-PRIV-004: only the learner experience is routable in production. Every demo/diagnostic
// page exposes internal learner states and is mounted only where diagnostics are explicitly enabled.
const learnerPages: AppManifest["pages"] = {
  "explain": () => import("./ui/explain/page")
};

const diagnosticPages: AppManifest["pages"] = {
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

const manifest: AppManifest = {
  ...identity,
  metadata,
  Layout: RootLayout,
  Home,
  pages: diagnosticsEnabled() ? { ...learnerPages, ...diagnosticPages } : learnerPages
};

export default manifest;
