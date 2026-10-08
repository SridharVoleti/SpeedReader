// Canonical-gap register. The architecture package requires several canonical inputs that the locked package may not
// contain. Where a role cannot start without one, the work item fails closed as BLOCKED_CANONICAL_INPUT naming the
// missing input. A human can acknowledge a gap (config.acknowledgedGaps) for an INFRASTRUCTURE DEMONSTRATION only;
// the acknowledgement is then carried on every affected packet and artifact as an authority caveat.
// Nothing here supplies the missing definition.

import type { CanonicalPackage } from "./canonical";
import type { PipelineConfig } from "./config";

export type Gap = {
  id: string;
  roles: number[];
  /** exactly what is missing */
  missing: string;
  satisfied(pkg: CanonicalPackage, cfg: PipelineConfig): boolean;
};

const specText = (pkg: CanonicalPackage) => pkg.readArtifactText(pkg.domainArtifact("GLOBAL_RULES"));
const hasHeading = (pkg: CanonicalPackage, re: RegExp) => specText(pkg).split(/\r?\n/).some((l) => /^#{1,3} /.test(l) && re.test(l));
const hasMember = (pkg: CanonicalPackage, re: RegExp) => pkg.artifacts.some((a) => a.present && re.test(a.name));
const hasDefinition = (pkg: CanonicalPackage, re: RegExp) => hasHeading(pkg, re) || hasMember(pkg, re);

export const GAPS: Gap[] = [
  {
    id: "G-R2-PROSE", roles: [2],
    missing: "Spec section 'Prose-generation acceptance gate' (PG1-PG12) and COUNT-100 contract",
    satisfied: (p) => hasHeading(p, /Prose-generation acceptance gate/) && hasHeading(p, /Canonical passage tokenizer/)
  },
  {
    id: "G-R3-COMPREHENSION", roles: [3],
    missing: "Spec comprehension blueprint sections (Comprehension progression gate; P10 comprehension coverage)",
    satisfied: (p) => hasHeading(p, /Comprehension progression gate/) && hasHeading(p, /P10 comprehension coverage/)
  },
  {
    id: "G-R4-MEANING-UNITS", roles: [4],
    missing: "canonical definition of the MEANING_UNITS artifact (meaning-unit / proposition / fact-ID semantics): the locked spec contains no such definition",
    satisfied: (p) => hasDefinition(p, /meaning[ _-]?unit|proposition|fact[ _-]?id/i)
  },
  {
    id: "G-R5-BPC", roles: [5],
    missing: "canonical definition of Best Possible Comprehension (BPC): the locked spec contains no such definition",
    satisfied: (p) => hasDefinition(p, /best possible comprehension|\bBPC\b/i)
  },
  {
    id: "G-R6-SEMANTIC-MAP", roles: [6],
    missing: "canonical definition of the SCORING_SEMANTIC_MAP artifact (semantic mapping / paraphrase-target rules): the locked spec contains no such definition",
    satisfied: (p) => hasDefinition(p, /semantic (scoring )?map|scoring semantic|paraphrase target/i)
  },
  {
    id: "G-R8-FINAL-SCHEMA", roles: [8],
    missing: "canonical final package JSON Schema (canonical/final_package.schema.json in the architecture manifest); not a member of the locked package",
    satisfied: (p) => hasMember(p, /final[_ ]package.*schema|Final_Package_Schema/i)
  },
  {
    id: "G-R8-REFERENTIAL-RULES", roles: [8],
    missing: "canonical cross-artifact reference rules (which ids in Roles 3-7 must resolve against which); not defined by the locked package",
    satisfied: (p, c) => hasMember(p, /referential|reference[_ ]rules/i) && !!c
  }
];

export type GapStatus = { id: string; missing: string; satisfied: boolean; acknowledged: boolean };

export function gapsForRole(pkg: CanonicalPackage, cfg: PipelineConfig, role: number): GapStatus[] {
  return GAPS.filter((g) => g.roles.includes(role)).map((g) => ({
    id: g.id, missing: g.missing, satisfied: g.satisfied(pkg, cfg), acknowledged: cfg.acknowledgedGaps.includes(g.id)
  }));
}

/** Gaps that currently block starting `role`: missing from the canonical package and not acknowledged. */
export const blockingGaps = (pkg: CanonicalPackage, cfg: PipelineConfig, role: number): GapStatus[] =>
  gapsForRole(pkg, cfg, role).filter((g) => !g.satisfied && !g.acknowledged);

/** Acknowledged-but-unsatisfied gaps travel with the artifact as caveats. */
export const acknowledgedCaveats = (pkg: CanonicalPackage, cfg: PipelineConfig, role: number): string[] =>
  gapsForRole(pkg, cfg, role).filter((g) => !g.satisfied && g.acknowledged).map((g) => `ACKNOWLEDGED_CANONICAL_GAP ${g.id}: ${g.missing}`);
