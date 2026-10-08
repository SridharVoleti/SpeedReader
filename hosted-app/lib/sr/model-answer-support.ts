// SR-004 / SR-045 - Best possible comprehension (BPC) is the only comprehension support. Showing it is
// logged and every later attempt is tagged assisted; recorded outcomes are immutable, so assisted
// performance can never overwrite or masquerade as first independent evidence.

export type AttemptRole = "FIRST_INDEPENDENT" | "ASSISTED";
export type AttemptSlot = { attemptRole: AttemptRole; assisted: boolean; evidenceType: "INDEPENDENT" | "ASSISTED" };
export type AttemptOutcome = Readonly<AttemptSlot & { score: number }>;
export type AttemptLog = {
  readonly passageId: string;
  readonly exposures: readonly { kind: "BPC" }[];
  readonly attempts: readonly AttemptOutcome[];
};

export const newAttemptLog = (passageId: string): AttemptLog => ({ passageId, exposures: [], attempts: [] });

export function revealBpc(log: AttemptLog, ctx: { submitted: boolean; bpcApproved: boolean }): { ok: boolean; log: AttemptLog } {
  if (!ctx.submitted || !ctx.bpcApproved) return { ok: false, log };
  return { ok: true, log: { ...log, exposures: [...log.exposures, { kind: "BPC" }] } };
}

export function startNextAttempt(log: AttemptLog): AttemptSlot {
  const assisted = log.exposures.length > 0 || log.attempts.length > 0;
  return assisted
    ? { attemptRole: "ASSISTED", assisted: true, evidenceType: "ASSISTED" }
    : { attemptRole: "FIRST_INDEPENDENT", assisted: false, evidenceType: "INDEPENDENT" };
}

export function recordOutcome(log: AttemptLog, slot: AttemptSlot, score: number): AttemptLog {
  return { ...log, attempts: [...log.attempts, Object.freeze({ ...slot, score })] };
}

export const independentEvidence = (log: AttemptLog): AttemptOutcome | undefined =>
  log.attempts.find((a) => a.evidenceType === "INDEPENDENT");
