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

// SR-R8-002: Retained comprehension (TC-R8-002-B: immediate pass, delayed fail).
// "Immediate PASS + delayed FAIL remain distinct; advanced certification withheld when
//  retention mandatory."
test("keeps immediate PASS and delayed FAIL distinct, withholding advanced certification only while retention is mandatory", async ({
  page
}) => {
  await page.goto("/retention-demo");
  const retained = page.getByTestId("retained-comprehension");

  await expect(retained.getByTestId("immediate-result")).toHaveText("Immediate: PASS");
  await expect(retained.getByTestId("retention-state")).toHaveText("Retention: FAIL");
  await expect(retained.getByTestId("retention-required-state")).toHaveText("Retention required: yes");
  await expect(retained.getByTestId("advanced-certification-result")).toHaveText(
    "Advanced certification: WITHHELD (RETENTION_REQUIRED_NOT_MET)"
  );

  await retained.getByTestId("toggle-retention-required").click();

  await expect(retained.getByTestId("retention-required-state")).toHaveText("Retention required: no");
  await expect(retained.getByTestId("retention-state")).toHaveText("Retention: FAIL");
  await expect(retained.getByTestId("immediate-result")).toHaveText("Immediate: PASS");
  await expect(retained.getByTestId("advanced-certification-result")).toHaveText("Advanced certification: ELIGIBLE (ELIGIBLE)");
});

// SR-R8-003: Unfamiliar-content transfer.
// "Near-duplicate/recently trained form cannot satisfy transfer requirement."
test("selects transfer content outside recently trained topic families, and excludes it entirely once every candidate is recently trained", async ({
  page
}) => {
  await page.goto("/retention-demo");
  const transfer = page.getByTestId("unfamiliar-content-transfer");

  await expect(transfer.getByTestId("recently-trained-topics")).toHaveText("Recently trained topics: animals");
  await expect(transfer.getByTestId("transfer-content")).toHaveText("Transfer content: passage-novel-1");
  await expect(transfer.getByTestId("transfer-reason")).toHaveText("Reason: TRANSFER_ELIGIBLE_space");

  await transfer.getByTestId("toggle-all-topics-trained").click();

  await expect(transfer.getByTestId("recently-trained-topics")).toHaveText("Recently trained topics: animals, space");
  await expect(transfer.getByTestId("transfer-content")).toHaveText("Transfer content: none");
  await expect(transfer.getByTestId("transfer-reason")).toHaveText("Reason: NO_TRANSFER_ELIGIBLE_CONTENT");
});
