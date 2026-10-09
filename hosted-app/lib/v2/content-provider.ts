import { join } from "node:path";
// Content port for the v3 learner journey. The app CONSUMES approved content and never authors it (CLAUDE-005).
//
//  * ApprovedPackageProvider - production. Reads only hash-verified approved SR packages; anything missing,
//    unapproved or invalid yields null and the journey fails closed with a friendly "stories are being prepared".
//  * FixtureContentProvider - a clearly labelled synthetic story used ONLY where diagnostics are enabled
//    (tests/previews). It is never constructed in production.
//
// Answer keys and authored ideas stay server-side: learnerView() is the only shape sent to the browser.

import { loadApprovedPackage, type LearnerPackage } from "../sr/runtime/package-loader";
import type { createStore } from "../sr/pipeline/storage";
import type { AuthoredIdea } from "./spoken-expression";
import type { BpcContent } from "./best-comprehension";
import { stem } from "./stem";
import { deliveryCoordinateFor, sequenceForPassageId } from "./delivery-order";
import { count100 } from "../sr/pipeline-v2/count100";
import type { RsvpToken } from "./rsvp";

/** A content defect (never a learner failure): the journey fails closed with the friendly "being prepared" message. */
export class ContentError extends Error {}

export type V3Item = { itemId: string; stem: string; options: string[]; answerIndex: number };

export type V3Passage = {
  /** Canonical sequence this passage occupies, or null for assessment-only material. */
  sequence: number | null;
  passageId: string;
  packageId: string;
  text: string;
  items: V3Item[];
  ideas: AuthoredIdea[];
  bpc: BpcContent;
  source: "APPROVED_PACKAGE" | "FIXTURE";
  /** Exact identity of the package consumed (id, version, immutable hash): recorded with every attempt (#23). */
  provenance: {
    packageId: string; packageVersion: number; contentHash: string;
    /** Assessment passages only: the approved manifest (id, version, hash) that selected this package. */
    manifest?: { manifestId: string; manifestVersion: number; hash: string };
  };
};

export interface ContentProvider {
  bySequence(sequence: number): V3Passage | null;
  byPassageId(passageId: string): V3Passage | null;
  /** The n-th (0-based) initial-assessment passage, or null when none is available. */
  assessment(index: number): V3Passage | null;
  readonly source: V3Passage["source"];
}

export type LearnerPassageView = {
  passageId: string;
  tokens: RsvpToken[];
  items: { itemId: string; stem: string; options: string[] }[];
};

/** The only passage shape that reaches the browser: no answer keys, no authored ideas, no BPC. */
export function learnerView(p: V3Passage): LearnerPassageView {
  // APP-READ-001 / APP-KM-002: the reader consumes the canonical COUNT-100 token stream, never its own split.
  const canonical = count100(p.text);
  if (canonical.status !== "VALID_TOKENIZATION") throw new ContentError(`passage ${p.passageId} fails the canonical tokenizer: ${canonical.errors.join("; ")}`);
  return { passageId: p.passageId, tokens: canonical.tokens.map((t) => ({ index: t.index, text: t.text })), items: p.items.map((i) => ({ itemId: i.itemId, stem: i.stem, options: [...i.options] })) };
}

/** Deterministic item scoring on the server: 1 for the keyed option, else 0. A missing/invalid choice is 0, never an error. */
export function scoreItems(passage: V3Passage, answers: readonly (number | null)[]): { itemId: string; score: number }[] {
  return passage.items.map((item, i) => ({ itemId: item.itemId, score: answers[i] === item.answerIndex ? 1 : 0 }));
}

const STOP = new Set(["the", "and", "that", "with", "from", "this", "then", "were", "have", "been", "into", "about", "their", "there", "when", "what", "which", "for", "his", "her", "was", "are", "but", "not", "had", "she", "him", "they"]);

/**
 * No approved paraphrase alternates exist, so authored ideas are derived from each meaning unit: its most
 * distinctive key stems form the accepted wordings (all of the top three, or any pair of the top four).
 * Documented derivation, not an invented rule; replace with authored wordings when the package supplies them.
 */
