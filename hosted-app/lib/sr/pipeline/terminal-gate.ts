// SR-041 - Final QA is the terminal production gate: one result per package, FINAL_JSON_QA_PASS only when
// every mandatory check executed and passed; defects route to the owning role; FAIL never promotes.

import { MANDATORY_CHECKS, evidenceSummary, notExecuted, runCheck, type Evidence } from "./evidence";
import { findDuplicateKeys, strictParseBytes } from "./strict-json";
import { SCHEMA_VALIDATOR, validatePackageSchema } from "./package-schema";
import { buildRegistry, checkReferentialIntegrity } from "./referential-integrity";
import { checkUpstreamFidelity } from "./fidelity";
import { verifyHashesAndVersion, type ApprovedLock } from "./version-lock";
import { verifyInputManifest, type ManifestEntry } from "./final-validator";
import { descendants, type RoleId } from "./roles";
import type { Defect } from "./qa";

type Obj = Record<string, unknown>;
export type FinalQaInput = {
  bytes: Uint8Array;
  approvedPayloads: Partial<Record<number, Obj>>;
  manifest: { assembly: { role: RoleId; hash: string } | undefined; upstream: readonly ManifestEntry[] };
  lock: ApprovedLock;
};
export type FinalQaResult = { packageId: string | null; result: "FINAL_JSON_QA_PASS" | "FINAL_JSON_QA_FAIL"; evidence: Evidence[]; defects: Defect[] };

const VERSION = `node ${process.version}`;

export function runFinalQa(input: FinalQaInput): FinalQaResult {
  const evidence: Evidence[] = [];
  const defects: Defect[] = [];
  const defect = (rule: string, evidenceText: string, owner: RoleId) =>
    defects.push({
      defect_id: `FINAL-D${defects.length + 1}`, violated_rule: rule, evidence: evidenceText, owner_role: owner, return_to_role: owner,
      affected_dependencies: descendants(owner), severity: "BLOCKER"
    });
  const ownerOf = (problem: string): RoleId => {
    const m = /role (\d)/.exec(problem);
    return (m ? Number(m[1]) : 8) as RoleId;
  };
  const record = (check: (typeof MANDATORY_CHECKS)[number], meta: { command: string; validatorVersion: string }, fn: () => { ok: boolean; problems: string[] }) => {
    const e = runCheck(check, meta, fn);
    evidence.push(e);
    for (const f of e.failures) defect(check, f, ownerOf(f));
  };

  const text = new TextDecoder().decode(input.bytes);
  const parsed = strictParseBytes(input.bytes, { rejectDuplicates: false });
  record("STRICT_JSON", { command: "strictParseBytes(bytes)", validatorVersion: `${VERSION} JSON.parse + TextDecoder(fatal)` }, () => ({ ok: parsed.ok, problems: parsed.ok ? [] : [parsed.error] }));

  if (!parsed.ok) {
    for (const c of MANDATORY_CHECKS.slice(1)) evidence.push(notExecuted(c, "skipped: package did not parse", VERSION));
  } else {
    const pkg = parsed.value as Obj;
    record("DUPLICATE_KEYS", { command: "findDuplicateKeys(text)", validatorVersion: "sr-json-scan 1" }, () => {
      const d = findDuplicateKeys(text);
      return { ok: d.length === 0, problems: d.map((p) => `duplicate key at ${p}`) };
    });
    record("JSON_SCHEMA", { command: "ajv.compile(PACKAGE_SCHEMA)(package)", validatorVersion: `${SCHEMA_VALIDATOR.name} ${SCHEMA_VALIDATOR.version}` }, () => {
      const r = validatePackageSchema(pkg);
      return { ok: r.ok, problems: r.errors };
    });
    record("REFERENTIAL_INTEGRITY", { command: "checkReferentialIntegrity(package, registry)", validatorVersion: "sr-refint 1" }, () =>
      checkReferentialIntegrity(pkg, buildRegistry({ 3: input.approvedPayloads[3], 4: input.approvedPayloads[4], 5: input.approvedPayloads[5] })));
    record("UPSTREAM_FIDELITY", { command: "checkUpstreamFidelity(package, approved)", validatorVersion: "sr-fidelity 1" }, () => checkUpstreamFidelity(pkg, input.approvedPayloads));
    record("VERSION_HASHES", { command: "verifyHashesAndVersion(package, lock)", validatorVersion: "sha256 canonical-json 1" }, () => verifyHashesAndVersion(pkg, input.lock));
  }

  const manifest = verifyInputManifest(input.manifest.assembly, input.manifest.upstream);
  for (const p of manifest.problems) defect("INPUT_MANIFEST", p, ownerOf(p));

  const pkgId = parsed.ok && typeof (parsed.value as Obj)?.packageId === "string" ? String((parsed.value as Obj).packageId) : null;
  const pass = evidenceSummary(evidence).canPass && manifest.ok && defects.length === 0;
  return { packageId: pkgId, result: pass ? "FINAL_JSON_QA_PASS" : "FINAL_JSON_QA_FAIL", evidence, defects };
}

/** Only a genuine PASS (re-checked against its evidence) may promote the approved package. */
export function promote(r: FinalQaResult): { promoted: true } | { promoted: false; reason: string } {
  if (r.result !== "FINAL_JSON_QA_PASS") return { promoted: false, reason: "FINAL_QA_FAILED" };
  if (!evidenceSummary(r.evidence).canPass || r.defects.length) return { promoted: false, reason: "PASS_LACKS_EXECUTED_EVIDENCE" };
  return { promoted: true };
}
