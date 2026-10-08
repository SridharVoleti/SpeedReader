import { describe, expect, it } from "vitest";
import { newAttemptLog, revealBpc, startNextAttempt, recordOutcome } from "../../../lib/sr/model-answer-support";

describe("SR-045 assisted performance never becomes independent readiness", () => {
  it("persists role, assistance flag, evidence type", () => {
    let log = newAttemptLog("p1");
    const a1 = startNextAttempt(log);
    log = recordOutcome(log, a1, 72);
    expect(log.attempts[0]).toMatchObject({ attemptRole: "FIRST_INDEPENDENT", assisted: false, evidenceType: "INDEPENDENT", score: 72 });
  });
  it("original independent outcome is unchanged after BPC exposure and a better assisted attempt", () => {
    let log = newAttemptLog("p1");
    log = recordOutcome(log, startNextAttempt(log), 40);
    const snapshot = JSON.stringify(log.attempts[0]);
    log = revealBpc(log, { submitted: true, bpcApproved: true }).log;
    log = recordOutcome(log, startNextAttempt(log), 95);
    expect(JSON.stringify(log.attempts[0])).toBe(snapshot);
    expect(log.attempts[1]).toMatchObject({ attemptRole: "ASSISTED", evidenceType: "ASSISTED" });
  });
  it("outcomes are immutable once recorded", () => {
    let log = newAttemptLog("p1");
    log = recordOutcome(log, startNextAttempt(log), 50);
    expect(() => { (log.attempts[0] as { score: number }).score = 99; }).toThrow();
  });
  it("readiness evidence is the first independent attempt only", async () => {
    const { independentEvidence } = await import("../../../lib/sr/model-answer-support");
    let log = newAttemptLog("p1");
    log = recordOutcome(log, startNextAttempt(log), 40);
    log = revealBpc(log, { submitted: true, bpcApproved: true }).log;
    log = recordOutcome(log, startNextAttempt(log), 95);
    expect(independentEvidence(log)?.score).toBe(40);
  });
});
