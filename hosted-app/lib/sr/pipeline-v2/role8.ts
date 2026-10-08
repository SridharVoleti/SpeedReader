// Role 8 (deterministic): assemble the final package from the QA-approved Role 1-7 artifacts and validate it.
// It adds ZERO educational semantics: sections are the approved artifacts byte-for-byte (as JSON values); the only
// additions are identity/lock metadata. Every mandatory check must be EXECUTED and PASS - a missing or unexecuted
// check is a FAIL. Failures are returned with the owning role so the orchestrator can route them upstream; Role 8
// never edits another role's artifact.

import Ajv2020 from "ajv/dist/2020";
import ajvPackage from "ajv/package.json";
import { canonicalHash } from "../pipeline/hash";
import { checkUpstreamFidelity } from "../pipeline/fidelity";
import { SECTION_ROLE, SECTIONS, type Section } from "../pipeline/sections";
import { findDuplicateKeys, strictParseBytes } from "../pipeline/strict-json";
import { notExecuted, runCheck, type Evidence } from "../pipeline/evidence";

type Obj = Record<string, unknown>;

export const V2_MANDATORY_CHECKS = [
  "STRICT_JSON", "DUPLICATE_KEYS", "JSON_SCHEMA", "REFERENTIAL_INTEGRITY", "UPSTREAM_FIDELITY", "VERSION_HASH_LOCK",
  "CURRENT_INPUTS", "QA_CERTIFICATES", "PROMOTION_SMOKE"
] as const;
export type V2Check = (typeof V2_MANDATORY_CHECKS)[number];

export type SchemaAuthority = "CANONICAL" | "CONFIGURED_NON_CANONICAL" | "INTERIM_ENVELOPE";
export type RefRule = { id: string; from: { section: Section; path: string }; to: { section: Section; path: string }; owner?: number };
export type SectionInput = {
  role: number; artifactId: string; version: number; hash: string; artifact: unknown;
  certificateHash: string | null; qaKind: string | null;
  /** the hash currently recorded as approved for this role (staleness check) */
  currentHash: string | null;
};
export type Role8Context = {
  passageId: string;
  packageVersion: number;
  canonical: { id: string; version: string; hash: string };
  unitCanonicalHash: string;
  sections: Record<number, SectionInput>;
  schema: { authority: SchemaAuthority; id: string; schema: object };
  refRules: RefRule[];
  refRulesAuthority: "CANONICAL" | "CONFIGURED_NON_CANONICAL" | "NONE";
};

export type RoutedProblem = { check: V2Check | "INPUT"; message: string; ownerRole: number; locator: string };
export type Role8Validation = { ok: boolean; evidence: Evidence[]; problems: RoutedProblem[]; caveats: string[] };

const SCHEMA_VALIDATOR = { name: "ajv/2020", version: (ajvPackage as { version: string }).version };
const HASH = { type: "string", pattern: "^[0-9a-f]{64}$" } as const;

/** NON-CANONICAL structural envelope used only when the canonical final schema is absent and a human acknowledged the gap. */
export const INTERIM_ENVELOPE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $comment: "INTERIM_NON_CANONICAL envelope: structure of the assembled package only. It says nothing about artifact semantics.",
  type: "object", additionalProperties: false,
  required: ["package_id", "package_version", "passage_id", "canonical", "sections", "lock"],
  properties: {
    package_id: { type: "string", pattern: "^PKG-W1-\\d{4}$" },
    package_version: { type: "integer", minimum: 1 },
    passage_id: { type: "string", pattern: "^W1-\\d{4}$" },
    canonical: { type: "object", additionalProperties: false, required: ["package_id", "package_version", "package_hash"], properties: { package_id: { type: "string" }, package_version: { type: "string" }, package_hash: HASH } },
    sections: {
      type: "object", additionalProperties: false, required: [...SECTIONS],
      properties: Object.fromEntries(SECTIONS.map((s) => [s, { type: "object", required: ["passage_id"] }]))
    },
    lock: {
      type: "object", additionalProperties: false, required: ["role_hashes", "qa_certificates"],
      properties: {
        role_hashes: { type: "object", additionalProperties: false, required: ["1", "2", "3", "4", "5", "6", "7"], properties: Object.fromEntries(["1", "2", "3", "4", "5", "6", "7"].map((k) => [k, HASH])) },
        qa_certificates: { type: "object", additionalProperties: false, required: ["1", "2", "3", "4", "5", "6", "7"], properties: Object.fromEntries(["1", "2", "3", "4", "5", "6", "7"].map((k) => [k, HASH])) }
      }
    }
  }
} as const;

