import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeLearner } from "../../../../app/api/sr/authorize";

// Issue #1: an editable/stale display cookie must never select a learner's progress.
describe("learner identity comes only from the verified session (#1)", () => {
  it("a forged speedreader_learner cookie without a signed session is refused", async () => {
    const forged = encodeURIComponent(JSON.stringify({ learnerId: "victim", displayName: "V" }));
    const req = new Request("http://x/api/v3/progress", { headers: { cookie: `speedreader_learner=${forged}` } });
    const r = await authorizeLearner(req, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it("the production learner UI never derives learner identity or progress keys from a cookie or browser storage", () => {
    const dir = "hosted-app/ui/learner";
    for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/JSON\.parse\([^)]*cookie/i);
      expect(src, f).not.toMatch(/speedreader-progress-v1/);
      expect(src, f).not.toMatch(/loadProgress|recordResult/);
    }
  });
});
