// CLI: the manual Cowork workflow end to end through the public commands (no model API, no network).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../../../../lib/sr/pipeline-v2/cli";
import { art, ALL_GAPS } from "./helpers/harness";
import { buildCanonicalFixture } from "./helpers/canonical-fixture";
import { findArchitectureDir } from "../../../../lib/sr/pipeline-v2/config";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";

let base: string;
let common: string[];
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "sr-cli-"));
  buildCanonicalFixture(join(base, "canonical"));
  common = [
    "--root", join(base, "pipeline"), "--canonical-dir", join(base, "canonical"), "--allow-candidate", "--interim-schema",
    "--architecture-dir", findArchitectureDir(join(__dirname, "..", "..", "..", "..", "..")),
    ...ALL_GAPS.flatMap((g) => ["--ack-gap", g])
  ];
});
afterEach(() => rmSync(base, { recursive: true, force: true, maxRetries: 3 }));

async function cli(...args: string[]) {
  let out = "", err = "";
  const code = await runCli([...args, ...common], { out: (s) => (out += s + "\n"), err: (s) => (err += s + "\n") });
  return { code, out, err };
}

describe("pipeline CLI", () => {
  it("full manual Cowork loop: register -> next -> export-job -> import-result (creator) -> READY_FOR_INDEPENDENT_QA -> QA import -> approved", async () => {
    expect((await cli("register", "W1-0001")).out).toContain("registered W1-0001");
    const next = await cli("next");
    expect(next.code).toBe(0);
    expect(next.out).toMatch(/job 1 .*Role 2 CREATOR/);

    const exp = await cli("export-job", "1");
    expect(exp.code).toBe(0);
    const packet = join(base, "pipeline", "jobs", "job-000001.packet.json");
    const prompt = join(base, "pipeline", "jobs", "job-000001.prompt.md");
    expect(existsSync(packet) && existsSync(prompt)).toBe(true);
    expect(exp.out).toContain("job-000001.prompt.md");

    const result = join(base, "creator.json");
    writeFileSync(result, JSON.stringify({ job_id: 1, production_unit_id: "W1-0001", role_id: "2", job_type: "CREATOR", state: "READY_FOR_INDEPENDENT_QA", artifact: art(2, "W1-0001"), checks_run: [], blocking_defects: [], nonblocking_observations: [] }));
    const imp = await cli("import-result", "1", result, "--run-ref", "cowork-task-A");
    expect(imp.code).toBe(0);
    expect(imp.out).toContain("READY_FOR_INDEPENDENT_QA");
    expect(imp.out).toMatch(/QA job 2/);
    expect(existsSync(join(base, "pipeline", "jobs", "job-000002.prompt.md"))).toBe(true);
    expect((await cli("next")).out).not.toMatch(/Role 2 QA/); // the QA job is already exported; nothing else is READY

    const qaPacket = JSON.parse(readFileSync(join(base, "pipeline", "jobs", "job-000002.packet.json"), "utf8"));
    const qaResult = join(base, "qa.json");
    writeFileSync(qaResult, JSON.stringify({ job_id: 2, production_unit_id: "W1-0001", role_id: "2", job_type: "QA", state: "QA_PASS", artifact: null, candidate_hash: qaPacket.candidate_artifact.content_hash, checks_run: [], blocking_defects: [], nonblocking_observations: [] }));
    const same = await cli("import-result", "2", qaResult, "--run-ref", "cowork-task-A");
    expect(same.code).toBe(2);
    expect(same.err).toContain("SELF_APPROVAL");
    const ok = await cli("import-result", "2", qaResult, "--run-ref", "cowork-task-B");
    expect(ok.code).toBe(0);
    expect(ok.out).toContain("APPROVED");
    expect(existsSync(join(base, "pipeline", "approved", "role2", "W1-0001", "v1.json"))).toBe(true);
    expect(qaPacket.candidate_artifact.content_hash).toBe(canonicalHash(art(2, "W1-0001")));
  });

  it("status, passage, defects and jobs report state; resume is safe to repeat", async () => {
    await cli("register", "W1-0001");
    const s = await cli("status");
    expect(s.out).toMatch(/units: 1/);
    expect(s.out).toMatch(/canonical: .*FREEZE_CANDIDATE_UNCERTIFIED/);
    const r1 = await cli("resume");
    const r2 = await cli("resume");
    expect(r1.out).toMatch(/Role 1 APPROVED/);
    expect(r2.out).not.toMatch(/Role 1 APPROVED/);
    const p = await cli("passage", "W1-0001");
    expect(p.out).toMatch(/RS01-P1/);
    expect(p.out).toMatch(/role 1 +APPROVED/);
    expect((await cli("defects")).out).toMatch(/no defects/i);
    expect((await cli("jobs")).out).toMatch(/Role 2 CREATOR/);
  });

  it("validate reports which roles are missing, then runs the Role 8 machine checks", async () => {
    await cli("register", "W1-0001");
    const early = await cli("validate", "W1-0001");
    expect(early.code).toBe(1);
    expect(early.out).toMatch(/not ready.*missing roles/i);
    expect((await cli("validate", "W1-9999")).code).toBe(2);
  });

  it("retry re-issues a lost exported job", async () => {
    await cli("register", "W1-0001");
    await cli("next"); // runs deterministic Role 1 and creates the Role 2 creator job
    await cli("export-job", "1");
    const r = await cli("retry", "1");
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/job 1 cancelled; new job 2/);
  });

  it("count100 prints the canonical tokenization and the exact-100 verdict", async () => {
    const ok = await cli("count100", "--text", Array(100).fill("w").join(" "));
    expect(ok.out).toMatch(/COUNT-100-v2.0/);
    expect(ok.out).toMatch(/count: 100/);
    expect(ok.out).toMatch(/VALID_BAND_A/);
    const bad = await cli("count100", "--text", "one two");
    expect(bad.code).toBe(1);
    expect(bad.out).toMatch(/INVALID_WORD_COUNT/);
  });

  it("a production invocation refuses an uncertified canonical package", async () => {
    let out = "", err = "";
    const code = await runCli(["status", "--root", join(base, "pipeline"), "--canonical-dir", join(base, "canonical")], { out: (s) => (out += s), err: (s) => (err += s) });
    expect(code).toBe(2);
    expect(err).toMatch(/BLOCKED_CANONICAL_INPUT/);
    void out;
  });

  it("unknown commands print usage and fail", async () => {
    const r = await cli("frobnicate");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/usage/i);
  });
});
