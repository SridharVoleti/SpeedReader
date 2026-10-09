import { expect, test, type Page } from "@playwright/test";

// News Reader (APP-NR-001..010) in the v3 learner journey: a parallel, optional, never-blocking activity.

const RIGHT = [1, 0, 2, 0];
const STORY = "Mia has a red kite. She takes it to the big hill every Saturday. One windy morning the string slips from her hand and the kite flies away over the trees. Mia is sad, so she runs after it. A boy named Ravi sees the kite stuck in a bush and carries it back. Mia says thank you and they fly it together. When the wind gets calm, they sit on the grass and share a banana. Mia learns that a kind friend can turn a sad day into a happy one, and she waves goodbye to Ravi.";
const FORBIDDEN = /NOT_GREEN|\bGREEN\b|\bPASS(ED)?\b|\bFAIL(ED)?\b|\bscore\b|\bpercent|\d+\s?%|threshold|classification|attemptId|\bwrong\b/i;

async function newLearner(page: Page) {
  const id = `v3nr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
}

/** Fake browser speech: a female Indian-English voice and (optionally) a recognizer that "hears" the story. */
async function installSpeech(page: Page, mode: "full" | "no-mic") {
  await page.addInitScript(([mode, story]) => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: { text: string; voice?: { name: string }; rate?: number; onstart?: () => void; onend?: () => void }) => {
          spoken.push(u.text);
          (window as unknown as { __voice: string }).__voice = u.voice?.name ?? "";
          setTimeout(() => u.onstart?.(), 5);
          setTimeout(() => u.onend?.(), 250);
        },
        cancel() {}, pause() {}, resume() {},
        getVoices: () => [
          { name: "Microsoft Ravi Online (Natural)", lang: "en-IN", localService: false },
          { name: "Microsoft Neerja Online (Natural)", lang: "en-IN", localService: false }
        ],
        addEventListener() {}, removeEventListener() {}
      }
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class { text: string; voice: unknown = null; lang = ""; rate = 1; pitch = 1; volume = 1; onend = null; onerror = null; onstart = null; onboundary = null; constructor(t: string) { this.text = t; } } });
    if (mode === "no-mic") {
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); } } });
      return;
    }
    class FakeRec {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror: (() => void) | null = null; onend: (() => void) | null = null;
      start() { setTimeout(() => this.onresult?.({ results: [[{ transcript: story, confidence: 0.9 }]] }), 30); }
      stop() { setTimeout(() => this.onend?.(), 5); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: FakeRec });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: FakeRec });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  }, [mode, STORY] as const);
}

async function readAndAnswer(page: Page) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
}

async function reachHomeWithOneStoryRead(page: Page) {
  await page.getByTestId("begin-assessment").click();
  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) break;
    await readAndAnswer(page);
    await page.getByTestId("questions-next").click();
  }
  await page.getByTestId("start-story").click();
  await readAndAnswer(page);
  await page.getByTestId("questions-next").click();
  await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("start-story")).toBeVisible();
}

const leak = async (page: Page) => expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);

test("a learner with no stories yet is told to read one first", async ({ page }) => {
  await newLearner(page);
  await installSpeech(page, "full");
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) break;
    await readAndAnswer(page);
    await page.getByTestId("questions-next").click();
  }
  await expect(page.getByTestId("open-news-reader")).toHaveCount(0); // nothing read yet: no entry point
});

test("listen with a female reference voice and a read-along highlight, then read aloud twice with gentle coaching", async ({ page }) => {
  await newLearner(page);
  await installSpeech(page, "full");
  await page.goto("/");
  await reachHomeWithOneStoryRead(page);
  const speedBefore = await page.getByTestId("speed-badge").innerText();

  await page.getByTestId("open-news-reader").click();
  await expect(page.getByTestId("nr-pick")).toBeVisible();
  await page.getByTestId("nr-pick-0").click();
  await expect(page.getByTestId("nr-text")).toContainText("Mia has a red kite");

  await page.getByTestId("nr-listen").click();
  await expect(page.locator('[data-active="true"]').first()).toBeVisible(); // read-along highlight follows the narration
  // the female voice is preferred over the male one the browser also exposes
  await expect.poll(() => page.evaluate(() => (window as unknown as { __voice?: string }).__voice ?? "")).toMatch(/Neerja/);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken[0] ?? "")).toMatch(/^Mia has a red kite/);

  await page.getByTestId("nr-ready").click();
  await page.getByTestId("nr-record").click();
  await page.getByTestId("nr-finish").click();
  await expect(page.getByText("Once more, with feeling")).toBeVisible();
  await page.getByTestId("nr-record").click();
  await page.getByTestId("nr-finish").click();
  await expect(page.getByTestId("nr-done")).toBeVisible();
  await leak(page);

  await page.getByTestId("nr-exit").click();
  await expect(page.getByTestId("start-story")).toBeVisible(); // the next canonical story is still open
  await expect(page.getByTestId("speed-badge")).toHaveText(speedBefore); // earned speed is untouched
});

test("no microphone: the learner can skip recording, is thanked, and nothing else changes", async ({ page }) => {
  await newLearner(page);
  await installSpeech(page, "no-mic");
  await page.goto("/");
  await reachHomeWithOneStoryRead(page);
  const speedBefore = await page.getByTestId("speed-badge").innerText();
  await page.getByTestId("open-news-reader").click();
  await page.getByTestId("nr-pick-0").click();
  await page.getByTestId("nr-ready").click();
  await page.getByTestId("nr-record").click();
  await expect(page.getByTestId("nr-note")).toContainText("skip recording");
  await page.getByTestId("nr-skip").click();
  await page.getByTestId("nr-skip").click();
  await expect(page.getByTestId("nr-done")).toBeVisible();
  await expect(page.getByTestId("nr-coaching")).toContainText("Practising out loud");
  await leak(page);
  await page.getByTestId("nr-exit").click();
  await expect(page.getByTestId("speed-badge")).toHaveText(speedBefore);
  await expect(page.getByTestId("start-story")).toBeVisible();
});

test("layout: the News Reader screens fit the viewport with comfortable targets", async ({ page }) => {
  await newLearner(page);
  await installSpeech(page, "full");
  await page.goto("/");
  await reachHomeWithOneStoryRead(page);
  const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByTestId("open-news-reader").click();
  await noHScroll();
  await page.getByTestId("nr-pick-0").click();
  await noHScroll();
  expect((await page.getByTestId("nr-listen").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId("nr-ready").click();
  await noHScroll();
  expect((await page.getByTestId("nr-record").boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
