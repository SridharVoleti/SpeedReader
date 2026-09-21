import { expect, test } from "@playwright/test";

// SR-R2-001: Certified Reading Rate.
// "Attempting above CRR never changes CRR unless certification rule passes." (TC-R2-001-A)
// SR-R2-002: Independent confirmation.
// "One success cannot certify when confirmations>1; same form/version cannot count repeatedly as
//  independent." (TC-R2-002-B: "Duplicate form cannot confirm")
// SR-R2-003: Certification gate composition.
// "Any required gate failure blocks certification; INVALID does not count as learner failure."
// (TC-R2-003-B: "One confirmation fails comprehension")

async function submitWith(
  page: import("@playwright/test").Page,
  formId: string,
  gates: { exposureValid?: boolean; comprehensionPassed?: boolean; evidenceSufficient?: boolean }
) {
  await page.getByTestId("form-id-input").fill(formId);
  if (gates.exposureValid === false) await page.getByTestId("gate-exposure-valid").uncheck();
  else await page.getByTestId("gate-exposure-valid").check();
  if (gates.comprehensionPassed === false) await page.getByTestId("gate-comprehension-passed").uncheck();
  else await page.getByTestId("gate-comprehension-passed").check();
  if (gates.evidenceSufficient === false) await page.getByTestId("gate-evidence-sufficient").uncheck();
  else await page.getByTestId("gate-evidence-sufficient").check();
  await page.getByTestId("submit-confirmation").click();
}

test("a single passing attempt never certifies when more than one confirmation is required", async ({ page }) => {
  await page.goto("/certification-demo");

  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/3");

  await submitWith(page, "form-a", {});

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 1/3");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});

test("passing the same form/version repeatedly never counts as independent confirmations (TC-R2-002-B)", async ({
  page
}) => {
  await page.goto("/certification-demo");

  await submitWith(page, "form-a", {});
  await submitWith(page, "form-a", {});
  await submitWith(page, "form-a", {});

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 1/3");
  await expect(page.getByTestId("confirmed-forms")).toHaveText("Confirmed forms: form-a");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});

test("a comprehension gate failure blocks that confirmation and leaves the CRR intact (TC-R2-003-B)", async ({
  page
}) => {
  await page.goto("/certification-demo");

  await submitWith(page, "form-a", {});
  await submitWith(page, "form-b", {});
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 2/3");

  // A valid, non-technical comprehension failure on the third form.
  await submitWith(page, "form-c", { comprehensionPassed: false });

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 2/3");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");
});

test("an invalid-exposure attempt blocks confirmation the same as any other non-passing attempt", async ({
  page
}) => {
  await page.goto("/certification-demo");

  await submitWith(page, "form-a", { exposureValid: false });
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/3");

  await submitWith(page, "form-a", { evidenceSufficient: false });
  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 0/3");
});

test("certifies once enough distinct forms clear every gate", async ({ page }) => {
  await page.goto("/certification-demo");

  await submitWith(page, "form-a", {});
  await submitWith(page, "form-b", {});
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 100 WPM");

  await submitWith(page, "form-c", {});

  await expect(page.getByTestId("confirmation-count")).toHaveText("Confirmations: 3/3");
  await expect(page.getByTestId("certified-wpm")).toHaveText("Certified Reading Rate: 150 WPM");
});
