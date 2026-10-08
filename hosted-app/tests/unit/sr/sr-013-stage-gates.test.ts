import { describe, expect, it } from "vitest";
import { newPipeline, submitCreatorOutput, recordQa, canStartRole, consumeUpstream } from "../../../lib/sr/pipeline/gates";

describe("SR-013 eight creators, each with an independent QA gate", () => {
  it("role 1 may start immediately; role 2 may not until role 1 QA passed", () => {
    const p = newPipeline();
    expect(canStartRole(p, 1).ok).toBe(true);
    expect(canStartRole(p, 2)).toMatchObject({ ok: false, blockedBy: [1] });
  });
  it("creator output without self-check is rejected", () => {
    expect(() => submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: false })).toThrow(/self-check/);
  });
  it("creator output alone does not open the next stage", () => {
    const p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    expect(canStartRole(p, 2).ok).toBe(false);
  });
  it("a QA PASS opens the next stage; a QA FAIL does not", () => {
    let p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    expect(canStartRole(recordQa(p, 1, { verdict: "FAIL", qaActor: "qa1", blockers: 1 }), 2).ok).toBe(false);
    p = recordQa(p, 1, { verdict: "PASS", qaActor: "qa1", blockers: 0 });
    expect(canStartRole(p, 2).ok).toBe(true);
  });
  it("QA must be independent of the creator", () => {
    const p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true, creatorActor: "alice" });
    expect(() => recordQa(p, 1, { verdict: "PASS", qaActor: "alice", blockers: 0 })).toThrow(/independent/);
  });
  it("a PASS with blockers is invalid", () => {
    const p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    expect(() => recordQa(p, 1, { verdict: "PASS", qaActor: "q", blockers: 2 })).toThrow(/blocker/);
  });
  it("downstream consumption of unapproved WIP is refused", () => {
    const p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    expect(() => consumeUpstream(p, 2, 1)).toThrow(/unapproved/);
  });
  it("downstream consumption returns only the approved hash", () => {
    let p = submitCreatorOutput(newPipeline(), 1, { hash: "h1", selfCheck: true });
    p = recordQa(p, 1, { verdict: "PASS", qaActor: "q", blockers: 0 });
    expect(consumeUpstream(p, 2, 1)).toEqual({ role: 1, hash: "h1" });
  });
  it("consuming from a role that is not an upstream of the consumer is refused", () => {
    expect(() => consumeUpstream(newPipeline(), 2, 5)).toThrow(/not an upstream/);
  });
  it("all eight stage gates are enforced in sequence", () => {
    let p = newPipeline();
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(canStartRole(p, id).ok).toBe(true);
      p = submitCreatorOutput(p, id, { hash: `h${id}`, selfCheck: true });
      p = recordQa(p, id, { verdict: "PASS", qaActor: "q", blockers: 0 });
    }
    expect(Object.keys(p.stages)).toHaveLength(8);
  });
});
