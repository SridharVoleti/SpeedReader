// Minimal RFC 4180 CSV reader for the canonical package artifacts (BOM, quoted commas/newlines, CRLF).
// Ragged rows and unterminated quotes are errors: a parser must never guess at canonical data.

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let i = 0;
  let quoted = false;
  let fieldStarted = false;
  const endField = () => { record.push(field); field = ""; fieldStarted = false; };
  const endRecord = () => { endField(); if (!(record.length === 1 && record[0] === "")) records.push(record); record = []; };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"' && !fieldStarted) { quoted = true; fieldStarted = true; i++; continue; }
    if (c === ",") { endField(); i++; continue; }
    if (c === "\r") { if (text[i + 1] === "\n") i++; endRecord(); i++; continue; }
    if (c === "\n") { endRecord(); i++; continue; }
    field += c; fieldStarted = true; i++;
  }
  if (quoted) throw new Error("CSV parse error: unterminated quoted field");
  if (fieldStarted || field !== "" || record.length) endRecord();
  if (!records.length) return [];
  const header = records[0];
  return records.slice(1).map((r, n) => {
    if (r.length !== header.length) throw new Error(`CSV parse error: row ${n + 2} has ${r.length} columns, header has ${header.length}`);
    return Object.fromEntries(header.map((h, k) => [h, r[k]]));
  });
}
