import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendCertificationHistory,
  buildCertificationHistoryEntry,
  CERTIFICATION_RULE_VERSION,
  loadCertificationHistory,
  replayCertification
} from "../../lib/certification";

// SR-R2-004: Certification history.
// "Make every CRR change auditable."
// "History stores old/new CRR, qualifying attempts, rule version and timestamp; replay yields
//  same result."
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

describe("buildCertificationHistoryEntry", () => {
  it("captures old/new CRR, qualifying attempts, rule version and a timestamp", () => {
    const entry = buildCertificationHistoryEntry({
      oldCertifiedWpm: 100,
      newCertifiedWpm: 150,
      qualifyingFormIds: ["form-a", "form-b", "form-c"],
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(entry).toEqual({
      oldCertifiedWpm: 100,
      newCertifiedWpm: 150,
      qualifyingFormIds: ["form-a", "form-b", "form-c"],
      ruleVersion: CERTIFICATION_RULE_VERSION,
      recordedAt: "2026-01-01T00:00:00.000Z"
    });
  });
});

describe("replayCertification", () => {
  it("replaying the same qualifying attempts and rule version yields the same result", () => {
    const inputs = {
      priorCertifiedWpm: 100,
      challengeWpm: 150,
      qualifyingFormIds: ["form-a", "form-b", "form-c"],
      requiredConfirmations: 3
    };

    const first = replayCertification(inputs);
    const second = replayCertification(inputs);

    expect(first).toEqual(second);
    expect(first.certifiedWpm).toBe(150);
  });

  it("replay does not certify when the qualifying attempts don't meet the required confirmation count", () => {
    const result = replayCertification({
      priorCertifiedWpm: 100,
      challengeWpm: 150,
      qualifyingFormIds: ["form-a", "form-b"],
      requiredConfirmations: 3
    });

    expect(result.certifiedWpm).toBe(100);
  });

  it("replay de-duplicates a qualifying list that (incorrectly) repeats the same form id", () => {
    const result = replayCertification({
      priorCertifiedWpm: 100,
      challengeWpm: 150,
      qualifyingFormIds: ["form-a", "form-a", "form-a"],
      requiredConfirmations: 3
    });

    expect(result.certifiedWpm).toBe(100); // only 1 distinct form - matches TC-R2-002-B logic
  });
});

describe("certification history persistence", () => {
  function makeEntry(oldWpm: number, newWpm: number) {
    return buildCertificationHistoryEntry({
      oldCertifiedWpm: oldWpm,
      newCertifiedWpm: newWpm,
      qualifyingFormIds: ["form-a", "form-b", "form-c"]
    });
  }

  it("appends entries and never overwrites prior ones", () => {
    appendCertificationHistory(makeEntry(100, 150), "alice-123");
    appendCertificationHistory(makeEntry(150, 200), "alice-123");

    const history = loadCertificationHistory("alice-123");
    expect(history.map((entry) => [entry.oldCertifiedWpm, entry.newCertifiedWpm])).toEqual([
      [100, 150],
      [150, 200]
    ]);
  });

  it("keeps each learner's certification history isolated from every other learner's", () => {
    appendCertificationHistory(makeEntry(100, 150), "alice-123");
    appendCertificationHistory(makeEntry(100, 180), "bob-456");

    expect(loadCertificationHistory("alice-123")).toHaveLength(1);
    expect(loadCertificationHistory("bob-456")).toHaveLength(1);
    expect(loadCertificationHistory("alice-123")[0].newCertifiedWpm).toBe(150);
    expect(loadCertificationHistory("bob-456")[0].newCertifiedWpm).toBe(180);
  });
});
