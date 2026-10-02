import type { WorldConfig } from "./world1-product";
import { matchProposition, normalizeEvidenceText, type Proposition } from "./evidence-scoring";

export type EvidenceState = "PASS" | "HOLD" | "TECHNICAL_RETRY" | "INSUFFICIENT_EVIDENCE";
export type SessionPassage = {
  passageId: string;
  targetWpm: number;
  comprehension: EvidenceState;
  oralQuality: EvidenceState;
  staminaWords: number;
  trainingMode?: "INTEGRATED";
};
export type World1Session = {
  id: string;
  startedAtMs: number;
  endedAtMs?: number;
  passages: SessionPassage[];
};

export function recommendNextSession(lastStartedAtMs: number, config: WorldConfig): number {
  return lastStartedAtMs + config.cadenceDays * 24 * 60 * 60 * 1000;
}

export function sessionTimeRemaining(session: World1Session, nowMs: number, config: WorldConfig): number {
  return Math.max(0, config.sessionMinutes * 60 * 1000 - (nowMs - session.startedAtMs));
}

export function finishSession(session: World1Session, nowMs: number): World1Session {
  return session.endedAtMs === undefined ? { ...session, endedAtMs: nowMs } : session;
}

export function closeSessionAtBudget(session: World1Session, nowMs: number, config: WorldConfig): World1Session {
  if (session.endedAtMs !== undefined || sessionTimeRemaining(session, nowMs, config) > 0) return session;
  return finishSession(session, nowMs);
}

export function recordSessionPassage(
  session: World1Session, passage: SessionPassage, completedAtMs: number, config: WorldConfig
): World1Session {
  if (session.endedAtMs !== undefined) return session;
  if (completedAtMs < session.startedAtMs) throw new RangeError("passage completed before session started");
  const evidenceStates: readonly EvidenceState[] = ["PASS", "HOLD", "TECHNICAL_RETRY", "INSUFFICIENT_EVIDENCE"];
  if (!passage.passageId || !Number.isFinite(passage.targetWpm) || passage.targetWpm <= 0 ||
      !Number.isInteger(passage.staminaWords) || passage.staminaWords <= 0 ||
      !evidenceStates.includes(passage.comprehension) || !evidenceStates.includes(passage.oralQuality) ||
      (passage.trainingMode !== undefined && passage.trainingMode !== "INTEGRATED")) {
    throw new Error("integrated passage evidence required");
  }
  const updated = { ...session, passages: [...session.passages, passage] };
  return closeSessionAtBudget(updated, completedAtMs, config);
}

export function sessionOutcome(session: World1Session): "SUCCESS" | "HOLD" | "INSUFFICIENT_EVIDENCE" {
  const valid = session.passages.filter((p) =>
    (p.comprehension === "PASS" || p.comprehension === "HOLD") &&
    (p.oralQuality === "PASS" || p.oralQuality === "HOLD")
  );
  if (valid.length === 0) return "INSUFFICIENT_EVIDENCE";
  return valid.some((p) => p.comprehension === "PASS" && p.oralQuality === "PASS") ? "SUCCESS" : "HOLD";
}

export type SpokenJudgement = "RELEVANT" | "UNRELATED" | "UNCERTAIN";
export type SpokenAssessment = { state: EvidenceState; reason: string };

// Authored expression variants are evidence of meaning, not a demand that the
// learner recite the passage's keywords. Missing a variant remains uncertain.
export function judgeAuthoredSpokenIdea(transcript: string, propositions: Proposition[]): SpokenJudgement {
  if (propositions.length === 0) return "UNCERTAIN";
  const words = normalizeEvidenceText(transcript);
  const matches = propositions.map((proposition) => matchProposition(proposition, words));
  if (matches.some((match) => match.contradicted)) return "UNRELATED";
  if (matches.some((match) => match.matched)) return "RELEVANT";
  return "UNCERTAIN";
}

