// SR-040 - Every final-validator check leaves executable evidence (command, validator version, result,
// failure details). A check that did not run is NOT_EXECUTED and can never count as a pass.

export const MANDATORY_CHECKS = Object.freeze(["STRICT_JSON", "DUPLICATE_KEYS", "JSON_SCHEMA", "REFERENTIAL_INTEGRITY", "UPSTREAM_FIDELITY", "VERSION_HASHES"] as const);

export type EvidenceResult = "PASS" | "FAIL" | "NOT_EXECUTED";
export type Evidence = { check: string; command: string; validatorVersion: string; executed: boolean; result: EvidenceResult; failures: string[] };

export const notExecuted = (check: string, command: string, validatorVersion: string): Evidence =>
  ({ check, command, validatorVersion, executed: false, result: "NOT_EXECUTED", failures: [] });

export function runCheck(check: string, meta: { command: string; validatorVersion: string }, fn: () => { ok: boolean; problems: string[] }): Evidence {
  if (!meta.command || !meta.validatorVersion) return notExecuted(check, meta.command, meta.validatorVersion);
  try {
    const r = fn();
    return { check, ...meta, executed: true, result: r.ok ? "PASS" : "FAIL", failures: r.ok ? [] : r.problems };
  } catch (e) {
    return { check, ...meta, executed: true, result: "FAIL", failures: [`validator error: ${(e as Error).message}`] };
  }
}

export function evidenceSummary(evidence: readonly Evidence[]) {
  const by = new Map(evidence.map((e) => [e.check, e]));
  const failed = MANDATORY_CHECKS.filter((c) => by.get(c)?.result === "FAIL");
  const notRun = MANDATORY_CHECKS.filter((c) => !by.has(c) || by.get(c)!.result === "NOT_EXECUTED");
  return { canPass: failed.length === 0 && notRun.length === 0, failed: [...failed], notExecuted: [...notRun] };
}
