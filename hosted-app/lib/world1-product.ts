// World 1 product rules layered over (not substituted for) the frozen Band A KM.
// The existing 36-level demo is not a World 1 passage catalog.
import { gateContent, type ContentFile } from "./content-gate";
import { bandACoordinate, isKnowledgeStrand, isRsId, type KnowledgeStrand, type RsId } from "./world1-framework";

export type AgeBand = "7-10" | "11-14" | "15-18" | (string & {});
export type WorldConfig = {
  version: string;
  lengthPolicyVersion: "world1-length-staircase-v1";
  worldId: number;
  ageBands: readonly AgeBand[];
  targetWpm: number;
  passageCount?: number;
  sessionMinutes: number;
  cadenceDays: number;
  speedStepWpm?: number; // OPEN-001: omitted until calibrated.
  staminaConfirmations?: number; // OPEN-005: omitted until calibrated.
  advancementPriority?: "LENGTH" | "SPEED"; // OPEN-006.
};

export const WORLD_TARGETS: Readonly<Record<number, number>> = Object.freeze({
  1: 100, 2: 150, 3: 180, 4: 225, 5: 250, 6: 300
});

export const WORLD1_CONFIG: WorldConfig = {
  version: "decisions-1.1",
  lengthPolicyVersion: "world1-length-staircase-v1",
  worldId: 1,
  ageBands: ["7-10", "11-14", "15-18"],
  targetWpm: WORLD_TARGETS[1],
  passageCount: 1500,
  sessionMinutes: 20,
  cadenceDays: 2
};

const WORLD_CONFIG_FIELDS = new Set([
  "version", "lengthPolicyVersion", "worldId", "ageBands", "targetWpm",
  "passageCount", "sessionMinutes", "cadenceDays", "speedStepWpm",
  "staminaConfirmations", "advancementPriority"
]);

export function validateWorldConfig(config: WorldConfig): string[] {
  const errors: string[] = [];
  for (const field of Object.keys(config)) {
    if (!WORLD_CONFIG_FIELDS.has(field)) errors.push(`unsupported config field ${field}`);
  }
  if (!config.version) errors.push("version required");
  if (config.lengthPolicyVersion !== "world1-length-staircase-v1") errors.push("unsupported lengthPolicyVersion");
  if (!Number.isInteger(config.worldId) || config.worldId < 1) errors.push("invalid worldId");
  if (!Number.isFinite(config.targetWpm) || config.targetWpm <= 0) errors.push("invalid targetWpm");
  if (!Array.isArray(config.ageBands) || !config.ageBands.length || new Set(config.ageBands).size !== config.ageBands.length) errors.push("invalid ageBands");
  if (!Number.isFinite(config.sessionMinutes) || config.sessionMinutes <= 0) errors.push("invalid sessionMinutes");
  if (!Number.isFinite(config.cadenceDays) || config.cadenceDays <= 0) errors.push("invalid cadenceDays");
  if (config.passageCount !== undefined && (!Number.isInteger(config.passageCount) || config.passageCount < 1)) errors.push("invalid passageCount");
  if (config.speedStepWpm !== undefined && (!Number.isFinite(config.speedStepWpm) || config.speedStepWpm <= 0)) errors.push("invalid speedStepWpm");
  if (config.staminaConfirmations !== undefined && (!Number.isInteger(config.staminaConfirmations) || config.staminaConfirmations < 1)) errors.push("invalid staminaConfirmations");
  return errors;
}

export type LengthTarget = { words: number; stepType: "FOUNDATION" | "BRIDGE" | "CONSOLIDATION"; staminaStep: number };

export function passageLengthTarget(sequence: number): LengthTarget {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 1500) throw new RangeError("World 1 sequence must be 1..1500");
  if (sequence <= 150) return { words: 100, stepType: "FOUNDATION", staminaStep: 0 };
  const block = Math.floor((sequence - 151) / 150);
  const offset = (sequence - 151) % 150;
  const withinBlockStep = offset < 75 ? Math.floor(offset / 25) + 1 : 4;
  return {
    words: 100 + block * 100 + withinBlockStep * 25,
    stepType: withinBlockStep === 4 ? "CONSOLIDATION" : "BRIDGE",
    staminaStep: block * 4 + withinBlockStep
  };
}

export type CatalogPassage = ContentFile & {
  passage_sequence: number;
  age_band: AgeBand;
  text: string;
  rs_id: RsId;
  knowledge_strand: KnowledgeStrand;
  competency_level?: number;
  theme: string;
  narrative_form: string;
  reading_purpose: string;
  language_qa_approved: boolean;
  age_qa_approved: boolean;
  km_approved: boolean;
  language_qa?: LanguageQa;
};

export type LanguageQa = {
  accessibleProseApproved: boolean;
  ageTopicApproved: boolean;
  vocabularyOverload: boolean;
  unnecessaryStretchDimensions: readonly string[];
  primaryStretchDimensions?: readonly string[];
};

