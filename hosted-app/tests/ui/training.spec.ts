import { expect, test } from "@playwright/test";

// SR-R6-001: Evidence-driven next activity.
// "Select next activity from diagnosed needs and prerequisites. Same learner profile yields
//  same eligible activity/reason; only approved tagged content selected."
test("selects the approved prerequisite-satisfying activity, then advances once the prerequisite completes", async ({
  page
}) => {
  await page.goto("/training-demo");

  await expect(page.getByTestId("selected-activity")).toHaveText("Selected activity: act-inference-1");
  await expect(page.getByTestId("selection-reason")).toHaveText("Selection reason: TARGETS_BOTTLENECK_RS-INFERENCE");

  await page.getByTestId("complete-inference-1").click();

  await expect(page.getByTestId("selected-activity")).toHaveText("Selected activity: act-inference-2");
  await expect(page.getByTestId("completed-activities")).toHaveText("Completed: act-inference-1");
});

// SR-R6-002: Remediation then independent reassessment (TC-R6-002-B: "Training cannot certify").
// "Training result itself cannot count as independent confirmation unless explicitly approved
//  for assessment."
test("a passing training attempt is excluded from independent confirmation, but a passing assessment attempt counts", async ({
  page
}) => {
  await page.goto("/training-demo");
  const reassessment = page.getByTestId("remediation-reassessment");

  await expect(reassessment.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/1");

  await reassessment.getByTestId("submit-training-form").click();
  await expect(reassessment.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/1");
  await expect(reassessment.getByTestId("confirmed-forms")).toHaveText("Confirmed forms: none");

  await reassessment.getByTestId("submit-assessment-form").click();
  await expect(reassessment.getByTestId("confirmation-count")).toHaveText("Confirmations: 1/1");
  await expect(reassessment.getByTestId("confirmed-forms")).toHaveText("Confirmed forms: assessment-form-1");
});

// SR-R6-003: No meaningless repetition.
// "Immediate duplicate form reuse is rejected when alternatives exist; unavoidable reuse logs
//  reason."
test("rejects immediate duplicate form reuse while alternatives exist, but logs a reason when the pool is exhausted to one form", async ({
  page
}) => {
  await page.goto("/training-demo");
  const repetition = page.getByTestId("no-meaningless-repetition");

  await expect(repetition.getByTestId("selected-form")).toHaveText("Selected form: form-a");
  await expect(repetition.getByTestId("reuse-reason")).toHaveText("Reuse reason: none");

  await repetition.getByTestId("use-next-form").click();
  await expect(repetition.getByTestId("selected-form")).not.toHaveText("Selected form: form-a");
  await expect(repetition.getByTestId("reuse-reason")).toHaveText("Reuse reason: none");

  await expect(repetition.getByTestId("solo-selected-form")).toHaveText("Selected form: form-solo");
  await expect(repetition.getByTestId("solo-reuse-reason")).toHaveText("Reuse reason: none");

  await repetition.getByTestId("use-next-form-solo").click();
  await expect(repetition.getByTestId("solo-selected-form")).toHaveText("Selected form: form-solo");
  await expect(repetition.getByTestId("solo-reuse-reason")).toHaveText(
    "Reuse reason: NO_ALTERNATIVE_FORM_AVAILABLE"
  );
});
