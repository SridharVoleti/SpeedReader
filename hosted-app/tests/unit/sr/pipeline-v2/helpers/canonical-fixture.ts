// TEST FIXTURE ONLY - a synthetic, structurally faithful stand-in for the locked canonical package.
// It is NOT canonical content: values are placeholders so tests never depend on the real package location.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIRED_ALWAYS, REQUIRED_P10 } from "../../../../../lib/sr/pipeline-v2/registry";

export const FIXTURE_VERSION = "v0.99";
export const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

const csvEscape = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (header: string[], rows: string[][]) => [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";

export const TRANSITION_TABLE = [
  "| readiness_state before | attempt role | attempt_outcome | readiness_state after | Failed-cycle increment |",
  "|---|---|---|---|---:|",
  "| `PRIMARY_PENDING` | PRIMARY / NEW_CYCLE_PRIMARY / TECHNICAL_REPLACEMENT | `PASS` | `CONFIRMATION_PENDING` | No |",
  "| `PRIMARY_PENDING` | same | `FAIL` | `NOT_YET` | Yes |",
  "| `PRIMARY_PENDING` | same | `TECHNICAL_INVALID` / `INSUFFICIENT_EVIDENCE` / `INVALID_FORM` | `PRIMARY_PENDING` | No |",
  "| `CONFIRMATION_PENDING` | CONFIRMATION / NEW_CYCLE_CONFIRMATION / TECHNICAL_REPLACEMENT | `PASS` | `CONFIRMED_READY` | No |",
  "| `CONFIRMATION_PENDING` | same | `FAIL` | `DISCORDANT_NOT_YET` | Yes |",
  "| `CONFIRMATION_PENDING` | same | `TECHNICAL_INVALID` / `INSUFFICIENT_EVIDENCE` / `INVALID_FORM` | `CONFIRMATION_PENDING` | No |",
  "| `REVALIDATION_PENDING` | REVALIDATION / TECHNICAL_REPLACEMENT | `PASS` | `CURRENT_REVALIDATED` | No |",
  "| `REVALIDATION_PENDING` | same | `FAIL` | `NOT_YET_AFTER_REVALIDATION` | No |",
  "| `REVALIDATION_PENDING` | same | `TECHNICAL_INVALID` / `INSUFFICIENT_EVIDENCE` / `INVALID_FORM` | `REVALIDATION_PENDING` | No |"
].join("\n");

export const specText = (): string => `# Fixture Spec ${FIXTURE_VERSION}

## Prose-generation acceptance gate — complete normative specification

PG1-PG12 fixture text.

## Canonical passage tokenizer and exact-word-count contract — COUNT-100 v2.0 — normative in ${FIXTURE_VERSION} (introduced v0.51)

COUNT-100 fixture text.

## Attempt outcome model — ATTEMPT-OUTCOME-1.0 — normative in ${FIXTURE_VERSION} (introduced v0.31)

Canonical fields:

- \`readiness_state\` — lifecycle phase;
- \`attempt_outcome\` — transaction result;
- \`attempt_role\` — PRIMARY / CONFIRMATION / NEW_CYCLE_PRIMARY / NEW_CYCLE_CONFIRMATION / REVALIDATION / TECHNICAL_REPLACEMENT;

### Canonical transition matrix

${TRANSITION_TABLE}

\`PASS\` and \`FAIL\` are the only attempt outcomes that may advance a learner-performance lifecycle transition.

### Persistence requirement

Persist things.

Attempt outcomes reuse \`ATTEMPT-OUTCOME-1.0\`:

\`PASS; FAIL; TECHNICAL_INVALID; INSUFFICIENT_EVIDENCE; INVALID_FORM\`

## Comprehension progression gate — session based

Fixture comprehension text.

## P10 comprehension coverage — COMP-COVERAGE-1.0 — normative in ${FIXTURE_VERSION}

Fixture coverage text.

## P10 designated primary comprehension item — P10-PRIMARY-1.0 — normative in ${FIXTURE_VERSION}

Fixture primary item text.

## Independent P10 comprehension readiness — COMP-P10-1.0 — normative in ${FIXTURE_VERSION}

Fixture 3/4 + primary text.

## Oral-reading telemetry and ASR safeguards

Fixture ASR text.

## Engagement and factual/safety gates

Fixture engagement text.
`;

const STRANDS = Array.from({ length: 15 }, (_, i) => `Strand ${String.fromCharCode(65 + i)}`);

export function fixtureRow(rs: number, p: number): Record<string, string> {
  const no = (p - 1) * 15 + rs; // delivery session
  const passageNo = (rs - 1) * 10 + p; // registry order is RS-major
  const row: Record<string, string> = {};
  for (const c of [...REQUIRED_ALWAYS, ...REQUIRED_P10]) row[c] = `${c} for RS${rs}/P${p}`;
  Object.assign(row, {
    passage_no: String(passageNo), passage_id: `W1-${String(passageNo).padStart(4, "0")}`, delivery_session: String(no),
    delivery_round: String(p), round_position: String(rs), reading_stage_no: String(rs),
    reading_stage: `RS${String(rs).padStart(2, "0")} — Fixture competency`, stage_passage_no: String(p), stage_passage_label: `P${p}`,
    target_words: "100", visual_span: "1 word", title: `Title ${passageNo}`, knowledge_strand: STRANDS[(rs - 1 + p - 1) % 15],
    comprehension_level_no: String(p), quiz_question_count: p === 10 ? "4" : "2", qa_flags: "GENERAL",
    readiness_form_role: p === 10 ? "PRIMARY_CANONICAL_FORM" : "NOT_P10_READINESS_FORM", canonical_package_version: FIXTURE_VERSION,
    row_normative_status: "NORMATIVE_ROW_INSTANCE", row_authority_domain: "ROW_INSTANCE_VALUES"
  });
  if (p !== 10) for (const c of REQUIRED_P10) row[c] = "";
  return row;
}

export type FixtureOptions = { certified?: boolean; rows?: Record<string, string>[] };

/** Build a synthetic locked package in `dir`; returns file names so tests can tamper with them. */
export function buildCanonicalFixture(dir: string, opts: FixtureOptions = {}) {
  mkdirSync(dir, { recursive: true });
  const names = {
    spec: `Fixture_Spec_${FIXTURE_VERSION}.md`,
    rows: `Fixture_Canonical_Row_Contracts_${FIXTURE_VERSION}.csv`,
    mirror: `Fixture_Attempt_Outcome_Model_${FIXTURE_VERSION}.csv`,
    lock: `Fixture_Package_Lock_${FIXTURE_VERSION}.csv`,
    manifest: `Fixture_Package_Manifest_${FIXTURE_VERSION}.csv`,
    cert: `Fixture_Independent_QA_Final_Certification_${FIXTURE_VERSION}.csv`
  };
  const rowHeader = [...REQUIRED_ALWAYS, ...REQUIRED_P10];
  const all = opts.rows ?? Array.from({ length: 150 }, (_, i) => fixtureRow((i % 15) + 1, Math.floor(i / 15) + 1));
  const rowsSorted = [...all].sort((a, b) => Number(a.passage_no) - Number(b.passage_no));
  writeFileSync(join(dir, names.spec), specText());
  writeFileSync(join(dir, names.rows), toCsv(rowHeader, rowsSorted.map((r) => rowHeader.map((h) => r[h] ?? ""))));
  const mirrorHeader = ["canonical_version", "attempt_outcome_model_version", "attempt_outcome", "definition", "learner_failure", "preserve_phase", "allowed_to_advance_phase"];
  writeFileSync(join(dir, names.mirror), toCsv(mirrorHeader, [
    ["PASS", "NO", "NO", "YES"], ["FAIL", "YES", "NO", "YES"], ["TECHNICAL_INVALID", "NO", "YES", "NO"],
    ["INSUFFICIENT_EVIDENCE", "NO", "YES", "NO"], ["INVALID_FORM", "NO", "YES", "NO"]
  ].map(([o, lf, pp, adv]) => [FIXTURE_VERSION, "ATTEMPT-OUTCOME-1.0", o, `def ${o}`, lf, pp, adv])));

  const members: [string, string, string][] = [[names.spec, "GLOBAL_RULES", "NORMATIVE_REQUIRED"], [names.rows, "ROW_INSTANCE_VALUES", "NORMATIVE_REQUIRED"], [names.mirror, "DERIVED_MIRROR", "MIRROR_ONLY"]];
  const lockHeader = ["canonical_package_version", "package_model_version", "artifact", "authority_domain", "required_in_package", "sha256", "bytes", "lock_validation_rule"];
  writeFileSync(join(dir, names.lock), toCsv(lockHeader, members.map(([n, d]) => {
    const buf = readFileSync(join(dir, n));
    return [FIXTURE_VERSION, "PACKAGE-1.0", n, d, "YES", sha(buf), String(buf.length), "exact"];
  })));
  const manHeader = ["canonical_package_version", "package_model_version", "artifact", "authority_domain", "normative_status", "required_in_package", "implementation_authority", "conflict_behavior", "notes"];
  writeFileSync(join(dir, names.manifest), toCsv(manHeader, [
    [names.lock, "PACKAGE_IDENTITY", "NORMATIVE_REQUIRED"], ...members
  ].map(([n, d, s]) => [FIXTURE_VERSION, "PACKAGE-1.0", n, d, s, "YES", "YES", "", ""])));
  if (opts.certified) {
    const h = ["canonical_package_version", "package_lock_reference", "final_qa_status", "knowledge_map_final_freeze"];
    writeFileSync(join(dir, names.cert), toCsv(h, [[FIXTURE_VERSION, names.lock, "PASS", "YES"]]));
  }
  return { dir, names, rows: rowsSorted };
}
