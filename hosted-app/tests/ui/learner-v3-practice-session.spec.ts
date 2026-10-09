import { expect, test, type Page } from "@playwright/test";

// Production V3 learner journey: familiar practice, and the child-safe states for session/device/server failures
// (issue #28: the QA suite covers practice and the resume/session error states that the product implements).

const RIGHT = [1, 0, 2, 0];
const WRONG = [0, 1, 0, 1];
const FORBIDDEN = /NOT_GREEN|\bGREEN\b|\bPASS(ED)?\b|\bFAIL(ED)?\b|\bscore\b|\bpercent|\d+\s?%|threshold|classification|attemptId|\bwrong\b|\b(401|409|429|500|503)\b|SERVER_CONFIGURATION|CONFIGURATION_ERROR|Supabase|exception/i;

async function newLearner(page: Page, id = `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`) {
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
  return id;
}

async function readAndAnswer(page: Page, picks: number[]) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < picks.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(picks[i]).click();
}

async function completeAssessment(page: Page) {
  await page.getByTestId("begin-assessment").click();
  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) return;
    // a realistic learner: reads well up to ~90 words per minute, then starts missing (the server times the assessment itself)
    await readAndAnswer(page, guard < 6 ? RIGHT : WRONG);
    await page.getByTestId("questions-next").click();
  }
  throw new Error("assessment did not finish");
}

async function noLeak(page: Page) {
  expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
}

test("familiar practice: after five stories without a Level Up the learner is offered a story they know, and nothing is lost", async ({ page }) => {
  test.setTimeout(180_000);
  await newLearner(page);
  await page.goto("/");
  await completeAssessment(page);
  const speedBefore = await page.getByTestId("book-time-now").innerText();
  for (let i = 0; i < 5; i += 1) {
    await page.getByTestId("start-story").click();
    await readAndAnswer(page, WRONG);
    await page.getByTestId("questions-next").click();
    await page.getByTestId("explain-text").fill("I like cricket.");
    await page.getByTestId("explain-send").click();
    await expect(page.getByTestId("feedback")).toBeVisible();
    await noLeak(page);
    await page.getByTestId("continue").click();
  }
  // the scheduler now offers a familiar story alongside the next new one; it is framed warmly, never as remediation
  await expect(page.getByTestId("start-practice")).toBeVisible();
  await noLeak(page);
  await page.getByTestId("start-practice").click();
  await expect(page.getByText("This is a story you already know")).toBeVisible();
  await readAndAnswer(page, RIGHT); // a known story: the questions come back as a gentle warm-up, then "Done"
  await page.getByTestId("questions-next").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await noLeak(page);
  await page.getByTestId("continue").click();
  // practice never changes the speed and the next new story is still open
  await expect(page.getByTestId("book-time-now")).toHaveText(speedBefore);
  await expect(page.getByTestId("start-story")).toBeVisible();
});

test("SpeedReader open on another device: a different device is told kindly, with no internal wording", async ({ browser }) => {
  const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const first = await (await browser.newContext()).newPage();
  await newLearner(first, id);
  await first.goto("/");
  await expect(first.getByTestId("begin-assessment")).toBeVisible();

  const second = await (await browser.newContext()).newPage(); // a separate browser profile = a different device id
  await newLearner(second, id);
  await second.goto("/");
  await expect(second.getByTestId("problem")).toContainText("already open on another device");
  await noLeak(second);
  await first.context().close();
  await second.context().close();
});

for (const [name, status, body, expected] of [
  ["weekly sessions used up", 429, { error: "WEEKLY_LIMIT_REACHED" }, "finished your reading sessions for this week"],
  ["signed out", 401, { error: "UNAUTHENTICATED" }, "open SpeedReader again from your Babysteps page"],
  ["server not configured (production safety)", 503, { error: "SERVER_CONFIGURATION", message: "This service is not available right now. Please try again later." }, "Something did not work this time"]
] as const) {
  test(`child-safe message when ${name}`, async ({ page }) => {
    await newLearner(page);
    await page.route("**/api/v3/bootstrap", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
    await page.goto("/");
    await expect(page.getByTestId("problem")).toContainText(expected);
    await noLeak(page);
  });
}

test("child-safe message when the network is down", async ({ page }) => {
  await newLearner(page);
  await page.route("**/api/v3/bootstrap", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("problem")).toContainText("could not connect");
  await noLeak(page);
});
