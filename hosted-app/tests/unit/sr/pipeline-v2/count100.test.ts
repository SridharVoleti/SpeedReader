// COUNT-100 v2.0 (canonical spec section "Canonical passage tokenizer and exact-word-count contract").
// Table-driven vectors mirror SpeedReader_W1_BandA_COUNT100_Conformance_v0.56.csv; when the locked package is
// present on this machine the real conformance CSV is replayed too.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COUNT100_VERSION, count100, segment100, validateBandA } from "../../../../lib/sr/pipeline-v2/count100";
import { parseCsv } from "../../../../lib/sr/pipeline-v2/csv";

const hundred = Array(100).fill("word").join(" ");
const VECTORS: [string, string, number | null, "VALID_TOKENIZATION" | "INVALID_COUNT_TEXT"][] = [
  ["C001", "don't", 1, "VALID_TOKENIZATION"],
  ["C002", "can\u2019t", 1, "VALID_TOKENIZATION"],
  ["C003", "Ravi's", 1, "VALID_TOKENIZATION"],
  ["C004", "well-known", 1, "VALID_TOKENIZATION"],
  ["C005", "mother-in-law", 1, "VALID_TOKENIZATION"],
  ["C006", "red\u2014blue", 2, "VALID_TOKENIZATION"],
  ["C007", "red - blue", 2, "VALID_TOKENIZATION"],
  ["C008", "Dr.", 1, "VALID_TOKENIZATION"],
  ["C009", "U.S.", 1, "VALID_TOKENIZATION"],
  ["C010", "7:30", 1, "VALID_TOKENIZATION"],
  ["C011", "3.14", 1, "VALID_TOKENIZATION"],
  ["C012", "1,000", 1, "VALID_TOKENIZATION"],
  ["C013", "12/09/2026", 1, "VALID_TOKENIZATION"],
  ["C014", "\u20B950", 1, "VALID_TOKENIZATION"],
  ["C015", "$5.50", 1, "VALID_TOKENIZATION"],
  ["C016", "50%", 1, "VALID_TOKENIZATION"],
  ["C017", "5 km", 2, "VALID_TOKENIZATION"],
  ["C018", "5km", 1, "VALID_TOKENIZATION"],
  ["C019", '"Hello,"', 1, "VALID_TOKENIZATION"],
  ["C020", "word \u2026 next", 2, "VALID_TOKENIZATION"],
  ["C021", "\u20B9 50", null, "INVALID_COUNT_TEXT"],
  ["C022", "rock & roll", null, "INVALID_COUNT_TEXT"],
  ["C023", "hello,world", 1, "VALID_TOKENIZATION"],
  ["C024", "one\ttwo\nthree", 3, "VALID_TOKENIZATION"],
  ["C025", "a\u200Bb", null, "INVALID_COUNT_TEXT"]
];

