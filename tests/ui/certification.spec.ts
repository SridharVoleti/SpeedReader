import { expect, test } from "@playwright/test";

// SR-R2-001: Certified Reading Rate.
// "Attempting above CRR never changes CRR unless certification rule passes." (TC-R2-001-A)
test("attempting a higher WPM without passing certification never changes the CRR", async ({ page }) => {
  await page.goto("/certification-demo");

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");

  await page.getByTestId("challenge-input").fill("200");
  await page.getByTestId("attempt-fail").click();

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
  await expect(page.getByTestId("challenge-wpm")).toHaveText("Challenge WPM: 200");
});

test("passing certification raises the CRR to the challenge WPM", async ({ page }) => {
  await page.goto("/certification-demo");

  await page.getByTestId("challenge-input").fill("150");
  await page.getByTestId("attempt-pass").click();

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 150 WPM");
  await expect(page.getByTestId("challenge-wpm")).toHaveText("Challenge WPM: 150");
});

test("repeated failed attempts never accumulate into a CRR change", async ({ page }) => {
  await page.goto("/certification-demo");

  for (const wpm of ["180", "220", "300"]) {
    await page.getByTestId("challenge-input").fill(wpm);
    await page.getByTestId("attempt-fail").click();
  }

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});
