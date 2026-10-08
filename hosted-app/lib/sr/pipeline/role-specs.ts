// Per-role owned-artifact contracts: the exact payload fields a role may produce (completeness + bound)
// and the role-specific blocker checks its independent QA runs. A role spec is added with its tests.

import { type Complexity, ProfileUnavailableError, passageSpecFor, validateSpecDifficulty } from "../passage-progression";
import { WORLD1_PASSAGE_COUNT } from "../../v2/catalog";
import type { RoleId } from "./roles";
import { getOptionJudge, getPropositionJudge, passageSentences } from "./verifiers";

export type Payload = Record<string, unknown>;
export type Upstream = Partial<Record<RoleId, Payload>>;
/** [rule, evidence, owner?] - owner defaults to the role under QA; set it when the root cause is upstream. */
export type Finding = [string, string] | [string, string, RoleId];
export type RoleSpec = {
  fields: readonly string[];
  /** Cosmetic findings reported as NON_BLOCKING; they never fail the stage or trigger rework (SR-048). */
  advisories?: (payload: Payload) => [string, string][];
  /** Blocking rule violations found in the payload: [rule, evidence]. */
  blockers: (payload: Payload, upstream: Upstream, approved: { role: RoleId; hash: string }[]) => Finding[];
};

const role1: RoleSpec = {
  fields: ["passageId", "sequence", "rsId", "pId", "targetWords", "complexity"],
  blockers(p) {
    const out: Finding[] = [];
    const seq = p.sequence as number;
    if (!Number.isInteger(seq) || seq < 1 || seq > WORLD1_PASSAGE_COUNT) return [["SEQUENCE_IN_RANGE", `sequence=${String(p.sequence)}`]];
    let spec;
    try { spec = passageSpecFor(seq); }
    catch (e) {
      if (e instanceof ProfileUnavailableError) return [["APPROVED_PROFILE_UNAVAILABLE", e.message]];
      throw e;
    }
    if (p.targetWords !== spec.targetWords) out.push(["LENGTH_LADDER", `targetWords=${String(p.targetWords)} expected ${spec.targetWords}`]);
    for (const d of validateSpecDifficulty({ ...spec, complexity: p.complexity as Complexity })) out.push(["CONSTANT_DIFFICULTY", d]);
    return out;
  }
};

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const LENGTH_TOLERANCE = 0.15;

const role2: RoleSpec = {
  fields: ["passageId", "text", "wordCount"],
  advisories: (p) => (/ {2,}/.test(String(p.text ?? "")) ? [["STYLE_DOUBLE_SPACE", "passage text contains repeated spaces"]] : []),
  blockers(p, up) {
    const out: Finding[] = [];
    const spec = up[1];
    if (spec && p.passageId !== spec.passageId) out.push(["PASSAGE_ID_MATCH", `got ${String(p.passageId)} expected ${String(spec.passageId)}`]);
    const actual = countWords(String(p.text ?? ""));
    if (p.wordCount !== actual) out.push(["WORD_COUNT_ACCURATE", `declared ${String(p.wordCount)} actual ${actual}`]);
    const target = spec?.targetWords as number | undefined;
    if (target && Math.abs(actual - target) > target * LENGTH_TOLERANCE) out.push(["LENGTH_TOLERANCE", `${actual} words vs target ${target} (+/-${LENGTH_TOLERANCE * 100}%)`]);
    return out;
  }
};

type Item = { itemId: string; stem: string; options: string[]; answerIndex: number; primary: boolean; evidence?: { quote?: string } };


