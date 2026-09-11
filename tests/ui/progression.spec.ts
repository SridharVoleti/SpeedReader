import { expect, test } from "@playwright/test";

test("home page shows the level map with six worlds", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Climb from 100 to 200 WPM/i })).toBeVisible();
  await expect(page.getByTestId("level-map")).toBeVisible();
  await expect(page.getByLabel(/World 1: Single Word Focus/i)).toBeVisible();
  await expect(page.getByLabel(/World 6: Six-Word Glide/i)).toBeVisible();
  await expect(page.getByTestId("levels-cleared")).toHaveText("0/36");
});

test("only the first level starts unlocked", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("level-node-1")).toBeEnabled();
  await expect(page.getByTestId("level-node-2")).toBeDisabled();
  await expect(page.getByTestId("level-node-36")).toBeDisabled();
});

test("level 1 plays the passage one word at a time at 100 WPM", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("level-node-1").click();

  await expect(page.getByRole("heading", { name: /Level 1 — 1 word at 100 WPM/i })).toBeVisible();
  await page.getByRole("button", { name: "Start reading" }).click();

  await expect(page.getByTestId("active-chunk")).toHaveText("Ravi");
  // 100 WPM = 600 ms per word; after ~1.6 s the reader should have advanced.
  await page.waitForTimeout(1600);
  await expect(page.getByTestId("active-chunk")).not.toHaveText("Ravi");
});

test("passing the comprehension check unlocks the next level", async ({ page }) => {
  // The 79-word passage plays for ~47 s at 100 WPM before the quiz appears.
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByRole("button", { name: "Start reading" }).click();

  // Wait for the 79-word passage to finish at 100 WPM (~47 s).
  await expect(page.getByTestId("quiz-answer")).toBeVisible({ timeout: 60_000 });
  await page
    .getByTestId("quiz-answer")
    .fill(
      "Ravi went to a shop and the shopkeeper gave him extra change by mistake. " +
        "He counted the money, went back, and returned the extra coins. " +
        "The story teaches that being honest matters even when nobody is watching."
    );
  await page.getByTestId("quiz-submit").click();

  await expect(page.getByTestId("level-results")).toBeVisible();
  await expect(page.getByTestId("next-level")).toBeVisible();

  await page.getByRole("button", { name: "Back to level map" }).click();
  await expect(page.getByTestId("level-node-2")).toBeEnabled();
});

test("a weak answer fails the assessment and keeps the next level locked", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByRole("button", { name: "Start reading" }).click();

  await expect(page.getByTestId("quiz-answer")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("quiz-answer").fill("I do not remember anything about it.");
  await page.getByTestId("quiz-submit").click();

  await expect(page.getByTestId("level-results")).toBeVisible();
  await expect(page.getByTestId("next-level")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await page.getByRole("button", { name: "Back to map" }).click();
  await expect(page.getByTestId("level-node-2")).toBeDisabled();
});
