// Lightweight, UI-free facts about the hosted app. The container's server-side code
// (launch handler, cookies, progress sync) imports only this - never the UI manifest.

import type { AppIdentity } from "../container/app-contract";

const identity: AppIdentity = {
  displayName: "Speed Reading",
  cookiePrefix: "speedreader",
  journey: {
    title: "Speed Reading Journey",
    shortDescription: "Read faster, understand deeply and explain clearly - one words-per-minute Babystep at a time, with a story and a retelling every step of the way."
  }
};

export default identity;
