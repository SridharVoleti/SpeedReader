import { expect, test } from "@playwright/test";

test("home page shows the level map with six worlds", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Climb from 100 to 200 WPM/i })).toBeVisible();
  await expect(page.getByTestId("level-map")).toBeVisible();
  await expect(page.getByLabel(/World 1: Single Word Focus/i)).toBeVisible();
  await expect(page.getByLabel(/World 6: Six-Word Glide/i)).toBeVisible();
  await expect(page.getByTestId("levels-cleared")).toHaveText("0/36");
});

// SR-R1-013: Persist learner progress.
// "Reload restores same learner state/history and never exposes another learner's state."
test("learner progress is scoped by BabySteps identity and never leaks between learners", async ({ page }) => {
  await page.goto("/");

  async function setLearnerCookie(learnerId: string, displayName: string) {
    await page.evaluate(
      ({ learnerId, displayName }) => {
        const value = encodeURIComponent(JSON.stringify({ learnerId, displayName, avatarId: null }));
        document.cookie = `speedreader_learner=${value}; path=/`;
      },
      { learnerId, displayName }
    );
  }

  await setLearnerCookie("learner-a", "Aanya");
  await page.reload();
  await expect(page.getByTestId("levels-cleared")).toHaveText("0/36");

  // Simulate learner-a having already passed level 1 on a prior visit.
  await page.evaluate(() => {
    window.localStorage.setItem(
      "speedreader-progress-v1:learner-a",
      JSON.stringify({
        "1": { bestScore: 100, stars: 3, passed: true, completedAt: new Date().toISOString(), attemptId: "test-a" }
      })
    );
  });
  await page.reload();
  await expect(page.getByTestId("levels-cleared")).toHaveText("1/36");
  await expect(page.getByTestId("level-node-2")).toBeEnabled();

  // A different learner identity on the same device must never see learner-a's progress.
  await setLearnerCookie("learner-b", "Bilal");
  await page.reload();
  await expect(page.getByTestId("levels-cleared")).toHaveText("0/36");
  await expect(page.getByTestId("level-node-2")).toBeDisabled();

  // Switching back to learner-a restores exactly their own state.
  await setLearnerCookie("learner-a", "Aanya");
  await page.reload();
  await expect(page.getByTestId("levels-cleared")).toHaveText("1/36");
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

  // SR-R1-001: the deterministic plan and the actually-elapsed reading time are both recorded.
  const timing = await page.evaluate(() => {
    const raw = window.localStorage.getItem("speedreader-progress-v1");
    return raw ? JSON.parse(raw)["1"]?.lastReadingTiming : null;
  });
  expect(timing).toMatchObject({
    target_wpm: 100,
    words_per_chunk: 1,
    ms_per_chunk: 600
  });
  expect(timing.planned_duration_ms).toBeGreaterThan(0);
  expect(timing.actual_duration_ms).toBeGreaterThan(0);

  // SR-R1-013: every recorded attempt carries a unique attempt_id.
  const attemptId = await page.evaluate(() => {
    const raw = window.localStorage.getItem("speedreader-progress-v1");
    return raw ? JSON.parse(raw)["1"]?.attemptId : null;
  });
  expect(attemptId).toBeTruthy();

  await page.getByRole("button", { name: "Back to level map" }).click();
  await expect(page.getByTestId("level-node-2")).toBeEnabled();

  // SR-R1-013: reload restores the same learner state - level 2 stays unlocked and the pass
  // record survives, without replaying the reading/quiz flow.
  await page.reload();
  await expect(page.getByTestId("level-node-2")).toBeEnabled();
  await expect(page.getByTestId("levels-cleared")).toHaveText("1/36");
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
