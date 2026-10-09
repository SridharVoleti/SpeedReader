// APP-KM-004 / APP-KM-006 - conformance diff between the readiness rule table the app executes (p10-readiness.ts) and a
// candidate rule table, in particular the approved canonical v0.56 package once it is supplied.
//
// The candidate is any CSV with a reading_stage column (RS01..RS15) and a p10_success_rule column; if it has a p_level
// column only the P10 rows are used, and an optional canonical_version column is reported. The comparison is on the rule
// TEXT after whitespace normalisation: the app's thresholds are encoded from that text, so identical text means the same
// thresholds, and any difference is listed for a human decision (the app never edits its own rules from a candidate).

import { parseCsv } from "../sr/pipeline-v2/csv";
import { READINESS_RULES, READINESS_RULESET_ID, RS_KEYS, type RsKey } from "./p10-readiness";

const squash = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim();

export type RulesetDiff = {
  executedRulesetId: string;
  candidateVersions: string[];
  identical: RsKey[];
  /** The candidate states a different rule from the one the app executes. */
  different: { rs: RsKey; executed: string; candidate: string }[];
  /** The candidate has no P10 rule for this RS. */
  missingInCandidate: RsKey[];
  /** Candidate rows for reading stages the app does not execute. */
  unknownInCandidate: string[];
  /** True only when every one of the 15 RS rules is textually identical. */
  conforms: boolean;
};

export function diffReadinessRuleset(candidateCsv: string): RulesetDiff {
  const rows = parseCsv(candidateCsv);
  const header = Object.keys(rows[0] ?? {});
  if (!header.includes("reading_stage") || !header.includes("p10_success_rule")) throw new Error("candidate table needs reading_stage and p10_success_rule columns");
  const body = rows.filter((r) => !header.includes("p_level") || r.p_level === "P10");
  const candidate = new Map<string, string>();
  for (const r of body) candidate.set(r.reading_stage, squash(r.p10_success_rule));
  const versions = [...new Set(body.map((r) => r.canonical_version).filter(Boolean))];

  const identical: RsKey[] = [];
  const different: RulesetDiff["different"] = [];
  const missing: RsKey[] = [];
  for (const rs of RS_KEYS) {
    const executed = squash(READINESS_RULES.find((r) => r.rs === rs)!.specText);
    const theirs = candidate.get(rs);
    if (theirs === undefined) missing.push(rs);
    else if (theirs === executed) identical.push(rs);
    else different.push({ rs, executed, candidate: theirs });
  }
  return {
    executedRulesetId: READINESS_RULESET_ID,
    candidateVersions: versions,
    identical,
    different,
    missingInCandidate: missing,
    unknownInCandidate: [...candidate.keys()].filter((k) => !(RS_KEYS as readonly string[]).includes(k)),
    conforms: identical.length === RS_KEYS.length
  };
}
