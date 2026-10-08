import { passageSpecFor, setActiveProfile } from "../../../../lib/sr/passage-progression";
import { FIXTURE_PROFILE } from "./profile";
import { setOptionJudge, setPropositionJudge } from "../../../../lib/sr/pipeline/verifiers";

const ITEMS_KEY: Record<string, number> = { "What happened first?": 0, "Who acted?": 1, "Why?": 2, "What next?": 0 };

setActiveProfile(FIXTURE_PROFILE);

// Fixture judges stand in for the independent reviewer: option judge knows the fixture key (never given the creator's answerIndex);
// proposition judge entails everything except text marked "invented".
setOptionJudge((_passage, item) => {
  const key = ITEMS_KEY[item.stem];
  return { verdicts: item.options.map((_o, n) => (key === undefined ? "UNSUPPORTED" : n === key ? "SUPPORTED" : "CONTRADICTED")), evidence: ["fixture judge"] };
});
setPropositionJudge((_evidence, proposition) => (/invented/.test(proposition) ? "UNSUPPORTED" : "ENTAILED"));
const COMPLEXITY_PROFILE = FIXTURE_PROFILE.complexity;
import type { RoleId } from "../../../../lib/sr/pipeline/roles";

export const prov = (role: RoleId, inputs: { role: RoleId; hash: string }[] = []) => ({ role, inputs, createdAt: "2026-10-08T00:00:00Z", creator: "creator-agent" });

export const envelope = (role: RoleId, artifactType: string, payload: Record<string, unknown>, inputs: { role: RoleId; hash: string }[] = []) => ({
  role, artifactType, status: "WIP" as const, location: `pipeline/wip/role${role}.json`, provenance: prov(role, inputs), payload
});

export const role1Payload = (sequence = 7) => ({
  passageId: `W1-${String(sequence).padStart(4, "0")}`, sequence, rsId: "RS01", pId: "P01",
  targetWords: passageSpecFor(sequence).targetWords, complexity: { ...COMPLEXITY_PROFILE }
});
export const role1 = (sequence = 7) => envelope(1, "PASSAGE_SPEC", role1Payload(sequence));

// ---- consistent chain for passage W1-0007 (sequence 7, 80 target words) ----
export const PID = "W1-0007";
export const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
export const H = (r: RoleId) => ({ role: r, hash: `hash-${r}` });

export const role2Payload = () => ({ passageId: PID, text: words(80), wordCount: 80 });
export const role2 = (p: Record<string, unknown> = role2Payload()) => envelope(2, "PASSAGE_TEXT", p, [H(1)]);

export const items4 = () => [
  { itemId: "I1", stem: "What happened first?", options: ["a", "b", "c"], answerIndex: 0, primary: true, evidence: { quote: "w0 w1" } },
  { itemId: "I2", stem: "Who acted?", options: ["a", "b", "c"], answerIndex: 1, primary: false, evidence: { quote: "w5 w6" } },
  { itemId: "I3", stem: "Why?", options: ["a", "b", "c"], answerIndex: 2, primary: false, evidence: { quote: "w20 w21" } },
  { itemId: "I4", stem: "What next?", options: ["a", "b", "c"], answerIndex: 0, primary: false, evidence: { quote: "w30 w31" } }
];
export const role3Payload = () => ({ passageId: PID, items: items4() });
export const role3 = (p: Record<string, unknown> = role3Payload()) => envelope(3, "ASSESSMENT", p, [H(1), H(2)]);

export const role4Payload = () => ({
  passageId: PID,
  units: [
    { muId: "MU1", text: "w0 w1 w2", factIds: ["F1"], evidence: { span: "w0 w1 w2" } },
    { muId: "MU2", text: "A faithful paraphrase of w10 w11", factIds: ["F2"], evidence: { span: "w10 w11" } },
    { muId: "MU3", text: "w40 w41 w42", factIds: ["F3"], evidence: { sentences: [1] } }
  ]
});
export const role4 = (p: Record<string, unknown> = role4Payload()) => envelope(4, "MEANING_UNITS", p, [H(2)]);

export const role5Payload = () => ({ passageId: PID, text: "A model retelling that covers every idea.", factIds: ["F1", "F2", "F3"] });
export const role5 = (p: Record<string, unknown> = role5Payload()) => envelope(5, "BPC", p, [H(2), H(4)]);

export const role6Payload = () => ({
  passageId: PID, ruleId: "P10_FIRST_ATTEMPT_3_OF_4_PRIMARY", primaryItemId: "I1",
  itemPoints: { I1: 25, I2: 25, I3: 25, I4: 25 }
});
export const role6 = (p: Record<string, unknown> = role6Payload()) => envelope(6, "SCORING_CONTRACT", p, [H(3), H(4)]);

export const role7Payload = () => ({
  passageId: PID,
  outcomes: [
    { state: "PASS", nextAction: "CONTINUE_NEXT_PASSAGE", oralReady: true, comprehensionReady: true },
    { state: "FAIL", nextAction: "CONTINUE_NEXT_PASSAGE", oralReady: false, comprehensionReady: false }
  ]
});
export const role7 = (p: Record<string, unknown> = role7Payload()) => envelope(7, "ATTEMPT_CONTRACT", p, [H(6)]);

export const role8Payload = () => ({
  passageId: PID,
  refs: { 1: "hash-1", 2: "hash-2", 3: "hash-3", 4: "hash-4", 5: "hash-5", 6: "hash-6", 7: "hash-7" }
});
export const role8 = (p: Record<string, unknown> = role8Payload()) => envelope(8, "FINAL_PACKAGE", p, [1, 2, 3, 4, 5, 6, 7].map((r) => H(r as RoleId)));

export const UPSTREAM = {
  1: role1Payload(), 2: role2Payload(), 3: role3Payload(), 4: role4Payload(), 5: role5Payload(), 6: role6Payload(), 7: role7Payload()
} as Record<number, Record<string, unknown>>;
export const approved = (...roles: RoleId[]) => roles.map(H);
