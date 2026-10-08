import { describe, expect, it } from "vitest";
import { strictParseBytes } from "../../../lib/sr/pipeline/strict-json";

const bytes = (s: string) => new TextEncoder().encode(s);
describe("SR-034 strict JSON parser on serialized bytes", () => {
  it("accepts well-formed JSON bytes and returns the value", () => {
    const r = strictParseBytes(bytes('{"a":[1,2,{"b":null}]}'));
    expect(r).toMatchObject({ ok: true, value: { a: [1, 2, { b: null }] } });
  });
  it("rejects malformed JSON: trailing comma, single quotes, comments, unquoted keys", () => {
    for (const bad of ['{"a":1,}', "{'a':1}", '{"a":1} // c', "{a:1}", '{"a":', "", "NaN", '{"a":01}']) {
      expect(strictParseBytes(bytes(bad)).ok, bad).toBe(false);
    }
  });
  it("rejects trailing garbage after a valid document", () => {
    expect(strictParseBytes(bytes('{"a":1} x')).ok).toBe(false);
  });
  it("rejects bytes that are not valid UTF-8", () => {
    expect(strictParseBytes(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))).toMatchObject({ ok: false });
  });
  it("rejects a UTF-8 BOM in the serialized package", () => {
    expect(strictParseBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("{}")])).ok).toBe(false);
  });
  it("records the failure position/message as evidence", () => {
    const r = strictParseBytes(bytes('{"a":1,}'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});
