import { describe, expect, it } from "vitest";
import { count100 } from "../../../lib/sr/pipeline-v2/count100";
import { initialReader, pause, planRsvp, progress, start, tick, tokenAt, tokensFromText } from "../../../lib/v2/rsvp";

const text = "Mia has a red kite. She runs to the hill, and the wind lifts it high.";
const tokens = tokensFromText(text);

describe("APP-READ-001 canonical token stream", () => {
  it("indices run 1..N and match the canonical COUNT-100 tokenizer on the same text", () => {
    const canonical = count100(text).tokens;
    expect(tokens).toHaveLength(canonical.length);
    expect(tokens.map((t) => t.index)).toEqual(canonical.map((t) => t.index));
    expect(tokens.map((t) => t.text)).toEqual(canonical.map((t) => t.text));
  });
});

describe("APP-READ-002 WPM-driven display", () => {
  it("shows each token for exactly 60000/WPM ms and the passage for N tokens", () => {
    const plan = planRsvp(tokens, 120);
    expect(plan.msPerToken).toBe(500);
    expect(plan.totalMs).toBe(500 * tokens.length);
    expect(tokenAt(plan, 0)!.index).toBe(1);
    expect(tokenAt(plan, 499)!.index).toBe(1);
    expect(tokenAt(plan, 500)!.index).toBe(2);
    expect(tokenAt(plan, plan.totalMs - 1)!.index).toBe(tokens.length);
    expect(tokenAt(plan, plan.totalMs)).toBeNull();
  });
  it("a higher engine WPM is strictly faster", () => {
    expect(planRsvp(tokens, 150).totalMs).toBeLessThan(planRsvp(tokens, 90).totalMs);
  });
  it("rejects non-positive WPM and empty passages", () => {
    expect(() => planRsvp(tokens, 0)).toThrow(RangeError);
    expect(() => planRsvp(tokens, NaN)).toThrow(RangeError);
    expect(() => planRsvp([], 100)).toThrow(RangeError);
  });
});

describe("APP-NFR-009 timing stays correct under rendering delays", () => {
  it("position depends on timestamps, not tick count: one late tick lands on the same token as many on-time ticks", () => {
    const plan = planRsvp(tokens, 120);
    let a = start(initialReader(), 1000);
    for (let t = 1016; t <= 3016; t += 16) a = tick(plan, a, t).state;
    const b = tick(plan, start(initialReader(), 1000), 3016).state; // a single 2s-late frame
    expect(b.elapsedMs).toBe(a.elapsedMs);
    expect(tokenAt(plan, b.elapsedMs)!.index).toBe(tokenAt(plan, a.elapsedMs)!.index);
  });
  it("a janky 400ms frame skips ahead rather than slowing the reading", () => {
    const plan = planRsvp(tokens, 120);
    const s = tick(plan, start(initialReader(), 0), 400).state;
    expect(s.elapsedMs).toBe(400);
  });
  it("a clock that goes backwards never rewinds reading time", () => {
    const plan = planRsvp(tokens, 120);
    const s = tick(plan, start(initialReader(), 1000), 900).state;
    expect(s.elapsedMs).toBe(0);
  });
});

describe("APP-READ-003 single idempotent completion event", () => {
  it("completes exactly once, only after the final token has been shown in full", () => {
    const plan = planRsvp(tokens, 120);
    let s = start(initialReader(), 0);
    let r = tick(plan, s, plan.totalMs - 1);
    expect(r.completed).toBe(false);
    expect(r.state.phase).toBe("PLAYING");
    r = tick(plan, r.state, plan.totalMs);
    expect(r.completed).toBe(true);
    expect(r.state.phase).toBe("FINISHED");
    s = r.state;
    expect(tick(plan, s, plan.totalMs + 5000)).toEqual({ state: s, completed: false });
    expect(start(s, 99999)).toBe(s); // cannot be restarted into a second completion
  });
});

describe("APP-READ-005/006 interruptions and session boundary", () => {
  it("a pause freezes reading time; resume continues at the same token with no phantom completion", () => {
    const plan = planRsvp(tokens, 120);
    let s = start(initialReader(), 0);
    s = tick(plan, s, 1200).state;
    s = pause(s, 1300);
    expect(s).toMatchObject({ phase: "PAUSED", elapsedMs: 1300, interruptions: 1 });
    expect(tick(plan, s, 999999)).toEqual({ state: s, completed: false });
    s = start(s, 50_000);
    expect(tokenAt(plan, s.elapsedMs)!.index).toBe(tokenAt(plan, 1300)!.index);
    expect(s.completionEmitted).toBe(false);
  });
  it("an abandoned passage (never ticked to the end) never emits completion", () => {
    const plan = planRsvp(tokens, 120);
    let s = start(initialReader(), 0);
    s = pause(tick(plan, s, plan.totalMs - 600).state, plan.totalMs - 500);
    expect(s.completionEmitted).toBe(false);
    expect(s.phase).toBe("PAUSED");
  });
  it("pausing when not playing is a no-op", () => {
    const s = initialReader();
    expect(pause(s, 5)).toBe(s);
  });
  it("progress is derived from reading time only", () => {
    const plan = planRsvp(tokens, 120);
    const s = start(initialReader(), 0);
    expect(progress(plan, s, 0)).toBe(0);
    expect(progress(plan, s, plan.totalMs / 2)).toBeCloseTo(0.5);
    expect(progress(plan, tick(plan, s, plan.totalMs * 2).state)).toBe(1);
  });
});
