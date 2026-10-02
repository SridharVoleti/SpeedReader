// SpeedReader's declaration to the BabySteps container (see container/app-contract.ts).
// With app.identity.ts, one of the only two files the container imports from /hosted-app.

import type { AppManifest } from "../container/app-contract";
import RootLayout, { metadata } from "./ui/layout";
import Home from "./ui/page";
import identity from "./app.identity";

const manifest: AppManifest = {
  ...identity,
  metadata,
  Layout: RootLayout,
  Home,
  pages: {
    "adaptive-speed-demo": () => import("./ui/adaptive-speed-demo/page"),
    "book-mode-demo": () => import("./ui/book-mode-demo/page"),
    "certification-demo": () => import("./ui/certification-demo/page"),
    "evidence-demo": () => import("./ui/evidence-demo/page"),
    "item-types-demo": () => import("./ui/item-types-demo/page"),
    "meaningful-chunking-demo": () => import("./ui/meaningful-chunking-demo/page"),
    "personal-reading-model-demo": () => import("./ui/personal-reading-model-demo/page"),
    "retention-demo": () => import("./ui/retention-demo/page"),
    "rs-diagnosis-demo": () => import("./ui/rs-diagnosis-demo/page"),
    "sustained-reading-demo": () => import("./ui/sustained-reading-demo/page"),
    "training-demo": () => import("./ui/training-demo/page")
  }
};

export default manifest;
