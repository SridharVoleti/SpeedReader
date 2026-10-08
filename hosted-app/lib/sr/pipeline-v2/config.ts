// Pipeline configuration. Every path is configurable; tests always use temporary directories.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Production default root (repo-level pipeline/ folder). */
export const PRODUCTION_ROOT = "D:\\Sridhar\\Projects\\SpeedReader\\pipeline";
export const DEFAULT_CANONICAL_DIR = "D:\\Sridhar\\Projects\\SpeedReader_CC\\SpeedReader_W1_BandA_v0.56_FINAL_FREEZE_CANDIDATE_FULL_PACKAGE";
export const ARCHITECTURE_DIRNAME = "SpeedReader_Pipeline_v2_Executable_Architecture";

export type PipelineConfig = {
  /** MANUAL_PACKET is the only mode: jobs are exported/imported by hand. No model API exists in this code base. */
  executionMode: "MANUAL_PACKET";
  root: string;
  dbPath: string;
  wipRoot: string;
  approvedRoot: string;
  jobsRoot: string;
  resultsRoot: string;
  canonicalDir: string;
  /** production = true: only an independently certified freeze may be used. */
  requireFrozenCanonical: boolean;
  /** architecture package folder holding contracts/ and orchestrator/*.schema.json */
  architectureDir: string;
  maxCreatorAttempts: number;
  /** canonical gap ids a human has explicitly acknowledged (infrastructure demonstration only) */
  acknowledgedGaps: string[];
  /** optional Role 8 inputs that are not (yet) in the canonical package */
  finalSchemaPath?: string;
  referentialRulesPath?: string;
  /** allow Role 8 to use the built-in non-canonical envelope schema (must also acknowledge the schema gap) */
  allowInterimEnvelopeSchema: boolean;
  expectedRegistryRows: number;
  clock?: () => string;
};

export function findArchitectureDir(start = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    const cand = join(dir, ARCHITECTURE_DIRNAME);
    if (existsSync(cand)) return cand;
    const up = dirname(dir);
    if (up === dir) return join(resolve(start), ARCHITECTURE_DIRNAME);
    dir = up;
  }
}

export function resolveConfig(over: Partial<PipelineConfig> & { root?: string } = {}): PipelineConfig {
  const root = over.root ?? process.env.SR_PIPELINE_ROOT ?? PRODUCTION_ROOT;
  return {
    executionMode: "MANUAL_PACKET",
    root,
    dbPath: over.dbPath ?? join(root, "state", "speedreader.db"),
    wipRoot: over.wipRoot ?? join(root, "wip"),
    approvedRoot: over.approvedRoot ?? join(root, "approved"),
    jobsRoot: over.jobsRoot ?? join(root, "jobs"),
    resultsRoot: over.resultsRoot ?? join(root, "results"),
    canonicalDir: over.canonicalDir ?? process.env.SR_CANONICAL_DIR ?? DEFAULT_CANONICAL_DIR,
    requireFrozenCanonical: over.requireFrozenCanonical ?? true,
    architectureDir: over.architectureDir ?? process.env.SR_ARCHITECTURE_DIR ?? findArchitectureDir(),
    maxCreatorAttempts: over.maxCreatorAttempts ?? 3,
    acknowledgedGaps: over.acknowledgedGaps ?? [],
    finalSchemaPath: over.finalSchemaPath,
    referentialRulesPath: over.referentialRulesPath,
    allowInterimEnvelopeSchema: over.allowInterimEnvelopeSchema ?? false,
    expectedRegistryRows: over.expectedRegistryRows ?? 150,
    clock: over.clock
  };
}
