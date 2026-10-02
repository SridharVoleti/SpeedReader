import { describe, expect, it } from "vitest";
import { planReadingTiming, recordActualDuration } from "../../lib/reading-timing";

// SR-R1-001: Deterministic target WPM.
// "Same passage/WPM/chunks produce identical planned timing; actual elapsed time is recorded."
describe("planReadingTiming", () => {
  it("is deterministic for identical inputs", () => {
    const first = planReadingTiming(79, 100, 1);
    const second = planReadingTiming(79, 100, 1);
    expect(second).toEqual(first);
  });

  it("computes planned duration from word count, target WPM and chunk size", () => {
    // 100 WPM, 1 word/chunk -> 600ms/chunk; 79 words -> 79 chunks.
    const plan = planReadingTiming(79, 100, 1);
    expect(plan.ms_per_chunk).toBe(600);
    expect(plan.chunk_count).toBe(79);
    expect(plan.planned_duration_ms).toBe(600 * 79);
  });

  it("rounds up partial final chunks", () => {
    // 10 words at 2 words/chunk -> 5 chunks; 11 words -> 6 chunks (last chunk partial).
    expect(planReadingTiming(10, 120, 2).chunk_count).toBe(5);
    expect(planReadingTiming(11, 120, 2).chunk_count).toBe(6);
  });

  it("shortens planned duration as target WPM increases", () => {
    const base = planReadingTiming(79, 100, 1);
    const fasterWpm = planReadingTiming(79, 200, 1);

    expect(fasterWpm.planned_duration_ms).toBeLessThan(base.planned_duration_ms);
  });

  it("changes ms per chunk when chunk size changes", () => {
    const base = planReadingTiming(79, 100, 1);
    const biggerChunks = planReadingTiming(79, 100, 2);

    expect(biggerChunks.ms_per_chunk).toBeGreaterThan(base.ms_per_chunk);
  });

  it("rejects non-positive WPM or chunk size", () => {
    expect(() => planReadingTiming(79, 0, 1)).toThrow();
    expect(() => planReadingTiming(79, -100, 1)).toThrow();
    expect(() => planReadingTiming(79, 100, 0)).toThrow();
  });

  it("rejects a negative word count", () => {
    expect(() => planReadingTiming(-1, 100, 1)).toThrow();
  });
});

describe("recordActualDuration", () => {
  it("records actual elapsed time alongside the deterministic plan", () => {
    const plan = planReadingTiming(79, 100, 1);
    const record = recordActualDuration(plan, 1_000, 48_500);

    expect(record).toMatchObject(plan);
    expect(record.actual_duration_ms).toBe(47_500);
  });

  it("never reports a negative elapsed time", () => {
    const plan = planReadingTiming(79, 100, 1);
    const record = recordActualDuration(plan, 5_000, 1_000);

    expect(record.actual_duration_ms).toBe(0);
  });
});
