import { expect, test } from "@playwright/test";

// SR-R1-005: Structured response types.
// "Each type can be authored/rendered/answered/scored; invalid response shapes are rejected."
// Invalid-shape rejection itself is covered at the unit level (tests/unit/item-types.test.ts) -
// the UI's own controls cannot physically produce a malformed payload, so this suite proves the
// full authored -> rendered -> answered -> scored path for each type in a real browser.

test("single choice item can be rendered, answered and scored", async ({ page }) => {
  await page.goto("/item-types-demo");
  await expect(page.getByTestId("item-types-demo")).toBeVisible();

  const item = page.getByTestId("item-demo-single-choice");
  await item.getByTestId("option-a").check();
  await item.getByTestId("check-demo-single-choice").click();
  await expect(item.getByTestId("result-demo-single-choice")).toHaveText("correct");

  await item.getByTestId("option-b").check();
  await item.getByTestId("check-demo-single-choice").click();
  await expect(item.getByTestId("result-demo-single-choice")).toHaveText("incorrect");
});

test("ordering item can be rendered, answered and scored", async ({ page }) => {
  await page.goto("/item-types-demo");
  const item = page.getByTestId("item-demo-ordering");

  await item.getByTestId("order-select-1").selectOption("1");
  await item.getByTestId("order-select-2").selectOption("2");
  await item.getByTestId("order-select-3").selectOption("3");
  await item.getByTestId("check-demo-ordering").click();
  await expect(item.getByTestId("result-demo-ordering")).toHaveText("correct");
});

test("matching item can be rendered, answered and scored", async ({ page }) => {
  await page.goto("/item-types-demo");
  const item = page.getByTestId("item-demo-matching");

  await item.getByTestId("match-select-l1").selectOption("r1");
  await item.getByTestId("match-select-l2").selectOption("r2");
  await item.getByTestId("check-demo-matching").click();
  await expect(item.getByTestId("result-demo-matching")).toHaveText("correct");
});

test("constrained short answer item can be rendered, answered and scored", async ({ page }) => {
  await page.goto("/item-types-demo");
  const item = page.getByTestId("item-demo-short-answer");

  await item.getByTestId("short-answer-text").fill("He returned the extra coins.");
  await item.getByTestId("check-demo-short-answer").click();
  await expect(item.getByTestId("result-demo-short-answer")).toHaveText("correct");

  await item.getByTestId("short-answer-text").fill("He did nothing much.");
  await item.getByTestId("check-demo-short-answer").click();
  await expect(item.getByTestId("result-demo-short-answer")).toHaveText("incorrect");
});

test("the check-answer button stays disabled until a response is given", async ({ page }) => {
  await page.goto("/item-types-demo");
  const item = page.getByTestId("item-demo-single-choice");

  await expect(item.getByTestId("check-demo-single-choice")).toBeDisabled();
  await item.getByTestId("option-a").check();
  await expect(item.getByTestId("check-demo-single-choice")).toBeEnabled();
});

// SR-R1-006: Basic constructs.
// "Identify main idea, explicit detail and sequence/relationship in item metadata."
test("every item declares and displays its primary R1 construct", async ({ page }) => {
  await page.goto("/item-types-demo");

  await expect(page.getByTestId("construct-demo-single-choice")).toHaveText("detail");
  await expect(page.getByTestId("construct-demo-ordering")).toHaveText("sequence relationship");
  await expect(page.getByTestId("construct-demo-matching")).toHaveText("detail");
  await expect(page.getByTestId("construct-demo-short-answer")).toHaveText("main idea");
});

// SR-R1-007: Mandatory gates (TC-R1-007-B: "High aggregate but main idea fails").
// "Configured mandatory gate failure prevents PASS even if aggregate threshold is exceeded;
//  reason is recorded."
test("failing the mandatory main-idea item blocks PASS even with a high aggregate score", async ({ page }) => {
  await page.goto("/item-types-demo");

  // Answer the three non-mandatory detail/sequence items correctly...
  await page.getByTestId("item-demo-single-choice").getByTestId("option-a").check();
  await page.getByTestId("item-demo-single-choice").getByTestId("check-demo-single-choice").click();

  await page.getByTestId("item-demo-ordering").getByTestId("order-select-1").selectOption("1");
  await page.getByTestId("item-demo-ordering").getByTestId("order-select-2").selectOption("2");
  await page.getByTestId("item-demo-ordering").getByTestId("order-select-3").selectOption("3");
  await page.getByTestId("item-demo-ordering").getByTestId("check-demo-ordering").click();

  await page.getByTestId("item-demo-matching").getByTestId("match-select-l1").selectOption("r1");
  await page.getByTestId("item-demo-matching").getByTestId("match-select-l2").selectOption("r2");
  await page.getByTestId("item-demo-matching").getByTestId("check-demo-matching").click();

  // ...but get the mandatory main-idea short answer wrong.
  await page.getByTestId("item-demo-short-answer").getByTestId("short-answer-text").fill("He did nothing much.");
  await page.getByTestId("item-demo-short-answer").getByTestId("check-demo-short-answer").click();

  const evaluation = page.getByTestId("comprehension-evaluation");
  await expect(evaluation).toBeVisible();
  await expect(evaluation.getByTestId("aggregate-score")).toHaveText("Aggregate score: 75%");
  await expect(evaluation.getByTestId("comprehension-state")).toHaveText("FAIL");
  await expect(evaluation.getByTestId("reason-code")).toHaveText("MANDATORY_GATE_FAILED");
});

test("PASSes overall when every item, including the mandatory one, is answered correctly", async ({ page }) => {
  await page.goto("/item-types-demo");

  await page.getByTestId("item-demo-single-choice").getByTestId("option-a").check();
  await page.getByTestId("item-demo-single-choice").getByTestId("check-demo-single-choice").click();

  await page.getByTestId("item-demo-ordering").getByTestId("order-select-1").selectOption("1");
  await page.getByTestId("item-demo-ordering").getByTestId("order-select-2").selectOption("2");
  await page.getByTestId("item-demo-ordering").getByTestId("order-select-3").selectOption("3");
  await page.getByTestId("item-demo-ordering").getByTestId("check-demo-ordering").click();

  await page.getByTestId("item-demo-matching").getByTestId("match-select-l1").selectOption("r1");
  await page.getByTestId("item-demo-matching").getByTestId("match-select-l2").selectOption("r2");
  await page.getByTestId("item-demo-matching").getByTestId("check-demo-matching").click();

  await page.getByTestId("item-demo-short-answer").getByTestId("short-answer-text").fill("He returned the extra coins.");
  await page.getByTestId("item-demo-short-answer").getByTestId("check-demo-short-answer").click();

  const evaluation = page.getByTestId("comprehension-evaluation");
  await expect(evaluation.getByTestId("comprehension-state")).toHaveText("PASS");
  await expect(evaluation.getByTestId("reason-code")).toHaveText("PASS");
});
