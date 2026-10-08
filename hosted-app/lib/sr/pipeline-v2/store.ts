// Versioned artifact files on top of the existing durable WIP/approved store (SR-042, issue #11):
//   * creators/code write ONLY under the WIP root;
//   * the ONLY promotion path is promote(), called by the engine after an independent QA PASS (or a deterministic
//     machine certificate) for the exact content hash;
//   * downstream readers use readApproved(), which re-verifies the approval record - WIP is never authoritative.

import { join } from "node:path";
import { createStore } from "../pipeline/storage";
import { canonicalHash } from "../pipeline/hash";
import type { PipelineConfig } from "./config";

/** The single actor the underlying store accepts for promotion: only the engine's QA gate holds it. */
export const QA_GATE_ACTOR = "pipeline-v2-qa-gate";

export type ArtifactStore = ReturnType<typeof openArtifactStore>;

export const artifactHash = (artifact: unknown): string => canonicalHash(artifact);

export function openArtifactStore(cfg: Pick<PipelineConfig, "wipRoot" | "approvedRoot">) {
  const store = createStore({ wipRoot: cfg.wipRoot, approvedRoot: cfg.approvedRoot, qaActors: [QA_GATE_ACTOR] });
  const rel = (role: number, passageId: string, version: number) => join(`role${role}`, passageId, `v${version}.json`);
  const wipPath = (role: number, passageId: string, version: number) => join(store.roots.wip, rel(role, passageId, version));
  const approvedPath = (role: number, passageId: string, version: number) => join(store.roots.approved, rel(role, passageId, version));
  return {
    roots: store.roots,
    wipPath,
    approvedPath,
    writeWip(role: number, passageId: string, version: number, artifact: unknown): { path: string; hash: string } {
      const path = wipPath(role, passageId, version);
      store.writeWip(path, JSON.stringify(artifact, null, 2));
      return { path, hash: artifactHash(artifact) };
    },
    readWip(role: number, passageId: string, version: number): { artifact: unknown; hash: string } {
      const artifact = JSON.parse(store.readWip(wipPath(role, passageId, version)));
      return { artifact, hash: artifactHash(artifact) };
    },
    /** Promote the exact WIP bytes whose hash QA reviewed. Throws if the WIP file no longer matches. */
    promote(role: number, passageId: string, version: number, hash: string): string {
      return store.approve({ actor: QA_GATE_ACTOR, verdict: "PASS", wipPath: wipPath(role, passageId, version), hash });
    },
    readApproved(role: number, passageId: string, version: number): { artifact: unknown; hash: string } {
      const { content, hash } = store.readAuthoritative(approvedPath(role, passageId, version));
      return { artifact: JSON.parse(content), hash };
    },
    /** raw approved bytes (as text) plus the verified hash, for the post-promotion smoke test */
    readApprovedText(role: number, passageId: string, version: number): { text: string; hash: string } {
      const { content, hash } = store.readAuthoritative(approvedPath(role, passageId, version));
      return { text: content, hash };
    },
    recover: () => store.recover()
  };
}
