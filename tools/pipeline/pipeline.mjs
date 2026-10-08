#!/usr/bin/env node
// Launcher for the SpeedReader Pipeline v2 CLI.  Usage:  node tools/pipeline/pipeline.mjs <command> [options]
// (or `npm run pipeline -- <command>`).  Needs Node >= 22.13 (built-in node:sqlite); makes no network calls.
// The TypeScript sources are bundled on the fly with the repo's own esbuild, so there is no separate build step.

import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const major = Number(process.versions.node.split(".")[0]);
const minor = Number(process.versions.node.split(".")[1]);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`pipeline needs Node >= 22.13 for node:sqlite (found ${process.versions.node}).`);
  process.exit(2);
}
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const entry = process.argv[2] === "demo-phase-a" ? "demo-main.ts" : "cli-main.ts";
const out = join(repo, "node_modules", ".cache", "sr-pipeline-v2", `${entry}.mjs`);
mkdirSync(dirname(out), { recursive: true });
await build({
  entryPoints: [join(repo, "hosted-app", "lib", "sr", "pipeline-v2", entry)], outfile: out, bundle: true, platform: "node", format: "esm",
  target: "node22", external: ["node:*"], logLevel: "error", sourcemap: "inline",
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }
});
const emit = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w).includes("SQLite") ? undefined : emit.call(process, w, ...rest)); // node:sqlite is experimental in 22.x
const argv = process.argv.slice(entry === "demo-main.ts" ? 3 : 2);
const mod = await import(pathToFileURL(out).href);
process.exitCode = await mod.main(argv);
