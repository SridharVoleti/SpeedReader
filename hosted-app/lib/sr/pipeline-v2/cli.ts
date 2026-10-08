// pipeline CLI - the manual Cowork workflow. No model API, no network: it exports job packets and imports the
// structured results people bring back from fresh Cowork contexts.
//
//   pipeline register <passage-id...> | --phase-a     pipeline status        pipeline next        pipeline resume
//   pipeline export-job <job-id>                      pipeline import-result <job-id> <result.json> --run-ref <id>
//   pipeline defects [--passage id]                   pipeline passage <id>  pipeline jobs        pipeline retry <job-id>
//   pipeline validate <passage-id>                    pipeline resolve <passage-id> <role> --note "<decision>"
//   pipeline count100 --text "<body>" | --file f      pipeline canonical-check

import { readFileSync } from "node:fs";
import { resolveConfig, type PipelineConfig } from "./config";
import { PipelineEngine, ImportRejected, StaleJobError, type JobRow } from "./engine";
import { CanonicalError } from "./canonical";
import { validateBandA, COUNT100_VERSION } from "./count100";
import { gapsForRole } from "./gaps";
import { roleLabel } from "./packets";

export type Io = { out: (s: string) => void; err: (s: string) => void };

/** Representative Band A rows for the Phase-A infrastructure demonstration (see pilot/PILOT_PLAN.md). */
export const PHASE_A = ["W1-0001", "W1-0043", "W1-0075", "W1-0100", "W1-0150"];

type Args = { pos: string[]; flags: Record<string, string[]>; bool: Set<string> };
const BOOL = new Set(["allow-candidate", "interim-schema", "json", "phase-a", "help"]);

function parse(argv: string[]): Args {
  const a: Args = { pos: [], flags: {}, bool: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith("--")) {
      const k = t.slice(2);
      if (BOOL.has(k)) a.bool.add(k);
      else (a.flags[k] ??= []).push(argv[++i] ?? "");
    } else a.pos.push(t);
  }
  return a;
}

const USAGE = `usage: pipeline <command> [options]
  register <passage-id...> | --phase-a    register production units (and queue Role 1)
  status                                   queue, canonical package, escalations, gaps
  next                                     run deterministic roles, then show the next READY Cowork job
  resume                                   recover files, run Roles 1/7/8 where eligible, show next job
  jobs                                     list jobs
  export-job <job-id>                      write the job packet + self-contained prompt
  import-result <job-id> <file> --run-ref <cowork-task-id>
  retry <job-id>                           re-issue a lost exported job (no attempt spent)
  defects [--passage <id>]                 list routed defects
  passage <id>                             full state of one passage
  validate <passage-id>                    Role 8 machine validation (dry run)
  resolve <passage-id> <role> --note "<decision>"   record a human decision on an escalated item
  canonical-check                          canonical package identity, freeze status, gaps
  count100 --text "<body>" | --file <f>    canonical COUNT-100 tokenization
options: --root <dir> --canonical-dir <dir> --architecture-dir <dir> --allow-candidate --interim-schema
         --ack-gap <id> (repeatable) --final-schema <file> --ref-rules <file> --config <json> --json`;

export function configFromArgs(a: Args): PipelineConfig {
  const file = a.flags.config?.[0] ? (JSON.parse(readFileSync(a.flags.config[0], "utf8")) as Partial<PipelineConfig>) : {};
  const over: Partial<PipelineConfig> & { root?: string } = { ...file };
  if (a.flags.root) over.root = a.flags.root[0];
  if (a.flags["canonical-dir"]) over.canonicalDir = a.flags["canonical-dir"][0];
  if (a.flags["architecture-dir"]) over.architectureDir = a.flags["architecture-dir"][0];
  if (a.bool.has("allow-candidate")) over.requireFrozenCanonical = false;
  if (a.bool.has("interim-schema")) over.allowInterimEnvelopeSchema = true;
  if (a.flags["ack-gap"]) over.acknowledgedGaps = [...(file.acknowledgedGaps ?? []), ...a.flags["ack-gap"]];
  if (a.flags["final-schema"]) over.finalSchemaPath = a.flags["final-schema"][0];
  if (a.flags["ref-rules"]) over.referentialRulesPath = a.flags["ref-rules"][0];
  return resolveConfig(over);
}

const jobLine = (j: JobRow, coord?: string) => `job ${j.job_id}  ${j.passage_id}${coord ? ` (${coord})` : ""}  Role ${roleLabel(j.role_id)} ${j.job_type}  attempt ${j.attempt_no}${j.is_correction ? "  correction" : ""}${j.upstream_caused ? "  upstream-caused rerun" : ""}  ${j.state}`;

