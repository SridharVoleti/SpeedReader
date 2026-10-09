import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ContentError, FixtureContentProvider, learnerView, type V3Passage } from "../../../lib/v2/content-provider";
import { levelUpSyncPayload } from "../../../lib/v2/babysteps-sync";
import { buildDeps, handleV3 } from "../../../api/v3";
import { count100 } from "../../../lib/sr/pipeline-v2/count100";

describe("APP-READ-001 / APP-KM-002 the learner view uses the canonical tokenizer", () => {
  it("token indices and text are exactly COUNT-100's", () => {
    const p = new FixtureContentProvider().bySequence(1)!;
    const canonical = count100(p.text).tokens;
    expect(learnerView(p).tokens).toEqual(canonical.map((t) => ({ index: t.index, text: t.text })));
  });

  it("standalone punctuation is metadata, not a displayed word", () => {
    const p = { ...new FixtureContentProvider().bySequence(1)!, text: "Mia ran - fast ! Then rested ." };
    expect(learnerView(p).tokens.map((t) => t.text)).toEqual(["Mia", "ran", "fast", "Then", "rested"]);
  });

  it("text the canonical tokenizer rejects is a content defect that fails closed as 'being prepared'", async () => {
    const bad: V3Passage = { ...new FixtureContentProvider().bySequence(1)!, text: "Mia​ ran fast" };
    expect(() => learnerView(bad)).toThrow(ContentError);
    const provider = { source: "FIXTURE" as const, assessment: () => bad, bySequence: () => bad, byPassageId: () => bad };
    const dir = mkdtempSync(join(tmpdir(), "sr-cp2-"));
    try {
      const deps = buildDeps(dir, provider);
      const who = { learnerId: "kid", sessionId: "S", deviceId: "d" };
      const call = (m: string, path: string) => handleV3(new Request(`http://x/api/v3/${path}`, { method: m }), path.split("/"), who, deps);
      await call("POST", "bootstrap");
      await call("POST", "assessment/start");
      const res = await call("GET", "assessment/passage");
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: "CONTENT_UNAVAILABLE" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("APP-PLAT-010 / APP-PRIV-003 Babysteps sync payload", () => {
  it("a Level Up is one completed Babystep, reported with structured fields only", () => {
    const p = levelUpSyncPayload(90, 91);
    expect(p).toEqual({
      levelKey: "90",
      nextLevelKey: "91",
      progressSummary: { currentLevel: "91 words a minute", efficiencyStars: 0, milestone: "You Levelled Up!", nextDestination: "92 words a minute" }
    });
    expect(JSON.stringify(p)).not.toMatch(/transcript|audio|GREEN|score|classification/i);
  });

  it("refuses anything that is not exactly +1 WPM", () => {
    expect(() => levelUpSyncPayload(90, 92)).toThrow(RangeError);
    expect(() => levelUpSyncPayload(91, 90)).toThrow(RangeError);
    expect(() => levelUpSyncPayload(90.5, 91.5)).toThrow(RangeError);
  });
});