export function ideasFromMeaningUnits(units: readonly { muId: string; text: string }[]): AuthoredIdea[] {
  return units.map((u) => {
    const stems = [...new Set(u.text.split(/\s+/).map(stem).filter((w) => w.length >= 4 && !STOP.has(w)))].sort((a, b) => b.length - a.length || a.localeCompare(b));
    const top = stems.slice(0, 4);
    const wordings: string[][] = top.length >= 3 ? [top.slice(0, 3)] : top.length ? [top] : [[stem(u.text.split(/\s+/)[0] ?? "")]];
    for (let i = 0; i < top.length; i += 1) for (let j = i + 1; j < top.length; j += 1) wordings.push([top[i], top[j]]);
    return { ideaId: u.muId, role: "KEY_EVENT" as const, wordings };
  });
}

type Store = ReturnType<typeof createStore>;

/** Approved artifact `<approved>/assessment/ASSESSMENT-MANIFEST.json`: the ordered approved packages used as assessment passages. */
export const ASSESSMENT_MANIFEST_FILE = "ASSESSMENT-MANIFEST.json";
export type AssessmentManifest = { schemaVersion: "1.0"; manifestId: string; manifestVersion: number; packageIds: string[] };

export function parseAssessmentManifest(text: string): { ok: true; manifest: AssessmentManifest } | { ok: false; error: string } {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return { ok: false, error: "manifest is not valid JSON" }; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false, error: "manifest must be an object" };
  const m = v as Record<string, unknown>;
  if (m.schemaVersion !== "1.0") return { ok: false, error: "unsupported manifest schemaVersion" };
  if (typeof m.manifestId !== "string" || m.manifestId.trim() === "") return { ok: false, error: "manifestId is required" };
  if (!Number.isInteger(m.manifestVersion) || (m.manifestVersion as number) < 1) return { ok: false, error: "manifestVersion must be a positive integer" };
  const ids = m.packageIds;
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "packageIds must be a non-empty list" };
  if (!ids.every((i) => typeof i === "string" && /^PKG-W1-[0-9]{4}$/.test(i))) return { ok: false, error: "every package id must look like PKG-W1-NNNN" };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "package ids must be unique" };
  return { ok: true, manifest: { schemaVersion: "1.0", manifestId: m.manifestId, manifestVersion: m.manifestVersion as number, packageIds: [...ids] as string[] } };
}

const pad4 = (n: number) => String(n).padStart(4, "0");

function fromPackage(pkg: LearnerPackage, contentHash: string, manifest?: { manifestId: string; manifestVersion: number; hash: string }): V3Passage {
  return {
    // delivery order (delivery_session), NOT registry order: the same passage id sits at a different sequence
    sequence: sequenceForPassageId(pkg.passageId),
    passageId: pkg.passageId,
    packageId: pkg.packageId,
    text: pkg.text,
    items: pkg.items.map((i) => ({ itemId: i.itemId, stem: i.stem, options: [...i.options], answerIndex: i.answerIndex })),
    ideas: ideasFromMeaningUnits(pkg.meaningUnits),
    bpc: { passageId: pkg.passageId, text: pkg.bpcText, qaApproved: true, version: `pkg-${pkg.packageVersion}` },
    source: "APPROVED_PACKAGE",
    provenance: { packageId: pkg.packageId, packageVersion: pkg.packageVersion, contentHash, ...(manifest ? { manifest } : {}) }
  };
}

export class ApprovedPackageProvider implements ContentProvider {
  readonly source = "APPROVED_PACKAGE" as const;
  constructor(private readonly store: Store) {}

