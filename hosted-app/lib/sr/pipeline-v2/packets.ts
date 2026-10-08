// Cowork job packets. A semantic task is assembled from:
//   COMMON CONTRACT + ROLE CONTRACT + CANONICAL VERSION/HASH + canonical excerpts + REGISTRY ROW (the approved Role 1
//   PASSAGE_SPEC) + QA-APPROVED upstream artifacts + ACTIVE DEFECT CONTEXT.
// The machine envelope (job_packet.schema.json, validated with AJV) cannot carry excerpts or contract text, so the
// self-contained rendered prompt (.prompt.md) is the artifact a person pastes into a fresh Cowork context.
// QA packets never include creator reasoning, notes, run references or self-reported checks.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import type { MachineEvidence } from "./machine-checks";
import type { Excerpt } from "./excerpts";

export const roleLabel = (role: number): string => (role === 6 ? "6S" : String(role));
export const roleFromLabel = (label: string | number): number => (String(label) === "6S" ? 6 : Number(label));

export type UpstreamArtifact = { role_id: string; artifact_type: string; artifact_id: string; version: number; content_hash: string; content: unknown };
export type DefectContext = Record<string, unknown>;
export type JobPacket = {
  job_id: number;
  production_unit_id: string;
  role_id: string;
  job_type: "CREATOR" | "QA";
  attempt_no: number;
  canonical_package_id: string;
  canonical_package_hash: string;
  applicable_acceptance_criteria_ids: string[];
  approved_upstream_artifacts: UpstreamArtifact[];
  candidate_artifact: { artifact_id: string; role_id: string; version: number; content_hash: string; content: unknown } | null;
  machine_check_evidence: MachineEvidence[];
  open_defect_context: DefectContext[];
};

export type PacketInput = {
  packet: JobPacket;
  canonicalVersion: string;
  freezeStatus: string;
  excerpts: Excerpt[];
  caveats: string[];
  contracts: { common: string; role: string; roleFile: string };
  resultSchemaText: string;
};

const readSchema = (dir: string, name: string) => {
  const p = join(dir, "orchestrator", name);
  if (!existsSync(p)) throw new Error(`architecture schema missing: ${p}`);
  return readFileSync(p, "utf8");
};

export function loadContracts(architectureDir: string, roleId: number, jobType: "CREATOR" | "QA") {
  const roleFile = `ROLE_0${roleLabel(roleId)}_${jobType}.md`;
  const read = (n: string) => {
    const p = join(architectureDir, "contracts", n);
    if (!existsSync(p)) throw new Error(`contract file missing: ${p}`);
    return readFileSync(p, "utf8");
  };
  return { common: read("COMMON_AGENT_CONTRACT.md"), role: read(roleFile), roleFile };
}