// COUNT-100 tokenization is owned by the canonical KM. The product layer accepts its
// count service instead of inventing an alternate whitespace or punctuation rule.
export type CanonicalWordCounter = (text: string) => number;

export function validatePassage(passage: CatalogPassage, countWords: CanonicalWordCounter): string[] {
  const errors: string[] = [];
  const gate = gateContent(passage);
  if (!gate.valid) errors.push(...gate.reasons);
  let target: LengthTarget | null = null;
  try { target = passageLengthTarget(passage.passage_sequence); } catch { errors.push("invalid passage_sequence"); }
  if (target) {
    try {
      if (countWords(passage.text) !== target.words) errors.push("COUNT_MISMATCH");
    } catch {
      errors.push("COUNT_UNAVAILABLE");
    }
  }
  if (!isRsId(passage.rs_id) || !isKnowledgeStrand(passage.knowledge_strand)) errors.push("INVALID_FRAMEWORK_COORDINATE");
  if (passage.passage_sequence >= 1 && passage.passage_sequence <= 150) {
    const expected = bandACoordinate(passage.passage_sequence);
    if (passage.rs_id !== expected.rsId || passage.knowledge_strand !== expected.knowledgeStrand || passage.competency_level !== expected.pLevel) {
      errors.push("BAND_A_COORDINATE_MISMATCH");
    }
  }
  if (!passage.theme || !passage.narrative_form || !passage.reading_purpose) errors.push("missing variety metadata");
  if (!passage.language_qa_approved || !passage.age_qa_approved || !passage.km_approved) errors.push("QA_NOT_APPROVED");
  const languageQa = passage.language_qa;
  if (!languageQa || languageQa.accessibleProseApproved !== true || languageQa.ageTopicApproved !== true || languageQa.vocabularyOverload !== false || !Array.isArray(languageQa.unnecessaryStretchDimensions)) {
    errors.push("LANGUAGE_QA_INCOMPLETE");
  } else {
    if (languageQa.unnecessaryStretchDimensions.length > 0) errors.push("UNNECESSARY_STRETCH_DEMAND");
    if (languageQa.primaryStretchDimensions && (!Array.isArray(languageQa.primaryStretchDimensions) || languageQa.primaryStretchDimensions.length > 1)) {
      errors.push("SIMULTANEOUS_STRETCH_DEMANDS");
    }
  }
  if (languageQa?.vocabularyOverload === true) errors.push("VOCABULARY_OVERLOAD");
  return errors;
}

export function validateCatalog(passages: CatalogPassage[], band: AgeBand, countWords: CanonicalWordCounter, expectedCount = 1500): string[] {
  const errors: string[] = [];
  const records = passages.filter((passage) => passage.age_band === band);
  const seen = new Set<number>();
  for (const passage of records) {
    if (seen.has(passage.passage_sequence)) errors.push(`duplicate sequence ${passage.passage_sequence}`);
    seen.add(passage.passage_sequence);
    errors.push(...validatePassage(passage, countWords).map((reason) => `${passage.passage_sequence}: ${reason}`));
  }
  for (let sequence = 1; sequence <= expectedCount; sequence += 1) {
    if (!seen.has(sequence)) errors.push(`missing sequence ${sequence}`);
  }
  return errors;
}

export type CatalogSelection =
  | { status: "READY"; passage: CatalogPassage }
  | { status: "CONTENT_UNAVAILABLE" | "CONTENT_INVALID"; reason: string };

export function nextSequentialPassage(passages: CatalogPassage[], band: AgeBand, nextSequence: number, countWords: CanonicalWordCounter): CatalogSelection {
  if (!Number.isInteger(nextSequence) || nextSequence < 1 || nextSequence > 1500) return { status: "CONTENT_UNAVAILABLE", reason: "sequence outside World 1" };
  const matches = passages.filter((passage) => passage.age_band === band && passage.passage_sequence === nextSequence);
  if (matches.length !== 1) return { status: "CONTENT_UNAVAILABLE", reason: `expected one passage at ${nextSequence}; found ${matches.length}` };
  const errors = validatePassage(matches[0], countWords);
  return errors.length ? { status: "CONTENT_INVALID", reason: errors.join(", ") } : { status: "READY", passage: matches[0] };
}

export function varietyIssues(passages: CatalogPassage[], maxRepeat: number): string[] {
  const issues: string[] = [];
  if (!Number.isInteger(maxRepeat) || maxRepeat < 1) throw new RangeError("maxRepeat must be positive");
  for (const key of ["theme", "narrative_form", "reading_purpose"] as const) {
    let run = 0;
    let previous = "";
    for (const passage of passages) {
      run = passage[key] === previous ? run + 1 : 1;
      previous = passage[key];
      if (run === maxRepeat + 1) issues.push(`${key} repeats after sequence ${passage.passage_sequence}`);
    }
  }
  return issues;
}
