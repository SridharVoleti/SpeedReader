import { expect, test } from "@playwright/test";

// SR-R4-001: Adaptive speed governor.
// "Identical state/evidence yields identical next WPM and reason code."
test("PASS advances the next target WPM by the configured increment", async ({ page }) => {
  await page.goto("/adaptive-speed-demo");

  await page.getByTestId("outcome-select").selectOption("PASS");
  await expect(page.getByTestId("next-target-wpm")).toHaveText("Next target WPM: 220");
  await expect(page.getByTestId("reason-code")).toHaveText("Reason code: COMPREHENSION_PASSED_ADVANCE");
});

test("HOLD retreats the next target WPM to the certified rate", async ({ page }) => {
  await page.goto("/adaptive-speed-demo");

  await page.getByTestId("outcome-select").selectOption("HOLD");
  await expect(page.getByTestId("next-target-wpm")).toHaveText("Next target WPM: 150");
  await expect(page.getByTestId("reason-code")).toHaveText("Reason code: COMPREHENSION_FAILED_RETREAT");
});

test("INVALID retries the same target WPM without penalty", async ({ page }) => {
  await page.goto("/adaptive-speed-demo");

  await page.getByTestId("outcome-select").selectOption("INVALID");
  await expect(page.getByTestId("next-target-wpm")).toHaveText("Next target WPM: 200");
  await expect(page.getByTestId("reason-code")).toHaveText("Reason code: INVALID_RETRY");
});

// SR-R4-002: Frontier search.
// "Tests show larger steps below frontier and smaller bounded steps after borderline/failure
//  evidence."
test("the step size grows on comfortable passes and shrinks on borderline/failure evidence", async ({ page }) => {
  await page.goto("/adaptive-speed-demo");

  await expect(page.getByTestId("step-size")).toHaveText("Current step size: 10");

  await page.getByTestId("evidence-comfortable-pass").click();
  await expect(page.getByTestId("step-size")).toHaveText("Current step size: 20");
  await page.getByTestId("evidence-comfortable-pass").click();
  await expect(page.getByTestId("step-size")).toHaveText("Current step size: 40");

  await page.getByTestId("evidence-borderline-pass").click();
  await expect(page.getByTestId("step-size")).toHaveText("Current step size: 20");
  await page.getByTestId("evidence-fail").click();
  await expect(page.getByTestId("step-size")).toHaveText("Current step size: 10");

  await expect(page.getByTestId("step-history")).toHaveText("History: 10 -> 20 -> 40 -> 20 -> 10");
});

// SR-R4-003: Invalid attempts do not penalize (TC-R4-003-B: CRR=200, challenge=220).
// "Injected invalid attempt leaves CRR unchanged and selects retry/reassessment."
test("an injected technical interruption leaves the CRR unchanged and selects retry, not failure", async ({
  page
}) => {
  await page.goto("/adaptive-speed-demo");
  await expect(page.getByTestId("invalid-demo-crr")).toHaveText("Certified Reading Rate: 200 WPM");

  await page.getByTestId("invalid-demo-submit-invalid").click();
  await expect(page.getByTestId("invalid-demo-crr")).toHaveText("Certified Reading Rate: 200 WPM");
  await expect(page.getByTestId("invalid-demo-reason")).toHaveText("Last decision reason: INVALID_RETRY");

  // Repeated invalid attempts never erode the CRR.
  await page.getByTestId("invalid-demo-submit-invalid").click();
  await page.getByTestId("invalid-demo-submit-invalid").click();
  await expect(page.getByTestId("invalid-demo-crr")).toHaveText("Certified Reading Rate: 200 WPM");

  // A genuine PASS still raises it normally.
  await page.getByTestId("invalid-demo-submit-pass").click();
  await expect(page.getByTestId("invalid-demo-crr")).toHaveText("Certified Reading Rate: 220 WPM");
  await expect(page.getByTestId("invalid-demo-reason")).toHaveText(
    "Last decision reason: COMPREHENSION_PASSED_ADVANCE"
  );
});

// SR-R4-004: Comprehension dominates speed (TC-R4-004-B: "Fast but poor comprehension").
// "Fast failed-comprehension attempt cannot raise CRR/progression."
test("a fast challenge with a failed mandatory item cannot raise the CRR, despite an 80% aggregate", async ({
  page
}) => {
  await page.goto("/adaptive-speed-demo");
  const demo = page.getByTestId("dominates-speed-demo");

  await expect(demo.getByTestId("dominates-aggregate")).toHaveText("Challenge WPM: 300 | Aggregate score: 80%");
  await expect(demo.getByTestId("dominates-outcome")).toHaveText("Comprehension outcome: HOLD");
  await expect(demo.getByTestId("dominates-crr-after")).toHaveText("CRR after: 150 WPM");
});
