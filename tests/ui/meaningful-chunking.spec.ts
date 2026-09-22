import { expect, test } from "@playwright/test";

// SR-R9-001: Meaningful chunk schema.
// "Rendered chunks concatenate to source exactly; chunk sizes may vary." (TC-R9-001-B: exact
//  source token sequence, no omission/duplication.)
test("variable-size authored chunks reproduce the source exactly, and a schema with a gap does not", async ({ page }) => {
  await page.goto("/meaningful-chunking-demo");
  const schema = page.getByTestId("chunk-schema");

  await expect(schema.getByTestId("rendered-chunks")).toHaveText(
    "Rendered chunks: The quick | brown | fox jumps over | the lazy dog"
  );
  await expect(schema.getByTestId("chunk-sizes")).toHaveText("Chunk sizes: 2, 1, 3, 3");
  await expect(schema.getByTestId("reproduces-source")).toHaveText("Reproduces source exactly: yes");

  await schema.getByTestId("toggle-invalid-schema").click();

  await expect(schema.getByTestId("reproduces-source")).toHaveText("Reproduces source exactly: no");
});

// SR-R9-002: Flexible span progression (TC-R9-002-B: certified L2, challenge L3, fail
// comprehension).
// "Failed comprehension at larger span cannot raise certified span."
test("a failed comprehension attempt at a larger span never raises the certified span, but a passing one does", async ({
  page
}) => {
  await page.goto("/meaningful-chunking-demo");
  const span = page.getByTestId("flexible-span-progression");

  await expect(span.getByTestId("certified-span")).toHaveText("Certified span: L2");

  await span.getByTestId("fail-span-challenge").click();

  await expect(span.getByTestId("certified-span")).toHaveText("Certified span: L2");
  await expect(span.getByTestId("challenge-span")).toHaveText("Challenge span: L3");

  await span.getByTestId("pass-span-challenge").click();

  await expect(span.getByTestId("certified-span")).toHaveText("Certified span: L3");
});