// The semantic assessor is supplied separately; this layer never treats ASR confidence
// or a short but meaningful answer as a failed learner response.
export function assessYoungBeginnerSpoken(input: {
  transcript: string;
  asrUsable: boolean;
  semanticJudgement?: SpokenJudgement;
  semanticConfidence?: number;
  minimumSemanticConfidence?: number;
  asrConfidence?: number;
  minimumAsrConfidence?: number;
}): SpokenAssessment {
  if (!input.asrUsable) return { state: "TECHNICAL_RETRY", reason: "ASR_UNUSABLE" };
  if (input.minimumAsrConfidence !== undefined) {
    if (!Number.isFinite(input.minimumAsrConfidence) || input.minimumAsrConfidence < 0 || input.minimumAsrConfidence > 1) {
      throw new RangeError("invalid ASR confidence threshold");
    }
    if (input.asrConfidence === undefined || !Number.isFinite(input.asrConfidence) ||
        input.asrConfidence < input.minimumAsrConfidence || input.asrConfidence > 1) {
      return { state: "TECHNICAL_RETRY", reason: "ASR_UNCERTAIN" };
    }
  }
  if (input.minimumSemanticConfidence !== undefined) {
    if (!Number.isFinite(input.minimumSemanticConfidence) || input.minimumSemanticConfidence < 0 || input.minimumSemanticConfidence > 1) {
      throw new RangeError("invalid semantic confidence threshold");
    }
    if (input.semanticConfidence === undefined || !Number.isFinite(input.semanticConfidence) ||
        input.semanticConfidence < input.minimumSemanticConfidence || input.semanticConfidence > 1) {
      return { state: "INSUFFICIENT_EVIDENCE", reason: "SEMANTIC_REVIEW_NEEDED" };
    }
  }
  if (!input.transcript.trim() || input.semanticJudgement === undefined || input.semanticJudgement === "UNCERTAIN") {
    return { state: "INSUFFICIENT_EVIDENCE", reason: "SEMANTIC_REVIEW_NEEDED" };
  }
  return input.semanticJudgement === "RELEVANT"
    ? { state: "PASS", reason: "ONE_MEANINGFUL_IDEA" }
    : { state: "HOLD", reason: "GENTLE_RETRY" };
}

export type OralMetrics = {
  accuracy: number;
  omissions: number;
  substitutions: number;
  hesitations: number;
  restarts: number;
  selfCorrections: number;
  wpm: number;
};
export type OralRead = { attempt: 1 | 2; passageId: string; metrics: OralMetrics | null; evidence: EvidenceState };
export type NewsReaderResult = {
  read1: OralRead;
  read2: OralRead;
  average: OralMetrics | null;
  delta: OralMetrics | null;
};

export function completeNewsReader(read1: OralRead, read2: OralRead): NewsReaderResult {
  if (read1.attempt !== 1 || read2.attempt !== 2 || read1.passageId !== read2.passageId) {
    throw new Error("News Reader requires ordered reads of the same passage");
  }
  if (read1.evidence !== "PASS" || read2.evidence !== "PASS" || !read1.metrics || !read2.metrics) {
    return { read1, read2, average: null, delta: null };
  }
  const keys: (keyof OralMetrics)[] = ["accuracy", "omissions", "substitutions", "hesitations", "restarts", "selfCorrections", "wpm"];
  const average = {} as OralMetrics;
  const delta = {} as OralMetrics;
  for (const key of keys) {
    average[key] = (read1.metrics[key] + read2.metrics[key]) / 2;
    delta[key] = read2.metrics[key] - read1.metrics[key];
  }
  return { read1, read2, average, delta };
}

export type BaselineSample = { sessionId: string; value: number; evidence: EvidenceState; comparable: boolean };
export type BaselineConfig = { windowSize: number; minimumSamples: number };

// Median makes one unusually strong/weak session unable to move a mature baseline
// materially. Window and evidence minimum remain calibration inputs.
export function rollingPersonalBaseline(samples: BaselineSample[], prior: number | null, config: BaselineConfig): number | null {
  if (!Number.isInteger(config.windowSize) || config.windowSize < 1 || !Number.isInteger(config.minimumSamples) || config.minimumSamples < 1) throw new Error("invalid baseline config");
  const unique = new Map<string, number>();
  for (const sample of samples) {
    if (sample.evidence === "PASS" && sample.comparable && Number.isFinite(sample.value)) unique.set(sample.sessionId, sample.value);
  }
  const values = [...unique.values()].slice(-config.windowSize).sort((a, b) => a - b);
  if (values.length < config.minimumSamples) return prior;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
