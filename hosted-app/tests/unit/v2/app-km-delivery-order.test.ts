import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../lib/sr/pipeline-v2/csv";
import { BAND_A_PASSAGES, deliveryCoordinateFor, registryCoordinateFor, sequenceForPassageId, sequenceForPassageNo } from "../../../lib/v2/delivery-order";
import { ApprovedPackageProvider } from "../../../lib/v2/content-provider";
import { buildValidPackage } from "../sr/helpers/package";

const REGISTRY = "hosted-app/pipeline/wip/SpeedReader_W1_BandA_Registry_v0.25.csv";
const MATRIX = "hosted-app/Content Creation/SpeedReader_World1_Blocker4_BandA_Readiness_Matrix_v1.0.csv";
const rows = parseCsv(readFileSync(REGISTRY, "utf8").replace(/^﻿/, ""));

describe("APP-KM-001 / APP-W1-002 delivery follows delivery_session, verified against the real registry", () => {
  it("the registry has the 150 Band-A rows this check relies on", () => {
    expect(rows).toHaveLength(BAND_A_PASSAGES);
  });

  it("every one of the 150 positions maps to exactly the passage the registry assigns to that delivery_session", () => {
    for (const r of rows) {
      const c = deliveryCoordinateFor(Number(r.delivery_session));
      expect(c.passageId, `session ${r.delivery_session}`).toBe(r.passage_id);
      expect(c.rs).toBe(Number(r.reading_stage_no));
      expect(c.p).toBe(Number(r.stage_passage_no));
      expect(c.passageNo).toBe(Number(r.passage_no));
      expect(c.specified).toBe(true);
    }
  });

  it("the inverse agrees with the registry, and the mapping is a bijection over 1..150", () => {
    for (const r of rows) expect(sequenceForPassageId(r.passage_id)).toBe(Number(r.delivery_session));
    const ids = new Set(Array.from({ length: 150 }, (_, i) => deliveryCoordinateFor(i + 1).passageId));
    expect(ids.size).toBe(150);
    for (let n = 1; n <= 150; n += 1) expect(sequenceForPassageNo(deliveryCoordinateFor(n).passageNo)).toBe(n);
  });

  it("learners are not served in registry order: the first rounds interleave the 15 reading stages", () => {
    expect(Array.from({ length: 15 }, (_, i) => deliveryCoordinateFor(i + 1).coordinate)).toEqual(Array.from({ length: 15 }, (_, i) => `RS${String(i + 1).padStart(2, "0")}-P1`));
    expect(deliveryCoordinateFor(2)).toMatchObject({ coordinate: "RS02-P1", passageId: "W1-0011" });
    expect(deliveryCoordinateFor(16)).toMatchObject({ coordinate: "RS01-P2", passageId: "W1-0002" });
    expect(deliveryCoordinateFor(150)).toMatchObject({ coordinate: "RS15-P10", passageId: "W1-0150" });
  });

  it("agrees with the readiness matrix: each RS's P10 form is delivered in sessions 136..150", () => {
    const matrix = parseCsv(readFileSync(MATRIX, "utf8").replace(/^﻿/, ""));
    expect(matrix).toHaveLength(15);
    for (const m of matrix) {
      const c = deliveryCoordinateFor(Number(m.final_delivery_session));
      expect(c.coordinate).toBe(`${m.reading_stage}-P10`);
      expect(c.passageNo).toBe(Number(m.final_passage_no));
    }
  });

  it("positions beyond 150 are an explicit unspecified placeholder, never presented as canon", () => {
    expect(deliveryCoordinateFor(151)).toMatchObject({ specified: false, passageId: "W1-0151" });
    expect(deliveryCoordinateFor(1500).specified).toBe(false);
    expect(sequenceForPassageNo(151)).toBe(151);
  });

  it("rejects out-of-range positions and malformed ids", () => {
    expect(() => deliveryCoordinateFor(0)).toThrow(RangeError);
    expect(() => deliveryCoordinateFor(1501)).toThrow(RangeError);
    expect(() => deliveryCoordinateFor(2.5)).toThrow(RangeError);
    expect(() => sequenceForPassageNo(0)).toThrow(RangeError);
    expect(sequenceForPassageId("FX-0001")).toBeNull();
    expect(sequenceForPassageId("W1-12")).toBeNull();
  });
});

