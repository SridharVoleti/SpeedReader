import { expect, test } from "@playwright/test";

// SR-R9-004: Personal Reading Model.
// "Profile derives only from valid stored evidence and rebuilds identically from ledger."
// (TC-R9-004-B: delete derived profile, rebuild from ledger -> rebuilt state equals original.)
test("derives the profile only from valid evidence, and rebuilding from the same ledger yields an identical profile", async ({
  page
}) => {
  await page.goto("/personal-reading-model-demo");
  const model = page.getByTestId("personal-reading-model");

  await expect(model.getByTestId("profile-crr")).toHaveText("CRR: 240");
  await expect(model.getByTestId("profile-sustainable-rate")).toHaveText("Sustainable rate: 200");
  await expect(model.getByTestId("profile-span")).toHaveText("Certified span: L2");
  await expect(model.getByTestId("profile-rs-evidence")).toHaveText("RS-INFERENCE evidence: not matched, matched");
  await expect(model.getByTestId("rebuild-count")).toHaveText("Rebuild count: 0");

  await model.getByTestId("rebuild-from-ledger").click();

  await expect(model.getByTestId("rebuild-count")).toHaveText("Rebuild count: 1");
  await expect(model.getByTestId("profile-crr")).toHaveText("CRR: 240");
  await expect(model.getByTestId("profile-sustainable-rate")).toHaveText("Sustainable rate: 200");
  await expect(model.getByTestId("profile-span")).toHaveText("Certified span: L2");
});
