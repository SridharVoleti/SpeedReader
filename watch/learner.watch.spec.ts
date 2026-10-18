import { expect, test, type Page } from "@playwright/test";
import { highlight, showStep, watched, type WatchRequirement } from "./narrated-runner";

const packageUrl = "/explain?pkg=PKG-W1-0001";
const goodExplanation = "Ravi bought a pencil, a notebook, and a packet of biscuits. Ravi returned the extra coins.";

async function useTypedFallback(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
  });
}

async function answerAll(page: Page, req: WatchRequirement, option: number) {
  for (const id of ["I1", "I2", "I3", "I4"]) {
    const item = page.getByTestId(`sr-item-${id}`);
    await highlight(page, item, `Answering question ${id} with option ${option + 1}.`, req);
    await item.locator('input[type="radio"]').nth(option).check();
  }
}

test("[LIVE] FR-001 five-world requirement on actual learner home screen", async ({ page }) => {
  const req: WatchRequirement = {
    id: "FR-001", title: "Five worlds in the real learner experience",
    expected: "The child-facing home screen must reflect the frozen five-world model, not the superseded six-world demo.",
    scope: "REAL LEARNER UI"
  };
  await watched(page, req, async () => {
    await page.goto("/");
    const home = page.locator("main");
    await highlight(page, home.locator("h1"), "Checking real learner home screen against the frozen requirement.", req);
    await expect(home).not.toContainText("Six worlds, thirty-six levels");
  });
});

test("[LIVE] SR-E2E-001 complete approved passage through typed fallback", async ({ page }) => {
  const req: WatchRequirement = {
    id: "SR-E2E-001", title: "Real child completes an approved passage",
    expected: "Approved passage is displayed. All four answers and a typed explanation are required. A correct first attempt produces feedback and separate readiness statuses. Persistence must be verified by an additional dedicated test.",
    scope: "REAL LEARNER UI"
  };
  await watched(page, req, async () => {
    await useTypedFallback(page);
    await page.goto(packageUrl);
    const passage = page.getByTestId("sr-passage");
    await expect(passage).toContainText("Ravi visited a small shop");
    await highlight(page, passage, "Learner reads the approved passage.", req);
    await expect(page.getByTestId("sr-submit")).toBeDisabled();
    await answerAll(page, req, 0);
    const explanation = page.getByTestId("sr-transcript");
    await highlight(page, explanation, "Learner types a retelling in their own words.", req);
    await explanation.fill(goodExplanation);
    await showStep(page, req, "Submitting the full first attempt.");
    await page.getByTestId("sr-submit").click();
    await expect(page.getByTestId("sr-feedback")).toBeVisible();
    const score = page.getByTestId("sr-comprehension");
    await highlight(page, score, "Checking scored comprehension and first-attempt evidence.", req);
    await expect(score).toContainText("4 of 4");
    await expect(score).toContainText("first try");
    await expect(page.getByTestId("sr-readiness")).toContainText("These are tracked separately");
    await expect(page.getByTestId("sr-continue")).toBeVisible();
  });
});

test("[LIVE] SR-E2E-002 incorrect first answer, feedback and retry", async ({ page }) => {
  const req: WatchRequirement = {
    id: "SR-E2E-002", title: "Struggling learner receives a safe second chance",
    expected: "Incorrect first responses produce appropriate feedback and an optional retry. A retry is not counted as first-attempt readiness evidence.",
    scope: "REAL LEARNER UI"
  };
  await watched(page, req, async () => {
    await useTypedFallback(page);
    await page.goto(packageUrl);
    await expect(page.getByTestId("sr-passage")).toBeVisible();
    await answerAll(page, req, 1);
    await page.getByTestId("sr-transcript").fill("Something happened at a place.");
    await showStep(page, req, "Submitting an intentionally incorrect answer.");
    await page.getByTestId("sr-submit").click();
    const readiness = page.getByTestId("sr-readiness");
    await highlight(page, readiness, "Checking that weak evidence does not qualify for readiness.", req);
    await expect(readiness).toContainText("Comprehension readiness: not yet");
    await expect(page.getByTestId("sr-retry")).toBeVisible();
    await page.getByTestId("sr-retry").click();
    await answerAll(page, req, 0);
    await page.getByTestId("sr-transcript").fill(goodExplanation);
    await showStep(page, req, "Retrying after feedback.");
    await page.getByTestId("sr-submit").click();
    await expect(page.getByTestId("sr-comprehension")).toContainText("practice try");
    await expect(page.getByTestId("sr-readiness")).toContainText("not first attempt evidence");
  });
});

test("[LIVE] SR-E2E-003 invalid or unavailable package is safely rejected", async ({ page }) => {
  const req: WatchRequirement = {
    id: "SR-E2E-003", title: "Do not deliver unavailable content",
    expected: "An unknown or unapproved package must show an error instead of any passage or assessment.",
    scope: "REAL LEARNER UI"
  };
  await watched(page, req, async () => {
    await page.goto("/explain?pkg=PKG-W1-9999");
    const error = page.getByTestId("sr-error");
    await highlight(page, error, "Checking unavailable content protection.", req);
    await expect(error).toContainText("unavailable");
    await expect(page.getByTestId("sr-passage")).toHaveCount(0);
  });
});

test("[LIVE] FR-029 private numeric comprehension on real learner screen", async ({ page }) => {
  const req: WatchRequirement = {
    id: "FR-029", title: "Private comprehension numbers",
    expected: "The child sees confidence-building feedback, not a raw numeric comprehension score.",
    scope: "REAL LEARNER UI"
  };
  await watched(page, req, async () => {
    await useTypedFallback(page);
    await page.goto(packageUrl);
    await answerAll(page, req, 0);
    await page.getByTestId("sr-transcript").fill(goodExplanation);
    await page.getByTestId("sr-submit").click();
    const feedback = page.getByTestId("sr-comprehension");
    await highlight(page, feedback, "Checking that the child-facing score remains private.", req);
    await expect(feedback).not.toContainText(/\b\d+ of \d+\b/);
  });
});
