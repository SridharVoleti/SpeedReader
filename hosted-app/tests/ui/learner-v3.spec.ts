import { expect, test, type Page } from "@playwright/test";

// The production learner journey on the v3 engine (AC-A18): "/" is the real product, not the legacy demo.
// The e2e server serves a labelled fixture story (diagnostics + SR_CONTENT=fixture). The browser clock is faked so a
// ~100 second story can be read in milliseconds without changing any timing logic.

const RIGHT = [1, 0, 2, 0];
/** After six good assessment answers the learner starts missing: the assessment ends at a realistic baseline (the server measures real elapsed time, so a perfect learner would climb to the 150 ceiling). */
const WRONG_PICKS = [0, 1, 0, 1];
const WRONG = [0, 1, 0, 1];
const FORBIDDEN = /NOT_GREEN|\bGREEN\b|\bPASS(ED)?\b|\bFAIL(ED)?\b|\bscore\b|\bpercent|\d+\s?%|threshold|classification|attemptId|\bwrong\b/i;

async function newLearner(page: Page) {
  const id = `v3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
  return id;
}

/** Read the current story to the end, then answer its four questions. */
async function readAndAnswer(page: Page, picks: number[]) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < picks.length; i += 1) {
    await page.locator("fieldset").nth(i).locator("label").nth(picks[i]).click();
  }
}

async function noInternalLeak(page: Page) {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(FORBIDDEN);
}

async function completeAssessment(page: Page, picks = RIGHT) {
  await page.getByTestId("begin-assessment").click();
  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) return;
    await readAndAnswer(page, guard < 6 ? picks : WRONG_PICKS);
    await page.getByTestId("questions-next").click();
  }
  throw new Error("assessment did not finish");
}

test("a new learner finds their speed, reads a story, tells it, gets feedback and the explanation", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await expect(page.getByTestId("begin-assessment")).toBeVisible();
  await noInternalLeak(page);
  await completeAssessment(page);

  // the baseline speed is shown in the learner's own words
  const badge = page.getByTestId("book-time-now");
  await expect(badge).toHaveText(/Today, a 200-page book would take you about/);
  const startSpeed = Number(await badge.getAttribute("data-wpm"));
  const timeAtStart = await badge.innerText();
  expect(startSpeed).toBeGreaterThanOrEqual(60);
  expect(startSpeed).toBeLessThanOrEqual(150);
  await noInternalLeak(page);

  // first canonical story: one word at a time, from the first word
  await page.getByTestId("start-story").click();
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toHaveText("Mia");
  await page.clock.fastForward(200_000);
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
  await page.getByTestId("questions-next").click();
  await expect(page.getByTestId("explain-text")).toBeVisible();
  await noInternalLeak(page);
  await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.");
  await page.getByTestId("explain-send").click();

  await expect(page.getByTestId("feedback")).toBeVisible();
  await expect(page.getByTestId("feedback-message")).not.toBeEmpty();
  await noInternalLeak(page);
  await page.getByTestId("show-bpc").click();
  await expect(page.getByTestId("bpc-text")).toContainText("kite");
  await noInternalLeak(page);

  await page.getByTestId("continue").click();
  await expect(page.getByTestId("start-story")).toBeVisible();
  await expect(badge).toHaveText(timeAtStart); // one story does not change the earned speed (or the book time)
});

test("a weak answer is met with encouragement: no failure language, the speed is never lowered, the next story is open", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await completeAssessment(page);
  const before = await page.getByTestId("book-time-now").innerText();
  await page.getByTestId("start-story").click();
  await readAndAnswer(page, WRONG);
  await page.getByTestId("questions-next").click();
  await page.getByTestId("explain-text").fill("I like cricket.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await noInternalLeak(page);
  await expect(page.getByTestId("new-speed")).toHaveCount(0);
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("start-story")).toBeVisible();
  await expect(page.getByTestId("book-time-now")).toHaveText(before);
});

test("five good stories earn a celebrated Level Up with the new speed and book-time impact", async ({ page }) => {
  test.setTimeout(120_000);
  await newLearner(page);
  await page.goto("/");
  await completeAssessment(page);
  const startSpeed = Number(await page.getByTestId("book-time-now").getAttribute("data-wpm"));
  const timeBefore = await page.getByTestId("book-time-now").innerText();
  for (let story = 1; story <= 5; story += 1) {
    await page.getByTestId("start-story").click();
    await readAndAnswer(page, RIGHT);
    await page.getByTestId("questions-next").click();
    await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.");
    await page.getByTestId("explain-send").click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    if (story < 5) await page.getByTestId("continue").click();
  }
  await expect(page.getByTestId("feedback-message")).toHaveText("You Levelled Up!");
  await expect(page.getByTestId("new-speed")).toHaveText(`Your new speed: ${startSpeed + 1} words a minute`);
  await expect(page.getByTestId("book-time")).toContainText("50,000-word book");
  await noInternalLeak(page);
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("book-time-now")).toHaveAttribute("data-wpm", String(startSpeed + 1));
  expect(await page.getByTestId("book-time-now").innerText()).not.toBe(timeBefore); // the outcome moved: the book now takes less time
  await expect(page.getByTestId("book-goal-line")).toContainText("You have already saved about");
});

test("missing stories are explained kindly, never as an error page", async ({ page }) => {
  await newLearner(page);
  await page.route("**/api/v3/assessment/passage", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "CONTENT_UNAVAILABLE", message: "Your next story is being prepared. Please come back soon." }) }));
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  await expect(page.getByTestId("problem")).toContainText("being prepared");
  await noInternalLeak(page);
});

test("a hidden tab pauses the reader, resuming continues from the same word, and nothing completes by itself", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  await page.getByTestId("reader-start").click();
  await page.clock.runFor(3_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("reader-resume")).toBeVisible();
  const frozen = await page.getByTestId("reader-word").innerText();
  await page.clock.fastForward(500_000); // time passes while hidden
  await expect(page.getByTestId("reader-word")).toHaveText(frozen);
  await expect(page.getByTestId("questions-next")).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
  await page.getByTestId("reader-resume").click();
  await page.clock.fastForward(200_000);
  await expect(page.locator("fieldset").first()).toBeVisible();
});

test("layout works at the current viewport: no sideways scroll and comfortable touch targets", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await noHScroll();
  const begin = page.getByTestId("begin-assessment");
  const box = (await begin.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  await begin.click();
  await expect(page.getByTestId("reader-start")).toBeVisible();
  await noHScroll();
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await noHScroll();
  await page.clock.fastForward(200_000);
  await noHScroll();
  const option = (await page.locator("fieldset").first().locator("label").first().boundingBox())!;
  expect(option.height).toBeGreaterThanOrEqual(44);
});

test("the whole first step is keyboard-operable with a visible focus", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await page.getByTestId("begin-assessment").focus();
  await expect(page.getByTestId("begin-assessment")).toBeFocused();
  const outline = await page.getByTestId("begin-assessment").evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(["auto", "solid"]).toContain(outline);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("reader-start")).toBeVisible();
  await page.getByTestId("reader-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("reader-word")).toBeVisible();
});

test("the legacy demo is no longer the home page", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await expect(page.locator("main")).not.toContainText(/Climb from 100 to 200 WPM|Six worlds|thirty-six levels/i);
  await expect(page.getByTestId("level-node-1")).toHaveCount(0);
});
