// The contract between the BabySteps container and whatever app it hosts.
//
// The container (everything under /container plus the Next.js router shims in /app) knows
// nothing about any particular app. A hosted app lives entirely in /hosted-app and describes
// itself with two files: `hosted-app/app.identity.ts` (default-exports `AppIdentity`; UI-free,
// used by server-side container code) and `hosted-app/app.manifest.ts` (default-exports
// `AppManifest`; UI wiring used by the router shims).
// To host a different app: replace /hosted-app with the new app's folder (it must provide
// those files) - nothing in /container or /app needs to change.

import type { ComponentType, ReactNode } from "react";
import type { Metadata } from "next";

export type PageModule = { default: ComponentType<Record<string, never>> };

export interface JourneyInfo {
  title: string;
  shortDescription: string;
}

export interface AppIdentity {
  /** Human name shown in container-rendered pages, e.g. "Speed Reading". */
  displayName: string;
  /** Prefix for the container's cookies, e.g. "speedreader" -> speedreader_session. */
  cookiePrefix: string;
  /** Title/description of the learner journey reported to BabySteps on progress sync. */
  journey: JourneyInfo;
}

export interface AppManifest extends AppIdentity {
  /** Next.js metadata for the root layout. */
  metadata: Metadata;
  /** Root layout (html/body, fonts, global CSS). */
  Layout: ComponentType<{ children: ReactNode }>;
  /** Component rendered at "/". */
  Home: ComponentType;
  /** Additional pages, keyed by path below "/" (e.g. "training-demo"). */
  pages: Record<string, () => Promise<PageModule>>;
}
