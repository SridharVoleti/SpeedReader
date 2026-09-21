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
