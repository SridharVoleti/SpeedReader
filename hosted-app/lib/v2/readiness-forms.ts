// FR-044 - Readiness-critical forms [FROZEN] (AC-P27)
// Confirmation, reassessment, revalidation and any other readiness-critical evidence must use
// PRE-GENERATED, independently QA-approved EQUIVALENT forms. Readiness-critical material is never
// generated dynamically at learner runtime; runtime AI may coach or explain, but certification evidence
// must come from controlled approved material.

import type { RsId } from "../world1-framework";

export type ReadinessForm = {
  formId: string;
  version: string;
  rsId: RsId;
  /** Forms in the same group are independently QA-approved as equivalent to one another. */
  equivalenceGroupId: string;
  source: "PRE_GENERATED" | "RUNTIME_GENERATED";
  qaApproved: boolean;
  /** Reviewer who is independent of the author/implementer. */
  independentQaReviewerId: string | null;
  authorId: string;
};

export function validateReadinessForm(form: ReadinessForm): string[] {
  const errors: string[] = [];
  if (form.source !== "PRE_GENERATED") errors.push("readiness-critical forms must be pre-generated, never runtime-generated");
  if (!form.qaApproved) errors.push("form is not QA approved");
  if (!form.independentQaReviewerId) errors.push("form has no independent QA reviewer");
  else if (form.independentQaReviewerId === form.authorId) errors.push("QA reviewer must be independent of the author");
  if (!form.equivalenceGroupId) errors.push("form is not part of an approved equivalence group");
  if (!form.version) errors.push("form needs a version");
  return errors;
}

/** What a readiness evidence record must cite: an approved form id AND the exact version used. */
export type FormReference = { formId: string; version: string };

export type EvidenceCheck = { ok: true; form: ReadinessForm } | { ok: false; reason: string };

/** Certification evidence may only reference an approved form at the exact approved version. */
export function checkCertificationEvidence(ref: FormReference, catalog: readonly ReadinessForm[]): EvidenceCheck {
  const form = catalog.find((f) => f.formId === ref.formId);
  if (!form) return { ok: false, reason: "UNKNOWN_FORM: not an approved catalog form (runtime-generated content cannot be certification evidence)" };
  if (form.version !== ref.version) return { ok: false, reason: `FORM_VERSION_MISMATCH: evidence cites ${ref.version}, approved is ${form.version}` };
  const errors = validateReadinessForm(form);
  if (errors.length) return { ok: false, reason: `FORM_NOT_APPROVED: ${errors.join("; ")}` };
  return { ok: true, form };
}

/** Pick an approved equivalent form for an RS competency, avoiding forms already used. */
export function selectEquivalentForm(
  catalog: readonly ReadinessForm[],
  rsId: RsId,
  usedFormIds: readonly string[]
): ReadinessForm | null {
  const approved = catalog.filter((f) => f.rsId === rsId && validateReadinessForm(f).length === 0);
  const fresh = approved.find((f) => !usedFormIds.includes(f.formId));
  return fresh ?? null;
}