export function assembleFinalPackage(ctx: Role8Context): { pkg: Obj; bytes: Uint8Array } {
  const sections: Obj = {};
  const roleHashes: Record<string, string> = {};
  const certs: Record<string, string> = {};
  for (const s of SECTIONS) {
    const role = SECTION_ROLE[s];
    const input = ctx.sections[role];
    if (!input) throw new Error(`role ${role} approved artifact missing; cannot assemble`);
    sections[s] = input.artifact;
    roleHashes[String(role)] = input.hash;
    certs[String(role)] = input.certificateHash ?? "";
  }
  const pkg: Obj = {
    package_id: `PKG-${ctx.passageId}`,
    package_version: ctx.packageVersion,
    passage_id: ctx.passageId,
    canonical: { package_id: ctx.canonical.id, package_version: ctx.canonical.version, package_hash: ctx.canonical.hash },
    sections,
    lock: { role_hashes: roleHashes, qa_certificates: certs }
  };
  return { pkg, bytes: new TextEncoder().encode(JSON.stringify(pkg, null, 2)) };
}

function select(root: unknown, path: string): string[] {
  if (!path.startsWith("$")) throw new Error(`bad path ${path}`);
  let cur: unknown[] = [root];
  const re = /\.([A-Za-z0-9_]+)|\[\*\]|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path.slice(1)))) {
    if (m[1] !== undefined) cur = cur.flatMap((c) => (c && typeof c === "object" && !Array.isArray(c) && m![1] in (c as Obj) ? [(c as Obj)[m![1]]] : []));
    else if (m[2] !== undefined) cur = cur.flatMap((c) => (Array.isArray(c) && c.length > Number(m![2]) ? [c[Number(m![2])]] : []));
    else cur = cur.flatMap((c) => (Array.isArray(c) ? c : []));
  }
  return cur.filter((v) => typeof v === "string") as string[];
}

const ownerFromPointer = (instancePath: string): number => {
  const m = /^\/sections\/([A-Za-z]+)/.exec(instancePath);
  return m && m[1] in SECTION_ROLE ? SECTION_ROLE[m[1] as Section] : 8;
};

