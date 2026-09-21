import { expect, test } from "@playwright/test";

// SR-R2-001: Certified Reading Rate.
// "Attempting above CRR never changes CRR unless certification rule passes." (TC-R2-001-A)
// SR-R2-002: Independent confirmation.
// "One success cannot certify when confirmations>1; same form/version cannot count repeatedly as
//  independent." (TC-R2-002-B: "Duplicate form cannot confirm")
test("a single passing attempt never certifies when more than one confirmation is required", async ({ page }) => {
  await page.goto("/certification-demo");

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/3");

  await page.getByTestId("form-id-input").fill("form-a");
  await page.getByTestId("confirmation-pass").click();

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 1/3");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});

test("passing the same form/version repeatedly never counts as independent confirmations (TC-R2-002-B)", async ({
  page
}) => {
  await page.goto("/certification-demo");

  await page.getByTestId("form-id-input").fill("form-a");
  await page.getByTestId("confirmation-pass").click();
  await page.getByTestId("confirmation-pass").click();
  await page.getByTestId("confirmation-pass").click();

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 1/3");
  await expect(page.getByTestId("confirmed-forms")).toHaveText("Confirmed forms: form-a");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});

test("certifies once enough distinct forms independently pass, and never from a failed attempt", async ({
  page
}) => {
  await page.goto("/certification-demo");

  // A failing attempt on a fresh form never counts.
  await page.getByTestId("form-id-input").fill("form-x");
  await page.getByTestId("confirmation-fail").click();
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/3");

  await page.getByTestId("form-id-input").fill("form-a");
  await page.getByTestId("confirmation-pass").click();
  await page.getByTestId("form-id-input").fill("form-b");
  await page.getByTestId("confirmation-pass").click();
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");

  await page.getByTestId("form-id-input").fill("form-c");
  await page.getByTestId("confirmation-pass").click();

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 3/3");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 150 WPM");
});
