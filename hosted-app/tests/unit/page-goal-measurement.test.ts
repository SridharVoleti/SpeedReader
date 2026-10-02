import { describe, expect, it } from "vitest";
import { resolveWordCount } from "../../lib/book-mode";

// SR-R10-005: 200-page goal measurement.
// "Use actual word count when available; distinguish page estimate from measured word count."
// "Known words use words/time; page-only input is labeled estimated using configurable
//  words/page assumption." (TC-R10-005-B: 200 pages, no word count -> clearly labeled estimate
//  using configured words/page.)
describe("resolveWordCount", () => {
  it("uses the exact measured word count and labels it as not estimated when known words are available", () => {
    const result = resolveWordCount({ source: "measured", wordCount: 52000 });

    expect(result.wordCountSource).toBe("measured");
    expect(result.wordCount).toBe(52000);
    expect(result.isEstimated).toBe(false);
    expect(result.wordsPerPageAssumption).toBeNull();
  });

  it("derives and clearly labels a page-only input as an estimate using the configured words/page assumption (TC-R10-005-B)", () => {
    const result = resolveWordCount({ source: "page_estimate", pageCount: 200 }, 250);

    expect(result.wordCountSource).toBe("page_estimate");
    expect(result.wordCount).toBe(50000);
    expect(result.isEstimated).toBe(true);
    expect(result.wordsPerPageAssumption).toBe(250);
  });

  it("respects a different configured words/page assumption", () => {
    const result = resolveWordCount({ source: "page_estimate", pageCount: 200 }, 300);
    expect(result.wordCount).toBe(60000);
    expect(result.wordsPerPageAssumption).toBe(300);
  });

  it("is deterministic for identical inputs", () => {
    const input = { source: "page_estimate" as const, pageCount: 200 };
    expect(resolveWordCount(input, 250)).toEqual(resolveWordCount(input, 250));
  });
});