describe("ApprovedPackageProvider loads the passage delivery order asks for", () => {
  // a stub store that records which approved package file is read and serves a valid package for any request
  function stubStore() {
    const read: string[] = [];
    const pkg = JSON.stringify(buildValidPackage());
    return {
      read,
      store: { roots: { approved: "/approved", wip: "/wip" }, readAuthoritative: (path: string) => { read.push(path.replace(/\\/g, "/")); return { content: pkg }; } } as never
    };
  }

  it("sequence 2 loads RS02-P1 (W1-0011), not W1-0002", () => {
    const { read, store } = stubStore();
    new ApprovedPackageProvider(store).bySequence(2);
    expect(read[0]).toMatch(/packages\/PKG-W1-0011\.json$/);
  });

  it.each([[1, "W1-0001"], [15, "W1-0141"], [16, "W1-0002"], [136, "W1-0010"], [150, "W1-0150"]])("sequence %i loads %s", (seq, id) => {
    const { read, store } = stubStore();
    new ApprovedPackageProvider(store).bySequence(seq);
    expect(read[0]).toMatch(new RegExp(`packages/PKG-${id}\\.json$`));
  });

  it("the passage's sequence is derived from delivery order, so the submit check compares like with like", () => {
    const { store } = stubStore();
    const p = new ApprovedPackageProvider(store).byPassageId("W1-0007")!;
    expect(p).toBeTruthy();
    // the stub serves the package whose own passageId is W1-0007 = RS01-P7 = delivery session (7-1)*15+1 = 91
    expect(p.passageId).toBe("W1-0007");
    expect(p.sequence).toBe(91);
  });

  it("malformed ids and out-of-range sequences never touch the store", () => {
    const { read, store } = stubStore();
    const provider = new ApprovedPackageProvider(store);
    expect(provider.byPassageId("../../etc/passwd")).toBeNull();
    expect(provider.byPassageId("FX-0001")).toBeNull();
    expect(provider.bySequence(0)).toBeNull();
    expect(provider.bySequence(1501)).toBeNull();
    expect(read).toEqual([]);
  });
});

describe("registry coordinate stored with each attempt (APP-DATA-002)", () => {
  it("matches the real registry for every Band-A passage", () => {
    for (const r of rows) {
      expect(registryCoordinateFor(r.passage_id)).toEqual({ registryPassageId: r.passage_id, rsId: `RS${String(r.reading_stage_no).padStart(2, "0")}`, p: Number(r.stage_passage_no) });
    }
  });
  it("is null outside the specified registry (fixtures, later positions, junk)", () => {
    expect(registryCoordinateFor("FX-0001")).toBeNull();
    expect(registryCoordinateFor("W1-0151")).toBeNull();
    expect(registryCoordinateFor("nonsense")).toBeNull();
  });
  it("flows onto the stored attempt for approved content only", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { buildDeps, handleV3 } = await import("../../../api/v3");
    const { FixtureContentProvider } = await import("../../../lib/v2/content-provider");
    const fixture = new FixtureContentProvider();
    const dir = mkdtempSync(join(tmpdir(), "sr-km-"));
    try {
      // approved-looking content for sequence 1 (W1-0001 = RS01-P1); assessment passages stay the fixture
      const approvedLike = { ...fixture.bySequence(1)!, passageId: "W1-0001", sequence: 1, source: "APPROVED_PACKAGE" as const };
      const provider = { source: "APPROVED_PACKAGE" as const, assessment: (i: number) => fixture.assessment(i), bySequence: (n: number) => (n === 1 ? approvedLike : fixture.bySequence(n)), byPassageId: (id: string) => (id === "W1-0001" ? approvedLike : fixture.byPassageId(id)) };
      const deps = buildDeps(dir, provider);
      const who = { learnerId: "kid", sessionId: "S", deviceId: "d" };
      const call = async (m: string, path: string, body?: unknown) => (await handleV3(new Request(`http://x/api/v3/${path}`, { method: m, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("/"), who, deps)).json() as Promise<Record<string, any>>;
      await call("POST", "bootstrap");
      await call("POST", "assessment/start");
      for (let i = 1; ; i += 1) { const a = await call("POST", "assessment/answer", { key: `k${i}`, answers: [1, 0, 2, 0] }); if (a.status === "COMPLETE") break; }
      await call("POST", "assessment/finalize");
      await call("POST", "passage/submit", { attemptId: "a1", passageId: "W1-0001", answers: [1, 0, 2, 0], explanation: { text: "Mia has a red kite.", mode: "typed" } });
      const stored = (await deps.repo.load("kid"))!.learner.ledger[0];
      expect(stored.registry).toEqual({ registryPassageId: "W1-0001", rsId: "RS01", p: 1 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
