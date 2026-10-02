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

test("FR-003 1,500 canonical passages", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-003")).toHaveText(
    "1500 sequential passages, 0 structural errors; first 150 = 15 RS x 10 P"
  );
});

test("FR-004 first 150 passages are 100 words, one word at a time", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-004")).toHaveText(
    "P150 = 100 words, ONE_WORD_AT_A_TIME, RS15/P10; sample text errors 0; 100 single-word steps"
  );
});

test("FR-005 stamina staircase", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-005")).toHaveText(
    "P1=100 P151=125 P176=150 P226=200 P376=300 P1500=1000; 37 steps"
  );
});
