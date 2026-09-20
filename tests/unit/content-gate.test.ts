import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTENT_SCHEMA_VERSION, gateContent, loadApprovedContent } from "../../lib/content-gate";

// SR-R1-003: Approved-file-only content.
// "Missing approval/version/schema validity blocks exposure and logs CONTENT_INVALID."
function approvedFixture(overrides: Record<string, unknown> = {}) {
  return {
    content_id: "level1_001",
    content_version: "1.0",
    schema_version: CONTENT_SCHEMA_VERSION,
    approval_status: "APPROVED" as const,
    ...overrides
  };
}

describe("gateContent", () => {
  it("passes through content that is approved, versioned and schema-valid", () => {
    const raw = approvedFixture();
    const result = gateContent(raw);

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.content).toEqual(raw);
  });

  it("blocks content missing approval_status", () => {
    const raw = approvedFixture({ approval_status: undefined });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasonCode).toBe("CONTENT_INVALID");
      expect(result.reasons.some((r) => r.includes("approval_status"))).toBe(true);
    }
  });

  it("blocks content that is not APPROVED (e.g. WIP)", () => {
    const raw = approvedFixture({ approval_status: "WIP" });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reasonCode).toBe("CONTENT_INVALID");
  });

  it("blocks content missing content_version", () => {
    const raw = approvedFixture({ content_version: undefined });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reasons.some((r) => r.includes("content_version"))).toBe(true);
  });

  it("blocks content missing schema_version", () => {
    const raw = approvedFixture({ schema_version: undefined });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reasons.some((r) => r.includes("schema_version"))).toBe(true);
  });

  it("blocks content with an unsupported schema_version", () => {
    const raw = approvedFixture({ schema_version: "999.0" });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reasons.some((r) => r.includes("schema_version"))).toBe(true);
  });

  it("blocks content missing content_id", () => {
    const raw = approvedFixture({ content_id: undefined });
    const result = gateContent(raw);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reasons.some((r) => r.includes("content_id"))).toBe(true);
  });
});

describe("loadApprovedContent", () => {
  it("returns only approved, valid content and drops the rest", () => {
    const good = approvedFixture({ content_id: "good" });
    const bad = approvedFixture({ content_id: "bad", approval_status: "WIP" });

    const loaded = loadApprovedContent([good, bad]);

    expect(loaded).toEqual([good]);
  });

  it("reports CONTENT_INVALID for each blocked item via the provided callback", () => {
    const bad = approvedFixture({ content_id: "bad", approval_status: "RETIRED" });
    const onInvalid = vi.fn();

    loadApprovedContent([bad], onInvalid);

    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0][0]).toMatchObject({
      valid: false,
      reasonCode: "CONTENT_INVALID",
      contentId: "bad"
    });
  });

  describe("default logging", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs CONTENT_INVALID when no callback is supplied", () => {
      loadApprovedContent([approvedFixture({ approval_status: "WIP" })]);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("CONTENT_INVALID"),
        expect.anything()
      );
    });
  });
});
