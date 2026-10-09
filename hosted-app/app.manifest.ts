// SpeedReader's declaration to the BabySteps container (see container/app-contract.ts).
// With app.identity.ts, one of the only two files the container imports from /hosted-app.

import type { AppManifest } from "../container/app-contract";
import RootLayout, { metadata } from "./ui/layout";
import Home from "./ui/page";
import identity from "./app.identity";
import { routablePages } from "./app.pages";
export { DIAGNOSTIC_ROUTES } from "./app.pages";


const manifest: AppManifest = {
  ...identity,
  metadata,
  Layout: RootLayout,
  Home,
  pages: routablePages()
};

export default manifest;
