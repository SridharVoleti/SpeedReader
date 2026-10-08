import { describe, expect, it } from "vitest";
import { evaluateGates } from "../../../lib/sr/separate-gates";

describe("SR-047 oral and comprehension gates never compensate", () => {
  it("oral pass cannot override comprehension fail", () => {
    const g = evaluateGates({ oral: 95, comprehension: 20 }, { oral: 70, comprehension: 60 });
    expect(g).toMatchObject({ oralReady: true, comprehensionReady: false, fullyReady: false });
  });
  it("comprehension pass cannot override oral fail", () => {
    const g = evaluateGates({ oral: 10, comprehension: 99 }, { oral: 70, comprehension: 60 });
    expect(g).toMatchObject({ oralReady: false, comprehensionReady: true, fullyReady: false });
  });
  it("both must pass independently", () => {
    expect(evaluateGates({ oral: 70, comprehension: 60 }, { oral: 70, comprehension: 60 }).fullyReady).toBe(true);
  });
  it("results are persisted as two separate fields, not an average", () => {
    const g = evaluateGates({ oral: 80, comprehension: 40 }, { oral: 70, comprehension: 60 });
    expect(g.results).toEqual({ oral: 80, comprehension: 40 });
    expect("combined" in g).toBe(false);
  });
});
