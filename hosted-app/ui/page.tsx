"use client";

// Production learner home (APP-NFR-007 / AC-A18): the v3 engine, not the legacy 36-level demo
// (relocated to the diagnostics-gated /legacy-demo route).
import LearnerApp from "./learner/LearnerApp";

export default function Home() {
  return <LearnerApp />;
}
