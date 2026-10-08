import { describe, expect, it } from "vitest";
import { buildRegistry, checkReferentialIntegrity } from "../../../lib/sr/pipeline/referential-integrity";
import { buildValidPackage } from "./helpers/package";
import { UPSTREAM } from "./helpers/artifacts";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const registry = () => buildRegistry({ 3: UPSTREAM[3], 4: UPSTREAM[4], 5: UPSTREAM[5] });

describe("SR-037 referential integrity against the approved artifact registry", () => {
  it("a package whose every id resolves passes", () => {
    expect(checkReferentialIntegrity(buildValidPackage(), registry())).toEqual({ ok: true, problems: [] });
  });
  it("a dangling primary item id fails", () => {
    const p = clone(buildValidPackage());
    p.scoring.primaryItemId = "I99";
    const r = checkReferentialIntegrity(p, registry());
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/dangling.*I99/);
  });
  it("a dangling scoring point key fails", () => {
    const p = clone(buildValidPackage());
    p.scoring.itemPoints = { ...(p.scoring.itemPoints as Record<string, number>), I77: 0 };
    expect(checkReferentialIntegrity(p, registry()).problems.join()).toMatch(/dangling.*I77/);
  });
  it("a BPC fact id with no meaning unit fails", () => {
    const p = clone(buildValidPackage());
    p.bpc.factIds = [...(p.bpc.factIds as string[]), "F42"];
    expect(checkReferentialIntegrity(p, registry()).problems.join()).toMatch(/dangling.*F42/);
  });
  it("a section belonging to another passage fails as a cross-passage reference", () => {
    const p = clone(buildValidPackage());
    p.meaningUnits.passageId = "W1-0099";
    const r = checkReferentialIntegrity(p, registry());
    expect(r.problems.join()).toMatch(/cross-passage.*meaningUnits.*W1-0099/);
  });
  it("an id that exists only for a different passage in the registry is cross-passage, not resolved", () => {
    const reg = registry();
    const other = buildRegistry({ 3: { passageId: "W1-0099", items: [{ itemId: "I1" }] }, 4: { passageId: "W1-0099", units: [] }, 5: { passageId: "W1-0099", factIds: [] } });
    const merged = { ...reg, ...other };
    expect(checkReferentialIntegrity(buildValidPackage(), merged).ok).toBe(true);
    expect(checkReferentialIntegrity(buildValidPackage(), other).ok).toBe(false);
  });
});
