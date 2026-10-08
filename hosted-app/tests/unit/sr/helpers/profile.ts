// TEST FIXTURE ONLY. These numbers are NOT the approved Knowledge Map values (none are approved yet);
// they exist so structural/boundary behaviour can be exercised. Production code never imports this file.
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";
import type { ApprovedProfile } from "../../../../lib/sr/passage-progression";

const body = {
  qaStatus: "PASS" as const,
  source: "TEST-FIXTURE",
  complexity: { maxSentenceWords: 10, vocabularyBand: "T", maxClausesPerSentence: 1 },
  lengthSchedule: [
    { from: 1, to: 150, targetWords: 80 }, { from: 151, to: 300, targetWords: 100 }, { from: 301, to: 450, targetWords: 120 },
    { from: 451, to: 600, targetWords: 140 }, { from: 601, to: 750, targetWords: 160 }, { from: 751, to: 900, targetWords: 180 },
    { from: 901, to: 1050, targetWords: 200 }, { from: 1051, to: 1200, targetWords: 220 }, { from: 1201, to: 1350, targetWords: 240 },
    { from: 1351, to: 1500, targetWords: 260 }
  ]
};
export const FIXTURE_PROFILE: ApprovedProfile = { ...body, contentHash: canonicalHash(body) };
