// Mechanical facts are decided by code, never by a model. This module runs the deterministic checks that apply to a
// semantic creator candidate (currently: the canonical COUNT-100 exact-100 check for Role 2).

import { validateBandA } from "./count100";

export type MachineEvidence = {
  check: string;
  validator: string;
  executed: boolean;
  result: "PASS" | "FAIL" | "NOT_EXECUTED";
  details: Record<string, unknown>;
  failures: string[];
};

export type MachineDefect = { violated_rule_id: string; expected: string; actual: string; evidence_locator: string };

export function runMachineChecks(roleId: number, artifact: unknown, passageId: string): MachineEvidence[] {
  const out: MachineEvidence[] = [];
  const a = (artifact ?? {}) as Record<string, unknown>;
  const identity: MachineEvidence = a.passage_id === passageId
    ? { check: "ARTIFACT_PASSAGE_IDENTITY", validator: "pipeline-v2/engine", executed: true, result: "PASS", details: { passage_id: passageId }, failures: [] }
    : { check: "ARTIFACT_PASSAGE_IDENTITY", validator: "pipeline-v2/engine", executed: true, result: "FAIL", details: { expected: passageId, actual: a.passage_id ?? null }, failures: [`artifact.passage_id must equal ${passageId}`] };
  out.push(identity);

  if (roleId === 2) {
    const body = a.body;
    if (typeof body !== "string" || typeof a.title !== "string") {
      out.push({ check: "COUNT-100", validator: "COUNT-100-v2.0", executed: true, result: "FAIL", details: {}, failures: ["PASSAGE_TEXT must provide string `title` and `body` (title separately plus one passage body)"] });
    } else {
      const r = validateBandA(body);
      const toks = r.tokenization.tokens;
      out.push({
        check: "COUNT-100", validator: "COUNT-100-v2.0", executed: true, result: r.ok ? "PASS" : "FAIL",
        details: {
          status: r.status, token_count: r.count,
          first_token: toks[0]?.text ?? null, last_token: toks[toks.length - 1]?.text ?? null,
          boundary_tokens: r.ok ? { t33: toks[32].text, t34: toks[33].text, t66: toks[65].text, t67: toks[66].text } : null
        },
        failures: r.errors
      });
    }
  }
  return out;
}

export const machinePassed = (ev: MachineEvidence[]) => ev.every((e) => e.executed && e.result === "PASS");

export function machineDefects(roleId: number, ev: MachineEvidence[]): MachineDefect[] {
  return ev.filter((e) => e.result !== "PASS").flatMap((e) => (e.failures.length ? e.failures : [`${e.check} did not pass`]).map((f) => ({
    violated_rule_id: e.check === "COUNT-100" ? (/INVALID_COUNT_TEXT|hidden|nonlexical/i.test(f) ? "COUNT-100:INVALID_COUNT_TEXT" : "COUNT-100:INVALID_WORD_COUNT") : `MACHINE:${e.check}`,
    expected: e.check === "COUNT-100" ? "a valid COUNT-100 v2.0 tokenization with exactly 100 tokens" : `${e.check} PASS`,
    actual: f,
    evidence_locator: `machine_check:${e.check}:role${roleId}`
  })));
}
