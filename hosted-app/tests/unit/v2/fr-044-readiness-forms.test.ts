import { describe, expect, it } from "vitest";
import { checkCertificationEvidence, selectEquivalentForm, validateReadinessForm, type ReadinessForm } from "../../../lib/v2/readiness-forms";

const form = (over: Partial<ReadinessForm> = {}): ReadinessForm => ({
  formId: "RS03-A", version: "1.0", rsId: "RS03", equivalenceGroupId: "RS03-equiv-1", source: "PRE_GENERATED",
  qaApproved: true, independentQaReviewerId: "qa-1", authorId: "author-1", ...over
});
const catalog = [form(), form({ formId: "RS03-B" }), form({ formId: "RS03-C" })];

// FR-044 - Readiness-critical forms [FROZEN] (AC-P27)
describe("FR-044 readiness-critical forms", () => {
  it("accepts a pre-generated, independently QA-approved form in an equivalence group", () => {
    expect(validateReadinessForm(form())).toEqual([]);
  });

  it("rejects runtime-generated readiness material", () => {
    expect(validateReadinessForm(form({ source: "RUNTIME_GENERATED" }))).toContain("readiness-critical forms must be pre-generated, never runtime-generated");
  });

  it("requires QA approval by a reviewer independent of the author", () => {
    expect(validateReadinessForm(form({ qaApproved: false }))).toContain("form is not QA approved");
    expect(validateReadinessForm(form({ independentQaReviewerId: null }))).toContain("form has no independent QA reviewer");
    expect(validateReadinessForm(form({ independentQaReviewerId: "author-1" }))).toContain("QA reviewer must be independent of the author");
  });

  it("requires membership of an approved equivalence group and a version", () => {
    expect(validateReadinessForm(form({ equivalenceGroupId: "" }))).toContain("form is not part of an approved equivalence group");
    expect(validateReadinessForm(form({ version: "" }))).toContain("form needs a version");
  });

  it("certification evidence must cite an approved form id and version (AC-P27)", () => {
    expect(checkCertificationEvidence({ formId: "RS03-A", version: "1.0" }, catalog)).toMatchObject({ ok: true });
  });

  it("runtime-generated, unknown or unapproved content cannot be certification evidence", () => {
    const unknown = checkCertificationEvidence({ formId: "runtime-gen-123", version: "1.0" }, catalog);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toMatch(/UNKNOWN_FORM/);
    const draft = checkCertificationEvidence({ formId: "RS03-A", version: "1.0" }, [form({ qaApproved: false })]);
    expect(draft.ok).toBe(false);
    if (!draft.ok) expect(draft.reason).toMatch(/FORM_NOT_APPROVED/);
    const runtime = checkCertificationEvidence({ formId: "RS03-A", version: "1.0" }, [form({ source: "RUNTIME_GENERATED" })]);
    expect(runtime.ok).toBe(false);
  });

  it("rejects an evidence reference whose form version does not match the approved version", () => {
    const r = checkCertificationEvidence({ formId: "RS03-A", version: "0.9" }, catalog);
    expect(r).toEqual({ ok: false, reason: "FORM_VERSION_MISMATCH: evidence cites 0.9, approved is 1.0" });
  });

  it("selects an unused approved equivalent form, skipping unapproved ones, or none if exhausted", () => {
    const mixed = [form({ formId: "x", qaApproved: false }), ...catalog];
    expect(selectEquivalentForm(mixed, "RS03", [])?.formId).toBe("RS03-A");
    expect(selectEquivalentForm(mixed, "RS03", ["RS03-A"])?.formId).toBe("RS03-B");
    expect(selectEquivalentForm(mixed, "RS03", ["RS03-A", "RS03-B", "RS03-C"])).toBeNull();
    expect(selectEquivalentForm(mixed, "RS04", [])).toBeNull();
  });
});
