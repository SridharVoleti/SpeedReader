// Entry point bundled by tools/pipeline/pipeline.mjs.
import { runCli } from "./cli";

export const main = (argv: string[]) => runCli(argv, { out: (s) => console.log(s), err: (s) => console.error(s) });