export function validateFinalPackage(bytes: Uint8Array, ctx: Role8Context): Role8Validation {
  const evidence: Evidence[] = [];
  const problems: RoutedProblem[] = [];
  const caveats: string[] = [];
  const text = new TextDecoder().decode(bytes);
  const add = (check: V2Check, meta: { command: string; validatorVersion: string }, fn: () => { ok: boolean; problems: { message: string; ownerRole: number; locator: string }[] }) => {
    let routed: { message: string; ownerRole: number; locator: string }[] = [];
    const e = runCheck(check, meta, () => {
      const r = fn();
      routed = r.problems;
      return { ok: r.ok, problems: r.problems.map((p) => p.message) };
    });
    evidence.push(e);
    for (const p of routed) problems.push({ check, ...p });
    if (e.result === "FAIL" && !routed.length) problems.push({ check, message: e.failures.join("; "), ownerRole: 8, locator: check });
  };

  const parsed = strictParseBytes(bytes, { rejectDuplicates: false });
  add("STRICT_JSON", { command: "strictParseBytes(bytes)", validatorVersion: `node ${process.version} JSON.parse + TextDecoder(fatal)` },
    () => ({ ok: parsed.ok, problems: parsed.ok ? [] : [{ message: parsed.error, ownerRole: 8, locator: "$" }] }));
  if (!parsed.ok) {
    for (const c of V2_MANDATORY_CHECKS.slice(1)) evidence.push(notExecuted(c, "skipped: package did not parse", "n/a"));
    return { ok: false, evidence, problems, caveats };
  }
  const pkg = parsed.value as Obj;
  const sections = (pkg.sections ?? {}) as Obj;

  add("DUPLICATE_KEYS", { command: "findDuplicateKeys(text)", validatorVersion: "sr-json-scan 1" }, () => {
    const d = findDuplicateKeys(text);
    return { ok: d.length === 0, problems: d.map((p) => ({ message: `duplicate key at ${p}`, ownerRole: ownerFromPointer("/" + p.replace(/^\$\./, "").replace(/\./g, "/")), locator: p })) };
  });

  add("JSON_SCHEMA", { command: `ajv.compile(${ctx.schema.id})(package)`, validatorVersion: `${SCHEMA_VALIDATOR.name} ${SCHEMA_VALIDATOR.version} [schema authority: ${ctx.schema.authority}]` }, () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(ctx.schema.schema);
    const ok = validate(pkg) as boolean;
    return {
      ok,
      problems: ok ? [] : (validate.errors ?? []).map((e) => ({
        message: `${e.instancePath || "/"} ${e.message}${e.params && "missingProperty" in e.params ? ` (${String(e.params.missingProperty)})` : ""}`,
        ownerRole: ownerFromPointer(e.instancePath), locator: e.instancePath || "/"
      }))
    };
  });
  if (ctx.schema.authority !== "CANONICAL") caveats.push(`JSON_SCHEMA used a ${ctx.schema.authority} schema (${ctx.schema.id}); the canonical final package schema is not available`);

  add("REFERENTIAL_INTEGRITY", { command: "identity checks + configured reference rules", validatorVersion: `sr-refint-v2 [rules: ${ctx.refRulesAuthority}]` }, () => {
    const out: { message: string; ownerRole: number; locator: string }[] = [];
    for (const s of SECTIONS) {
      const pid = (sections[s] as Obj | undefined)?.passage_id;
      if (pid !== ctx.passageId) out.push({ message: `cross-passage reference: ${s} belongs to ${String(pid)}, package is ${ctx.passageId}`, ownerRole: SECTION_ROLE[s], locator: `sections.${s}.passage_id` });
    }
    for (const rule of ctx.refRules) {
      const targets = new Set(select(sections[rule.to.section], rule.to.path));
      for (const v of select(sections[rule.from.section], rule.from.path)) {
        if (!targets.has(v)) out.push({ message: `dangling reference ${v} (rule ${rule.id}: ${rule.from.section}${rule.from.path} -> ${rule.to.section}${rule.to.path})`, ownerRole: rule.owner ?? SECTION_ROLE[rule.from.section], locator: `${rule.from.section}${rule.from.path}` });
      }
    }
    return { ok: out.length === 0, problems: out };
  });
  if (ctx.refRulesAuthority !== "CANONICAL") caveats.push(`REFERENTIAL_INTEGRITY ran identity checks plus ${ctx.refRules.length} ${ctx.refRulesAuthority} rule(s); canonical reference rules are not available`);

  add("UPSTREAM_FIDELITY", { command: "checkUpstreamFidelity(sections, approved)", validatorVersion: "sr-fidelity 1" }, () => {
    const approved: Partial<Record<number, Obj>> = {};
    for (const s of SECTIONS) approved[SECTION_ROLE[s]] = ctx.sections[SECTION_ROLE[s]]?.artifact as Obj;
    const r = checkUpstreamFidelity(sections, approved);
    return { ok: r.ok, problems: r.problems.map((m) => ({ message: m, ownerRole: 8, locator: m })) };
  });

  add("VERSION_HASH_LOCK", { command: "recompute canonicalHash per section + lock + canonical identity", validatorVersion: "sha256 canonical-json 1" }, () => {
    const out: { message: string; ownerRole: number; locator: string }[] = [];
    const lock = ((pkg.lock as Obj | undefined)?.role_hashes ?? {}) as Record<string, string>;
    if (pkg.package_version !== ctx.packageVersion) out.push({ message: `package_version ${String(pkg.package_version)} != ${ctx.packageVersion}`, ownerRole: 8, locator: "package_version" });
    const can = (pkg.canonical ?? {}) as Obj;
    if (can.package_hash !== ctx.canonical.hash || can.package_hash !== ctx.unitCanonicalHash) out.push({ message: "canonical package hash differs from the locked/registered canonical hash", ownerRole: 8, locator: "canonical.package_hash" });
    if (can.package_version !== ctx.canonical.version) out.push({ message: `canonical package version ${String(can.package_version)} != ${ctx.canonical.version}`, ownerRole: 8, locator: "canonical.package_version" });
    for (const s of SECTIONS) {
      const role = SECTION_ROLE[s];
      const approvedHash = ctx.sections[role]?.hash;
      if (canonicalHash(sections[s]) !== approvedHash) out.push({ message: `role ${role} (${s}): recomputed content hash differs from the approved hash`, ownerRole: 8, locator: `sections.${s}` });
      if (lock[String(role)] !== approvedHash) out.push({ message: `role ${role} (${s}): package lock hash differs from the approved hash`, ownerRole: 8, locator: `lock.role_hashes.${role}` });
    }
    return { ok: out.length === 0, problems: out };
  });

  add("CURRENT_INPUTS", { command: "approved hash == currently recorded approved hash", validatorVersion: "sr-current 1" }, () => {
    const out = SECTIONS.flatMap((s) => {
      const i = ctx.sections[SECTION_ROLE[s]];
      return !i || i.currentHash !== i.hash ? [{ message: `role ${SECTION_ROLE[s]} (${s}): approved hash is stale (current ${i?.currentHash ?? "none"})`, ownerRole: SECTION_ROLE[s], locator: `sections.${s}` }] : [];
    });
    return { ok: out.length === 0, problems: out };
  });

  add("QA_CERTIFICATES", { command: "certificate present and of the required kind for every role 1-7", validatorVersion: "sr-certs 1" }, () => {
    const lockCerts = ((pkg.lock as Obj | undefined)?.qa_certificates ?? {}) as Record<string, string>;
    const out = SECTIONS.flatMap((s) => {
      const role = SECTION_ROLE[s];
      const i = ctx.sections[role];
      const want = role === 1 || role === 7 ? "MACHINE_DETERMINISTIC" : "INDEPENDENT_SEMANTIC";
      const probs: { message: string; ownerRole: number; locator: string }[] = [];
      if (!i?.certificateHash) probs.push({ message: `role ${role} (${s}): no QA certificate`, ownerRole: role, locator: `lock.qa_certificates.${role}` });
      else if (i.qaKind !== want) probs.push({ message: `role ${role} (${s}): certificate kind ${String(i.qaKind)} != required ${want}`, ownerRole: role, locator: `lock.qa_certificates.${role}` });
      if (i?.certificateHash && lockCerts[String(role)] !== i.certificateHash) probs.push({ message: `role ${role} (${s}): package lock certificate differs from the recorded certificate`, ownerRole: 8, locator: `lock.qa_certificates.${role}` });
      return probs;
    });
    return { ok: out.length === 0, problems: out };
  });

  evidence.push(notExecuted("PROMOTION_SMOKE", "runs after durable promotion (promotionSmoke)", "sr-promotion-smoke 1"));
  const first8 = evidence.filter((e) => e.check !== "PROMOTION_SMOKE");
  return { ok: first8.every((e) => e.executed && e.result === "PASS") && problems.length === 0, evidence, problems, caveats };
}

