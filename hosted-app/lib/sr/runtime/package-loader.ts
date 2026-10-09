import { createHash } from "node:crypto";
// The learner-runtime CONSUMER of approved SR packages (issues #13, #14).
// Loads only from the approved root (hash-verified by the store), re-validates the package, passes it through
// the platform content gate, and runs the runtime's own scorer against it so an unusable package is rejected
// at ingestion rather than at a learner.

import { join } from "node:path";
import { gateContent } from "../../content-gate";
import { validatePackageSchema } from "../pipeline/package-schema";
import { strictParseBytes } from "../pipeline/strict-json";
import { SCORING_RULES, scoreP10, type P10Item } from "../p10-scoring";
import type { createStore } from "../pipeline/storage";

type Store = ReturnType<typeof createStore>;

export type LearnerItem = { itemId: string; stem: string; options: string[]; answerIndex: number; primary: boolean };
export type LearnerPackage = {
  packageId: string; packageVersion: number; passageId: string; text: string; wordCount: number;
  items: LearnerItem[]; meaningUnits: { muId: string; text: string; factIds: string[] }[];
  bpcText: string; ruleId: string; outcomes: { state: "PASS" | "FAIL"; oralReady: boolean; comprehensionReady: boolean }[];
};
export type LoadResult = { ok: true; pkg: LearnerPackage; /** Approval hash of the exact bytes consumed, when the store provides it. */ hash?: string } | { ok: false; errors: string[] };

/** Run the runtime scorer against the package: all-correct first-attempt must pass, a wrong primary must fail. */
export function consumerContractCheck(pkg: LearnerPackage): string[] {
  const errors: string[] = [];
  const rule = SCORING_RULES[pkg.ruleId];
  if (!rule) return [`unknown scoring rule ${pkg.ruleId}`];
  if (pkg.items.length !== rule.itemCount) return [`rule ${rule.id} needs ${rule.itemCount} items, package has ${pkg.items.length}`];
  for (const i of pkg.items) if (i.answerIndex >= i.options.length) errors.push(`item ${i.itemId}: answerIndex outside options`);
  if (pkg.text.trim().split(/\s+/).length !== pkg.wordCount) errors.push("passage wordCount does not match text");
  if (errors.length) return errors;
  try {
    const answers = (allCorrect: boolean, primaryCorrect: boolean): P10Item[] =>
      pkg.items.map((i) => ({ itemId: i.itemId, primary: i.primary, firstAttempt: true, correct: i.primary ? primaryCorrect : allCorrect }));
    if (!scoreP10(answers(true, true), rule).pass) errors.push("runtime scorer rejects a perfect first-attempt response");
    if (scoreP10(answers(true, false), rule).pass) errors.push("runtime scorer passes a response with the primary item wrong");
  } catch (e) {
    errors.push(`runtime scorer cannot consume package: ${(e as Error).message}`);
  }
  return errors;
}

/** Parse + validate bytes as a runtime package. The gate only treats bytes read from the approved root as APPROVED. */
export function parseRuntimePackage(bytes: Uint8Array, approvalStatus: "APPROVED" | "WIP"): LoadResult {
  const parsed = strictParseBytes(bytes);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const schema = validatePackageSchema(parsed.value);
  if (!schema.ok) return { ok: false, errors: schema.errors };
  // schema-validated above, so the shape is known
  const p = parsed.value as {
    packageId: string; packageVersion: number; schemaVersion: string; passageId: string;
    passage: { text: string; wordCount: number };
    assessment: { items: LearnerItem[] };
    meaningUnits: { units: { muId: string; text: string; factIds: string[] }[] };
    bpc: { text: string };
    scoring: { ruleId: string };
    attemptContract: { outcomes: { state: "PASS" | "FAIL"; oralReady: boolean; comprehensionReady: boolean }[] };
  };
  const gate = gateContent({ content_id: p.packageId, content_version: String(p.packageVersion), schema_version: p.schemaVersion, approval_status: approvalStatus });
  if (!gate.valid) return { ok: false, errors: gate.reasons };
  const pkg: LearnerPackage = {
    packageId: p.packageId, packageVersion: p.packageVersion, passageId: p.passageId, text: p.passage.text, wordCount: p.passage.wordCount,
    items: p.assessment.items.map((i) => ({ itemId: i.itemId, stem: i.stem, options: [...i.options], answerIndex: i.answerIndex, primary: i.primary })),
    meaningUnits: p.meaningUnits.units.map((u) => ({ muId: u.muId, text: u.text, factIds: [...u.factIds] })),
    bpcText: p.bpc.text, ruleId: p.scoring.ruleId,
    outcomes: p.attemptContract.outcomes.map((o) => ({ state: o.state, oralReady: o.oralReady, comprehensionReady: o.comprehensionReady }))
  };
  const contract = consumerContractCheck(pkg);
  return contract.length ? { ok: false, errors: contract } : { ok: true, pkg };
}

export const approvedPackagePath = (store: Store, packageId: string) => join(store.roots.approved, "packages", `${packageId}.json`);

/** Approved-only load: the store verifies the approval hash; anything else fails closed. */
export function loadApprovedPackage(store: Store, packageId: string): LoadResult {
  if (!/^PKG-W1-[0-9]{4}$/.test(packageId)) return { ok: false, errors: [`invalid package id ${packageId}`] };
  try {
    const { content, hash } = store.readAuthoritative(approvedPackagePath(store, packageId)) as { content: string; hash?: string };
    const r = parseRuntimePackage(new TextEncoder().encode(content), "APPROVED");
    return r.ok ? { ...r, hash: hash ?? `sha256:${createHash("sha256").update(content).digest("hex")}` } : r;
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
}
