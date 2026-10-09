import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UNKNOWN_CLIENT, classifyClient } from "../../../lib/v2/client-class";
import { calibrationAnalytics } from "../../../lib/v2/calibration-analytics";
import { recordNewProgressionAttempt } from "../../../lib/v2/attempt-record";
import { newLearnerAggregate, type LearnerAggregate } from "../../../lib/v2/learner-aggregate";
import { scoreComprehension, structuredEvidence } from "../../../lib/v2/comprehension-score";
import { applyReadinessAttempt, completeRemediation, newReadinessStream, type AttemptOutcome, type AttemptRole, type ReadinessStream } from "../../../lib/v2/readiness-lifecycle";
import { buildDeps, handleV3 } from "../../../api/v3";
import { FixtureContentProvider } from "../../../lib/v2/content-provider";
import { GREEN_THRESHOLD } from "../../../lib/v2/comprehension-threshold";

describe("APP-CAL-003 coarse client classification (no raw user agent)", () => {
  const UA = {
    androidChrome: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    edgeDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    chromeDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    firefoxDesktop: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    ipadSafari: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    chromeOnIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1"
  };
  it.each([
    ["androidChrome", { device: "mobile", browser: "chrome" }],
    ["iphoneSafari", { device: "mobile", browser: "safari" }],
    ["edgeDesktop", { device: "desktop", browser: "edge" }],
    ["chromeDesktop", { device: "desktop", browser: "chrome" }],
    ["firefoxDesktop", { device: "desktop", browser: "firefox" }],
    ["ipadSafari", { device: "tablet", browser: "safari" }],
    ["chromeOnIos", { device: "mobile", browser: "chrome" }]
  ] as const)("%s", (key, expected) => {
    expect(classifyClient(UA[key])).toEqual(expected);
  });
  it("missing or empty user agents are unknown, and the class carries nothing else", () => {
    expect(classifyClient(undefined)).toEqual(UNKNOWN_CLIENT);
    expect(classifyClient("")).toEqual(UNKNOWN_CLIENT);
    expect(Object.keys(classifyClient(UA.androidChrome)).sort()).toEqual(["browser", "device"]);
  });
});

const scored = (s: number) => scoreComprehension(structuredEvidence([{ itemId: "q1", score: s }]), { score: s });
type Spec = { score: number | null; passageId?: string; at?: string; client?: { device: "mobile" | "desktop"; browser: "chrome" | "safari" }; registry?: { registryPassageId: string; rsId: string; p: number } };
function play(id: string, start: number, specs: Spec[]): LearnerAggregate {
  let l = newLearnerAggregate(id, start);
  specs.forEach((sp, i) => {
    const at = sp.at ?? `2026-10-0${1 + Math.floor(i / 4)}T10:${String(i).padStart(2, "0")}:00Z`;
    l = recordNewProgressionAttempt(l, {
      attemptId: `${id}-a${i}`, passageId: sp.passageId ?? `P${i + 1}`, displayedWpm: l.core.wpm, passageWords: 100, recordedAt: at, completedAt: at, startedAt: at,
      comprehension: sp.score === null ? ({ status: "AWAITING_SPOKEN_EVIDENCE", structured: structuredEvidence([{ itemId: "q", score: 0.5 }]), calibrationVersion: "c", score: null, classification: null } as never) : scored(sp.score),
      spokenReason: sp.score === null ? "ASR_LOW_CONFIDENCE" : null, client: sp.client ?? null, registry: sp.registry ?? null
    }).learner;
  });
  return l;
}

