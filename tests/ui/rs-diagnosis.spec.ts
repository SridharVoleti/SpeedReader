import { expect, test } from "@playwright/test";

// SR-R5-001: RS competency integration.
// "Attempt evidence attributes to relevant RS without hard-coded passage IDs."
test("attempt evidence attributes to the correct RS competency for two unrelated content sets", async ({
  page
}) => {
  await page.goto("/rs-diagnosis-demo");

  await expect(page.getByTestId("attribution-level1_001-i1")).toHaveText(
    "level1_001-i1 -> RS-VOCABULARY (keyword-recognition): matched"
  );
  await expect(page.getByTestId("attribution-level1_001-i2")).toHaveText(
    "level1_001-i2 -> RS-INFERENCE (cause-effect-reasoning): not matched"
  );
  await expect(page.getByTestId("attribution-world3_042-q7")).toHaveText(
    "world3_042-q7 -> RS-FLUENCY (phrase-recognition-speed): matched"
  );
});
