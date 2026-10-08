// SR-044 - Proposition-based free-explanation recall against a version-bound, approved fact map.
//
// HONEST SCOPE: this is a closed-set proposition matcher, NOT general semantic equivalence. A fact is a
// proposition (subject / predicate / object) whose acceptable surface alternates were approved with the map.
// Credit needs every required slot matched inside one clause, with polarity checked. Anything that only
// partly matches is UNRESOLVED_SEMANTIC (routed to review) - it is never silently scored as an omission or
// as credit. Every decision carries an audit entry (clause, matched slots, rule).

export type Explicitness = "EXPLICIT" | "IMPLICIT" | "NOT_IN_PASSAGE";
/** Acceptable alternates per slot (each alternate may be multi-word). Predicate is mandatory. */
export type Proposition = { subject?: readonly string[]; predicate: readonly string[]; object?: readonly string[] };
export type Fact = {
  /** Immutable across map versions. */
  factId: string;
  /** EXPLICIT: stated in passage. IMPLICIT: only inferable. NOT_IN_PASSAGE: a known unsupported claim. */
  explicitness: Explicitness;
  proposition: Proposition;
  /** Propositions that, when asserted, contradict this fact (e.g. "kept" the money). */
  contradictions?: readonly Proposition[];
};
export type FactMapVersion = { mapId: string; version: string };
export type FactMapV = FactMapVersion & { facts: readonly Fact[] };
export type FactState =
  | "CREDITED" | "OMITTED" | "CONTRADICTED" | "UNSUPPORTED_INFERENCE" | "UNSUPPORTED_CLAIM" | "UNRESOLVED_ASR" | "UNRESOLVED_SEMANTIC";
export type AuditEntry = { factId: string; state: FactState; rule: string; clause?: string; matched?: string[] };
export type Classification = {
  method: "APPROVED_ALTERNATES_PROPOSITION_MATCH";
  factMap: FactMapVersion;
  states: Record<string, FactState>;
  audit: AuditEntry[];
  /** Clauses that matched no fact at all - surfaced for review, never penalised automatically. */
  unclassifiedClauses: string[];
};

export const ASR_CONFIDENCE_FLOOR = 0.6;
const NEGATIONS = new Set(["not", "no", "never", "didnt", "dont", "doesnt", "wasnt", "werent", "isnt", "arent", "wont", "cant", "couldnt", "without", "nothing", "neither", "nor", "refused"]);

const norm = (s: string): string =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const has = (clause: string, alt: string): boolean => ` ${clause} `.includes(` ${norm(alt)} `);
const firstHit = (clause: string, alts: readonly string[] | undefined): string | null =>
  (alts ?? []).find((a) => has(clause, a)) ?? null;

/** Negation is local: a negator within 3 words before the matched predicate alternate, in the same clause. */
function negatedAround(clause: string, predicateAlt: string): boolean {
  const words = clause.split(" ");
  const p = norm(predicateAlt).split(" ");
  for (let i = 0; i + p.length <= words.length; i++) {
    if (p.every((w, j) => words[i + j] === w)) return words.slice(Math.max(0, i - 3), i).some((w) => NEGATIONS.has(w));
  }
  return false;
}

type Match = { complete: boolean; partial: boolean; matched: string[]; negated: boolean };

function matchProposition(clause: string, sentence: string, prop: Proposition): Match {
  const pred = firstHit(clause, prop.predicate);
  const obj = prop.object ? firstHit(clause, prop.object) : "";
  const subj = prop.subject ? firstHit(sentence, prop.subject) : "";
  const matched = [pred && `predicate:${pred}`, prop.object && obj && `object:${obj}`, prop.subject && subj && `subject:${subj}`].filter(Boolean) as string[];
  const complete = !!pred && (!prop.object || !!obj);
  // subject is verified at sentence level (pronoun-led second clauses are normal speech); a named wrong subject is not matched
  const subjectOk = !prop.subject || !!subj || !/\b(he|she|they|it|him|her)\b/.test(` ${sentence} `) === false;
  const partial = !complete && matched.length > 0;
  return { complete: complete && subjectOk, partial: partial || (complete && !subjectOk), matched, negated: !!pred && negatedAround(clause, pred) };
}