describe("APP-CAL-003 analytics are informational aggregates", () => {
  const G = 0.9, N = 0.4;
  const a = play("a", 90, [{ score: G }, { score: G }, { score: G }, { score: G }, { score: G }]); // Level Up on the 5th
  const b = play("b", 90, [{ score: G }, { score: N }, { score: N }, { score: N }, { score: N }]); // HOLD
  const report = calibrationAnalytics({ learners: [a, b] });

  it("is labelled informational, carries the frozen threshold, and contains no learner identifiers", () => {
    expect(report.informationalOnly).toBe(true);
    expect(report.greenThreshold).toBe(GREEN_THRESHOLD);
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/"a-a\d"|"b-a\d"|learnerId|"a"|"b"/);
  });

  it("cohort size and score distribution are computed exactly", () => {
    expect(report.cohort).toEqual({ learners: 2, attempts: 10, scoredAttempts: 10 });
    expect(report.scoreDistribution).toMatchObject({ min: 0.4, max: 0.9, atOrAboveGreen: 0.6 });
    expect(report.scoreDistribution.mean).toBeCloseTo((0.9 * 6 + 0.4 * 4) / 10, 3);
  });

  it("progression rate: one Level Up, one HOLD, per-learner rate", () => {
    expect(report.progression).toMatchObject({ levelUps: 1, holds: 1, deferredByLengthStep: 0, levelUpsPerLearner: 0.5 });
  });

  it("time to Level Up counts the scored attempts it took", () => {
    expect(report.timeToLevelUp.samples).toBe(1);
    expect(report.timeToLevelUp.medianAttempts).toBe(5);
  });

  it("passage splits group by passage", () => {
    expect(report.byPassage["P1"]).toMatchObject({ attempts: 2, greenShare: 1 });
    expect(report.byPassage["P2"]).toMatchObject({ attempts: 2, greenShare: 0.5, meanScore: 0.65 });
  });

  it("RS/P splits use the registry coordinate when present and skip attempts without one", () => {
    const l = play("r", 90, [{ score: G, registry: { registryPassageId: "R1", rsId: "RS03", p: 4 } }, { score: N, registry: { registryPassageId: "R2", rsId: "RS03", p: 4 } }, { score: G }]);
    const r = calibrationAnalytics({ learners: [l] });
    expect(Object.keys(r.byRsAndP)).toEqual(["RS03-P4"]);
    expect(r.byRsAndP["RS03-P4"]).toMatchObject({ attempts: 2, greenShare: 0.5 });
  });

  it("device/browser effects use the coarse class and skip attempts without one", () => {
    const l = play("d", 90, [
      { score: G, client: { device: "mobile", browser: "chrome" } }, { score: N, client: { device: "mobile", browser: "chrome" } },
      { score: G, client: { device: "desktop", browser: "safari" } }, { score: G }
    ]);
    const r = calibrationAnalytics({ learners: [l] });
    expect(Object.keys(r.byDeviceBrowser)).toEqual(["desktop/safari", "mobile/chrome"]);
    expect(r.byDeviceBrowser["mobile/chrome"]).toMatchObject({ attempts: 2, greenShare: 0.5 });
  });

  it("ASR uncertainty is reported separately from performance", () => {
    const l = play("t", 90, [{ score: G }, { score: null }, { score: null }, { score: G }]);
    const r = calibrationAnalytics({ learners: [l] });
    expect(r.asrUncertainty).toEqual({ attempts: 2, technicalShare: 0.5, byReason: { ASR_LOW_CONFIDENCE: 2 } });
    expect(r.cohort.scoredAttempts).toBe(2);
  });

  it("practice frequency is per 100 new passages", () => {
    const l = { ...play("p", 90, [{ score: N }, { score: N }, { score: N }, { score: N }]), practiceLog: [{ attemptId: "x", passageId: "P1", wpm: 90, attemptType: "FAMILIAR_PRACTICE" as const, sessionId: "S", recordedAt: "2026-10-01T10:00:00Z" }] };
    expect(calibrationAnalytics({ learners: [l] }).practice).toEqual({ practiceEvents: 1, per100NewPassages: 25 });
  });

  it("stamina-transition outcomes compare the first longer passage with the rest", () => {
    const base = play("s", 90, [{ score: G }, { score: G }, { score: G }]);
    // make the third record the first of a longer length
    const ledger = base.ledger.map((r, i) => (i === 2 ? { ...r, passageWords: 125, classification: "NOT_GREEN" as const, comprehensionScore: 0.4 } : r));
    const r = calibrationAnalytics({ learners: [{ ...base, ledger }] });
    expect(r.staminaTransitions).toEqual({ transitions: 1, greenShareAtFirstLongerPassage: 0, greenShareElsewhere: 1 });
  });

  it("engagement: active days, and the share of learners who left and came back", () => {
    const back = play("e", 90, [{ score: G, at: "2026-10-01T10:00:00Z" }, { score: G, at: "2026-10-20T10:00:00Z" }]);
    const steady = play("f", 90, [{ score: G, at: "2026-10-01T10:00:00Z" }, { score: G, at: "2026-10-02T10:00:00Z" }]);
    const r = calibrationAnalytics({ learners: [back, steady] });
    expect(r.engagement).toEqual({ learnersActive: 2, medianActiveDays: 2, returnedAfterGapShare: 0.5 });
  });

  it("an empty cohort yields nulls rather than invented numbers", () => {
    const r = calibrationAnalytics({ learners: [] });
    expect(r.cohort).toEqual({ learners: 0, attempts: 0, scoredAttempts: 0 });
    expect(r.scoreDistribution.mean).toBeNull();
    expect(r.progression.levelUpsPerLearner).toBeNull();
    expect(r.timeToLevelUp.medianAttempts).toBeNull();
    expect(r.engagement.returnedAfterGapShare).toBeNull();
  });
});

