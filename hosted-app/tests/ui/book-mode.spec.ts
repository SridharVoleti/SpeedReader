import { expect, test } from "@playwright/test";

// SR-R10-001: Book Challenge.
// "Challenge resumes/completes; total valid time/words reconcile with block records."
test("a book challenge resumes across reading blocks and reconciles total valid time/words with the block records", async ({
  page
}) => {
  await page.goto("/book-mode-demo");
  const challenge = page.getByTestId("book-challenge");

  await expect(challenge.getByTestId("challenge-status")).toHaveText("Status: NOT_STARTED");
  await expect(challenge.getByTestId("total-valid-words")).toHaveText("Total valid words: 0 / 1000");

  await challenge.getByTestId("add-reading-block").click();
  await expect(challenge.getByTestId("challenge-status")).toHaveText("Status: IN_PROGRESS");
  await expect(challenge.getByTestId("total-valid-words")).toHaveText("Total valid words: 400 / 1000");
  await expect(challenge.getByTestId("total-valid-seconds")).toHaveText("Total valid seconds: 300");

  await challenge.getByTestId("add-reading-block").click(); // resumed later
  await expect(challenge.getByTestId("total-valid-words")).toHaveText("Total valid words: 800 / 1000");
  await expect(challenge.getByTestId("challenge-status")).toHaveText("Status: IN_PROGRESS");

  await challenge.getByTestId("add-reading-block").click();
  await expect(challenge.getByTestId("challenge-status")).toHaveText("Status: COMPLETED");
  await expect(challenge.getByTestId("total-valid-words")).toHaveText("Total valid words: 1000 / 1000");
  await expect(challenge.getByTestId("total-valid-seconds")).toHaveText("Total valid seconds: 700");
});

// SR-R10-002: Book ETA (TC-R10-002-B: peak=350, sustainable=250, known words -> uses 250 WPM).
// "ETA uses configured book-rate source; peak CRR alone cannot override it."
test("the ETA uses the configured sustainable rate, not the higher peak CRR, unless explicitly switched", async ({ page }) => {
  await page.goto("/book-mode-demo");
  const eta = page.getByTestId("book-eta");

  await expect(eta.getByTestId("eta-rate-source")).toHaveText("Rate source: sustainable");
  await expect(eta.getByTestId("eta-wpm-used")).toHaveText("WPM used: 250");
  await expect(eta.getByTestId("eta-minutes")).toHaveText("Estimated minutes: 20");

  await eta.getByTestId("toggle-rate-source").click();

  await expect(eta.getByTestId("eta-rate-source")).toHaveText("Rate source: peak_crr");
  await expect(eta.getByTestId("eta-wpm-used")).toHaveText("WPM used: 350");
});

// SR-R10-003: Section mental-model checks.
// "Test section/chapter understanding without over-testing every paragraph."
// "Checkpoint links to section-level constructs/evidence and contributes independently of
//  speed."
test("only triggers a checkpoint at the section-level paragraph interval, linked to section constructs and a speed-independent score", async ({
  page
}) => {
  await page.goto("/book-mode-demo");
  const checkpoint = page.getByTestId("section-checkpoint");

  await expect(checkpoint.getByTestId("checkpoint-triggered")).toHaveText("Checkpoint triggered: no");
  await expect(checkpoint.getByTestId("checkpoint-section")).toHaveText("Checkpoint section: chapter-3");
  await expect(checkpoint.getByTestId("checkpoint-constructs")).toHaveText("Constructs assessed: main-idea, cause-effect");
  await expect(checkpoint.getByTestId("checkpoint-score")).toHaveText("Comprehension score: 80%");

  for (let i = 0; i < 4; i++) {
    await checkpoint.getByTestId("advance-paragraph").click();
  }
  await expect(checkpoint.getByTestId("paragraphs-read")).toHaveText("Paragraphs read: 4");
  await expect(checkpoint.getByTestId("checkpoint-triggered")).toHaveText("Checkpoint triggered: no");

  await checkpoint.getByTestId("advance-paragraph").click();
  await expect(checkpoint.getByTestId("paragraphs-read")).toHaveText("Paragraphs read: 5");
  await expect(checkpoint.getByTestId("checkpoint-triggered")).toHaveText("Checkpoint triggered: yes");
  // The comprehension score is unaffected regardless of when the checkpoint fires.
  await expect(checkpoint.getByTestId("checkpoint-score")).toHaveText("Comprehension score: 80%");
});

// SR-R10-004: Book-level certification (TC-R10-004-B: book fast, comprehension below gate).
// "Fast completion cannot be certified as book-level success if configured
//  comprehension/retention gates fail."
test("shows time/rate for a fast completion but withholds book-level certification when comprehension fails the gate", async ({
  page
}) => {
  await page.goto("/book-mode-demo");
  const certification = page.getByTestId("book-level-certification");

  await expect(certification.getByTestId("report-actual-minutes")).toHaveText("Actual minutes: 40");
  await expect(certification.getByTestId("report-effective-wpm")).toHaveText("Effective rate: 500 WPM");
  await expect(certification.getByTestId("report-comprehension")).toHaveText("Comprehension: 40%");
  await expect(certification.getByTestId("certification-result")).toHaveText(
    "Book-level certification: WITHHELD (COMPREHENSION_GATE_NOT_MET)"
  );

  await certification.getByTestId("raise-comprehension-score").click();

  // Time/rate remain exactly as reported before - only the gate outcome changes.
  await expect(certification.getByTestId("report-actual-minutes")).toHaveText("Actual minutes: 40");
  await expect(certification.getByTestId("report-effective-wpm")).toHaveText("Effective rate: 500 WPM");
  await expect(certification.getByTestId("certification-result")).toHaveText("Book-level certification: CERTIFIED (CERTIFIED)");
});

// SR-R10-005: 200-page goal measurement (TC-R10-005-B: 200 pages, no word count).
// "Known words use words/time; page-only input is labeled estimated using configurable
//  words/page assumption."
test("labels a page-only input as a clear estimate, and uses the exact measured word count when known words are available", async ({
  page
}) => {
  await page.goto("/book-mode-demo");
  const wordCount = page.getByTestId("page-goal-measurement");

  await expect(wordCount.getByTestId("word-count-source")).toHaveText("Source: page_estimate");
  await expect(wordCount.getByTestId("word-count-value")).toHaveText("Word count: 50000");
  await expect(wordCount.getByTestId("word-count-estimated")).toHaveText("Estimated (using 250 words/page)");

  await wordCount.getByTestId("use-measured-word-count").click();

  await expect(wordCount.getByTestId("word-count-source")).toHaveText("Source: measured");
  await expect(wordCount.getByTestId("word-count-value")).toHaveText("Word count: 52000");
  await expect(wordCount.getByTestId("word-count-estimated")).toHaveText("Measured (exact)");
});
