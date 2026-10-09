import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// APP-NFR-005 (automated part): WCAG 2.x A/AA checks on every v3 learner screen, plus keyboard/focus basics.
// This is evidence for the Babysteps accessibility QA gate, not a substitute for it.

const RIGHT = [1, 0, 2, 0];

async function newLearner(page: Page) {
  const id = `v3a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include("main").analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label}: accessibility violations`).toEqual([]);
}

async function readAndAnswer(page: Page) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
}

test("every learner screen passes automated WCAG A/AA checks", async ({ page }) => {
  test.setTimeout(120_000);
  await newLearner(page);
  await page.goto("/");
  await expect(page.getByTestId("begin-assessment")).toBeVisible();
  await audit(page, "welcome");

  await page.getByTestId("begin-assessment").click();
  await expect(page.getByTestId("reader-start")).toBeVisible();
  await audit(page, "reader (ready)");
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await audit(page, "reader (playing)");
  await page.clock.fastForward(200_000);
  await expect(page.locator("fieldset").first()).toBeVisible();
  await audit(page, "questions (unanswered)");
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
  await audit(page, "questions (answered)");
  await page.getByTestId("questions-next").click();

  for (let guard = 0; guard < 12; guard += 1) {
    const home = page.getByTestId("start-story");
    const reader = page.getByTestId("reader-start");
    await expect(home.or(reader)).toBeVisible({ timeout: 15_000 });
    if (await home.isVisible()) break;
    await readAndAnswer(page);
    await page.getByTestId("questions-next").click();
  }
  await audit(page, "home");

  await page.getByTestId("start-story").click();
  await readAndAnswer(page);
  await page.getByTestId("questions-next").click();
  await expect(page.getByTestId("explain-text")).toBeVisible();
  await audit(page, "explanation");
  await page.getByTestId("explain-text").fill("Mia has a red kite and takes it to the big hill. Ravi finds the kite stuck in a bush and carries it back.");
  await page.getByTestId("explain-send").click();
  await expect(page.getByTestId("feedback")).toBeVisible();
  await audit(page, "feedback");
  await page.getByTestId("show-bpc").click();
  await expect(page.getByTestId("bpc-text")).toBeVisible();
  await audit(page, "feedback with explanation");
  await page.getByTestId("continue").click();

  await page.getByTestId("open-news-reader").click();
  await expect(page.getByTestId("nr-pick")).toBeVisible();
  await audit(page, "news reader pick");
  await page.getByTestId("nr-pick-0").click();
  await expect(page.getByTestId("nr-listen")).toBeVisible();
  await audit(page, "news reader listen");
  await page.getByTestId("nr-ready").click();
  await expect(page.getByTestId("nr-record")).toBeVisible();
  await audit(page, "news reader read");
});

test("the problem screen is announced to assistive technology", async ({ page }) => {
  await newLearner(page);
  await page.route("**/api/v3/assessment/passage", (r) =>
    r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "CONTENT_UNAVAILABLE", message: "Your next story is being prepared. Please come back soon." }) }));
  await page.goto("/");
  await page.getByTestId("begin-assessment").click();
  await expect(page.getByRole("alert").filter({ hasText: "being prepared" })).toBeVisible();
  await audit(page, "problem");
});

test("keyboard users can answer the questions and the focus stays visible", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await page.getByTestId("begin-assessment").focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("reader-start").focus();
  await page.keyboard.press("Enter");
  await page.clock.fastForward(200_000);
  const firstRadio = page.locator("fieldset").first().locator("input[type=radio]").first();
  await firstRadio.focus();
  await page.keyboard.press("Space");
  await expect(firstRadio).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("fieldset").first().locator("input[type=radio]").nth(1)).toBeChecked();
  // every option has a programmatic label
  const unlabeled = await page.locator("fieldset input[type=radio]").evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).labels?.length === 0).length);
  expect(unlabeled).toBe(0);
});
