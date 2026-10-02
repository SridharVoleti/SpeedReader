// Lightweight, UI-free facts about the hosted app. The container's server-side code
// (launch handler, cookies, progress sync) imports only this - never the UI manifest.

import type { AppIdentity } from "../container/app-contract";

const identity: AppIdentity = {
  displayName: "Speed Reading",
  cookiePrefix: "speedreader",
  journey: {
    title: "Speed Reading Journey",
    shortDescription: "Climb from 100 to 200 WPM across 36 levels, with a comprehension check after every passage."
  }
};

export default identity;
