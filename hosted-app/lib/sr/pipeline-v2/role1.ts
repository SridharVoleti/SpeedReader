// Role 1 (deterministic): canonical registry row -> PASSAGE_SPEC. Code, not an LLM.
// It copies the canonical row verbatim and adds only mechanically derived identity. Anything the canonical package
// does not supply is BLOCKED_CANONICAL_INPUT - nothing is guessed, defaulted or hard-coded.

import { CanonicalError, type CanonicalPackage } from "./canonical";
import { COUNT100_VERSION } from "./count100";
import type { Registry } from "./registry";
import { canonicalHash } from "../pipeline/hash";
import { diffPaths } from "../pipeline/fidelity";

export const SPEC_ENVELOPE_VERSION = 1;

export type PassageSpec = {
  artifact_type: "PASSAGE_SPEC";
  envelope_version: number;
  passage_id: string;
  registry_coordinate: string;
  rs: number;
  p: number;
  delivery_session: number;
  delivery_round: number;
  round_position: number;
  target_words: number;
  count_model_version: string;
  is_p10_readiness_form: boolean;
  canonical: {
    package_id: string;
    package_version: string;
    package_hash: string;
    spec_artifact: string;
    spec_sha256: string;
    row_artifact: string;
    row_artifact_sha256: string;
    row_sha256: string;
  };
  /** every canonical row column, verbatim */
  row: Record<string, string>;
};

export function canonicalRefs(pkg: CanonicalPackage) {
  const specName = pkg.domainArtifact("GLOBAL_RULES");
  const rowName = pkg.domainArtifact("ROW_INSTANCE_VALUES");
  const sha = (n: string) => pkg.artifacts.find((a) => a.name === n)!.sha256;
  return {
    package_id: pkg.id, package_version: pkg.version, package_hash: pkg.hash,
    spec_artifact: specName, spec_sha256: sha(specName), row_artifact: rowName, row_artifact_sha256: sha(rowName)
  };
}

export function buildPassageSpec(pkg: CanonicalPackage, registry: Registry, passageId: string): PassageSpec {
  const r = registry.byId.get(passageId);
  if (!r) throw new CanonicalError("BLOCKED_CANONICAL_INPUT", [`passage ${passageId} is not in the canonical registry`]);
  const row = { ...r.row };
  return {
    artifact_type: "PASSAGE_SPEC",
    envelope_version: SPEC_ENVELOPE_VERSION,
    passage_id: r.passageId,
    registry_coordinate: r.coordinate,
    rs: r.rs,
    p: r.p,
    delivery_session: r.deliverySession,
    delivery_round: Number(row.delivery_round),
    round_position: Number(row.round_position),
    target_words: Number(row.target_words),
    count_model_version: COUNT100_VERSION,
    is_p10_readiness_form: r.p === 10,
    canonical: { ...canonicalRefs(pkg), row_sha256: canonicalHash(row) },
    row
  };
}

/** Independent re-derivation: the stored spec must equal what the canonical package yields right now. */
export function verifyPassageSpec(spec: PassageSpec, pkg: CanonicalPackage, registry: Registry): { ok: boolean; problems: string[] } {
  if (!spec || typeof spec !== "object" || typeof spec.passage_id !== "string") return { ok: false, problems: ["not a PASSAGE_SPEC object"] };
  let expected: PassageSpec;
  try { expected = buildPassageSpec(pkg, registry, spec.passage_id); }
  catch (e) { return { ok: false, problems: [(e as Error).message] }; }
  const problems = diffPaths(expected, spec).map((p) => `${p.replace(/^\$\./, "")} differs from the canonical derivation`);
  return { ok: problems.length === 0, problems };
}
