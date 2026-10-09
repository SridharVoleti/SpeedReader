import { describe, expect, it } from "vitest";
import { routablePages } from "../../../app.pages";

// Issue #18: the legacy /explain journey exposes GREEN/readiness states, so it is diagnostics-only.
describe("legacy /explain route is not production-routable (#18)", () => {
  it("is absent on a Vercel production deployment even when diagnostics are requested", () => {
    expect(Object.keys(routablePages({ VERCEL_ENV: "production", SR_ENABLE_DIAGNOSTICS: "true" }))).toEqual([]);
  });
  it("is absent by default", () => {
    expect(routablePages({})).not.toHaveProperty("explain");
  });
  it("is mounted only when diagnostics are explicitly enabled outside production", () => {
    expect(routablePages({ SR_ENABLE_DIAGNOSTICS: "true", VERCEL_ENV: "preview" })).toHaveProperty("explain");
    expect(routablePages({ SR_ENABLE_DIAGNOSTICS: "true" })).toHaveProperty("explain");
  });
});
