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
