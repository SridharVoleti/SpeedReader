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
