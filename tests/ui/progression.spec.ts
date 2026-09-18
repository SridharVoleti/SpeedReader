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

test("read along highlights the passage one word at a time like a news reader", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByRole("button", { name: "Read along like a news reader" }).click();

  await expect(page.getByTestId("read-along")).toBeVisible();
  await expect(page.getByTestId("read-along-active-word")).toHaveText("Ravi");
  // 150 WPM = 400 ms per word; after ~1.2 s the highlight should have moved on.
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("read-along-active-word")).not.toHaveText("Ravi");

  await page.getByTestId("read-along-toggle").click();
  await expect(page.getByTestId("read-along-toggle")).toHaveText("Resume");

  await page.getByTestId("read-along-restart").click();
  await expect(page.getByTestId("read-along-active-word")).toHaveText("Ravi");

  await page.getByRole("button", { name: "Exit read along" }).click();
  await expect(page.getByRole("button", { name: "Start reading" })).toBeVisible();
});

test("speech-to-text lets a student dictate their comprehension answer", async ({ page }) => {
  test.setTimeout(120_000);

  // Stub the Web Speech API so the test is deterministic and doesn't need a real microphone.
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        (window as unknown as { __fakeRecognition: FakeSpeechRecognition }).__fakeRecognition =
          this;
      }
      stop() {
        this.onend?.();
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      FakeSpeechRecognition;
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      FakeSpeechRecognition;
  });

  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(page.getByTestId("quiz-answer")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("speech-to-text-toggle").click();
  await expect(page.getByTestId("speech-to-text-toggle")).toHaveText("⏹ Stop talking");
  await expect(page.getByTestId("listening-indicator")).toBeVisible();

  await page.evaluate(() => {
    const recognition = (
      window as unknown as { __fakeRecognition: { onresult: (event: unknown) => void } }
    ).__fakeRecognition;
    const result = Object.assign([{ transcript: "The boy returned the extra coins." }], {
      isFinal: true
    });
    recognition.onresult({ resultIndex: 0, results: [result] });
  });

  await expect(page.getByTestId("quiz-answer")).toHaveValue(/The boy returned the extra coins\./);

  await page.getByTestId("speech-to-text-toggle").click();
  await expect(page.getByTestId("speech-to-text-toggle")).toHaveText("🎤 Speak your answer");
  await expect(page.getByTestId("listening-indicator")).not.toBeVisible();
});

test("comprehension check falls back to typing when speech isn't supported", async ({ page }) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });

  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(page.getByTestId("quiz-answer")).toBeVisible({ timeout: 60_000 });

  await expect(page.getByTestId("speech-unsupported-hint")).toBeVisible();
  await expect(page.getByTestId("speech-to-text-toggle")).toHaveCount(0);
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
