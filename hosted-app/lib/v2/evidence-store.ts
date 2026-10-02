// FR-036 - Shared content, separate state [FROZEN]
// News Reader may use the same canonical passage as core reading, but the two tracks' evidence is
// stored separately, each with its own metrics/state, and News Reader results can never be substituted
// for comprehension evidence. (FR-048 builds the wider leakage guards on top of this store.)

import type { InternalAttemptRecord } from "./passage-completion";
import type { NewsReaderAttempt } from "./news-reader";

export type EvidenceStore = {
  /** Core reading comprehension evidence, keyed by passage. */
  core: ReadonlyMap<string, readonly InternalAttemptRecord[]>;
  /** News Reader oral evidence, keyed by passage. Separate namespace and separate metrics. */
  newsReader: ReadonlyMap<string, readonly NewsReaderAttempt[]>;
};

export function emptyEvidenceStore(): EvidenceStore {
  return { core: new Map(), newsReader: new Map() };
}

function add<T>(map: ReadonlyMap<string, readonly T[]>, key: string, value: T): ReadonlyMap<string, readonly T[]> {
  const next = new Map(map);
  next.set(key, [...(map.get(key) ?? []), value]);
  return next;
}

export function recordCoreEvidence(store: EvidenceStore, passageId: string, record: InternalAttemptRecord): EvidenceStore {
  return { ...store, core: add(store.core, passageId, record) };
}

export function recordNewsReaderEvidence(store: EvidenceStore, attempt: NewsReaderAttempt): EvidenceStore {
  return { ...store, newsReader: add(store.newsReader, attempt.passageId, attempt) };
}

/** The ONLY source of comprehension evidence for a passage: core attempts, never News Reader. */
export function comprehensionEvidenceForPassage(store: EvidenceStore, passageId: string): readonly InternalAttemptRecord[] {
  return store.core.get(passageId) ?? [];
}

/** Oral evidence for a passage, for News Reader coaching only. */
export function oralEvidenceForPassage(store: EvidenceStore, passageId: string): readonly NewsReaderAttempt[] {
  return store.newsReader.get(passageId) ?? [];
}

/** Guard for any comprehension scoring entry point: News Reader attempts are refused. */
export function assertComprehensionEvidence(source: { attemptType?: string; readNumber?: unknown }): void {
  if (source.attemptType === "NEWS_READER" || "readNumber" in source) {
    throw new Error("News Reader results cannot be substituted for comprehension evidence (FR-036)");
  }
}