describe("readiness indicators (false-ready / false-not-ready)", () => {
  let n = 0;
  const att = (role: AttemptRole, outcome: AttemptOutcome) => {
    n += 1;
    return { registryPassageId: "R", formFamilyId: "F", assessmentFormId: `f${n}`, deliveryEventId: `e${n}`, attemptId: `at${n}`, role, outcome, at: "2026-10-09T10:00:00Z" };
  };
  const apply = (s: ReadinessStream, a: ReturnType<typeof att>) => { const r = applyReadinessAttempt(s, a); if (!r.ok) throw new Error(r.error); return r.stream; };

  it("counts a confirmed stream that later fails revalidation as a false-ready indicator", async () => {
    const { dueForRevalidation } = await import("../../../lib/v2/readiness-lifecycle");
    let s = apply(apply(newReadinessStream("k", "RS01"), att("PRIMARY", "PASS")), att("CONFIRMATION", "PASS"));
    s = apply(dueForRevalidation(s, "INACTIVITY"), att("REVALIDATION", "FAIL"));
    const r = calibrationAnalytics({ learners: [], readiness: [s] });
    expect(r.readiness).toMatchObject({ streams: 1, confirmed: 0, falseReadyIndicators: 1, falseNotReadyIndicators: 0 });
  });

  it("counts a failed cycle followed by an immediate pass of the next cycle's primary as a false-not-ready indicator", () => {
    let s = apply(newReadinessStream("k", "RS02"), att("PRIMARY", "FAIL"));
    s = apply(completeRemediation(s), att("NEW_CYCLE_PRIMARY", "PASS"));
    const r = calibrationAnalytics({ learners: [], readiness: [s] });
    expect(r.readiness).toMatchObject({ falseNotReadyIndicators: 1, falseReadyIndicators: 0 });
  });
});

describe("the ops endpoint exposes the report only to internal callers and captures the client class", () => {
  it("is gated by the internal key and built from stored learners", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sr-cal-"));
    try {
      const deps = buildDeps(dir, new FixtureContentProvider());
      const who = { learnerId: "kid", sessionId: "S", deviceId: "d" };
      const call = (path: string, headers: Record<string, string> = {}, method = "GET", body?: unknown) =>
        handleV3(new Request(`http://x/api/v3/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("/"), who, deps);
      expect((await call("ops/calibration")).status).toBe(403);
      process.env.SR_INTERNAL_API_KEY = "k".repeat(24);
      await call("bootstrap", {}, "POST");
      await call("assessment/start", {}, "POST");
      for (let i = 1; ; i += 1) {
        const a = await (await call("assessment/answer", {}, "POST", { key: `k${i}`, answers: [1, 0, 2, 0] })).json() as { status: string };
        if (a.status === "COMPLETE") break;
      }
      await call("assessment/finalize", {}, "POST");
      await call("passage/submit", { "user-agent": "Mozilla/5.0 (Linux; Android 13) Chrome/126.0 Mobile Safari/537.36" }, "POST", { attemptId: "a1", passageId: "FX-0001", answers: [1, 0, 2, 0], explanation: { text: "Mia has a red kite and takes it to the big hill.", mode: "typed" } });
      const res = await call("ops/calibration", { "x-sr-internal-key": "k".repeat(24) });
      expect(res.status).toBe(200);
      const { report } = (await res.json()) as { report: ReturnType<typeof calibrationAnalytics> };
      expect(report.cohort).toMatchObject({ learners: 1, attempts: 1 });
      expect(report.byDeviceBrowser).toHaveProperty("mobile/chrome");
      expect(JSON.stringify(report)).not.toMatch(/Mozilla|Android 13|kid/);
    } finally {
      delete process.env.SR_INTERNAL_API_KEY;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
