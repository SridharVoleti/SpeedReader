// SR-001 - World 1 passage difficulty is constant; only length steps up per the APPROVED schedule.
// No length or complexity value is baked in here: they are loaded from the QA-approved profile artifact
// (pipeline/approved/world1-passage-profile.json) and the module fails closed when that is unavailable.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WORLD1_PASSAGE_COUNT } from "../v2/catalog";
import { canonicalHash } from "./pipeline/hash";

export const BATCH_SIZE = 150;

export type Complexity = { maxSentenceWords: number; vocabularyBand: string; maxClausesPerSentence: number };
export type LengthStep = { from: number; to: number; targetWords: number };
export type ApprovedProfile = {
  qaStatus: "PASS";
  source: string;
  complexity: Complexity;
  lengthSchedule: LengthStep[];
  /** canonicalHash of every other field - binds the profile to its approved content. */
  contentHash: string;
};
export type PassageSpec = { sequence: number; lengthBand: number; targetWords: number; complexity: Complexity };

export class ProfileUnavailableError extends Error {
  constructor(message: string) { super(`APPROVED_PROFILE_UNAVAILABLE: ${message}`); this.name = "ProfileUnavailableError"; }
}

export const APPROVED_PROFILE_PATH = resolve(__dirname, "../../pipeline/approved/world1-passage-profile.json");

/** Structural + coverage validation of a profile. Returns violations (empty = valid). */
export function validateProfile(p: ApprovedProfile): string[] {
  const out: string[] = [];
  const c = p.complexity as Partial<Complexity> | undefined;
  if (!c || !Number.isInteger(c.maxSentenceWords) || (c.maxSentenceWords as number) < 1) out.push("complexity.maxSentenceWords must be a positive integer");
  if (!c || typeof c.vocabularyBand !== "string" || !c.vocabularyBand) out.push("complexity.vocabularyBand must be a non-empty string");
  if (!c || !Number.isInteger(c.maxClausesPerSentence) || (c.maxClausesPerSentence as number) < 1) out.push("complexity.maxClausesPerSentence must be a positive integer");
  const s = p.lengthSchedule;
  if (!Array.isArray(s) || s.length === 0) return [...out, "lengthSchedule must be a non-empty array"];
  let expectedFrom = 1;
  let prev = 0;
  s.forEach((step, i) => {
    if (!Number.isInteger(step.targetWords) || step.targetWords < 1) out.push(`step ${i}: targetWords must be a positive integer`);
    if (!Number.isInteger(step.from) || !Number.isInteger(step.to) || step.to < step.from) out.push(`step ${i}: invalid range ${step.from}..${step.to}`);
    if (step.from !== expectedFrom) out.push(`step ${i}: schedule not contiguous (expected from=${expectedFrom}, got ${step.from}) - gap or overlap`);
    if (step.targetWords < prev) out.push(`step ${i}: targetWords decreases (${prev} -> ${step.targetWords})`);
    expectedFrom = step.to + 1;
    prev = step.targetWords;
  });
  if (expectedFrom - 1 !== WORLD1_PASSAGE_COUNT) out.push(`schedule must cover exactly passages 1..${WORLD1_PASSAGE_COUNT} (ends at ${expectedFrom - 1})`);
  return out;
}

/** Load the approved profile from disk; throws ProfileUnavailableError on anything short of a valid sealed QA PASS. */
export function loadApprovedProfile(path: string = APPROVED_PROFILE_PATH): ApprovedProfile {
  if (!existsSync(path)) throw new ProfileUnavailableError(`no approved profile at ${path}`);
  let parsed: ApprovedProfile;
  try { parsed = JSON.parse(readFileSync(path, "utf8")) as ApprovedProfile; }
  catch (e) { throw new ProfileUnavailableError(`unreadable profile: ${(e as Error).message}`); }
  if (!parsed || typeof parsed !== "object") throw new ProfileUnavailableError("profile is not an object");
  if (parsed.qaStatus !== "PASS") throw new ProfileUnavailableError(`qaStatus must be PASS, got ${String(parsed.qaStatus)}`);
  const { contentHash, ...body } = parsed;
  if (canonicalHash(body) !== contentHash) throw new ProfileUnavailableError("contentHash mismatch - profile altered after approval (hash)");
  const problems = validateProfile(parsed);
  if (problems.length) throw new ProfileUnavailableError(problems.join("; "));
  return parsed;
}

let active: ApprovedProfile | null = null;
/** Inject a profile (tests / pipeline runner). Pass null to return to loading from the approved root. */
export function setActiveProfile(p: ApprovedProfile | null): void { active = p; }
export function getActiveProfile(): ApprovedProfile { return active ?? loadApprovedProfile(); }

function stepIndex(sequence: number, profile: ApprovedProfile): number {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > WORLD1_PASSAGE_COUNT) throw new RangeError(`passage ${sequence} outside 1..${WORLD1_PASSAGE_COUNT}`);
  const i = profile.lengthSchedule.findIndex((s) => sequence >= s.from && sequence <= s.to);
  if (i < 0) throw new ProfileUnavailableError(`passage ${sequence} not covered by approved schedule`);
  return i;
}

export function lengthBandFor(sequence: number, profile: ApprovedProfile = getActiveProfile()): number {
  return stepIndex(sequence, profile);
}

export function passageSpecFor(sequence: number, profile: ApprovedProfile = getActiveProfile()): PassageSpec {
  const lengthBand = stepIndex(sequence, profile);
  return { sequence, lengthBand, targetWords: profile.lengthSchedule[lengthBand].targetWords, complexity: { ...profile.complexity } };
}

export function validateSpecDifficulty(spec: PassageSpec, profile: ApprovedProfile = getActiveProfile()): string[] {
  const c = spec.complexity ?? ({} as Complexity);
  return (Object.keys(profile.complexity) as (keyof Complexity)[])
    .filter((k) => c[k] !== profile.complexity[k])
    .map((k) => `complexity.${k} drifts from approved profile`);
}
