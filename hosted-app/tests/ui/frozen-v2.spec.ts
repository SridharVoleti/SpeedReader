import { expect, test } from "@playwright/test";

// v2.0 Final Frozen Requirements - one assertion block per implemented FR.
test("FR-001 five Worlds, everyone starts in World 1", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-001")).toHaveText(
    "1:VERY SIMPLE | 2:SIMPLE | 3:MEDIUM | 4:HARD | 5:VERY HARD; every learner starts in World 1"
  );
});

test("FR-002 World 2+ strategy direction", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  const text = await page.getByTestId("result-FR-002").textContent();
  expect(text).toContain("W2=skimming+scanning+keywords+locating-information-quickly");
  expect(text).toContain("W5=skimming+scanning+chunking+selective-deep-reading-by-purpose");
});
