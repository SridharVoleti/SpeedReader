// Entry for `node tools/pipeline/pipeline.mjs demo-phase-a [--canonical-dir d] [--root d] [--force]`.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CANONICAL_DIR, findArchitectureDir } from "./config";
import { runPhaseADemo } from "./demo";

export async function main(argv: string[]): Promise<number> {
  const flag = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const root = flag("root") ?? join(process.cwd(), "pipeline", "demo");
  if (existsSync(root) && readdirSync(root).length && !argv.includes("--force")) {
    console.error(`${root} already has content; the demo owns this folder and rebuilds it. Re-run with --force to replace it.`);
    return 2;
  }
  const report = await runPhaseADemo({
    canonicalDir: flag("canonical-dir") ?? process.env.SR_CANONICAL_DIR ?? DEFAULT_CANONICAL_DIR, root,
    architectureDir: flag("architecture-dir") ?? findArchitectureDir(), log: (s) => console.log(s)
  });
  console.log(JSON.stringify(report, null, 2));
  console.log(`report written to ${join(root, "demo-report.json")}`);
  return 0;
}
