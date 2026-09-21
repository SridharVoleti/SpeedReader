import { expect, test } from "@playwright/test";

// SR-R8-001: Delayed recall evidence.
// "Delayed item links to source and scores separately from immediate comprehension."
test("the delayed item links to its source passage and scores independently of a perfect immediate score", async ({
  page
}) => {
  await page.goto("/retention-demo");
  const evidence = page.getByTestId("delayed-recall-evidence");

  await expect(evidence.getByTestId("source-passage")).toHaveText("Source passage: level1_001");
  await expect(evidence.getByTestId("delay-bucket")).toHaveText("Delay bucket: NEXT_DAY");
  await expect(evidence.getByTestId("immediate-score")).toHaveText("Immediate score: 100%");
  await expect(evidence.getByTestId("retention-score")).toHaveText("Retention score: 40%");

  await evidence.getByTestId("lower-delayed-score").click();

  // Retention score drops on its own evidence, while the immediate (perfect) score is untouched.
  await expect(evidence.getByTestId("retention-score")).toHaveText("Retention score: 20%");
  await expect(evidence.getByTestId("immediate-score")).toHaveText("Immediate score: 100%");
});
