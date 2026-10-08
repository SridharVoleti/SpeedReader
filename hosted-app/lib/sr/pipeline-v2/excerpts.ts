// Applicable canonical excerpts for a semantic task packet. Text is sliced VERBATIM from the locked spec; the
// role -> headings table below is a PROPOSED mapping that the canonical owner should confirm (reported as such).
// A mapped heading that is absent from the spec fails closed - an excerpt is never paraphrased or fabricated.

import { CanonicalError, type CanonicalPackage } from "./canonical";

export const ROLE_EXCERPT_HEADINGS: Record<number, string[]> = {
  2: ["Prose-generation acceptance gate", "Canonical passage tokenizer and exact-word-count contract", "Engagement and factual/safety gates"],
  3: ["Comprehension progression gate", "P10 comprehension coverage", "P10 designated primary comprehension item", "Independent P10 comprehension readiness"],
  4: [],
  5: [],
  6: ["Independent P10 comprehension readiness", "P10 designated primary comprehension item", "Oral-reading telemetry and ASR safeguards"]
};

/** PROPOSED role -> acceptance-criteria mapping (AC ids from the Final Knowledge Map Acceptance Criteria). */
export const ROLE_AC_IDS: Record<number, string[]> = {
  2: ["AC-22", "AC-23", "AC-40", "AC-48", "AC-49", "AC-50", "AC-51"],
  3: ["AC-15", "AC-16", "AC-17", "AC-18", "AC-19"],
  4: ["AC-18"],
  5: ["AC-18", "AC-19"],
  6: ["AC-17", "AC-19", "AC-20", "AC-21", "AC-22"]
};

export type Excerpt = { heading: string; text: string };

export function specExcerpts(pkg: CanonicalPackage, roleId: number): Excerpt[] {
  const wanted = ROLE_EXCERPT_HEADINGS[roleId] ?? [];
  if (!wanted.length) return [];
  const lines = pkg.readArtifactText(pkg.domainArtifact("GLOBAL_RULES")).split(/\r?\n/);
  return wanted.map((w) => {
    const start = lines.findIndex((l) => /^## /.test(l) && l.includes(w));
    if (start < 0) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`spec section "${w}" required by the Role ${roleId} packet is missing`]);
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) if (/^## /.test(lines[i])) { end = i; break; }
    return { heading: lines[start].replace(/^## /, ""), text: lines.slice(start, end).join("\n").trimEnd() };
  });
}
