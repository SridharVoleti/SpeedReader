// SR-005 - Two weeks of learner inactivity makes evidence stale. The exact boundary is PROVISIONAL and
// pending confirmation, so the convention is explicit and switchable rather than implied.

export type Boundary = "STALE_AT_COMPLETE_DAYS" | "STALE_AFTER_COMPLETE_DAYS";
export type InactivityPolicy = { inactiveDays: number; status: "PROVISIONAL_PILOT"; boundary: Boundary };

export const INACTIVITY_POLICY: InactivityPolicy = Object.freeze({ inactiveDays: 14, status: "PROVISIONAL_PILOT", boundary: "STALE_AT_COMPLETE_DAYS" });

const DAY_MS = 86_400_000;

export function evidenceFreshness(lastActivity: Date, now: Date, policy: InactivityPolicy = INACTIVITY_POLICY) {
  const elapsed = now.getTime() - lastActivity.getTime();
  if (elapsed < 0) throw new RangeError("last activity is after now");
  const limit = policy.inactiveDays * DAY_MS;
  const stale = policy.boundary === "STALE_AT_COMPLETE_DAYS" ? elapsed >= limit : elapsed > limit;
  return { state: stale ? ("STALE" as const) : ("FRESH" as const), completeDays: Math.floor(elapsed / DAY_MS) };
}

export function certifyFromEvidence(evidence: { confirmed: boolean }, state: "FRESH" | "STALE") {
  if (state === "STALE") return { certified: false as const, reason: "STALE_EVIDENCE_REQUIRES_REVALIDATION" as const };
  return { certified: evidence.confirmed };
}
