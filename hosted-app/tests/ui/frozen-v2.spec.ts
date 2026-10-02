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

test("FR-006 length increase takes precedence over a same-passage Level Up", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-006")).toHaveText(
    "P151 at 125w 90WPM (level-up deferred=true); P161 at 125w 91WPM (level-up applied=true)"
  );
});

test("FR-007 AC-53R replaces AC-53", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-007")).toHaveText(
    "36 transitions; sample PASS; no data INSUFFICIENT_EVIDENCE; AC-53 superseded=true"
  );
});

test("FR-008 ten-minute initial assessment finds a sustainable starting WPM", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-008")).toHaveText(
    "limit 95 -> start 90 WPM in 10 attempts; limit 45 -> start 40 WPM; budget 600s"
  );
});

test("FR-009 progress is personal, never peer-compared", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-009")).toHaveText(
    "learner A 40->42 (+2); learner B 110->113 (+3); peer comparison rejected=true"
  );
});

test("FR-010 World 1 speed ceiling", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-010")).toHaveText(
    "max 150 WPM; 151 schedulable=false; clamp(180)=150; at 150 other development continues=true"
  );
});
