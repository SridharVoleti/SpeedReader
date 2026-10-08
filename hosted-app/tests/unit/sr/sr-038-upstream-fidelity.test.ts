import { describe, expect, it } from "vitest";
import { checkUpstreamFidelity, diffPaths } from "../../../lib/sr/pipeline/fidelity";
import { buildValidPackage } from "./helpers/package";
import { UPSTREAM } from "./helpers/artifacts";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const approved = () => ({ 1: UPSTREAM[1], 2: UPSTREAM[2], 3: UPSTREAM[3], 4: UPSTREAM[4], 5: UPSTREAM[5], 6: UPSTREAM[6], 7: UPSTREAM[7] });

describe("SR-038 upstream fidelity: the package is exactly the approved artifacts", () => {
  it("an unaltered assembly passes", () => {
    expect(checkUpstreamFidelity(buildValidPackage(), approved())).toEqual({ ok: true, problems: [] });
  });
  it("diffPaths pinpoints changed, added and removed paths", () => {
    expect(diffPaths({ a: 1, b: { c: [1, 2] }, d: 1 }, { a: 2, b: { c: [1, 3] }, e: 1 }).sort()).toEqual(["$.a", "$.b.c[1]", "$.d", "$.e"]);
    expect(diffPaths({ a: [1] }, { a: [1, 2] })).toEqual(["$.a[1]"]);
    expect(diffPaths({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it("an edited passage word fails and names the role and path", () => {
    const p = clone(buildValidPackage());
    p.passage.text = "tampered " + String(p.passage.text);
    const r = checkUpstreamFidelity(p, approved());
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/role 2.*passage.*\$\.text/);
  });
  it("an altered correct answer fails", () => {
    const p = clone(buildValidPackage());
    (p.assessment.items as { answerIndex: number }[])[0].answerIndex = 2;
    expect(checkUpstreamFidelity(p, approved()).problems.join()).toMatch(/role 3.*answerIndex/);
  });
  it("altered scoring, attempt contract, BPC and meaning units all fail", () => {
    for (const [section, role, mutate] of [
      ["scoring", 6, (p: Record<string, any>) => { p.scoring.primaryItemId = "I2"; }],
      ["attemptContract", 7, (p: Record<string, any>) => { p.attemptContract.outcomes[1].nextAction = "STOP"; }],
      ["bpc", 5, (p: Record<string, any>) => { p.bpc.text = "different"; }],
      ["meaningUnits", 4, (p: Record<string, any>) => { p.meaningUnits.units.pop(); }]
    ] as const) {
      const p = clone(buildValidPackage());
      mutate(p as Record<string, any>);
      expect(checkUpstreamFidelity(p, approved()).problems.join(), section).toMatch(new RegExp(`role ${role}`));
    }
  });
  it("a section with no approved counterpart fails", () => {
    const a: Record<number, Record<string, unknown>> = approved();
    delete a[5];
    expect(checkUpstreamFidelity(buildValidPackage(), a).problems.join()).toMatch(/role 5.*no approved/);
  });
});
