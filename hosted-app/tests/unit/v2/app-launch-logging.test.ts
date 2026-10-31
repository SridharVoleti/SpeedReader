import { describe, it, expect, vi } from "vitest";
import { logLaunch, redact } from "../../../../container/launch/log";

describe("launch logging never leaks credentials", () => {
  it("replaces credential-looking fields with their length", () => {
    const r = redact({ accessToken: "abc.def.ghi", bootstrapAssertion: "x".repeat(40), launchCode: "secret-code", SESSION_SECRET: "s", learnerId: "l-1", scopes: ["a"] });
    expect(r.accessToken).toBe("<redacted len=11>");
    expect(r.bootstrapAssertion).toBe("<redacted len=40>");
    expect(r.launchCode).toBe("<redacted len=11>");
    expect(r.SESSION_SECRET).toBe("<redacted len=1>");
    expect(r.learnerId).toBe("l-1");
    expect(r.scopes).toEqual(["a"]);
  });

  it("emits one greppable JSON line per event", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logLaunch("error", "launch.failed", { code: "EXCHANGE_FAILED", token: "do-not-print", error: new Error("boom") });
    const line = String(spy.mock.calls[0][0]);
    spy.mockRestore();
    expect(line.startsWith("[sr-launch] launch.failed {")).toBe(true);
    expect(line).not.toContain("do-not-print");
    expect(JSON.parse(line.slice("[sr-launch] launch.failed ".length))).toMatchObject({ code: "EXCHANGE_FAILED", error: { message: "boom" } });
  });
});
