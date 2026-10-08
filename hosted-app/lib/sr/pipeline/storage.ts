// SR-042 - WIP and approved artifacts are separate. Everything generated lives under the configured WIP
// root; only an authorised QA actor holding a PASS can copy the exact, hash-matching artifact to the
// approved root; downstream readers only ever read approved copies. Paths are Windows paths.

import { win32 } from "node:path";
import { canonicalHash } from "./hash";

export type StorageConfig = { wipRoot: string; approvedRoot: string; qaActors: readonly string[] };
export type ApprovalRequest = { actor: string; verdict: "PASS" | "FAIL"; wipPath: string; hash: string };

const norm = (p: string) => win32.normalize(p).toLowerCase();
const within = (root: string, p: string) => {
  const rel = win32.relative(norm(root), norm(p));
  return rel !== "" && !rel.startsWith("..") && !win32.isAbsolute(rel);
};

/** In-memory backend keeps the policy testable; the same policy fronts any real file system. */
export function createStore(cfg: StorageConfig) {
  const wip = new Map<string, string>();
  const approved = new Map<string, { content: string; hash: string }>();

  return {
    writeWip(path: string, content: string): void {
      if (!within(cfg.wipRoot, path)) throw new Error(`generated artifacts must be written under the WIP root ${cfg.wipRoot}`);
      wip.set(norm(path), content);
    },

    readAuthoritative(path: string): { content: string; hash: string } {
      if (within(cfg.wipRoot, path)) throw new Error("WIP is not authoritative: read the approved copy");
      const a = approved.get(norm(path));
      if (!a) throw new Error(`no approved artifact at ${path}`);
      return a;
    },

    approve(req: ApprovalRequest): string {
      if (!cfg.qaActors.includes(req.actor)) throw new Error(`only QA may promote artifacts (actor ${req.actor})`);
      if (req.verdict !== "PASS") throw new Error("only a QA PASS may be promoted");
      const content = wip.get(norm(req.wipPath));
      if (content === undefined) throw new Error(`no WIP artifact at ${req.wipPath}`);
      if (canonicalHash(JSON.parse(content)) !== req.hash) throw new Error("WIP artifact hash differs from the QA'd hash; re-run QA");
      const target = win32.join(cfg.approvedRoot, win32.relative(norm(cfg.wipRoot), norm(req.wipPath)));
      if (approved.has(norm(target))) throw new Error(`artifact already approved at ${target}`);
      approved.set(norm(target), { content, hash: req.hash });
      return target;
    }
  };
}
