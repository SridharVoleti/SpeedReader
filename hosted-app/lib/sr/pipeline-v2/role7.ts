// Role 7 (deterministic): the ATTEMPT-OUTCOME-1.0 state machine. Code, not an LLM - no model-created transitions.
//
// The transition matrix is PARSED from the canonical spec (GLOBAL_RULES owns it); the Attempt_Outcome_Model CSV is only
// a mirror and is cross-checked (disagreement = MIRROR_DRIFT). Nothing here invents a threshold or a transition.

import { CanonicalError, type CanonicalPackage } from "./canonical";
import { canonicalRefs } from "./role1";
import type { Registry } from "./registry";
import { diffPaths } from "../pipeline/fidelity";

export type OutcomeInfo = { outcome: string; advancesLifecycle: boolean; preservesPhase: boolean; learnerFailure: boolean };
export type TransitionRow = { before: string; role: string; outcome: string; after: string; failedCycleIncrement: boolean };
export type OutcomeMachine = {
  modelVersion: string;
  states: string[];
  attemptRoles: string[];
  outcomes: OutcomeInfo[];
  table: TransitionRow[];
  mirrorChecked: boolean;
};

const MODEL_VERSION = "ATTEMPT-OUTCOME-1.0";
const strip = (s: string) => s.replace(/`/g, "").trim();
const splitList = (s: string, sep: RegExp) => strip(s).split(sep).map((x) => x.trim()).filter(Boolean);

export function parseOutcomeMachine(pkg: CanonicalPackage): OutcomeMachine {
  const specName = pkg.domainArtifact("GLOBAL_RULES");
  const lines = pkg.readArtifactText(specName).split(/\r?\n/);
  const sec = lines.findIndex((l) => /^## Attempt outcome model\b/.test(l));
  const head = sec < 0 ? -1 : lines.findIndex((l, i) => i > sec && /^### Canonical transition matrix\b/.test(l));
  if (head < 0) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`${specName}: "Canonical transition matrix" under the Attempt outcome model is missing`]);
  const tableLines: string[] = [];
  for (let i = head + 1; i < lines.length; i++) {
    if (lines[i].trim() === "" && !tableLines.length) continue;
    if (!lines[i].trim().startsWith("|")) break;
    tableLines.push(lines[i]);
  }
  const dataRows = tableLines.slice(2).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  if (tableLines.length < 3 || dataRows.some((c) => c.length !== 5)) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`${specName}: transition matrix is empty or malformed`]);

  const table: TransitionRow[] = [];
  let lastRoles: string[] = [];
  let lastBefore = "";
  for (const [before, role, outcome, after, inc] of dataRows) {
    const b = strip(before);
    const roles = strip(role) === "same" ? (b === lastBefore ? lastRoles : []) : splitList(role, /\s*\/\s*/);
    if (!roles.length) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`${specName}: matrix row for ${b} uses "same" with no prior roles`]);
    lastRoles = roles; lastBefore = b;
    for (const r of roles) for (const o of splitList(outcome, /\s*\/\s*/)) {
      table.push({ before: b, role: r, outcome: o, after: strip(after), failedCycleIncrement: /^yes$/i.test(strip(inc)) });
    }
  }

  const outcomeNames = [...new Set(table.map((t) => t.outcome))];
  const outcomes: OutcomeInfo[] = outcomeNames.map((outcome) => {
    const rows = table.filter((t) => t.outcome === outcome);
    return {
      outcome,
      advancesLifecycle: rows.some((r) => r.after !== r.before),
      preservesPhase: rows.every((r) => r.after === r.before),
      learnerFailure: outcome === "FAIL" // spec: the three non-scoreable outcomes "do not count as learner failure"
    };
  });
  const machine: OutcomeMachine = {
    modelVersion: MODEL_VERSION,
    states: [...new Set(table.map((t) => t.before))],
    attemptRoles: [...new Set(table.map((t) => t.role))],
    outcomes, table, mirrorChecked: false
  };
  machine.mirrorChecked = checkMirror(pkg, machine);
  return machine;
}

function checkMirror(pkg: CanonicalPackage, m: OutcomeMachine): boolean {
  const mirror = pkg.artifacts.find((a) => /_Attempt_Outcome_Model_v[\d.]+\.csv$/.test(a.name) && a.present);
  if (!mirror) return false;
  const drift: string[] = [];
  const yn = (b: boolean) => (b ? "YES" : "NO");
  const rows = pkg.readCsv(mirror.name);
  for (const o of m.outcomes) {
    const r = rows.find((x) => x.attempt_outcome === o.outcome);
    if (!r) { drift.push(`${o.outcome} missing from ${mirror.name}`); continue; }
    if (r.learner_failure !== yn(o.learnerFailure)) drift.push(`${o.outcome}.learner_failure mirror=${r.learner_failure} spec=${yn(o.learnerFailure)}`);
    if (r.preserve_phase !== yn(o.preservesPhase)) drift.push(`${o.outcome}.preserve_phase mirror=${r.preserve_phase} spec=${yn(o.preservesPhase)}`);
    if (r.allowed_to_advance_phase !== yn(o.advancesLifecycle)) drift.push(`${o.outcome}.allowed_to_advance_phase mirror=${r.allowed_to_advance_phase} spec=${yn(o.advancesLifecycle)}`);
  }
  for (const r of rows) if (!m.outcomes.some((o) => o.outcome === r.attempt_outcome)) drift.push(`${r.attempt_outcome} in mirror but not in the spec matrix`);
  if (drift.length) throw new CanonicalError("INVALID_CANONICAL_PACKAGE", drift.map((d) => `MIRROR_DRIFT: ${d}`));
  return true;
}

/** readiness_state_before + attempt_role + attempt_outcome -> readiness_state_after. Undefined combinations throw. */
export function applyAttempt(m: OutcomeMachine, a: { before: string; role: string; outcome: string }): { after: string; failedCycleIncrement: boolean } {
  const hit = m.table.find((t) => t.before === a.before && t.role === a.role && t.outcome === a.outcome);
  if (!hit) throw new Error(`ILLEGAL_TRANSITION: no canonical transition for ${a.before} + ${a.role} + ${a.outcome}`);
  return { after: hit.after, failedCycleIncrement: hit.failedCycleIncrement };
}

export type EvidenceFacts = { formValid: boolean; technicallyValid: boolean; evidenceSufficient: boolean; criteriaMet: boolean };

/**
 * Evidence validity -> canonical attempt_outcome, in the spec's order (OS12 step 9): TECHNICAL_INVALID for technical or
 * sample invalidity, INSUFFICIENT_EVIDENCE for an underpowered denominator, PASS/FAIL only when valid evidence is
 * scoreable. The spec does not rank INVALID_FORM against the other causes, so that combination fails closed.
 */
export function resolveAttemptOutcome(f: EvidenceFacts): string {
  if (!f.formValid) {
    if (!f.technicallyValid || !f.evidenceSufficient) throw new Error("AMBIGUOUS_EVIDENCE_CLASSIFICATION: INVALID_FORM combined with another invalidity; canonical precedence is not specified");
    return "INVALID_FORM";
  }
  if (!f.technicallyValid) return "TECHNICAL_INVALID";
  if (!f.evidenceSufficient) return "INSUFFICIENT_EVIDENCE";
  return f.criteriaMet ? "PASS" : "FAIL";
}

export type AttemptContract = {
  artifact_type: "ATTEMPT_OUTCOME_CONTRACT";
  envelope_version: number;
  passage_id: string;
  registry_coordinate: string;
  model_version: string;
  readiness_form_role: string;
  upstream_hashes: Record<string, string>;
  canonical: ReturnType<typeof canonicalRefs> & { mirror_artifact: string | null; mirror_sha256: string | null };
  outcomes: OutcomeInfo[];
  attempt_roles: string[];
  transitions: { before: string; role: string; outcome: string; after: string; failed_cycle_increment: boolean }[];
  evidence_classification: { source: string; precedence: string[]; invalid_form_combined_with_other_cause: string };
};

export function buildAttemptContract(pkg: CanonicalPackage, registry: Registry, passageId: string, role6Hash: string): AttemptContract {
  if (!/^[0-9a-f]{64}$/.test(role6Hash ?? "")) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", ["Role 7 requires the hash of the QA-approved Role 6 artifact"]);
  const r = registry.byId.get(passageId);
  if (!r) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`passage ${passageId} is not in the canonical registry`]);
  const m = parseOutcomeMachine(pkg);
  const mirror = pkg.artifacts.find((a) => /_Attempt_Outcome_Model_v[\d.]+\.csv$/.test(a.name) && a.present);
  return {
    artifact_type: "ATTEMPT_OUTCOME_CONTRACT",
    envelope_version: 1,
    passage_id: passageId,
    registry_coordinate: r.coordinate,
    model_version: m.modelVersion,
    readiness_form_role: r.row.readiness_form_role,
    upstream_hashes: { "6": role6Hash },
    canonical: { ...canonicalRefs(pkg), mirror_artifact: mirror?.name ?? null, mirror_sha256: mirror?.sha256 ?? null },
    outcomes: m.outcomes,
    attempt_roles: m.attemptRoles,
    transitions: m.table.map((t) => ({ before: t.before, role: t.role, outcome: t.outcome, after: t.after, failed_cycle_increment: t.failedCycleIncrement })),
    evidence_classification: {
      source: "OS-1.0 OS12 step 9",
      precedence: ["TECHNICAL_INVALID", "INSUFFICIENT_EVIDENCE", "PASS|FAIL"],
      invalid_form_combined_with_other_cause: "FAIL_CLOSED_AMBIGUOUS"
    }
  };
}

export function verifyAttemptContract(c: AttemptContract, pkg: CanonicalPackage, registry: Registry, role6Hash: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (c?.upstream_hashes?.["6"] !== role6Hash) problems.push(`role 6 hash ${String(c?.upstream_hashes?.["6"])} is not the current approved Role 6 hash ${role6Hash}`);
  let expected: AttemptContract;
  try { expected = buildAttemptContract(pkg, registry, c?.passage_id, role6Hash); }
  catch (e) { return { ok: false, problems: [...problems, (e as Error).message] }; }
  for (const p of diffPaths(expected, c)) problems.push(`${p.replace(/^\$\./, "")} differs from the canonical derivation`);
  return { ok: problems.length === 0, problems };
}
