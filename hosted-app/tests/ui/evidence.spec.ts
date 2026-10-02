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

// SR-R3-002: File-based semantic equivalence.
// "Gold paraphrases/short child responses map to same proposition result/credit."
test("a gold paraphrase and a short child response in the same equivalence group get equivalent credit", async ({
  page
}) => {
  await page.goto("/evidence-demo");
  const demo = page.getByTestId("equivalence-demo");

  await expect(demo.getByTestId("gold-response-result")).toContainText("matched (group eq-honesty)");
  await expect(demo.getByTestId("child-response-result")).toContainText("matched (group eq-honesty)");
  await expect(demo.getByTestId("equivalence-outcome")).toHaveText("equivalent credit");
});

// SR-R3-003: Partial evidence classes.
// "Distinguish complete, partial/minimal, contradicted, irrelevant, no-evidence and
//  uninterpretable where configured."
test("the live evidence class reflects each gold case as the response text changes", async ({ page }) => {
  await page.goto("/evidence-demo");
  const evidenceClass = page.getByTestId("evidence-class");
  const responseText = page.getByTestId("response-text");

  await responseText.fill("He returned the extra change because the shopkeeper made a mistake.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): complete");

  await responseText.fill("Ravi returned the extra change to the shop.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): partial");

  await responseText.fill("Ravi kept the extra change and said nothing.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): contradicted");

  await responseText.fill("Ravi liked going to the market with his friends every day.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): irrelevant");

  await responseText.fill("He went.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): no_evidence");

  await responseText.fill("I don't know what happened in the story honestly.");
  await expect(evidenceClass).toHaveText("Evidence class (SR-R3-003): uninterpretable");
});

// SR-R3-004: Interpretability safety (TC-R3-004-B: "Ambiguous answer").
// "Configured ambiguous/uninterpretable response returns SCORING_UNCERTAIN/UNINTERPRETABLE and
//  reassessment."
test("an ambiguous response is scored SCORING_UNCERTAIN with reassessment needed, never a plain failure", async ({
  page
}) => {
  await page.goto("/evidence-demo");
  const responseText = page.getByTestId("response-text");
  const decision = page.getByTestId("scoring-decision");

  await responseText.fill("I don't know what happened in the story honestly.");
  await expect(decision).toHaveText("Scoring decision (SR-R3-004): SCORING_UNCERTAIN (reassessment needed)");

  // A genuine failure (contradiction) is scored normally, not flagged uncertain.
  await responseText.fill("Ravi kept the extra change and said nothing.");
  await expect(decision).toHaveText("Scoring decision (SR-R3-004): SCORED");
});

// SR-R3-005: Expanded construct ontology.
// "Each construct has executable evidence definition and construct-level reporting."
test("construct-level reporting shows matched/total per construct as the response changes", async ({ page }) => {
  await page.goto("/evidence-demo");
  const responseText = page.getByTestId("response-text");

  await responseText.fill("He returned the extra change because the shopkeeper made a mistake.");
  await expect(page.getByTestId("construct-summary-main_idea")).toHaveText("main_idea: 1/1");
  await expect(page.getByTestId("construct-summary-detail")).toHaveText("detail: 1/1");

  await responseText.fill("Ravi returned the extra change to the shop.");
  await expect(page.getByTestId("construct-summary-main_idea")).toHaveText("main_idea: 1/1");
  await expect(page.getByTestId("construct-summary-detail")).toHaveText("detail: 0/1");
});

// SR-R3-006: Scorer gold corpus (TC-R3-006-B: "Gold mismatch").
// "Content cannot become APPROVED unless all required gold cases match expected scorer outcomes."
test("a full gold corpus approves content, and one deliberate mismatch blocks approval and reports the failing case", async ({
  page
}) => {
  await page.goto("/evidence-demo");
  const demo = page.getByTestId("gold-corpus-demo");

  await expect(demo.getByTestId("gold-corpus-passing-result")).toHaveText("Full gold corpus: APPROVED");
  await expect(demo.getByTestId("gold-corpus-mismatched-result")).toHaveText(
    "Corpus with one deliberate mismatch: blocked (failing: gc-contradiction)"
  );
});
