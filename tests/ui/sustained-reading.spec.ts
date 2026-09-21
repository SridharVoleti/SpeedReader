import { expect, test } from "@playwright/test";

// SR-R7-001: Duration-band measurement.
// "Attempt identifies duration band and rate/comprehension over full valid interval."
test("identifies duration band and rate/comprehension over the full valid interval, unaffected by a technical interruption", async ({
  page
}) => {
  await page.goto("/sustained-reading-demo");
  const measurement = page.getByTestId("duration-band-measurement");

  await expect(measurement.getByTestId("duration-band")).toHaveText("Duration band: SHORT");
  await expect(measurement.getByTestId("sustained-wpm")).toHaveText("Sustained WPM: 120");
  await expect(measurement.getByTestId("comprehension-rate")).toHaveText("Comprehension rate: 90%");
  await expect(measurement.getByTestId("interruption-state")).toHaveText("Interruption segment: absent");

  await measurement.getByTestId("toggle-interruption").click();

  await expect(measurement.getByTestId("interruption-state")).toHaveText("Interruption segment: present");
  await expect(measurement.getByTestId("duration-band")).toHaveText("Duration band: SHORT");
  await expect(measurement.getByTestId("sustained-wpm")).toHaveText("Sustained WPM: 120");
  await expect(measurement.getByTestId("comprehension-rate")).toHaveText("Comprehension rate: 90%");
});

// SR-R7-002: Sustainable Reading Rate (TC-R7-002-B: "Peak vs sustainable").
// "Short CRR increase does not raise sustainable rate without its own evidence gates."
test("maintains the sustainable rate separately from the short-passage CRR", async ({ page }) => {
  await page.goto("/sustained-reading-demo");
  const rate = page.getByTestId("sustainable-reading-rate");

  await expect(rate.getByTestId("crr-value")).toHaveText("Short-passage CRR: 240");
  await expect(rate.getByTestId("sustainable-wpm-value")).toHaveText("Sustainable rate: 240");

  await rate.getByTestId("certify-short-crr").click();

  await expect(rate.getByTestId("crr-value")).toHaveText("Short-passage CRR: 300");
  await expect(rate.getByTestId("sustainable-wpm-value")).toHaveText("Sustainable rate: 240");

  await rate.getByTestId("record-sustained-attempt").click();

  await expect(rate.getByTestId("sustainable-wpm-value")).toHaveText("Sustainable rate: 260");
  await expect(rate.getByTestId("crr-value")).toHaveText("Short-passage CRR: 300");
});

// SR-R7-003: Fatigue/stability indicators.
// "Synthetic histories crossing thresholds produce FATIGUE_RISK/STABILITY_DROP; stable
//  histories do not."
test("a stable history produces no fatigue signals, and a degrading history produces both FATIGUE_RISK and STABILITY_DROP", async ({
  page
}) => {
  await page.goto("/sustained-reading-demo");
  const fatigue = page.getByTestId("fatigue-stability-indicators");

  await expect(fatigue.getByTestId("fatigue-risk")).toHaveText("Fatigue risk: none");
  await expect(fatigue.getByTestId("stability-drop")).toHaveText("Stability drop: none");
  await expect(fatigue.getByTestId("fatigue-signals")).toHaveText("Signals: none");

  await fatigue.getByTestId("toggle-degrading-history").click();

  await expect(fatigue.getByTestId("fatigue-risk")).toHaveText("Fatigue risk: FATIGUE_RISK");
  await expect(fatigue.getByTestId("stability-drop")).toHaveText("Stability drop: STABILITY_DROP");
  await expect(fatigue.getByTestId("fatigue-signals")).toHaveText("Signals: FATIGUE_RISK, STABILITY_DROP");
});
