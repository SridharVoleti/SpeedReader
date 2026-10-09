import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearnerService, MemoryAssessmentStore, type Ctx } from "../../../lib/v2/learner-service";
import { FileLearnerRepository } from "../../../lib/v2/learner-repository";
import { SESSION_POLICY_V1, SessionRegistry } from "../../../lib/v2/session-envelope";
import { newReadinessStream, type ReadinessStream } from "../../../lib/v2/readiness-lifecycle";
import { newLearnerAggregate } from "../../../lib/v2/learner-aggregate";

// Issue #17: a due readiness/revalidation state is a parallel activity; it never replaces canonical reading.

const T0 = Date.parse("2026-10-05T09:00:00Z");
const ctx: Ctx = { learnerId: "kid", sessionId: "S1", deviceId: "phone" };
let dir: string;

const DUE: Array<Partial<ReadinessStream>> = [
  { phase: "PRIMARY_DUE" },
  { phase: "CONFIRMATION_DUE" },
  { phase: "NEW_CYCLE_PRIMARY_DUE" },
  { phase: "NEW_CYCLE_CONFIRMATION_DUE" },
  { phase: "REVALIDATION_DUE" },
  { phase: "CONFIRMED", pendingReplacement: "PRIMARY" }
];

async function build(streams: ReadinessStream[]) {
  const repo = new FileLearnerRepository(dir);
  await repo.create(newLearnerAggregate("kid", 60));
  const svc = new LearnerService({
    repo, assessments: new MemoryAssessmentStore(), sessions: new SessionRegistry(SESSION_POLICY_V1), bpcCatalog: [], provenance: () => ({ packageId: "TEST-PKG", packageVersion: 1, contentHash: "test-hash" }),
    readiness: () => streams, now: () => new Date(T0).toISOString()
  });
  return svc;
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-rdy-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("readiness is not a core-progression gate (#17)", () => {
  for (const patch of DUE) {
    const label = patch.pendingReplacement ? "TECHNICAL_REPLACEMENT" : patch.phase;
    it(`${label} due: a learning session still gets NEW_PROGRESSION, with readiness surfaced alongside`, async () => {
      const svc = await build([{ ...newReadinessStream("kid", "RS03"), ...patch }]);
      const b = await svc.bootstrap(ctx);
      if (!b.ok) throw new Error(JSON.stringify(b));
      expect(b.next).toMatchObject({ activity: "NEW_PROGRESSION", sequence: 1, wpm: 60 });
      expect((b.next as { readinessDue?: { streamId: string } }).readinessDue?.streamId).toBe("RS03");
    });
  }

  it("with nothing due the activity carries no readiness marker", async () => {
    const svc = await build([]);
    const b = await svc.bootstrap(ctx);
    if (!b.ok) throw new Error(JSON.stringify(b));
    expect(b.next).toMatchObject({ activity: "NEW_PROGRESSION" });
    expect((b.next as { readinessDue?: unknown }).readinessDue).toBeUndefined();
  });
});
