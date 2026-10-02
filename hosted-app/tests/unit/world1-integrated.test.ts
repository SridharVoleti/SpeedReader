import { describe, expect, it } from "vitest";
import { recordSessionPassage, sessionOutcome, type SessionPassage, type World1Session } from "../../lib/world1-session";
import { WORLD1_CONFIG } from "../../lib/world1-product";

const integrated: SessionPassage = {
  passageId: "p1", targetWpm: 100, staminaWords: 100,
  comprehension: "PASS", oralQuality: "PASS"
};

describe("DEC-008 integrated speed, comprehension and stamina training", () => {
  it("stores all reading dimensions together in the normal session", () => {
    const session: World1Session = { id: "s", startedAtMs: 0, passages: [] };
    const updated = recordSessionPassage(session, integrated, 60_000, WORLD1_CONFIG);
    expect(updated.passages).toEqual([integrated]);
    expect(sessionOutcome(updated)).toBe("SUCCESS");
  });

  it("rejects a stamina-only result or missing reading/comprehension/oral evidence", () => {
    const session: World1Session = { id: "s", startedAtMs: 0, passages: [] };
    const staminaOnly = { passageId: "p2", staminaWords: 125, trainingMode: "STAMINA_ONLY" } as unknown as SessionPassage;
    expect(() => recordSessionPassage(session, staminaOnly, 60_000, WORLD1_CONFIG)).toThrow();
    expect(() => recordSessionPassage(session, { ...integrated, targetWpm: 0 }, 60_000, WORLD1_CONFIG)).toThrow();
    expect(() => recordSessionPassage(session, { ...integrated, oralQuality: undefined } as unknown as SessionPassage, 60_000, WORLD1_CONFIG)).toThrow();
  });
});
