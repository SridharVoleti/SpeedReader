import { expect, test, type Page } from "@playwright/test";

// The header names the OUTCOME - "Read a 200-page book in under 3 hours - with understanding and retention." - not a
// words-per-minute figure. Speed is the means; the learner sees what a book would take today and how far along they are.

const RIGHT = [1, 0, 2, 0];
/** After six good assessment answers the learner starts missing: the assessment ends at a realistic baseline (the server measures real elapsed time, so a perfect learner would climb to the 150 ceiling). */
const WRONG_PICKS = [0, 1, 0, 1];
const HEADLINE = "Read a 200-page book in under 3 hours - with understanding and retention.";
const SPEED_WORDING = /\bWPM\b|words a minute|words per minute/i;

async function newLearner(page: Page) {
  const id = `v3o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
}

async function readAndAnswer(page: Page, picks: number[] = RIGHT) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < picks.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(picks[i]).click();
}

async function finishAssessment(page: Page) {
  await page.getByTestId("begin-assessment").click();
  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) return;
    await readAndAnswer(page, guard < 6 ? RIGHT : WRONG_PICKS);
    await page.getByTestId("questions-next").click();
  }
}

const headerText = (page: Page) => page.getByTestId("outcome-header").innerText();

test("the outcome headline leads every screen and the header never talks in words per minute", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await expect(page.getByTestId("outcome-headline")).toHaveText(HEADLINE);
  expect(await headerText(page)).not.toMatch(SPEED_WORDING);
  // before the baseline exists there is nothing to estimate yet - no invented number
  await expect(page.getByTestId("book-time-now")).toHaveCount(0);

  await page.getByTestId("begin-assessment").click();
  await expect(page.getByTestId("reader-start")).toBeVisible();
  await expect(page.getByTestId("outcome-headline")).toHaveText(HEADLINE);
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await expect(page.getByTestId("outcome-headline")).toHaveText(HEADLINE);
  await page.clock.fastForward(200_000);
  await expect(page.locator("fieldset").first()).toBeVisible();
  await expect(page.getByTestId("outcome-headline")).toHaveText(HEADLINE);
});

test("after the baseline the header shows what a 200-page book would take today, against the 3-hour goal", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await finishAssessment(page);
  const now = page.getByTestId("book-time-now");
  await expect(now).toHaveText(/^Today, a 200-page book would take you about \d+ hours?( \d+ minutes?)?\.$/);
  await expect(page.getByTestId("book-goal-line")).toContainText("Goal: under 3 hours.");
  await expect(page.getByTestId("book-goal-line")).toContainText("Every story gets you closer.");
  await expect(page.getByTestId("journey-bar")).toHaveAttribute("aria-valuenow", "0");
  expect(await headerText(page)).not.toMatch(SPEED_WORDING);
  expect(await headerText(page)).not.toMatch(/\d+\s?%/);
  // the headline is the page's one top-level heading
  await expect(page.locator("main h1")).toHaveCount(1);
});

test("earning a Level Up moves the outcome: the book takes less time and the saving is shown", async ({ page }) => {
  test.setTimeout(120_000);
  await newLearner(page);
  await page.goto("/");
  await finishAssessment(page);
  const now = page.getByTestId("book-time-now");
  const before = await now.innerText();
  const startWpm = Number(await now.getAttribute("data-wpm"));
  for (let story = 1; story <= 5; story += 1) {
    await page.getByTestId("start-story").click();
    await readAndAnswer(page);
    await page.getByTestId("questions-next").click();
    await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. The string slips so the kite flies away over the trees. Ravi finds the kite stuck in a bush and carries it back. A kind friend turns a sad day into a happy one.");
    await page.getByTestId("explain-send").click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    if (story < 5) await page.getByTestId("continue").click();
  }
  await page.getByTestId("continue").click();
  await expect(now).toHaveAttribute("data-wpm", String(startWpm + 1));
  expect(await now.innerText()).not.toBe(before);
  await expect(page.getByTestId("book-goal-line")).toContainText("You have already saved about");
  expect(await headerText(page)).not.toMatch(SPEED_WORDING);
});

test("the headline also shows when a story cannot be loaded, and stays free of internal wording", async ({ page }) => {
  await newLearner(page);
  await page.route("**/api/v3/assessment/passage", (r) =>
    r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "CONTENT_UNAVAILABLE", message: "Your next story is being prepared. Please come back soon." }) }));
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  await expect(page.getByTestId("problem")).toBeVisible();
  await expect(page.getByTestId("outcome-headline")).toHaveText(HEADLINE);
});

test("the header fits the viewport at every width and the headline stays readable", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await noHScroll();
  const size = await page.getByTestId("outcome-headline").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(20);
  await finishAssessment(page);
  await noHScroll();
});
