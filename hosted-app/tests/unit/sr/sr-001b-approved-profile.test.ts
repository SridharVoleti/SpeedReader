import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ProfileUnavailableError, loadApprovedProfile, validateProfile, passageSpecFor, lengthBandFor, validateSpecDifficulty, type ApprovedProfile
} from "../../../lib/sr/passage-progression";
import { canonicalHash } from "../../../lib/sr/pipeline/hash";
import { FIXTURE_PROFILE } from "./helpers/profile";

const seal = (p: Omit<ApprovedProfile, "contentHash">): ApprovedProfile => ({ ...p, contentHash: canonicalHash(p) });
const { contentHash: _h, ...BODY } = FIXTURE_PROFILE;

// Issue #6 - SR-001 values must come from the approved Knowledge Map; fail closed when absent/invalid.
describe("SR-001 approved profile (fail closed)", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "sr-prof-")); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("fails closed when no approved profile file exists", () => {
    expect(() => loadApprovedProfile(join(dir, "missing.json"))).toThrow(ProfileUnavailableError);
  });
  it("fails closed on malformed JSON, unapproved status, or hash mismatch", () => {
    const f = join(dir, "p.json");
    writeFileSync(f, "{not json");
    expect(() => loadApprovedProfile(f)).toThrow(ProfileUnavailableError);
    writeFileSync(f, JSON.stringify({ ...FIXTURE_PROFILE, qaStatus: "AWAITING_QA" }));
    expect(() => loadApprovedProfile(f)).toThrow(/qaStatus/);
    writeFileSync(f, JSON.stringify({ ...FIXTURE_PROFILE, complexity: { ...FIXTURE_PROFILE.complexity, maxSentenceWords: 99 } }));
    expect(() => loadApprovedProfile(f)).toThrow(/hash/);
  });
  it("loads a sealed, QA-PASS profile", () => {
    const f = join(dir, "p.json");
    writeFileSync(f, JSON.stringify(FIXTURE_PROFILE));
    expect(loadApprovedProfile(f).contentHash).toBe(FIXTURE_PROFILE.contentHash);
  });
  it("validates catalog coverage: gaps, overlaps, and short coverage are rejected", () => {
    expect(validateProfile(FIXTURE_PROFILE)).toEqual([]);
    const gap = seal({ ...BODY, lengthSchedule: [{ from: 1, to: 149, targetWords: 100 }, { from: 151, to: 1500, targetWords: 125 }] });
    expect(validateProfile(gap).join()).toMatch(/gap|contiguous/i);
    const overlap = seal({ ...BODY, lengthSchedule: [{ from: 1, to: 151, targetWords: 100 }, { from: 151, to: 1500, targetWords: 125 }] });
    expect(validateProfile(overlap).join()).toMatch(/contiguous/i);
    const short = seal({ ...BODY, lengthSchedule: [{ from: 1, to: 1499, targetWords: 100 }] });
    expect(validateProfile(short).join()).toMatch(/1500/);
  });
  it("rejects non-positive / non-integer lengths and decreasing schedules", () => {
    expect(validateProfile(seal({ ...BODY, lengthSchedule: [{ from: 1, to: 1500, targetWords: 0 }] })).length).toBeGreaterThan(0);
    expect(validateProfile(seal({ ...BODY, lengthSchedule: [{ from: 1, to: 750, targetWords: 120 }, { from: 751, to: 1500, targetWords: 100 }] })).join()).toMatch(/decreas/i);
  });
  it("resolves every 150-passage boundary and the full catalog from the profile", () => {
    for (let b = 150; b <= 1500; b += 150) {
      expect(passageSpecFor(b, FIXTURE_PROFILE).targetWords).toBeGreaterThan(0);
      if (b < 1500) expect(lengthBandFor(b + 1, FIXTURE_PROFILE)).toBeGreaterThanOrEqual(lengthBandFor(b, FIXTURE_PROFILE));
    }
    for (let n = 1; n <= 1500; n++) expect(passageSpecFor(n, FIXTURE_PROFILE).complexity).toEqual(FIXTURE_PROFILE.complexity);
  });
  it("passageSpecFor without an injected profile and no approved file fails closed (no baked-in defaults)", () => {
    expect(() => passageSpecFor(1)).toThrow(ProfileUnavailableError);
  });
  it("detects complexity drift against the supplied profile", () => {
    const spec = passageSpecFor(5, FIXTURE_PROFILE);
    expect(validateSpecDifficulty({ ...spec, complexity: { ...spec.complexity, maxClausesPerSentence: 9 } }, FIXTURE_PROFILE)).not.toEqual([]);
  });
});
