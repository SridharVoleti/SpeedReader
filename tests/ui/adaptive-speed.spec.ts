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