/** Post-promotion durable-ingestion smoke test: the approved bytes must parse strictly and match the assembled hash. */
export function promotionSmoke(readBack: () => { text: string; hash: string }, expectedHash: string): Evidence {
  return runCheck("PROMOTION_SMOKE", { command: "re-read approved package, strict parse, hash compare", validatorVersion: "sr-promotion-smoke 1" }, () => {
    const { text, hash } = readBack();
    const p = strictParseBytes(new TextEncoder().encode(text), { rejectDuplicates: true });
    const problems: string[] = [];
    if (!p.ok) problems.push(p.error);
    if (hash !== expectedHash) problems.push(`approved package hash ${hash} != assembled hash ${expectedHash}`);
    return { ok: problems.length === 0, problems };
  });
}

/** Final PASS requires every one of the nine mandatory checks to be executed and PASS. */
export function finalEvidenceSummary(evidence: readonly Evidence[]) {
  const by = new Map(evidence.map((e) => [e.check, e]));
  const failed = V2_MANDATORY_CHECKS.filter((c) => by.get(c)?.result === "FAIL");
  const notRun = V2_MANDATORY_CHECKS.filter((c) => !by.has(c) || by.get(c)!.result === "NOT_EXECUTED");
  return { canPass: !failed.length && !notRun.length, failed: [...failed], notExecuted: [...notRun] };
}
