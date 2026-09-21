import { describe, expect, it } from "vitest";
import { selectNextForm } from "../../lib/training";

// SR-R6-003: No meaningless repetition.
// "Repeated activities vary evidence/form while preserving target skill."
// "Immediate duplicate form reuse is rejected when alternatives exist; unavoidable reuse logs
//  reason."
describe("selectNextForm", () => {
  it("rejects immediate duplicate form reuse when an alternative exists", () => {
    const selection = selectNextForm(["form-a", "form-b", "form-c"], "form-a");

    expect(selection.formId).not.toBe("form-a");
    expect(["form-b", "form-c"]).toContain(selection.formId);
    expect(selection.reuseReason).toBeNull();
  });

  it("allows reuse and logs a reason when no alternative form is available", () => {
    const selection = selectNextForm(["form-a"], "form-a");

    expect(selection.formId).toBe("form-a");
    expect(selection.reuseReason).toBe("NO_ALTERNATIVE_FORM_AVAILABLE");
  });

  it("picks any available form with no reuse reason when there is no prior form (first attempt)", () => {
    const selection = selectNextForm(["form-a", "form-b"], null);

    expect(selection.formId).not.toBeNull();
    expect(selection.reuseReason).toBeNull();
  });

  it("returns no selection when there are no forms available at all", () => {
    const selection = selectNextForm([], "form-a");

    expect(selection.formId).toBeNull();
    expect(selection.reuseReason).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    expect(selectNextForm(["form-a", "form-b", "form-c"], "form-a")).toEqual(
      selectNextForm(["form-a", "form-b", "form-c"], "form-a")
    );
  });
});