  bySequence(sequence: number): V3Passage | null {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 1500) return null;
    // APP-KM-001: serve by delivery_session, e.g. sequence 2 is RS02-P1 = W1-0011, not W1-0002
    return this.byRegistryId(deliveryCoordinateFor(sequence).passageId);
  }

  byPassageId(passageId: string): V3Passage | null {
    return /^W1-\d{4}$/.test(passageId) ? this.byRegistryId(passageId) : null;
  }

  private byRegistryId(passageId: string, manifest?: { manifestId: string; manifestVersion: number; hash: string }): V3Passage | null {
    const r = loadApprovedPackage(this.store, `PKG-${passageId}`);
    return r.ok && r.hash ? fromPackage(r.pkg, r.hash, manifest) : null;
  }

  /**
   * The n-th initial-assessment passage (#25). The content authority approves an ordered ASSESSMENT-MANIFEST of approved
   * package ids; the app serves those packages and authors nothing. No approved manifest, an index past its end, or any
   * unapproved/tampered artifact yields null, so the journey fails closed with the child-safe message (never a fixture).
   */
  assessment(index: number): V3Passage | null {
    if (!Number.isInteger(index) || index < 0) return null;
    let read: { content: string; hash: string };
    try { read = this.store.readAuthoritative(join(this.store.roots.approved, "assessment", ASSESSMENT_MANIFEST_FILE)); } catch { return null; }
    const m = parseAssessmentManifest(read.content);
    if (!m.ok) return null;
    const id = m.manifest.packageIds[index];
    if (!id) return null;
    return this.byRegistryId(id.replace(/^PKG-/, ""), { manifestId: m.manifest.manifestId, manifestVersion: m.manifest.manifestVersion, hash: read.hash });
  }
}

// ---------------------------------------------------------------------------------------------------- fixtures

export const FIXTURE_STORY =
  "Mia has a red kite. She takes it to the big hill every Saturday. One windy morning the string slips from her hand and the kite flies away over the trees. Mia is sad, so she runs after it. A boy named Ravi sees the kite stuck in a bush and carries it back. Mia says thank you and they fly it together. When the wind gets calm, they sit on the grass and share a banana. Mia learns that a kind friend can turn a sad day into a happy one, and she waves goodbye to Ravi.";

const FIXTURE_ITEMS: V3Item[] = [
  { itemId: "i1", stem: "What colour is Mia's kite?", options: ["Blue", "Red", "Green"], answerIndex: 1 },
  { itemId: "i2", stem: "Where does Mia take her kite?", options: ["To the big hill", "To the beach", "To school"], answerIndex: 0 },
  { itemId: "i3", stem: "Who brings the kite back?", options: ["A girl", "Her mother", "A boy named Ravi"], answerIndex: 2 },
  { itemId: "i4", stem: "Why does Mia run?", options: ["To catch the kite", "To buy a banana", "To find Ravi"], answerIndex: 0 }
];

const FIXTURE_UNITS = [
  { muId: "mu1", text: "Mia has a red kite that she takes to the big hill" },
  { muId: "mu2", text: "The string slips and the kite flies away over the trees" },
  { muId: "mu3", text: "Ravi finds the kite stuck in a bush and carries it back" },
  { muId: "mu4", text: "A kind friend turns a sad day into a happy one" }
];

export class FixtureContentProvider implements ContentProvider {
  readonly source = "FIXTURE" as const;
  private make(passageId: string, sequence: number | null): V3Passage {
    return {
      sequence,
      passageId,
      packageId: `FIXTURE-${passageId}`,
      text: FIXTURE_STORY,
      items: FIXTURE_ITEMS.map((i) => ({ ...i, options: [...i.options] })),
      ideas: ideasFromMeaningUnits(FIXTURE_UNITS),
      bpc: { passageId, text: "Mia loved flying her red kite on the big hill. When the wind pulled it away she was sad, but Ravi found it and brought it back, so a sad day became a happy one because of a kind friend.", qaApproved: true, version: "fixture-1" },
      source: "FIXTURE",
      provenance: { packageId: `FIXTURE-${passageId}`, packageVersion: 1, contentHash: "fixture" }
    };
  }
  bySequence(sequence: number): V3Passage | null {
    return Number.isInteger(sequence) && sequence >= 1 && sequence <= 1500 ? this.make(`FX-${pad4(sequence)}`, sequence) : null;
  }
  byPassageId(passageId: string): V3Passage | null {
    const m = /^FX-(\d{4})$/.exec(passageId);
    return m ? this.bySequence(Number.parseInt(m[1], 10)) : null;
  }
  assessment(index: number): V3Passage | null {
    return Number.isInteger(index) && index >= 0 && index < 40 ? this.make(`FX-AS-${pad4(index + 1)}`, null) : null;
  }
}
