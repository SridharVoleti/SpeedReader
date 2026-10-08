// Registry access over ROW_INSTANCE_VALUES (the Canonical Row Contracts). Validates the 15x10 matrix mechanically
// (AC-04/05/06) and exposes one validated row per passage. It copies canonical values; it never invents any.

import { CanonicalError, type CanonicalPackage } from "./canonical";
import type { CsvRow } from "./csv";

/** Columns the spec's "Row-contract schema" makes mandatory for every row (blank => INVALID_ROW_CONTRACT). */
export const REQUIRED_ALWAYS = [
  "passage_no", "passage_id", "delivery_session", "delivery_round", "round_position", "reading_stage_no", "reading_stage",
  "stage_passage_no", "stage_passage_label", "target_words", "visual_span",
  "title", "knowledge_strand", "strand_goal", "passage_premise", "wisdom_or_trait", "wisdom_delivery", "hook_requirement",
  "mid_passage_pull", "ending_payoff", "setting_accessibility", "reading_skill_step", "reading_behavior_target", "qa_flags",
  "factual_safety_requirement",
  "comprehension_level_no", "comprehension_target", "quiz_blueprint_id", "quiz_blueprint", "quiz_question_count", "quiz_mastery_rule",
  "oral_reading_focus", "oral_metric_target", "qa_gate_definition", "babysteps_rule",
  "prose_content_fidelity_rule", "prose_comprehension_evidence_rule", "prose_oral_compatibility_rule", "prose_speech_fairness_rule",
  "prose_vocabulary_rule", "prose_wisdom_rule", "prose_duplicate_rule", "prose_confidence_rule", "prose_wordcount_rhythm_rule",
  "prose_quiz_path_rule", "prose_effortless_learning_rule", "prose_generation_gate_summary",
  "word_count_convention", "passage_output_contract", "generation_order", "deterministic_generation_contract",
  "readiness_form_role", "canonical_package_version", "row_normative_status", "row_authority_domain"
] as const;

/** Additionally mandatory when the row is a P10 readiness form. */
export const REQUIRED_P10 = [
  "readiness_form_family_id", "p10_minimum_evidence_precheck", "p10_dimension_contract", "designated_primary_item_no",
  "designated_primary_dimension_id", "designated_primary_dimension", "primary_item_form_validation_rule",
  "p10_passage_completion_model_version", "p10_passage_completion_validity_rule", "p10_incomplete_sample_outcome_rule"
] as const;

export type RegistryRow = {
  passageId: string;
  passageNo: number;
  rs: number;
  p: number;
  deliverySession: number;
  /** registry coordinate, e.g. RS01-P1 */
  coordinate: string;
  row: CsvRow;
};

export const coordinateOf = (rs: number, p: number) => `RS${String(rs).padStart(2, "0")}-P${p}`;
const int = (v: string | undefined) => (/^\d+$/.test((v ?? "").trim()) ? Number(v) : NaN);

/** Mechanical checks on a single row; returns problems (empty when valid). */
export function validateRow(row: CsvRow, version: string): string[] {
  const problems: string[] = [];
  const blank = REQUIRED_ALWAYS.filter((c) => !(c in row) || row[c].trim() === "");
  if (blank.length) problems.push(`blank/missing required field(s): ${blank.join(", ")}`);
  const p = int(row.stage_passage_no);
  const rs = int(row.reading_stage_no);
  if (p === 10) {
    const b10 = REQUIRED_P10.filter((c) => !(c in row) || row[c].trim() === "");
    if (b10.length) problems.push(`P10 row blank/missing: ${b10.join(", ")}`);
  }
  if (!(rs >= 1 && rs <= 15)) problems.push(`reading_stage_no ${row.reading_stage_no} outside RS01..RS15`);
  if (!(p >= 1 && p <= 10)) problems.push(`stage_passage_no ${row.stage_passage_no} outside P1..P10`);
  if (rs >= 1 && rs <= 15 && p >= 1 && p <= 10) {
    const expected = (p - 1) * 15 + rs;
    if (int(row.delivery_session) !== expected) problems.push(`delivery_session ${row.delivery_session} != (P-1)*15+RS = ${expected}`);
    if (int(row.delivery_round) !== p) problems.push(`delivery_round ${row.delivery_round} != P ${p}`);
    if (int(row.round_position) !== rs) problems.push(`round_position ${row.round_position} != RS ${rs}`);
    if (row.stage_passage_label !== `P${p}`) problems.push(`stage_passage_label ${row.stage_passage_label} != P${p}`);
    if (!(row.reading_stage ?? "").startsWith(`RS${String(rs).padStart(2, "0")}`)) problems.push(`reading_stage "${row.reading_stage}" does not start with RS${String(rs).padStart(2, "0")}`);
    if (int(row.comprehension_level_no) !== p) problems.push(`comprehension_level_no ${row.comprehension_level_no} != P ${p}`);
  }
  if (!/^W1-\d{4}$/.test(row.passage_id ?? "")) problems.push(`passage_id ${row.passage_id} is not W1-NNNN`);
  else if (int(row.passage_no) !== Number(row.passage_id.slice(3))) problems.push(`passage_no ${row.passage_no} != passage_id ${row.passage_id}`);
  if (row.target_words !== "100") problems.push(`target_words ${row.target_words} != 100`);
  if (row.canonical_package_version !== version) problems.push(`canonical_package_version ${row.canonical_package_version} != ${version}`);
  return problems;
}

export type Registry = { rows: RegistryRow[]; byId: Map<string, RegistryRow>; rowFile: string };

/** Load and structurally validate all rows (150 unique coordinates and sessions, 15 unique strands per round). */
export function loadRegistry(pkg: CanonicalPackage, opts: { expectedRows?: number } = {}): Registry {
  const expected = opts.expectedRows ?? 150;
  const rowFile = pkg.domainArtifact("ROW_INSTANCE_VALUES");
  const raw = pkg.readCsv(rowFile);
  const problems: string[] = [];
  const rows: RegistryRow[] = [];
  const seen = { id: new Set<string>(), coord: new Set<string>(), session: new Set<number>() };
  for (const r of raw) {
    for (const pr of validateRow(r, pkg.version)) problems.push(`${r.passage_id || "?"}: ${pr}`);
    const rs = int(r.reading_stage_no), p = int(r.stage_passage_no);
    const coordinate = coordinateOf(rs, p);
    if (seen.id.has(r.passage_id)) problems.push(`${r.passage_id}: duplicate passage_id`);
    if (seen.coord.has(coordinate)) problems.push(`${r.passage_id}: duplicate coordinate ${coordinate}`);
    if (seen.session.has(int(r.delivery_session))) problems.push(`${r.passage_id}: duplicate delivery_session ${r.delivery_session}`);
    seen.id.add(r.passage_id); seen.coord.add(coordinate); seen.session.add(int(r.delivery_session));
    rows.push({ passageId: r.passage_id, passageNo: int(r.passage_no), rs, p, deliverySession: int(r.delivery_session), coordinate, row: r });
  }
  if (rows.length !== expected) problems.push(`registry has ${rows.length} rows, expected ${expected}`);
  if (expected === 150) {
    for (let round = 1; round <= 10; round++) {
      const strands = rows.filter((r) => r.p === round).map((r) => r.row.knowledge_strand);
      if (new Set(strands).size !== 15) problems.push(`delivery round ${round} has ${new Set(strands).size} unique strands, expected 15`);
    }
  }
  if (problems.length) throw new CanonicalError("INVALID_ROW_CONTRACT", problems);
  return { rows, byId: new Map(rows.map((r) => [r.passageId, r])), rowFile };
}
