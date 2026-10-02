import { describe, expect, it } from "vitest";
import { closeSessionAtBudget, recommendNextSession, recordSessionPassage, sessionOutcome, sessionTimeRemaining, type World1Session } from "../../lib/world1-session";
import { WORLD1_CONFIG } from "../../lib/world1-product";
import { newWorld1Profile, recordWorld1SessionStart, nextWorld1SessionRecommendation } from "../../lib/world1-storage";

const passed = { passageId: "p1", targetWpm: 100, comprehension: "PASS" as const, oralQuality: "PASS" as const, staminaWords: 100 };

describe("DEC-007 twenty-minute alternate-day session", () => {
  it("recommends alternate days, producing four sessions then three in adjacent weeks", () => {
    const starts = [0];
    for (let i = 1; i < 7; i += 1) starts.push(recommendNextSession(starts[i - 1], WORLD1_CONFIG));
    const day = 24 * 60 * 60 * 1000;
    expect(starts.map((time) => time / day)).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  it("persists cadence guidance across sessions without refusing an early session", () => {
    const profile = newWorld1Profile("learner", 100);
    const first = recordWorld1SessionStart(profile, 0);
    expect(nextWorld1SessionRecommendation(first, WORLD1_CONFIG)).toBe(2 * 24 * 60 * 60 * 1000);
    const early = recordWorld1SessionStart(first, 24 * 60 * 60 * 1000);
    expect(early.lastSessionStartedAtMs).toBe(24 * 60 * 60 * 1000);
    expect(nextWorld1SessionRecommendation(early, WORLD1_CONFIG)).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("ends at the time budget with one valid passage and no passage-count failure", () => {
    const started: World1Session = { id: "session-1", startedAtMs: 0, passages: [] };
    const one = recordSessionPassage(started, passed, 12 * 60_000, WORLD1_CONFIG);
    expect(one.passages).toEqual([passed]);
    expect(sessionTimeRemaining(one, 12 * 60_000, WORLD1_CONFIG)).toBe(8 * 60_000);
    const closed = closeSessionAtBudget(one, 20 * 60_000, WORLD1_CONFIG);
    expect(closed.endedAtMs).toBe(20 * 60_000);
    expect(sessionOutcome(closed)).toBe("SUCCESS");
    expect(recordSessionPassage(closed, { ...passed, passageId: "p2" }, 21 * 60_000, WORLD1_CONFIG)).toBe(closed);
  });

  it("completes a passage at the time boundary and treats technical evidence as insufficient", () => {
    const started: World1Session = { id: "session-2", startedAtMs: 0, passages: [] };
    const completed = recordSessionPassage(started, passed, 21 * 60_000, WORLD1_CONFIG);
    expect(completed.endedAtMs).toBe(21 * 60_000);
    expect(sessionOutcome(completed)).toBe("SUCCESS");
    const uncertain = recordSessionPassage(started, { ...passed, comprehension: "INSUFFICIENT_EVIDENCE" }, 21 * 60_000, WORLD1_CONFIG);
    expect(sessionOutcome(uncertain)).toBe("INSUFFICIENT_EVIDENCE");
  });
});