function splitUnits(text: string): { sentence: string; clauses: string[] }[] {
  return text.split(/[.!?;\n]+/).map((raw) => {
    const sentence = norm(raw);
    return { sentence, clauses: raw.split(/,|\band\b|\bbut\b|\bthen\b|\bbecause\b/i).map(norm).filter(Boolean) };
  }).filter((u) => u.sentence);
}

export function validateFactMap(map: FactMapV): string[] {
  const out: string[] = [];
  if (!map.mapId || !map.version) out.push("fact map must carry mapId and version");
  if (!map.facts?.length) out.push("fact map is required");
  const seen = new Set<string>();
  for (const f of map.facts ?? []) {
    if (seen.has(f.factId)) out.push(`duplicate factId ${f.factId}`);
    seen.add(f.factId);
    if (!f.proposition?.predicate?.length) out.push(`${f.factId}: predicate alternates required`);
  }
  return out;
}

export function classifyResponse(
  text: string,
  map: FactMapV,
  ctx: { asrConfidence: number; boundVersion: FactMapVersion }
): Classification {
  if (ctx.boundVersion.mapId !== map.mapId || ctx.boundVersion.version !== map.version) {
    throw new Error(`fact map version drift: response bound to ${ctx.boundVersion.mapId}@${ctx.boundVersion.version}, map is ${map.mapId}@${map.version}`);
  }
  const problems = validateFactMap(map);
  if (problems.length) throw new Error(`invalid fact map: ${problems.join("; ")}`);

  const units = splitUnits(text);
  const states: Record<string, FactState> = {};
  const audit: AuditEntry[] = [];
  const touched = new Set<string>();
  const set = (e: AuditEntry) => { states[e.factId] = e.state; audit.push(e); };
  // precedence when one response touches a fact several ways: contradiction is never masked by credit
  const rank: FactState[] = ["CONTRADICTED", "CREDITED", "UNSUPPORTED_CLAIM", "UNSUPPORTED_INFERENCE", "UNRESOLVED_SEMANTIC"];
  const offer = (e: AuditEntry) => { if (states[e.factId] === undefined || rank.indexOf(e.state) < rank.indexOf(states[e.factId])) set(e); };

  for (const f of map.facts) {
    for (const u of units) {
      for (const clause of u.clauses) {
        const contra = (f.contradictions ?? []).map((c) => matchProposition(clause, u.sentence, c)).find((m) => m.complete && !m.negated);
        if (contra) { touched.add(clause); offer({ factId: f.factId, state: "CONTRADICTED", rule: "CONTRADICTING_PROPOSITION", clause, matched: contra.matched }); continue; }
        const m = matchProposition(clause, u.sentence, f.proposition);
        if (m.complete && m.negated) { touched.add(clause); offer({ factId: f.factId, state: "CONTRADICTED", rule: "NEGATED_PROPOSITION", clause, matched: m.matched }); continue; }
        if (m.complete) {
          touched.add(clause);
          const state: FactState = f.explicitness === "EXPLICIT" ? "CREDITED" : f.explicitness === "IMPLICIT" ? "UNSUPPORTED_INFERENCE" : "UNSUPPORTED_CLAIM";
          offer({ factId: f.factId, state, rule: `PROPOSITION_MATCH_${f.explicitness}`, clause, matched: m.matched });
        } else if (m.partial) {
          touched.add(clause);
          offer({ factId: f.factId, state: "UNRESOLVED_SEMANTIC", rule: "PARTIAL_PROPOSITION_MATCH_NEEDS_REVIEW", clause, matched: m.matched });
        }
      }
    }
  }
  for (const f of map.facts) {
    if (states[f.factId] !== undefined) continue;
    if (f.explicitness === "NOT_IN_PASSAGE") { continue; } // absence of an unsupported claim is the desired outcome
    set({ factId: f.factId, state: ctx.asrConfidence < ASR_CONFIDENCE_FLOOR ? "UNRESOLVED_ASR" : "OMITTED", rule: ctx.asrConfidence < ASR_CONFIDENCE_FLOOR ? "LOW_ASR_CONFIDENCE" : "NO_MATCH" });
  }
  const unclassifiedClauses = units.flatMap((u) => u.clauses).filter((c) => !touched.has(c));
  return { method: "APPROVED_ALTERNATES_PROPOSITION_MATCH", factMap: { mapId: map.mapId, version: map.version }, states, audit, unclassifiedClauses };
}
