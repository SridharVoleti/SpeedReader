import { describe, expect, it } from "vitest";
import { validatePackageSchema, SCHEMA_VALIDATOR } from "../../../lib/sr/pipeline/package-schema";
import { buildValidPackage } from "./helpers/package";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
describe("SR-036 canonical JSON Schema validation with a real validator", () => {
  it("names the real validator and version used", () => {
    expect(SCHEMA_VALIDATOR).toMatchObject({ name: "ajv", version: expect.stringMatching(/^8\./) });
  });
  it("a well-formed package validates", () => {
    expect(validatePackageSchema(buildValidPackage())).toEqual({ ok: true, errors: [] });
  });
  it("a missing required field fails", () => {
    const p = clone(buildValidPackage()) as Record<string, unknown>;
    delete p.bpc;
    const r = validatePackageSchema(p);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/bpc/);
  });
  it("a wrong type fails", () => {
    const p = clone(buildValidPackage());
    (p.passage as Record<string, unknown>).wordCount = "80";
    const r = validatePackageSchema(p);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/wordCount/);
  });
  it("an out-of-enum value fails", () => {
    const p = clone(buildValidPackage());
    (p.attemptContract as { outcomes: { state: string }[] }).outcomes[0].state = "MAYBE";
    expect(validatePackageSchema(p).ok).toBe(false);
  });
  it("unknown top-level properties fail (closed schema)", () => {
    expect(validatePackageSchema({ ...buildValidPackage(), extra: 1 }).ok).toBe(false);
  });
  it("non-object input fails without throwing", () => {
    expect(validatePackageSchema(null).ok).toBe(false);
    expect(validatePackageSchema([]).ok).toBe(false);
  });
});
