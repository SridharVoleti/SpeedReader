import { expect, test, type Page } from "@playwright/test";

// Speech paths and real-time cadence for the v3 learner journey (APP-COMP-010/011, APP-NFR-002/003/004, APP-NFR-009).

const RIGHT = [1, 0, 2, 0];
const FORBIDDEN = /NOT_GREEN|\bGREEN\b|\bPASS(ED)?\b|\bFAIL(ED)?\b|\bscore\b|\bpercent|\d+\s?%|threshold|classification|attemptId|\bwrong\b/i;

async function newLearner(page: Page, fakeClock = true) {
  const id = `v3s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  if (fakeClock) await page.clock.install();
}

async function readAndAnswer(page: Page) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
}

async function reachExplanation(page: Page) {
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
}

async function noInternalLeak(page: Page) {
  expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
}

test("the reader holds its configured cadence in real time", async ({ page }) => {
  test.setTimeout(60_000);
  await newLearner(page, false);
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  await page.evaluate(() => {
    const w = window as unknown as { __changes: number[] };
    w.__changes = [];
    new MutationObserver(() => { w.__changes.push(performance.now()); }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByTestId("reader-start").click();
  await page.waitForTimeout(7500);
  const changes = await page.evaluate(() => (window as unknown as { __changes: number[] }).__changes);
  // the first assessment story is read at 60 WPM = 1000 ms per word; keep only the word-change mutations
  const gaps = changes.slice(1).map((t, i) => t - changes[i]).filter((g) => g > 500 && g < 1500);
  expect(gaps.length).toBeGreaterThanOrEqual(4);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  expect(Math.abs(mean - 1000)).toBeLessThan(60);
  expect(Math.max(...gaps.map((g) => Math.abs(g - 1000)))).toBeLessThan(250);
});

test("spoken explanation: the transcript is editable before sending and the story is accepted", async ({ page }) => {
  await newLearner(page);
  await page.addInitScript(() => {
    class FakeRec {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror: (() => void) | null = null; onend: (() => void) | null = null;
      start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: "mia has a red kite and ravi finds the kite stuck in a bush", confidence: 0.83 }]] }); this.onend?.(); }, 30); }
      stop() {}
    }
    // modern Chromium exposes both names, and the unprefixed one wins: override both
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: FakeRec });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: FakeRec });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
  });
  await page.goto("/");
  await reachExplanation(page);
  await expect(page.getByTestId("explain-speak")).toBeVisible();
  await page.getByTestId("explain-speak").click();
  await expect(page.getByTestId("explain-speak")).toHaveText("Listening..."); // mic granted and recognizer started
  await page.clock.runFor(100);
  await expect(page.getByTestId("explain-text")).toHaveValue(/ravi finds the kite/);
  await expect(page.locator("main")).toContainText("You can fix any words before you send it.");
  await page.getByTestId("explain-text").fill("Mia has a red kite and Ravi finds the kite stuck in a bush and brings it back.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await noInternalLeak(page);
});

test("a denied microphone is not a failure: the learner types instead and carries on", async ({ page }) => {
  await newLearner(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, writable: true, value: class { start() {} stop() {} } });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, writable: true, value: class { start() {} stop() {} } });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); } } });
  });
  await page.goto("/");
  await reachExplanation(page);
  await page.getByTestId("explain-speak").click();
  await expect(page.getByRole("status").filter({ hasText: "you can type your story instead" })).toBeVisible();
  await page.getByTestId("explain-text").fill("Mia lost her kite and a boy found it.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await noInternalLeak(page);
});

test("with no speech support at all the typing path is the only path and works", async ({ page }) => {
  await newLearner(page);
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>)["SpeechRecognition"] = undefined;
    (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"] = undefined;
  });
  await page.goto("/");
  await reachExplanation(page);
  await expect(page.getByTestId("explain-speak")).toHaveCount(0);
  await page.getByTestId("explain-text").fill("Mia lost her kite and a boy found it.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
});

test("a Level Up reports exactly one structured Babystep to Babysteps and nothing else", async ({ page }) => {
  test.setTimeout(120_000);
  await newLearner(page);
  const syncs: unknown[] = [];
  await page.route("**/api/babysteps-progress", (route) => {
    syncs.push(JSON.parse(route.request().postData() ?? "{}"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ synced: false, reason: "not_launched_from_babysteps" }) });
  });
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
  const start = Number((await page.getByTestId("speed-badge").innerText()).match(/\d+/)![0]);
  for (let story = 1; story <= 5; story += 1) {
    await page.getByTestId("start-story").click();
    await readAndAnswer(page);
    await page.getByTestId("questions-next").click();
    await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.");
    await page.getByTestId("explain-send").click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    if (story < 5) await page.getByTestId("continue").click();
  }
  await expect.poll(() => syncs.length).toBe(1);
  expect(syncs[0]).toEqual({
    levelKey: String(start),
    nextLevelKey: String(start + 1),
    progressSummary: { currentLevel: `${start + 1} words a minute`, efficiencyStars: 0, milestone: "You Levelled Up!", nextDestination: `${start + 2} words a minute` }
  });
});
