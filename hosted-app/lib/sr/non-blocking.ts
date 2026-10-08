// SR-010 - Progression is separate from readiness: the next assigned passage is always available.

export type Verdict = "PASS" | "FAIL";
export type Result = { oral: Verdict; comprehension: Verdict };
export type Learner = {
  readonly history: readonly ({ passageId: string } & Result)[];
  readonly readiness: Readonly<Record<string, { oralReady: boolean; comprehensionReady: boolean }>>;
};

export const emptyLearner = (): Learner => ({ history: [], readiness: {} });

export function recordResult(l: Learner, passageId: string, r: Result): Learner {
  return {
    history: [...l.history, { passageId, ...r }],
    readiness: { ...l.readiness, [passageId]: { oralReady: r.oral === "PASS", comprehensionReady: r.comprehension === "PASS" } }
  };
}

/** Progression looks only at what has been attempted, never at pass/fail. */
export function nextAssigned(l: Learner, order: readonly string[]): string | null {
  const done = new Set(l.history.map((h) => h.passageId));
  return order.find((p) => !done.has(p)) ?? null;
}
