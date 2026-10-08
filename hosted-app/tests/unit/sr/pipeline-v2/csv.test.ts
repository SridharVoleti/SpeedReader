import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../../lib/sr/pipeline-v2/csv";

describe("parseCsv (RFC 4180)", () => {
  it("handles BOM, quoted commas, doubled quotes, embedded newlines and CRLF", () => {
    const text = '\uFEFFa,b,c\r\n1,"x,y","he said ""hi"""\r\n2,"line1\nline2",\r\n';
    expect(parseCsv(text)).toEqual([
      { a: "1", b: "x,y", c: 'he said "hi"' },
      { a: "2", b: "line1\nline2", c: "" }
    ]);
  });
  it("rejects ragged rows rather than guessing", () => {
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow(/column/);
  });
  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a,b\n1,"oops\n')).toThrow(/unterminated/);
  });
});
