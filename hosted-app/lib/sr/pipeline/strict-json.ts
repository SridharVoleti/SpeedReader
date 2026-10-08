// SR-034 / SR-035 - Strict parsing of the serialized package bytes: valid UTF-8 (no BOM), real JSON
// parser, no trailing garbage, and (SR-035) no duplicate object keys.

export type StrictResult = { ok: true; value: unknown } | { ok: false; error: string };

export function strictParseBytes(bytes: Uint8Array, opts: { rejectDuplicates?: boolean } = {}): StrictResult {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { ok: false, error: "UTF-8 BOM not allowed in serialized package" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, error: "bytes are not valid UTF-8" };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `malformed JSON: ${(e as Error).message}` };
  }
  const dups = opts.rejectDuplicates === false ? [] : findDuplicateKeys(text);
  if (dups.length) return { ok: false, error: `duplicate key "${dups[0].split(/[.\]]/).pop()}" at ${dups.join(", ")}` };
  return { ok: true, value };
}

/**
 * JSON paths of repeated object keys. JSON.parse silently keeps the last value, so this scans the text.
 * Expects syntactically valid JSON (strictParseBytes verifies that first).
 */
export function findDuplicateKeys(text: string): string[] {
  const dups: string[] = [];
  let i = 0;
  const ws = () => { while (i < text.length && /\s/.test(text[i])) i++; };
  const str = (): string => {
    const start = i++;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const value = (path: string): void => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const seen = new Set<string>();
      ws();
      if (text[i] === "}") { i++; return; }
      for (;;) {
        ws();
        const k = str();
        const child = `${path}.${k}`;
        if (seen.has(k)) dups.push(child);
        seen.add(k);
        ws(); i++; // ':'
        value(child);
        ws();
        if (text[i++] === "}") return;
      }
    } else if (c === "[") {
      i++;
      ws();
      if (text[i] === "]") { i++; return; }
      for (let n = 0; ; n++) {
        value(`${path}[${n}]`);
        ws();
        if (text[i++] === "]") return;
      }
    } else if (c === '"') str();
    else while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  value("$");
  return dups;
}
