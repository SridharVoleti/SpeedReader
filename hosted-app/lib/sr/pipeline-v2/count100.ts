// COUNT-100 v2.0 - the ONE canonical tokenizer for the learner-visible Band-A passage body.
// Source of truth: canonical Spec v0.56 section "Canonical passage tokenizer and exact-word-count contract";
// machine mirror SpeedReader_W1_BandA_COUNT100_Model_v0.56.csv (rules C100-001..015).
//
// Every consumer (authoring validation, passage QA, renderer, ASR alignment, WPM, equivalent-form validation)
// must import from this module. No role prompt or subsystem may use its own word-count heuristic.

export const COUNT100_VERSION = "COUNT-100-v2.0";
export const BAND_A_TOKEN_COUNT = 100;

export type CountStatus = "VALID_TOKENIZATION" | "INVALID_COUNT_TEXT";
export type CountToken = {
  /** immutable expected_token_index, 1..N */
  index: number;
  /** normalized fragment (NFKC, ASCII apostrophe/hyphen) with attached punctuation intact */
  text: string;
  /** punctuation-only fragments attached to this token as rendering/alignment metadata */
  punctuationBefore: string[];
  punctuationAfter: string[];
};
export type Count100Result = {
  version: typeof COUNT100_VERSION;
  status: CountStatus;
  /** null when the text is invalid */
  count: number | null;
  tokens: CountToken[];
  errors: string[];
  normalized: string;
};

const HIDDEN_FORMAT = /[­​‌‍⁠﻿]/u;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const PUNCT_ONLY = /^[.,!?;:'"()[\]{}-]+$/u;

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’ʼ]/gu, "'")
    .replace(/[‐‑−]/gu, "-")
    .replace(/[‒–—―]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const invalid = (errors: string[], normalized = ""): Count100Result =>
  ({ version: COUNT100_VERSION, status: "INVALID_COUNT_TEXT", count: null, tokens: [], errors, normalized });

export function count100(text: string): Count100Result {
  const hidden = HIDDEN_FORMAT.exec(text);
  if (hidden) return invalid([`hidden format character U+${hidden[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")} is not allowed`]);

  const normalized = normalize(text);
  const fragments = normalized === "" ? [] : normalized.split(" ");
  const tokens: CountToken[] = [];
  const errors: string[] = [];
  let pendingBefore: string[] = [];
  for (const f of fragments) {
    if (LETTER_OR_NUMBER.test(f)) {
      tokens.push({ index: tokens.length + 1, text: f, punctuationBefore: pendingBefore, punctuationAfter: [] });
      pendingBefore = [];
    } else if (PUNCT_ONLY.test(f)) {
      if (tokens.length) tokens[tokens.length - 1].punctuationAfter.push(f);
      else pendingBefore.push(f);
    } else {
      errors.push(`nonlexical fragment ${JSON.stringify(f)} has no Letter/Number and is not allowed punctuation`);
    }
  }
  if (errors.length) return invalid(errors, normalized);
  // punctuation-only text before any token with no token at all is just metadata of an empty body
  return { version: COUNT100_VERSION, status: "VALID_TOKENIZATION", count: tokens.length, tokens, errors: [], normalized };
}

export type BandAStatus = "VALID_BAND_A" | "INVALID_COUNT_TEXT" | "INVALID_WORD_COUNT";
export type BandAResult = { ok: boolean; status: BandAStatus; count: number | null; errors: string[]; tokenization: Count100Result };

/** Band-A body validity: a valid tokenization with exactly 100 COUNT tokens. */
export function validateBandA(text: string): BandAResult {
  const t = count100(text);
  if (t.status === "INVALID_COUNT_TEXT") return { ok: false, status: "INVALID_COUNT_TEXT", count: null, errors: t.errors, tokenization: t };
  if (t.count !== BAND_A_TOKEN_COUNT) return { ok: false, status: "INVALID_WORD_COUNT", count: t.count, errors: [`expected exactly ${BAND_A_TOKEN_COUNT} COUNT tokens, found ${t.count}`], tokenization: t };
  return { ok: true, status: "VALID_BAND_A", count: t.count, errors: [], tokenization: t };
}

export type Segment = { id: string; start: number; end: number; tokens: CountToken[] };
// SEGMENT-1.0: membership is fixed from expected_token_index (never from assessability).
const THIRDS: [string, number, number][] = [["T1", 1, 33], ["T2", 34, 66], ["T3", 67, 100]];
const QUARTILES: [string, number, number][] = [["Q1", 1, 25], ["Q2", 26, 50], ["Q3", 51, 75], ["Q4", 76, 100]];

export function segment100(tokens: readonly CountToken[]): { thirds: Segment[]; quartiles: Segment[] } {
  if (tokens.length !== BAND_A_TOKEN_COUNT) throw new Error(`SEGMENT-1.0 is defined for exactly ${BAND_A_TOKEN_COUNT} tokens, got ${tokens.length}`);
  const cut = (defs: [string, number, number][]): Segment[] =>
    defs.map(([id, start, end]) => ({ id, start, end, tokens: tokens.slice(start - 1, end) as CountToken[] }));
  return { thirds: cut(THIRDS), quartiles: cut(QUARTILES) };
}
