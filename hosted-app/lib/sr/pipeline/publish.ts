// SR-041 / issue #13 - Final QA over the PERSISTED package and durable promotion.
// Everything is read from disk: the package from the WIP root, its seven upstream artifacts from the APPROVED
// root. Manifest hashes and the version lock are derived from the approval records of those artifacts, never from
// caller-supplied values. After the mandatory checks pass, the package must also load through the real learner
// runtime consumer, then it is promoted to the approved root, then reloaded from there. Any gap fails closed.

import { join } from "node:path";
import { canonicalHash } from "./hash";
import { runFinalQa, type FinalQaResult } from "./terminal-gate";
import type { RoleId } from "./roles";
import type { createStore } from "./storage";
import { loadApprovedPackage, parseRuntimePackage, approvedPackagePath } from "../runtime/package-loader";

type Store = ReturnType<typeof createStore>;
type Obj = Record<string, unknown>;

export type PublishRequest = { packageId: string; actor: string; expectedPackageVersion: number; schemaVersion?: string };
export type PublishFailure = "MISSING_INPUT" | "FINAL_QA_FAILED" | "INGESTION_FAILED" | "PROMOTION_FAILED" | "POST_PROMOTION_LOAD_FAILED";
export type PublishResult =
  | { promoted: true; path: string; qa: FinalQaResult }
  | { promoted: false; reason: PublishFailure; problems: string[]; qa?: FinalQaResult };

export const wipPackagePath = (store: Store, packageId: string) => join(store.roots.wip, "packages", `${packageId}.json`);
export const approvedRolePath = (store: Store, role: number, passageId: string) => join(store.roots.approved, `role${role}`, `${passageId}.json`);

export function publishPackage(store: Store, req: PublishRequest): PublishResult {
  if (!/^PKG-W1-[0-9]{4}$/.test(req.packageId)) return { promoted: false, reason: "MISSING_INPUT", problems: [`invalid package id ${req.packageId}`] };
  const passageId = req.packageId.replace(/^PKG-/, "");

  let packageText: string;
  try { packageText = store.readWip(wipPackagePath(store, req.packageId)); }
  catch (e) { return { promoted: false, reason: "MISSING_INPUT", problems: [`package not persisted in WIP: ${(e as Error).message}`] }; }

  const problems: string[] = [];
  const approvedPayloads: Partial<Record<number, Obj>> = {};
  const roleHashes: Record<string, string> = {};
  const upstream: { role: RoleId; hash: string; qa: "PASS" }[] = [];
  for (const role of [1, 2, 3, 4, 5, 6, 7] as RoleId[]) {
    try {
      const { content, hash } = store.readAuthoritative(approvedRolePath(store, role, passageId));
      approvedPayloads[role] = JSON.parse(content) as Obj;
      roleHashes[String(role)] = hash;
      upstream.push({ role, hash, qa: "PASS" });
    } catch (e) { problems.push(`role ${role} approved artifact unavailable: ${(e as Error).message}`); }
  }
  if (problems.length) return { promoted: false, reason: "MISSING_INPUT", problems };

  let assemblyHash = "";
  try { assemblyHash = canonicalHash(JSON.parse(packageText)); } catch { /* strict parse inside runFinalQa reports it */ }

  const bytes = new TextEncoder().encode(packageText);
  const qa = runFinalQa({
    bytes, approvedPayloads,
    manifest: { assembly: assemblyHash ? { role: 8, hash: assemblyHash } : undefined, upstream },
    lock: { packageVersion: req.expectedPackageVersion, schemaVersion: req.schemaVersion ?? "1.0", roleHashes }
  });
  if (qa.result !== "FINAL_JSON_QA_PASS") return { promoted: false, reason: "FINAL_QA_FAILED", problems: qa.defects.map((d) => `${d.violated_rule}: ${d.evidence}`), qa };

  // the package must also be consumable by the real learner runtime BEFORE it is published
  const ingest = parseRuntimePackage(bytes, "APPROVED");
  if (!ingest.ok) return { promoted: false, reason: "INGESTION_FAILED", problems: ingest.errors, qa };

  let path: string;
  try { path = store.approve({ actor: req.actor, verdict: "PASS", wipPath: wipPackagePath(store, req.packageId), hash: assemblyHash }); }
  catch (e) { return { promoted: false, reason: "PROMOTION_FAILED", problems: [(e as Error).message], qa }; }

  const reload = loadApprovedPackage(store, req.packageId);
  if (!reload.ok) return { promoted: false, reason: "POST_PROMOTION_LOAD_FAILED", problems: reload.errors, qa };
  if (path.toLowerCase() !== approvedPackagePath(store, req.packageId).toLowerCase()) return { promoted: false, reason: "POST_PROMOTION_LOAD_FAILED", problems: ["promoted to an unexpected location"], qa };
  return { promoted: true, path, qa };
}
