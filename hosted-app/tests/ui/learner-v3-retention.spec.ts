import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Retention: the "understanding and retention" in the headline is measured, not just claimed. A spaced memory check asks
// about a story read earlier, from memory, then shows a refresher. (The e2e server brings the first check forward;
// production waits ~24 hours.)

const RIGHT = [1, 0, 2, 0];
const WRONG = [0, 1, 0, 1];
const FORBIDDEN = /NOT_GREEN|\bGREEN\b|\bPASS(ED)?\b|\bFAIL(ED)?\b|\bscore\b|\bpercent|\d+\s?%|threshold|classification|attemptId|\bwrong\b/i;

async function newLearner(page: Page) {
  const id = `v3r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await page.addInitScript(([learner]) => {
    window.localStorage.setItem("sr_test_learner", learner);
    window.localStorage.setItem("sr_test_session", `S-${learner}`);
  }, [id]);
  await page.clock.install();
}

async function readAndAnswer(page: Page) {
  await page.getByTestId("reader-start").click();
  await expect(page.getByTestId("reader-word")).toBeVisible();
  await page.clock.fastForward(200_000);
  for (let i = 0; i < RIGHT.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(RIGHT[i]).click();
}

async function homeWithOneStoryRead(page: Page) {
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

// scan the interface text; the story's own question options (e.g. a kite colour) are content, not internal labels
const leak = async (page: Page) => {
  const text = await page.evaluate(() => {
    const clone = document.querySelector("main")!.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("fieldset").forEach((f) => f.remove());
    return clone.textContent ?? "";
  });
  expect(text).not.toMatch(FORBIDDEN);
};
const answer = async (page: Page, picks: number[]) => {
  for (let i = 0; i < picks.length; i += 1) await page.locator("fieldset").nth(i).locator("label").nth(picks[i]).click();
};

test("a memory check is offered after a story, asks from memory without showing the story, and a good memory shows in the header", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await homeWithOneStoryRead(page);
  await expect(page.getByTestId("retention-line")).toHaveCount(0); // nothing measured yet, so nothing claimed
  const timeBefore = await page.getByTestId("book-time-now").innerText();

  await page.getByTestId("open-retention").click();
  await expect(page.getByTestId("rt-questions")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Mia has a red kite"); // recall is from memory: the story is not shown
  await expect(page.getByTestId("reader-word")).toHaveCount(0);
  await expect(page.getByTestId("rt-send")).toBeDisabled(); // every question needs an answer
  await leak(page);
  await answer(page, RIGHT);
  await page.getByTestId("rt-send").click();

  await expect(page.getByTestId("rt-message")).toHaveText("You remember this story really well - great memory!");
  await expect(page.getByTestId("rt-refresher")).toContainText("kite"); // retrieval first, THEN the refresher
  await leak(page);
  await page.getByTestId("rt-done").click();

  await expect(page.getByTestId("start-story")).toBeVisible();
  await expect(page.getByTestId("retention-line")).toHaveText("Memory check: you remembered 1 story well after time away.");
  await expect(page.getByTestId("open-retention")).toHaveCount(0); // the next check for this story is a week away
  await expect(page.getByTestId("book-time-now")).toHaveText(timeBefore); // memory checks never change the outcome estimate
});

test("a faded memory is treated as normal: gentle message, a refresher, nothing claimed, nothing lost", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await homeWithOneStoryRead(page);
  const timeBefore = await page.getByTestId("book-time-now").innerText();
  await page.getByTestId("open-retention").click();
  await answer(page, WRONG);
  await page.getByTestId("rt-send").click();
  await expect(page.getByTestId("rt-message")).toContainText("completely normal");
  await expect(page.getByTestId("rt-refresher")).toBeVisible();
  await leak(page);
  await page.getByTestId("rt-done").click();
  await expect(page.getByTestId("start-story")).toBeVisible();
  await expect(page.getByTestId("retention-line")).toHaveCount(0); // no overclaiming
  await expect(page.getByTestId("book-time-now")).toHaveText(timeBefore);
});

test("'Not now' records nothing and the check stays available", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await homeWithOneStoryRead(page);
  await page.getByTestId("open-retention").click();
  await page.getByTestId("rt-later").click();
  await expect(page.getByTestId("open-retention")).toBeVisible();
  await expect(page.getByTestId("retention-line")).toHaveCount(0);
});

test("memory-check screens are accessible and fit the viewport", async ({ page }) => {
  await newLearner(page);
  await page.goto("/");
  await homeWithOneStoryRead(page);
  const noHScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const axe = async (label: string) => {
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include("main").analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join("|")}`), label).toEqual([]);
  };
  await axe("home with memory prompt");
  await page.getByTestId("open-retention").click();
  await expect(page.getByTestId("rt-questions")).toBeVisible();
  await noHScroll();
  await axe("memory questions");
  expect((await page.locator("fieldset").first().locator("label").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await answer(page, RIGHT);
  expect((await page.getByTestId("rt-send").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId("rt-send").click();
  await expect(page.getByTestId("rt-result")).toBeVisible();
  await noHScroll();
  await axe("memory result");
});
