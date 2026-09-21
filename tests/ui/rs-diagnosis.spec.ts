import { expect, test } from "@playwright/test";

// SR-R5-001: RS competency integration.
// "Attempt evidence attributes to relevant RS without hard-coded passage IDs."
test("attempt evidence attributes to the correct RS competency for two unrelated content sets", async ({
  page
}) => {
  await page.goto("/rs-diagnosis-demo");

  await expect(page.getByTestId("attribution-level1_001-i1")).toHaveText(
    "level1_001-i1 -> RS-VOCABULARY (keyword-recognition): matched"
  );
  await expect(page.getByTestId("attribution-level1_001-i2")).toHaveText(
    "level1_001-i2 -> RS-INFERENCE (cause-effect-reasoning): not matched"
  );
  await expect(page.getByTestId("attribution-world3_042-q7")).toHaveText(
    "world3_042-q7 -> RS-FLUENCY (phrase-recognition-speed): matched"
  );
});

// SR-R5-002: Bottleneck reason codes (TC-R5-002-B: "Insufficient diagnosis evidence").
// "Below minimum returns INSUFFICIENT_EVIDENCE; sufficient pattern returns deterministic
//  bottleneck code."
test("diagnosis returns INSUFFICIENT_EVIDENCE below the minimum, then a deterministic bottleneck code once sufficient", async ({
  page
}) => {
  await page.goto("/rs-diagnosis-demo");

  await expect(page.getByTestId("evidence-count")).toHaveText("Evidence count: 0");
  await expect(page.getByTestId("bottleneck-code")).toHaveText("Bottleneck code: INSUFFICIENT_EVIDENCE");

  await page.getByTestId("add-failed-evidence").click();
  await page.getByTestId("add-failed-evidence").click();
  await expect(page.getByTestId("bottleneck-code")).toHaveText("Bottleneck code: INSUFFICIENT_EVIDENCE");

  // Reach the minimum of 5 with 3 failed / 2 matched -> 60% failure rate.
  await page.getByTestId("add-failed-evidence").click();
  await page.getByTestId("add-matched-evidence").click();
  await page.getByTestId("add-matched-evidence").click();

  await expect(page.getByTestId("evidence-count")).toHaveText("Evidence count: 5");
  await expect(page.getByTestId("bottleneck-code")).toHaveText("Bottleneck code: BOTTLENECK_DETECTED");
});

// SR-R5-003: Independent oral/comprehension gates (TC-R5-003-B: "Oral pass, comprehension fail").
// "Neither strong oral nor strong comprehension compensates for failure of the other when both
//  are required."
test("a passing oral gate never compensates for a failing comprehension gate, and vice versa", async ({ page }) => {
  await page.goto("/rs-diagnosis-demo");
  const gates = page.getByTestId("independent-gates");

  // Default: oral PASS, comprehension FAIL.
  await expect(gates.getByTestId("readiness-result")).toHaveText("Ready: no");
  await expect(gates.getByTestId("readiness-reason")).toHaveText("Reason: COMPREHENSION_GATE_FAILED");

  await gates.getByTestId("oral-state-select").selectOption("FAIL");
  await gates.getByTestId("comprehension-state-select").selectOption("PASS");
  await expect(gates.getByTestId("readiness-result")).toHaveText("Ready: no");
  await expect(gates.getByTestId("readiness-reason")).toHaveText("Reason: ORAL_GATE_FAILED");

  await gates.getByTestId("oral-state-select").selectOption("PASS");
  await expect(gates.getByTestId("readiness-result")).toHaveText("Ready: yes");
  await expect(gates.getByTestId("readiness-reason")).toHaveText("Reason: READY");
});
