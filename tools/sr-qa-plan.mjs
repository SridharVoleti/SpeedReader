// The steps the independent QA runner (tools/sr-qa-run.mjs) executes, kept separate so it can be unit-tested.
//
// Issue #28: --ui must exercise the PRODUCTION V3 learner journey (LearnerApp over /api/v3) on every Playwright
// project (mobile, desktop, constrained browser). The legacy /explain journey is diagnostics-only; its spec runs only
// when explicitly requested, under its own step name, and can never stand in for production acceptance.

/** Production V3 learner and API specs, plus the container launch/return contract. */
export const V3_UI_SPECS = Object.freeze([
  "hosted-app/tests/ui/learner-v3.spec.ts",
  "hosted-app/tests/ui/learner-v3-speech.spec.ts",
  "hosted-app/tests/ui/learner-v3-news-reader.spec.ts",
  "hosted-app/tests/ui/learner-v3-retention.spec.ts",
  "hosted-app/tests/ui/learner-v3-outcome.spec.ts",
  "hosted-app/tests/ui/learner-v3-a11y.spec.ts",
  "hosted-app/tests/ui/learner-v3-practice-session.spec.ts",
  "hosted-app/tests/ui/api-v3.spec.ts",
  "container/tests/app-launch.spec.ts"
]);

export function qaPlan({ ui = false, diagnosticsUi = false } = {}) {
  const steps = [
    { name: "unit-tests", command: "npx vitest run" },
    { name: "typecheck", command: "npx tsc --noEmit" },
    { name: "build", command: "npx next build" }
  ];
  // no --project filter: Playwright runs every configured project, and a failure in any of them fails the step
  if (ui) steps.push({ name: "ui-tests-v3", command: `npx playwright test ${V3_UI_SPECS.join(" ")}` });
  if (ui && diagnosticsUi) steps.push({ name: "ui-tests-diagnostics-explain", command: "npx playwright test hosted-app/tests/ui/sr-explain.spec.ts" });
  return steps;
}
