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

// SR-R2-004: Certification history.
// "Make every CRR change auditable." "History stores old/new CRR, qualifying attempts, rule
//  version and timestamp."
test("a CRR change is recorded as an auditable history entry with old/new CRR and qualifying forms", async ({
  page
}) => {
  await page.goto("/certification-demo");
  const history = page.getByTestId("certification-history");
  await expect(history.getByTestId("history-count")).toHaveText("History entries: 0");

  await submitWith(page, "form-a", {});
  await submitWith(page, "form-b", {});
  await expect(history.getByTestId("history-count")).toHaveText("History entries: 0");

  await submitWith(page, "form-c", {});

  await expect(history.getByTestId("history-count")).toHaveText("History entries: 1");
  await expect(history.getByTestId("history-entry-0")).toHaveText(
    "100 → 150 WPM (rule 1.0, qualifying: form-a, form-b, form-c)"
  );

  // The history survives a reload - it is a persisted audit trail, not transient UI state.
  await page.reload();
  await expect(page.getByTestId("certification-history").getByTestId("history-count")).toHaveText(
    "History entries: 1"
  );
});

// SR-R2-005: Rate states.
// "Distinguish certified, training and challenge rates."
// "UI/API never labels unconfirmed challenge rate certified; challenge failure preserves CRR."
// (TC-R2-005-A)
test("rate states distinguish training, certified and challenge, and never mislabel an unconfirmed challenge", async ({
  page
}) => {
  await page.goto("/certification-demo");
  const rates = page.getByTestId("rate-states");

  await expect(rates.getByTestId("rate-state-training")).toHaveText("80 WPM: training");
  await expect(rates.getByTestId("rate-state-certified")).toHaveText("100 WPM: certified");
  await expect(rates.getByTestId("rate-state-challenge")).toHaveText("150 WPM: challenge");

  // A failing confirmation never relabels the challenge rate as certified, and preserves the CRR.
  await submitWith(page, "form-a", { comprehensionPassed: false });
  await expect(rates.getByTestId("rate-state-challenge")).toHaveText("150 WPM: challenge");
  await expect(rates.getByTestId("rate-state-certified")).toHaveText("100 WPM: certified");

  // Once certification genuinely completes, the challenge rate reclassifies to certified.
  await submitWith(page, "form-a", {});
  await submitWith(page, "form-b", {});
  await submitWith(page, "form-c", {});

  await expect(rates.getByTestId("rate-state-certified")).toHaveText("150 WPM: certified");
});
