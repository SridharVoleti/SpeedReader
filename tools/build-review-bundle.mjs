// Builds the content-review bundle shown at /review: delivery sessions 1..49 from the owner-approved
// "Approved_v2" folder, slimmed to what a reviewer reads (text, questions, answers, hints, explanations).
// The bundle is a read-only projection: nothing is authored or changed, and every entry records the source file
// name and its SHA-256 so the review copy can be traced back to the exact bytes it came from.
//
//   node tools/build-review-bundle.mjs [sourceDir]
//
// Missing sessions (e.g. 44) are reported, never invented.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? join(root, "app", "content", "world 1", "Approved_v2"));
const out = join(root, "hosted-app", "data", "review", "world1-approved-v2.json");
const FIRST = 1;
const LAST = 49;

const files = readdirSync(source).filter((f) => /^W1-P\d{4}(_old)?\.json$/.test(f));
const bySession = new Map();
for (const f of files) bySession.set(Number(/^W1-P(\d{4})/.exec(f)[1]), f);

const passages = [];
const missing = [];
for (let n = FIRST; n <= LAST; n += 1) {
  const file = bySession.get(n);
  if (!file) { missing.push(n); continue; }
  const bytes = readFileSync(join(source, file));
  const doc = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(doc.passages) || doc.passages.length !== 1) throw new Error(`${file}: expected exactly one passage`);
  const p = doc.passages[0];
  if (p.delivery_session !== n) throw new Error(`${file}: delivery_session ${p.delivery_session} does not match file name`);
  passages.push({
    session: n,
    id: p.id,
    sourceFile: file,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    status: p.status,
    superseded: /_old\.json$/.test(file),
    title: p.title,
    strand: p.strand,
    rs: p.rs,
    pLevel: p.p_level,
    wordCount: p.length?.actual_words ?? null,
    text: p.text,
    primaryDimension: p.comprehension?.primary_dimension ?? null,
    requiredCorrect: p.assessment_profile?.required_correct_first_attempt ?? null,
    items: (p.comprehension?.items ?? []).map((i) => ({
      id: i.id,
      dimension: i.dimension,
      type: i.response_type,
      question: i.question,
      options: i.options ?? null,
      answer: i.correct_answer,
      primary: i.is_primary === true,
      hint: i.hint?.text ?? null,
      explanation: i.explanation?.text ?? null
    }))
  });
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify({ source: "world 1/Approved_v2", sessions: `${FIRST}-${LAST}`, missingSessions: missing, passages }, null, 2)}\n`);
console.log(`wrote ${passages.length} passages to ${out}`);
if (missing.length) console.log(`missing sessions (not invented): ${missing.join(", ")}`);
if (!existsSync(out)) process.exit(1);
