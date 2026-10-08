// Canonical hashing of artifacts: key order never changes the hash, any content change does.

import { createHash } from "node:crypto";

export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export const canonicalHash = (v: unknown): string => createHash("sha256").update(canonicalJson(v)).digest("hex");
