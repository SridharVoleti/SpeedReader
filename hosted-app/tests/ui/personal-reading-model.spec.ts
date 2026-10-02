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

// SR-R9-005: Reading-purpose profiles.
// "Evidence in one mode does not certify another unless transfer rule permits."
test("certifying one reading-purpose mode never certifies another unless a transfer rule permits it", async ({ page }) => {
  await page.goto("/personal-reading-model-demo");
  const modes = page.getByTestId("reading-purpose-profiles");

  await expect(modes.getByTestId("mode-normal-crr")).toHaveText("normal: 0");
  await expect(modes.getByTestId("mode-study-crr")).toHaveText("study: 0");

  await modes.getByTestId("certify-study-mode").click();

  await expect(modes.getByTestId("mode-study-crr")).toHaveText("study: 240");
  await expect(modes.getByTestId("mode-normal-crr")).toHaveText("normal: 0");
  await expect(modes.getByTestId("mode-story-crr")).toHaveText("story: 0");

  await modes.getByTestId("certify-story-mode-with-transfer").click();

  await expect(modes.getByTestId("mode-story-crr")).toHaveText("story: 320");
  await expect(modes.getByTestId("mode-normal-crr")).toHaveText("normal: 320");
});
