import { describe, expect, it } from "vitest";
import { nextAssigned, recordResult, emptyLearner } from "../../../lib/sr/non-blocking";

describe("SR-010 progression never blocked", () => {
  const order = ["p1", "p2", "p3"];
  it("failed oral and failed comprehension still enable the next passage", () => {
    let l = emptyLearner();
    l = recordResult(l, "p1", { oral: "FAIL", comprehension: "FAIL" });
    expect(nextAssigned(l, order)).toBe("p2");
  });
  it("history is retained intact, including failures", () => {
    let l = recordResult(emptyLearner(), "p1", { oral: "FAIL", comprehension: "FAIL" });
    l = recordResult(l, "p2", { oral: "PASS", comprehension: "PASS" });
    expect(l.history.map((h) => h.passageId)).toEqual(["p1", "p2"]);
    expect(l.history[0].comprehension).toBe("FAIL");
  });
  it("readiness is tracked separately from progression", () => {
    const l = recordResult(emptyLearner(), "p1", { oral: "PASS", comprehension: "FAIL" });
    expect(l.readiness.p1).toEqual({ oralReady: true, comprehensionReady: false });
    expect(nextAssigned(l, order)).toBe("p2");
  });
  it("returns null only when the sequence is exhausted", () => {
    let l = emptyLearner();
    for (const p of order) l = recordResult(l, p, { oral: "FAIL", comprehension: "FAIL" });
    expect(nextAssigned(l, order)).toBeNull();
  });
});
