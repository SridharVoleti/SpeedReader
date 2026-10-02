import { describe, expect, it } from "vitest";
import { BookCertificationGates, BookCompletionReport, evaluateBookCertification } from "../../lib/book-mode";

// SR-R10-004: Book-level certification.
// "Report actual time, effective rate, comprehension and retention separately."
// "Fast completion cannot be certified as book-level success if configured
//  comprehension/retention gates fail." (TC-R10-004-B: book fast, comprehension below gate ->
//  time/rate shown but no book-level certification.)
const GATES: BookCertificationGates = { comprehensionPassThreshold: 0.7, retentionPassThreshold: 0.7, retentionRequired: true };

describe("evaluateBookCertification", () => {
  it("withholds certification on a fast completion when comprehension is below the gate, while still reporting time/rate (TC-R10-004-B)", () => {
    const report: BookCompletionReport = { actualMinutes: 40, effectiveWpm: 500, comprehensionScore: 0.4, retentionScore: 0.9 };
    const result = evaluateBookCertification(report, GATES);

    expect(result.certified).toBe(false);
    expect(result.reasonCode).toBe("COMPREHENSION_GATE_NOT_MET");
    expect(result.actualMinutes).toBe(40);
    expect(result.effectiveWpm).toBe(500);
    expect(result.comprehensionScore).toBe(0.4);
  });

  it("withholds certification when comprehension passes but retention is mandatory and fails", () => {
    const report: BookCompletionReport = { actualMinutes: 40, effectiveWpm: 300, comprehensionScore: 0.9, retentionScore: 0.3 };
    const result = evaluateBookCertification(report, GATES);

    expect(result.certified).toBe(false);
    expect(result.reasonCode).toBe("RETENTION_GATE_NOT_MET");
  });

  it("certifies when both comprehension and retention pass their gates", () => {
    const report: BookCompletionReport = { actualMinutes: 40, effectiveWpm: 300, comprehensionScore: 0.9, retentionScore: 0.9 };
    const result = evaluateBookCertification(report, GATES);

    expect(result.certified).toBe(true);
    expect(result.reasonCode).toBe("CERTIFIED");
  });

  it("reports time, rate, comprehension and retention separately regardless of certification outcome", () => {
    const report: BookCompletionReport = { actualMinutes: 40, effectiveWpm: 500, comprehensionScore: 0.4, retentionScore: 0.9 };
    const result = evaluateBookCertification(report, GATES);

    expect(result.actualMinutes).toBe(report.actualMinutes);
    expect(result.effectiveWpm).toBe(report.effectiveWpm);
    expect(result.comprehensionScore).toBe(report.comprehensionScore);
    expect(result.retentionScore).toBe(report.retentionScore);
  });

  it("is deterministic for identical inputs", () => {
    const report: BookCompletionReport = { actualMinutes: 40, effectiveWpm: 500, comprehensionScore: 0.4, retentionScore: 0.9 };
    expect(evaluateBookCertification(report, GATES)).toEqual(evaluateBookCertification(report, GATES));
  });
});
