import { describe, expect, it } from "vitest";
import { strictParseBytes, findDuplicateKeys } from "../../../lib/sr/pipeline/strict-json";

const bytes = (s: string) => new TextEncoder().encode(s);
describe("SR-035 duplicate object keys are rejected", () => {
  it("JSON.parse alone would silently accept this fixture", () => {
    expect(() => JSON.parse('{"a":1,"a":2}')).not.toThrow();
  });
  it("the duplicate-key fixture fails strict parsing", () => {
    const r = strictParseBytes(bytes('{"a":1,"a":2}'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/duplicate key "a"/);
  });
  it("reports the JSON path of nested duplicates", () => {
    expect(findDuplicateKeys('{"x":{"y":[{"k":1,"k":2}]}}')).toEqual(['$.x.y[0].k']);
  });
  it("same key in different objects is fine", () => {
    expect(strictParseBytes(bytes('{"a":{"id":1},"b":{"id":2}}')).ok).toBe(true);
    expect(findDuplicateKeys('[{"id":1},{"id":2}]')).toEqual([]);
  });
  it("keys that are equal after escape decoding are duplicates", () => {
    expect(findDuplicateKeys('{"a":1,"\\u0061":2}')).toEqual(["$.a"]);
  });
  it("strings containing key-like text do not trigger false positives", () => {
    expect(findDuplicateKeys('{"a":"\\"a\\":1,\\"a\\":2","b":1}')).toEqual([]);
  });
});
