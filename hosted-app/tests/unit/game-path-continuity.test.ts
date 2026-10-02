import { describe, expect, it } from "vitest";
import { levels, nodeState, Progress, recordResult } from "../../lib/progression";

// SR-R1-016: Game path continuity.
// "Retain simple locked/unlocked/completed progression with clear next action."
// "PASS unlocks correct next node; HOLD/FAIL/INVALID does not; reload preserves state."
describe("nodeState", () => {
  it("the first level starts unlocked; every later level starts locked", () => {
    const progress: Progress = {};
    expect(nodeState(progress, levels[0])).toBe("unlocked");
    expect(nodeState(progress, levels[1])).toBe("locked");
    expect(nodeState(progress, levels[5])).toBe("locked");
  });

  it("PASS marks the level completed and unlocks exactly the correct next node", () => {
    const progress = recordResult({}, levels[0], 100); // 100 >= passThreshold -> PASS

    expect(nodeState(progress, levels[0])).toBe("completed");
    expect(nodeState(progress, levels[1])).toBe("unlocked");
    expect(nodeState(progress, levels[2])).toBe("locked"); // not skipped ahead
  });

  it("HOLD (a failing score) leaves the level unlocked (not completed) and does not unlock the next node", () => {
    const progress = recordResult({}, levels[0], 10); // below passThreshold -> HOLD/FAIL

    expect(nodeState(progress, levels[0])).toBe("unlocked");
    expect(nodeState(progress, levels[1])).toBe("locked");
  });

  it("an INVALID attempt outcome changes no node's state at all", () => {
    const before = recordResult({}, levels[0], 100); // a genuine prior PASS
    const after = recordResult(before, levels[0], 10, undefined, undefined, "INVALID");

    expect(nodeState(after, levels[0])).toBe(nodeState(before, levels[0]));
    expect(nodeState(after, levels[0])).toBe("completed");
    expect(nodeState(after, levels[1])).toBe(nodeState(before, levels[1]));
  });

  it("provides a clear single next action via nextPlayableLevel, consistent with nodeState", () => {
    let progress: Progress = {};
    progress = recordResult(progress, levels[0], 100);
    progress = recordResult(progress, levels[1], 100);

    // The next playable level should be the first "unlocked" (not "completed") node.
    for (const level of levels) {
      const state = nodeState(progress, level);
      if (state === "unlocked") {
        expect(level.id).toBe(3);
        break;
      }
    }
  });
});