/** Independent answer verification: explicit passage evidence, exactly one passage-supported option, distractors false. */
function verifyAnswers(items: Item[], passage: string, havePassage: boolean, prior: Finding[]): Finding[] {
  const out: Finding[] = [];
  const structurallyBad = new Set(prior.filter((f) => f[0] === "ONE_DEFENSIBLE_ANSWER").map((f) => f[1].split(":")[0]));
  const judge = getOptionJudge();
  for (const i of items) {
    if (structurallyBad.has(`item ${i.itemId}`)) continue;
    if (!havePassage) { out.push(["PASSAGE_EVIDENCE_UNAVAILABLE", `item ${i.itemId}: approved passage text is required to verify the answer`]); continue; }
    const quote = i.evidence?.quote?.trim();
    if (!quote) out.push(["ANSWER_EVIDENCE_PRESENT", `item ${i.itemId}: no explicit passage evidence cited for the correct answer`]);
    else if (!passage.includes(quote)) out.push(["ANSWER_EVIDENCE_IN_PASSAGE", `item ${i.itemId}: cited evidence "${quote}" is not in the approved passage`]);
    if (!judge) { out.push(["INDEPENDENT_VERIFIER_MISSING", `item ${i.itemId}: no independent option judge registered; answer uniqueness cannot be verified`]); continue; }
    const j = judge(passage, { stem: i.stem, options: i.options });
    if (j.verdicts.length !== i.options.length) { out.push(["ONE_DEFENSIBLE_ANSWER", `item ${i.itemId}: verifier returned ${j.verdicts.length} verdicts for ${i.options.length} options`]); continue; }
    const supported = j.verdicts.map((v, n) => (v === "SUPPORTED" ? n : -1)).filter((n) => n >= 0);
    const cite = j.evidence.join(" | ");
    if (supported.length > 1) out.push(["ONE_DEFENSIBLE_ANSWER", `item ${i.itemId}: options ${supported.map((n) => `#${n} "${i.options[n]}"`).join(" and ")} are both passage-supported. Evidence: ${cite}`]);
    else if (supported.length === 0) out.push(["ANSWER_SUPPORTED_BY_PASSAGE", `item ${i.itemId}: no option is passage-supported. Evidence: ${cite}`]);
    else if (supported[0] !== i.answerIndex) out.push(["ANSWER_CORRECT", `item ${i.itemId}: marked #${i.answerIndex} "${i.options[i.answerIndex]}" but passage supports #${supported[0]} "${i.options[supported[0]]}". Evidence: ${cite}`]);
  }
  return out;
}

const role3: RoleSpec = {
  fields: ["passageId", "items"],
  blockers(p, up) {
    const out: Finding[] = [];
    if (up[1] && p.passageId !== up[1].passageId) out.push(["PASSAGE_ID_MATCH", `got ${String(p.passageId)} expected ${String(up[1].passageId)}`]);
    const items = (p.items as Item[]) ?? [];
    if (items.length !== 4 || items.filter((i) => i.primary).length !== 1)
      out.push(["P10_BLUEPRINT", `${items.length} items, ${items.filter((i) => i.primary).length} primary (need 4 items, exactly 1 primary)`]);
    const ids = items.map((i) => i.itemId);
    if (new Set(ids).size !== ids.length) out.push(["ITEM_ID_UNIQUE", `ids ${ids.join(",")}`]);
    for (const i of items) {
      const distinct = new Set(i.options).size === i.options.length && i.options.length >= 2;
      if (!Number.isInteger(i.answerIndex) || i.answerIndex < 0 || i.answerIndex >= i.options.length || !distinct)
        out.push(["ONE_DEFENSIBLE_ANSWER", `item ${i.itemId}: answerIndex=${i.answerIndex} options=${JSON.stringify(i.options)}`]);
    }
    out.push(...verifyAnswers(items, String(up[2]?.text ?? ""), !!up[2], out));
    return out;
  }
};

const idBlocker = (p: Payload, up: Upstream): Finding[] => {
  const ref = Object.values(up).find((u) => u && typeof u.passageId === "string");
  return ref && p.passageId !== ref.passageId ? [["PASSAGE_ID_MATCH", `got ${String(p.passageId)} expected ${String(ref.passageId)}`]] : [];
};

/** `text` is the meaning-unit PROPOSITION (a faithful paraphrase is allowed); `evidence` is the canonical passage reference. */
type Evidence = { sentences?: number[]; span?: string };
type Unit = { muId: string; text: string; factIds: string[]; evidence?: Evidence };

function resolveEvidence(ev: Evidence | undefined, passage: string): { text: string } | { error: string } {
  if (!ev || (!ev.sentences?.length && !ev.span)) return { error: "no passage evidence reference (sentences[] or span)" };
  const sents = passageSentences(passage);
  const parts: string[] = [];
  for (const n of ev.sentences ?? []) {
    if (!Number.isInteger(n) || n < 1 || n > sents.length) return { error: `sentence ${String(n)} does not exist (passage has ${sents.length})` };
    parts.push(sents[n - 1]);
  }
  if (ev.span !== undefined) {
    if (!ev.span || !passage.includes(ev.span)) return { error: `source span "${ev.span}" not found in passage` };
    parts.push(ev.span);
  }
  return { text: parts.join(" ") };
}

const role4: RoleSpec = {
  fields: ["passageId", "units"],
  blockers(p, up) {
    const out: Finding[] = [...idBlocker(p, up)];
    const units = (p.units as Unit[]) ?? [];
    if (units.length === 0) out.push(["MU_HAS_FACT", "no meaning units"]);
    const ids = units.map((u) => u.muId);
    if (new Set(ids).size !== ids.length) out.push(["MU_ID_UNIQUE", `ids ${ids.join(",")}`]);
    const passage = String(up[2]?.text ?? "");
    for (const u of units) {
      if (!u.factIds?.length) out.push(["MU_HAS_FACT", `unit ${u.muId} has no fact id`]);
      if (new Set(u.factIds ?? []).size !== (u.factIds ?? []).length) out.push(["MU_FACT_ID_UNIQUE", `unit ${u.muId} repeats a fact id`]);
      if (!up[2]) { out.push(["PASSAGE_EVIDENCE_UNAVAILABLE", `unit ${u.muId}: approved passage text is required to verify evidence`]); continue; }
      const ev = resolveEvidence(u.evidence, passage);
      if ("error" in ev) { out.push(["MU_EVIDENCE_REF", `unit ${u.muId}: ${ev.error}`]); continue; }
      const judge = getPropositionJudge();
      if (!judge) { out.push(["INDEPENDENT_VERIFIER_MISSING", `unit ${u.muId}: no proposition judge registered; faithfulness cannot be verified`]); continue; }
      if (judge(ev.text, u.text) !== "ENTAILED") out.push(["MU_PROPOSITION_SUPPORTED", `unit ${u.muId}: proposition "${u.text}" is not supported by cited evidence "${ev.text}"`]);
    }
    return out;
  }
};

const role5: RoleSpec = {
  fields: ["passageId", "text", "factIds"],
  blockers(p, up) {
    const out: Finding[] = [...idBlocker(p, up)];
    if (!String(p.text ?? "").trim()) out.push(["BPC_TEXT_PRESENT", "BPC text is empty"]);
    const known = new Set(((up[4]?.units as Unit[]) ?? []).flatMap((u) => u.factIds));
    const cited = new Set((p.factIds as string[]) ?? []);
    const missing = [...known].filter((f) => !cited.has(f));
    if (missing.length) out.push(["FACT_COVERAGE", `BPC omits facts ${missing.join(",")}`]);
    const unknown = [...cited].filter((f) => !known.has(f));
    if (unknown.length) out.push(["NO_UNKNOWN_FACTS", `BPC cites unsupported facts ${unknown.join(",")}`]);
    return out;
  }
};

const role6: RoleSpec = {
  fields: ["passageId", "passThreshold", "primaryItemId", "itemPoints"],
  blockers(p, up) {
    const out: Finding[] = [...idBlocker(p, up)];
    const points = (p.itemPoints as Record<string, number>) ?? {};
    const approvedItems = (up[3]?.items as Item[]) ?? [];
    const want = approvedItems.map((i) => i.itemId).sort().join(",");
    if (up[3] && Object.keys(points).sort().join(",") !== want) out.push(["ITEM_POINTS_MATCH_ASSESSMENT", `points for ${Object.keys(points).sort().join(",")} but approved items ${want}`]);
    const total = Object.values(points).reduce((a, b) => a + b, 0);
    if (total !== 100) out.push(["POINTS_TOTAL_100", `points total ${total}`]);
    const primaries = approvedItems.filter((i) => i.primary);
    if (up[3] && primaries.length !== 1) out.push(["PRIMARY_ITEM_MATCH", `approved assessment has ${primaries.length} primary items; cannot bind contract`, 3]);
    else if (up[3] && p.primaryItemId !== primaries[0].itemId) out.push(["PRIMARY_ITEM_MATCH", `contract primary ${String(p.primaryItemId)} vs assessment primary ${primaries[0].itemId}`]);
    const t = p.passThreshold as number;
    if (!Number.isFinite(t) || t < 0 || t > 100) out.push(["THRESHOLD_RANGE", `passThreshold=${String(t)}`]);
    return out;
  }
};

type Outcome = { state: string; nextAction: string; oralReady?: unknown; comprehensionReady?: unknown };

const role7: RoleSpec = {
  fields: ["passageId", "outcomes"],
  blockers(p, up) {
    const out: Finding[] = [...idBlocker(p, up)];
    const outcomes = (p.outcomes as Outcome[]) ?? [];
    const states = new Set(outcomes.map((o) => o.state));
    if (!states.has("PASS") || !states.has("FAIL")) out.push(["OUTCOME_STATES_COMPLETE", `defined states: ${[...states].join(",") || "none"}`]);
    for (const o of outcomes) {
      if (o.nextAction !== "CONTINUE_NEXT_PASSAGE") out.push(["NON_BLOCKING_PROGRESSION", `outcome ${o.state} nextAction=${o.nextAction}`]);
      if (typeof o.oralReady !== "boolean" || typeof o.comprehensionReady !== "boolean") out.push(["SEPARATE_GATE_FLAGS", `outcome ${o.state} lacks separate oralReady/comprehensionReady booleans`]);
    }
    return out;
  }
};

const role8: RoleSpec = {
  fields: ["passageId", "refs"],
  blockers(p, up, approved) {
    const out: Finding[] = [...idBlocker(p, up)];
    const refs = (p.refs as Record<string, string>) ?? {};
    for (const r of [1, 2, 3, 4, 5, 6, 7] as RoleId[]) {
      if (!(r in refs)) { out.push(["ALL_REFS_PRESENT", `no reference to role ${r} artifact`]); continue; }
      const want = approved.find((a) => a.role === r)?.hash;
      if (refs[r] !== want) out.push(["REF_HASH_MATCHES_APPROVED", `role ${r} ref ${refs[r]} != approved ${String(want)}`]);
    }
    return out;
  }
};

export const ROLE_SPECS: Readonly<Partial<Record<RoleId, RoleSpec>>> = { 1: role1, 2: role2, 3: role3, 4: role4, 5: role5, 6: role6, 7: role7, 8: role8 };

export function specFor(id: RoleId): RoleSpec {
  const s = ROLE_SPECS[id];
  if (!s) throw new Error(`no contract defined for role ${id}`);
  return s;
}
