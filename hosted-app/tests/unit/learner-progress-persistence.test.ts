import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { levels, loadProgress, recordResult } from "../../lib/progression";

// SR-R1-013: Persist learner progress.
// "Persist production learner progression/history under Babysteps identity contract."
// "Reload restores same learner state/history and never exposes another learner's state."
function createMemoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createMemoryLocalStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("learner progress persistence", () => {
  it("restores exactly the same state after a simulated reload (loadProgress after saveProgress via recordResult)", () => {
    recordResult({}, levels[0], 100, "alice-123");

    const restored = loadProgress("alice-123");

    expect(restored["1"]).toBeDefined();
    expect(restored["1"].bestScore).toBe(100);
    expect(restored["1"].passed).toBe(true);
  });

  it("never exposes one learner's state to another learner's load", () => {
    recordResult({}, levels[0], 100, "alice-123");
    recordResult({}, levels[0], 40, "bob-456");

    const aliceState = loadProgress("alice-123");
    const bobState = loadProgress("bob-456");

    expect(aliceState["1"].bestScore).toBe(100);
    expect(bobState["1"].bestScore).toBe(40);
    expect(bobState["1"].bestScore).not.toBe(aliceState["1"].bestScore);
  });

  it("keeps anonymous (no learnerId) progress separate from any named learner's progress", () => {
    recordResult({}, levels[0], 100, "alice-123");
    recordResult({}, levels[0], 55);

    const anonymous = loadProgress(undefined);
    const alice = loadProgress("alice-123");

    expect(anonymous["1"].bestScore).toBe(55);
    expect(alice["1"].bestScore).toBe(100);
  });

  it("tags every recorded attempt with a unique attempt_id", () => {
    const afterFirst = recordResult({}, levels[0], 60, "alice-123");
    const afterSecond = recordResult(afterFirst, levels[0], 90, "alice-123");

    expect(afterFirst["1"].attemptId).toBeTruthy();
    expect(afterSecond["1"].attemptId).toBeTruthy();
    expect(afterSecond["1"].attemptId).not.toBe(afterFirst["1"].attemptId);
  });

  it("scopes attempt state by level_id, so two levels never collide for the same learner", () => {
    let progress = recordResult({}, levels[0], 100, "alice-123");
    progress = recordResult(progress, levels[1], 40, "alice-123");

    const restored = loadProgress("alice-123");
    expect(restored["1"].bestScore).toBe(100);
    expect(restored["2"].bestScore).toBe(40);
  });
});
