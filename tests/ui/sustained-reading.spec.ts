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