export async function runCli(argv: string[], io: Io): Promise<number> {
  const a = parse(argv);
  const cmd = a.pos[0];
  if (!cmd || a.bool.has("help")) { io.err(USAGE); return cmd ? 0 : 2; }

  if (cmd === "count100") {
    const text = a.flags.text ? a.flags.text[0] : a.flags.file ? readFileSync(a.flags.file[0], "utf8") : null;
    if (text === null) { io.err("count100 needs --text or --file"); return 2; }
    const r = validateBandA(text);
    io.out(`${COUNT100_VERSION}\nstatus: ${r.status}\ncount: ${r.count ?? "n/a"}\nBand A exact-100: ${r.ok ? "YES" : "NO"}${r.errors.length ? `\nerrors: ${r.errors.join("; ")}` : ""}`);
    if (a.bool.has("json")) io.out(JSON.stringify(r.tokenization.tokens.map((t) => [t.index, t.text])));
    return r.ok ? 0 : 1;
  }
  if (!["register", "status", "next", "resume", "jobs", "export-job", "import-result", "retry", "defects", "passage", "validate", "resolve", "canonical-check"].includes(cmd)) {
    io.err(`unknown command "${cmd}"\n${USAGE}`);
    return 2;
  }

  let eng: PipelineEngine;
  try { eng = PipelineEngine.open(configFromArgs(a)); }
  catch (e) { io.err(e instanceof CanonicalError ? `${e.message}` : `cannot start: ${(e as Error).message}`); return 2; }

  try {
    const coordOf = (id: string) => eng.unit(id)?.registry_coordinate;
    switch (cmd) {
      case "register": {
        const ids = a.bool.has("phase-a") ? PHASE_A : a.pos.slice(1);
        if (!ids.length) { io.err("register needs passage ids or --phase-a"); return 2; }
        const r = eng.registerUnits(ids);
        for (const id of r.registered) io.out(`registered ${id} (${coordOf(id)})`);
        for (const id of r.alreadyRegistered) io.out(`already registered ${id}`);
        return 0;
      }
      case "status": {
        const s = eng.status();
        if (a.bool.has("json")) { io.out(JSON.stringify(s, null, 2)); return 0; }
        io.out(`canonical: ${s.canonical.id} ${s.canonical.version} sha256:${s.canonical.hash}  ${s.canonical.freeze.status}`);
        io.out(`units: ${s.units}`);
        for (const r of s.byRole) io.out(`  role ${r.role_id}  ${r.state.padEnd(24)} ${r.c}`);
        io.out(`jobs: ${s.jobs.map((j) => `${j.job_type}/${j.state}=${j.c}`).join("  ") || "none"}`);
        io.out(`open defects: ${s.openDefects}`);
        for (const e of s.escalated) io.out(`ESCALATED ${e.passage_id} role ${e.role_id}: ${e.escalation_reason}`);
        for (const g of s.gaps) io.out(`canonical gap [role ${g.role}] ${g.id}${g.acknowledged ? " (acknowledged for infrastructure demo)" : " (BLOCKING)"}: ${g.missing}`);
        return 0;
      }
      case "resume":
      case "next": {
        const r = eng.resume();
        if (cmd === "resume") {
          if (r.recovery.removedTemps || r.recovery.completed.length || r.recovery.removedOrphans.length) io.out(`recovered: ${JSON.stringify(r.recovery)}`);
          for (const d of r.deterministic) io.out(`${d.passage} Role ${d.role} ${d.result}`);
        }
        if (!r.next) { io.out("NO_READY_JOBS"); return 0; }
        io.out(jobLine(r.next, coordOf(r.next.passage_id)));
        io.out(r.next.job_type === "QA" ? "run this in a NEW Cowork context (independent QA)" : "run this in a FRESH Cowork context");
        io.out(`next: pipeline export-job ${r.next.job_id}`);
        return 0;
      }
      case "jobs": {
        const js = eng.listJobs();
        if (!js.length) io.out("no jobs");
        for (const j of js) io.out(jobLine(j, coordOf(j.passage_id)));
        return 0;
      }
      case "export-job": {
        const id = Number(a.pos[1]);
        if (!Number.isInteger(id)) { io.err("export-job needs a numeric job id"); return 2; }
        const r = eng.exportJob(id);
        io.out(`exported job ${id}\n  packet: ${r.packetPath}\n  prompt: ${r.promptPath}\nOpen a ${r.packet.job_type === "QA" ? "NEW (independent)" : "FRESH"} Cowork context, give it the prompt file, save its single JSON reply, then:\n  pipeline import-result ${id} <result.json> --run-ref <cowork-task-id>`);
        return 0;
      }
      case "import-result": {
        const id = Number(a.pos[1]);
        const file = a.pos[2];
        if (!Number.isInteger(id) || !file) { io.err("import-result needs <job-id> <result-file> --run-ref <id>"); return 2; }
        let raw: unknown;
        try { raw = JSON.parse(readFileSync(file, "utf8")); } catch (e) { io.err(`cannot read ${file}: ${(e as Error).message}`); return 2; }
        const o = eng.importResult(id, raw, { runRef: a.flags["run-ref"]?.[0] });
        io.out(o.status);
        io.out(`  ${o.passageId} Role ${roleLabel(o.roleId)}: ${o.message}`);
        if (o.contentHash) io.out(`  artifact ${o.artifactId} sha256:${o.contentHash}`);
        if (o.status === "READY_FOR_INDEPENDENT_QA") {
          io.out(`  QA job ${o.qaJobId} packet: ${o.packetPath}\n  QA job ${o.qaJobId} prompt: ${o.promptPath}`);
          io.out(`STOP. Do not QA in the creator's context: open a NEW Cowork context and run QA job ${o.qaJobId}.`);
        } else for (const n of o.nextActions) io.out(`  next: ${n}`);
        return 0;
      }
      case "retry": {
        const id = Number(a.pos[1]);
        const fresh = eng.retryJob(id);
        io.out(`job ${id} cancelled; new job ${fresh.job_id} (${fresh.job_type}, attempt ${fresh.attempt_no}) is READY - run: pipeline export-job ${fresh.job_id}`);
        return 0;
      }
      case "defects": {
        const ds = eng.defects({ passage: a.flags.passage?.[0] });
        if (!ds.length) { io.out("no defects"); return 0; }
        for (const d of ds) io.out(`${d.defect_id}  ${d.passage_id}  owner=${d.owner_role}  detected_by=${roleLabel(d.detected_by_role)}  ${d.status}  ${d.violated_rule_id}: ${d.actual}`);
        return 0;
      }
      case "passage": {
        const rep = eng.passageReport(a.pos[1]);
        if (a.bool.has("json")) { io.out(JSON.stringify(rep, null, 2)); return 0; }
        io.out(`${rep.unit.passage_id}  ${rep.unit.registry_coordinate}  session ${rep.unit.delivery_session}  canonical ${rep.unit.canonical_package_hash.slice(0, 12)}`);
        for (const i of rep.items) io.out(`  role ${i.role_id}  ${i.state.padEnd(24)} failed=${i.failed_attempts}${i.blocked_on_role ? ` blocked_on=${i.blocked_on_role}` : ""}${i.escalation_reason ? `  ${i.escalation_reason}` : ""}`);
        for (const art of rep.artifacts) io.out(`  artifact ${art.artifact_id}  ${art.status}  sha256:${art.content_hash.slice(0, 12)}${art.invalidated_reason ? `  (${art.invalidated_reason})` : ""}`);
        for (const j of rep.jobs) io.out(`  ${jobLine(j)}`);
        for (const d of rep.defects) io.out(`  defect ${d.defect_id} owner=${d.owner_role} ${d.status}: ${d.actual}`);
        return 0;
      }
      case "validate": {
        const v = eng.validatePassage(a.pos[1]);
        if (!v.ready) { io.out(`not ready: missing roles ${v.missing.join(", ")}${v.schemaAuthority ? ` (${v.schemaAuthority})` : ""}`); return 1; }
        for (const e of v.validation!.evidence) io.out(`${e.result.padEnd(12)} ${e.check}  [${e.validatorVersion}]${e.failures.length ? "  " + e.failures.join("; ") : ""}`);
        for (const c of v.validation!.caveats) io.out(`caveat: ${c}`);
        io.out(v.validation!.ok ? "VALID (pre-promotion checks)" : "INVALID");
        return v.validation!.ok ? 0 : 1;
      }
      case "resolve": {
        eng.resolveEscalation(a.pos[1], Number(a.pos[2]), a.flags.note?.[0] ?? "");
        io.out(`resolved: ${a.pos[1]} role ${a.pos[2]} re-queued`);
        return 0;
      }
      case "canonical-check": {
        const c = eng.canonical;
        io.out(`${c.id} ${c.version}\nlock sha256: ${c.hash}\nfreeze: ${c.freeze.status} (${c.freeze.evidence})\nartifacts verified: ${c.artifacts.filter((x) => x.present).length}/${c.artifacts.length}\nregistry rows: ${eng.registry.rows.length}`);
        for (const r of [2, 3, 4, 5, 6, 8]) for (const g of gapsForRole(c, eng.cfg, r)) io.out(`role ${r} ${g.id}: ${g.satisfied ? "satisfied" : `MISSING${g.acknowledged ? " (acknowledged)" : ""} - ${g.missing}`}`);
        return 0;
      }
    }
    return 0;
  } catch (e) {
    if (e instanceof ImportRejected) { io.err(`REJECTED ${e.code}: ${e.message.replace(/^[A-Z_]+: /, "")}`); return 2; }
    if (e instanceof StaleJobError || e instanceof CanonicalError) { io.err(e.message); return 2; }
    io.err(`error: ${(e as Error).message}`);
    return 2;
  } finally {
    eng.close();
  }
}
