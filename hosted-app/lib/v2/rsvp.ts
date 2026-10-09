// APP-READ-001/002/003/005/006 + APP-NFR-009 - one-word-at-a-time reader timing engine (first 150 passages).
//
// Pure and clock-injected so the browser component is a thin shell. The schedule is derived from the canonical
// token stream (never re-tokenised) and the ENGINE-owned WPM: every token is on screen for exactly 60000/WPM ms,
// positions come from absolute elapsed time (not accumulated timer ticks), so rendering delays cannot distort the
// configured speed. A pause freezes elapsed time; resuming continues at the same token; completion fires at most
// once and only after the final token has been shown for its full duration (no phantom completion).

export type RsvpToken = { index: number; text: string };

export type RsvpPlan = {
  wpm: number;
  msPerToken: number;
  totalMs: number;
  tokens: readonly RsvpToken[];
};

export function planRsvp(tokens: readonly RsvpToken[], wpm: number): RsvpPlan {
  if (!Number.isFinite(wpm) || wpm <= 0) throw new RangeError("wpm must be positive");
  if (tokens.length === 0) throw new RangeError("a passage needs at least one token");
  const msPerToken = 60_000 / wpm;
  return { wpm, msPerToken, totalMs: msPerToken * tokens.length, tokens };
}

/** Token index visible at `elapsedMs` of reading time, or null once the passage has finished. */
export function tokenAt(plan: RsvpPlan, elapsedMs: number): RsvpToken | null {
  if (elapsedMs < 0) return plan.tokens[0];
  if (elapsedMs >= plan.totalMs) return null;
  return plan.tokens[Math.min(plan.tokens.length - 1, Math.floor(elapsedMs / plan.msPerToken))];
}

export type ReaderPhase = "READY" | "PLAYING" | "PAUSED" | "FINISHED";

export type ReaderState = {
  phase: ReaderPhase;
  /** Reading time accumulated while PLAYING. */
  elapsedMs: number;
  /** Wall-clock stamp of the last PLAYING tick/start; null unless PLAYING. */
  lastStamp: number | null;
  /** True once the single completion event has been emitted. */
  completionEmitted: boolean;
  /** Pauses caused by interruptions (tab hidden, user pause). */
  interruptions: number;
};

export const initialReader = (): ReaderState => ({ phase: "READY", elapsedMs: 0, lastStamp: null, completionEmitted: false, interruptions: 0 });

export function start(s: ReaderState, now: number): ReaderState {
  if (s.phase === "PLAYING" || s.phase === "FINISHED") return s;
  return { ...s, phase: "PLAYING", lastStamp: now };
}

export function pause(s: ReaderState, now: number): ReaderState {
  if (s.phase !== "PLAYING") return s;
  return { ...s, phase: "PAUSED", elapsedMs: s.elapsedMs + Math.max(0, now - (s.lastStamp ?? now)), lastStamp: null, interruptions: s.interruptions + 1 };
}

/** Advance the clock. Elapsed time comes from timestamps, never from the number of ticks. */
export function tick(plan: RsvpPlan, s: ReaderState, now: number): { state: ReaderState; completed: boolean } {
  if (s.phase !== "PLAYING") return { state: s, completed: false };
  const elapsedMs = s.elapsedMs + Math.max(0, now - (s.lastStamp ?? now));
  if (elapsedMs >= plan.totalMs) {
    const completed = !s.completionEmitted;
    return { state: { ...s, phase: "FINISHED", elapsedMs: plan.totalMs, lastStamp: null, completionEmitted: true }, completed };
  }
  return { state: { ...s, elapsedMs, lastStamp: now }, completed: false };
}

/** Progress position for display (0..1), derived from reading time only. */
export function progress(plan: RsvpPlan, s: ReaderState, now?: number): number {
  const live = s.phase === "PLAYING" && now !== undefined ? Math.max(0, now - (s.lastStamp ?? now)) : 0;
  return Math.min(1, (s.elapsedMs + live) / plan.totalMs);
}

/** Canonical tokens from passage text: whitespace-delimited, indices 1..N, identical to the count the package validated. */
export function tokensFromText(text: string): RsvpToken[] {
  return text.trim().split(/\s+/).filter(Boolean).map((t, i) => ({ index: i + 1, text: t }));
}
