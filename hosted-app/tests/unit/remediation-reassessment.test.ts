import { describe, expect, it } from "vitest";
import { canCountAsIndependentConfirmation, recordConfirmationRespectingFormPurpose, ReassessmentForm } from "../../lib/training";
import { startConfirmationTracker } from "../../lib/certification";

// SR-R6-002: Remediation then independent reassessment.
// "Certification after remediation must use independent reassessment evidence."
// "Training result itself cannot count as independent confirmation unless explicitly approved
//  for assessment." (TC-R6-002-B: "Training cannot certify" - remediation passed, run
//  certification using only training result -> excluded from independent confirmation.)
const allPassingGates = { exposureValid: true, comprehensionPassed: true, evidenceSufficient: true };

describe("canCountAsIndependentConfirmation", () => {
  it("an assessment-purpose form always counts", () => {
    const form: ReassessmentForm = { formId: "f1", formPurpose: "assessment", explicitlyApprovedForAssessment: false };
    expect(canCountAsIndependentConfirmation(form)).toBe(true);
  });

  it("a training-purpose form is excluded by default", () => {
    const form: ReassessmentForm = { formId: "f1", formPurpose: "training", explicitlyApprovedForAssessment: false };
    expect(canCountAsIndependentConfirmation(form)).toBe(false);
  });

  it("a training-purpose form counts only when explicitly approved for assessment", () => {
    const form: ReassessmentForm = { formId: "f1", formPurpose: "training", explicitlyApprovedForAssessment: true };
    expect(canCountAsIndependentConfirmation(form)).toBe(true);
  });
});

describe("recordConfirmationRespectingFormPurpose", () => {
  it("a passing remediation/training result is excluded from independent confirmation (TC-R6-002-B)", () => {
    const tracker = startConfirmationTracker(150, 3);
    const trainingForm: ReassessmentForm = {
      formId: "training-form-1",
      formPurpose: "training",
      explicitlyApprovedForAssessment: false
    };

    const next = recordConfirmationRespectingFormPurpose(tracker, trainingForm, allPassingGates);

    expect(next.confirmedFormIds).toEqual([]);
    expect(next).toEqual(tracker);
  });

  it("an assessment-purpose form with passing gates does count as independent confirmation", () => {
    const tracker = startConfirmationTracker(150, 3);
    const assessmentForm: ReassessmentForm = {
      formId: "assessment-form-1",
      formPurpose: "assessment",
      explicitlyApprovedForAssessment: false
    };

    const next = recordConfirmationRespectingFormPurpose(tracker, assessmentForm, allPassingGates);

    expect(next.confirmedFormIds).toEqual(["assessment-form-1"]);
  });

  it("a training-purpose form explicitly approved for assessment does count", () => {
    const tracker = startConfirmationTracker(150, 3);
    const approvedTrainingForm: ReassessmentForm = {
      formId: "training-form-approved",
      formPurpose: "training",
      explicitlyApprovedForAssessment: true
    };

    const next = recordConfirmationRespectingFormPurpose(tracker, approvedTrainingForm, allPassingGates);

    expect(next.confirmedFormIds).toEqual(["training-form-approved"]);
  });

  it("is deterministic for identical inputs", () => {
    const tracker = startConfirmationTracker(150, 3);
    const form: ReassessmentForm = { formId: "f1", formPurpose: "training", explicitlyApprovedForAssessment: false };
    expect(recordConfirmationRespectingFormPurpose(tracker, form, allPassingGates)).toEqual(
      recordConfirmationRespectingFormPurpose(tracker, form, allPassingGates)
    );
  });
});