describe("COUNT-100 v2.0 tokenizer", () => {
  it("is the single versioned implementation", () => {
    expect(COUNT100_VERSION).toBe("COUNT-100-v2.0");
  });

  it.each(VECTORS)("%s %j", (_id, input, expectedCount, expectedStatus) => {
    const r = count100(input);
    expect(r.status).toBe(expectedStatus);
    expect(r.count).toBe(expectedCount);
  });

  it.each(["\u00AD", "\u200B", "\u200C", "\u200D", "\u2060", "\uFEFF"])("rejects hidden format character U+%s", (ch) => {
    const r = count100(`a${ch}b`);
    expect(r.status).toBe("INVALID_COUNT_TEXT");
    expect(r.errors[0]).toMatch(/hidden format character/i);
  });

  it("normalizes typographic apostrophes and hyphens to ASCII before tokenizing", () => {
    expect(count100("don\u2019t \u2018quote\u2019 up\u2010to \u2212x").tokens.map((t) => t.text)).toEqual(["don't", "'quote'", "up-to", "-x"]);
  });

  it("treats figure/en/em dash and horizontal bar as word boundaries", () => {
    for (const d of ["\u2012", "\u2013", "\u2014", "\u2015"]) expect(count100(`red${d}blue`).count).toBe(2);
  });

  it("applies NFKC (ellipsis becomes punctuation-only metadata, zero count)", () => {
    expect(count100("wait \u2026 now").count).toBe(2);
  });

  it("assigns immutable 1-based expected_token_index and attaches punctuation-only fragments as metadata", () => {
    const r = count100("Hello , world - ok");
    expect(r.tokens.map((t) => [t.index, t.text])).toEqual([[1, "Hello"], [2, "world"], [3, "ok"]]);
    expect(r.tokens[0].punctuationAfter).toEqual([","]);
    expect(r.tokens[1].punctuationAfter).toEqual(["-"]);
    const lead = count100("( start end");
    expect(lead.tokens[0].punctuationBefore).toEqual(["("]);
  });

  it("is deterministic and pure", () => {
    const text = "The red umbrella, once lost, was found.";
    expect(count100(text)).toEqual(count100(text));
  });

  it("empty and punctuation-only text yields zero tokens", () => {
    expect(count100("").count).toBe(0);
    expect(count100(" ... ").count).toBe(0);
  });

  it("Band-A validity requires exactly 100 tokens (INVALID_WORD_COUNT otherwise)", () => {
    expect(validateBandA(hundred)).toMatchObject({ ok: true, status: "VALID_BAND_A", count: 100 });
    expect(validateBandA(hundred.replace(/ word$/, ""))).toMatchObject({ ok: false, status: "INVALID_WORD_COUNT", count: 99 });
    expect(validateBandA(hundred + " word")).toMatchObject({ ok: false, status: "INVALID_WORD_COUNT", count: 101 });
    expect(validateBandA("a\u200Bb")).toMatchObject({ ok: false, status: "INVALID_COUNT_TEXT" });
  });

  it("segments fixed thirds and quartiles from expected_token_index (SEGMENT-1.0)", () => {
    const seg = segment100(count100(hundred).tokens);
    expect(seg.thirds.map((s) => [s.id, s.start, s.end, s.tokens.length])).toEqual([["T1", 1, 33, 33], ["T2", 34, 66, 33], ["T3", 67, 100, 34]]);
    expect(seg.quartiles.map((s) => [s.id, s.start, s.end, s.tokens.length])).toEqual([["Q1", 1, 25, 25], ["Q2", 26, 50, 25], ["Q3", 51, 75, 25], ["Q4", 76, 100, 25]]);
  });

  it("refuses to segment a non-100 sequence instead of inventing boundaries", () => {
    expect(() => segment100(count100("a b c").tokens)).toThrow(/exactly 100/);
  });

  it("replays the locked package's conformance CSV when it is available", () => {
    const dir = process.env.SR_CANONICAL_DIR ?? "D:\Sridhar\Projects\SpeedReader_CC\SpeedReader_W1_BandA_v0.56_FINAL_FREEZE_CANDIDATE_FULL_PACKAGE";
    const file = join(dir, "SpeedReader_W1_BandA_COUNT100_Conformance_v0.56.csv");
    if (!existsSync(file)) return; // package not on this machine; the table above carries the vectors
    const rows = parseCsv(readFileSync(file, "utf8"));
    expect(rows.length).toBeGreaterThanOrEqual(28);
    for (const row of rows) {
      const r = validateBandA(row.input_text);
      const status = r.status === "INVALID_COUNT_TEXT" ? "INVALID_COUNT_TEXT" : "VALID_TOKENIZATION";
      expect([row.case_id, status]).toEqual([row.case_id, row.expected_tokenization_status]);
      if (row.expected_token_count !== "") expect([row.case_id, r.count]).toEqual([row.case_id, Number(row.expected_token_count)]);
      expect([row.case_id, r.ok]).toEqual([row.case_id, row.expected_exact100 === "YES"]);
    }
  });
});