export function loadSchemas(architectureDir: string) {
  const packetText = readSchema(architectureDir, "job_packet.schema.json");
  const resultText = readSchema(architectureDir, "agent_result.schema.json");
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const packet = ajv.compile(JSON.parse(packetText));
  const result = ajv.compile(JSON.parse(resultText));
  const defect = ajv.compile(DEFECT_SCHEMA);
  return {
    resultSchemaText: resultText,
    validatePacket: (p: unknown) => ({ ok: packet(p) as boolean, errors: (packet.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) }),
    validateResult: (r: unknown) => ({ ok: result(r) as boolean, errors: (result.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) }),
    validateDefect: (d: unknown) => ({ ok: defect(d) as boolean, errors: (defect.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`) })
  };
}

/** COMMON_AGENT_CONTRACT section 5 - the orchestrator fills production_unit_id/detected_by_role/defect_id when absent. */
export const DEFECT_SCHEMA = {
  type: "object",
  required: ["violated_rule_id", "expected", "actual", "evidence_locator", "severity", "owner_role", "source_role", "source_artifact_id"],
  properties: {
    defect_id: { type: "string" },
    production_unit_id: { type: "string" },
    detected_by_role: { type: ["string", "integer"] },
    source_role: { type: ["string", "integer"] },
    source_artifact_id: { type: "string" },
    source_hash: { type: ["string", "null"] },
    violated_rule_id: { type: "string", minLength: 1 },
    expected: { type: "string" },
    actual: { type: "string", minLength: 1 },
    evidence_locator: { type: "string" },
    severity: { enum: ["BLOCKER", "NON_BLOCKING"] },
    owner_role: { enum: ["1", "2", "3", "4", "5", "6", "6S", "CANONICAL_OWNER", 1, 2, 3, 4, 5, 6] },
    affected_artifacts: { type: "array" },
    recommended_revalidation: { type: "array" }
  },
  additionalProperties: true
} as const;

const fence = (obj: unknown) => "```json\n" + JSON.stringify(obj, null, 2) + "\n```";

export function renderPrompt(input: PacketInput): string {
  const p = input.packet;
  const qa = p.job_type === "QA";
  const out: string[] = [];
  out.push(`# SpeedReader Pipeline v2 - Cowork job ${p.job_id}: Role ${p.role_id} ${p.job_type} (attempt ${p.attempt_no})`);
  out.push(qa
    ? "> **INDEPENDENT QA.** Run this in a FRESH Cowork context that has never seen the creator's work or reasoning. You are read-only: do not repair, rewrite or improve the candidate. You cannot approve; you return PASS/FAIL with defects and the orchestrator decides."
    : "> **CREATOR.** Run this in a FRESH Cowork context. Create/correct only the artifact owned by this role. You return READY_FOR_INDEPENDENT_QA, never PASS. A different, fresh context will perform QA.");
  out.push("> This packet is self-contained. Do not rely on earlier chats, memory or other files. No model API is involved in this pipeline; you are the semantic worker for this one task.");
  if (input.caveats.length) out.push("## 0. AUTHORITY CAVEATS (read first)\n" + input.caveats.map((c) => `- ${c}`).join("\n") + "\n\nIf a required canonical definition is absent you must NOT invent it: return `BLOCKED_CANONICAL` (creator) / `QA_BLOCKED_NOT_EXECUTED` (QA) and say exactly what is missing.");
  out.push("## 1. Common semantic agent contract (verbatim)\n\n" + input.contracts.common.trim());
  out.push(`## 2. Role contract (verbatim: ${input.contracts.roleFile})\n\n` + input.contracts.role.trim());
  out.push("## 3. Job envelope (immutable inputs)\n\n" + fence({
    job_id: p.job_id, production_unit_id: p.production_unit_id, role_id: p.role_id, job_type: p.job_type, attempt_no: p.attempt_no,
    canonical_package_id: p.canonical_package_id, canonical_package_hash: p.canonical_package_hash,
    canonical_package_version: input.canonicalVersion, canonical_freeze_status: input.freezeStatus,
    applicable_acceptance_criteria_ids: p.applicable_acceptance_criteria_ids
  }));
  const spec = p.approved_upstream_artifacts.find((a) => a.role_id === "1");
  if (spec) {
    out.push("## 4. Registry row (canonical row contract, via the approved Role 1 PASSAGE_SPEC)\n\n" + fence((spec.content as { row?: unknown }).row ?? spec.content));
  }
  out.push("## 5. Applicable canonical excerpts (verbatim from the locked specification)\n\n" + (input.excerpts.length
    ? input.excerpts.map((e) => `### ${e.heading}\n\n${e.text}`).join("\n\n")
    : "_No canonical excerpt is mapped to this role._"));
  out.push("## 6. QA-approved upstream artifacts (the ONLY authoritative inputs; WIP is never used)\n\n" + (p.approved_upstream_artifacts.length
    ? p.approved_upstream_artifacts.map((a) => `### Role ${a.role_id} ${a.artifact_type} - ${a.artifact_id} v${a.version} - sha256 ${a.content_hash}\n\n${fence(a.content)}`).join("\n\n")
    : "_None._"));
  if (qa && p.candidate_artifact) {
    out.push(`## 7. Candidate under review (immutable) - ${p.candidate_artifact.artifact_id} v${p.candidate_artifact.version}\n\nContent hash (you must echo it as \`candidate_hash\`): \`${p.candidate_artifact.content_hash}\`\n\n` + fence(p.candidate_artifact.content));
  }
  out.push(`## ${qa ? "8" : "7"}. Machine-check evidence (authoritative for mechanical facts; do not recompute by hand)\n\n` + (p.machine_check_evidence.length ? fence(p.machine_check_evidence) : "_No machine check is defined for this role in this phase._"));
  out.push(`## ${qa ? "9" : "8"}. Active defect context\n\n` + (p.open_defect_context.length
    ? (qa ? "These defects were reported against earlier work. Verify whether each is actually fixed.\n\n" : "Fix ONLY the defects below within your own role; if the root cause is upstream, touch back instead.\n\n") + fence(p.open_defect_context)
    : "_None - this is an initial attempt._"));
  out.push(`## ${qa ? "10" : "9"}. Required output - exactly ONE JSON object, nothing else\n\nIt must validate against this schema:\n\n\`\`\`json\n${input.resultSchemaText.trim()}\n\`\`\`\n\n` + (qa
    ? `Rules: \`state\` is \`QA_PASS\`, \`QA_FAIL\` or \`QA_BLOCKED_NOT_EXECUTED\`. \`candidate_hash\` MUST be \`${p.candidate_artifact?.content_hash}\`. \`QA_PASS\` requires zero BLOCKER defects. Every BLOCKER is a complete defect object (see common contract section 5) whose \`owner_role\` is the TRUE owner (this role, an upstream role number, or \`CANONICAL_OWNER\`). Set \`artifact\` to null. Never set a creator-style state.\n\nSkeleton:\n\n`
    : `Rules: \`state\` is \`READY_FOR_INDEPENDENT_QA\`, \`BLOCKED_UPSTREAM\`, \`BLOCKED_CANONICAL\` or \`ESCALATED\`. \`artifact\` is a JSON object that includes \`"passage_id": "${p.production_unit_id}"\`${p.role_id === "2" ? " plus string fields `title` and `body` (the title separately, and exactly one learner-visible passage body that satisfies COUNT-100 v2.0; the orchestrator runs the machine count)" : ", with structure governed by the role contract and the canonical package (do not add fields the canonical package does not define)"}. Do not claim PASS. A blocker whose root cause is another role is reported as \`BLOCKED_UPSTREAM\` with a complete defect object naming the true \`owner_role\`; you never edit another role's artifact.\n\nSkeleton:\n\n`)
    + fence({
      job_id: p.job_id, production_unit_id: p.production_unit_id, role_id: p.role_id, job_type: p.job_type,
      state: qa ? "QA_PASS | QA_FAIL | QA_BLOCKED_NOT_EXECUTED" : "READY_FOR_INDEPENDENT_QA | BLOCKED_UPSTREAM | BLOCKED_CANONICAL | ESCALATED",
      artifact: qa ? null : { passage_id: p.production_unit_id },
      candidate_hash: qa ? p.candidate_artifact?.content_hash : "<optional sha256 you computed>",
      checks_run: [], blocking_defects: [], nonblocking_observations: [], notes: null
    }));
  out.push("---\nAfter you return the JSON, STOP. The orchestrator imports it with `pipeline import-result " + p.job_id + " <result-file> --run-ref <your Cowork task id>`.");
  return out.join("\n\n") + "\n";
}
