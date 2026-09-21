import { expect, test } from "@playwright/test";

// SR-R3-001: Evidence proposition schema.
// "Schema validates references; scorer maps authored variants deterministically."
test("an authored accepted expression variant matches the proposition", async ({ page }) => {
  await page.goto("/evidence-demo");

  await expect(page.getByTestId("proposition-mandatory")).toHaveText("Mandatory");

  await page.getByTestId("response-text").fill("He returned the extra change to the shopkeeper.");
  await expect(page.getByTestId("match-result")).toHaveText("matched");
});

test("a different authored expression variant for the same proposition also matches", async ({ page }) => {
  await page.goto("/evidence-demo");

  await page.getByTestId("response-text").fill("He gave back the extra money.");
  await expect(page.getByTestId("match-result")).toHaveText("matched");
});

test("an unrelated response shows no evidence, and a contradiction is flagged distinctly", async ({ page }) => {
  await page.goto("/evidence-demo");

  await page.getByTestId("response-text").fill("He went home and had dinner.");
  await expect(page.getByTestId("match-result")).toHaveText("no evidence");

  await page.getByTestId("response-text").fill("He kept the extra change for himself.");
  await expect(page.getByTestId("match-result")).toHaveText("contradicted");
});
