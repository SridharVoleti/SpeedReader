// Independent semantic verifiers used by QA (SR-017, SR-019). Semantic judgement cannot be done by string
// rules, so QA takes an injected judge (a model-backed reviewer in production). The judge never sees the
// creator's answer key. With no judge registered, QA fails closed - it never "passes" what it cannot verify.

export type OptionVerdict = "SUPPORTED" | "CONTRADICTED" | "UNSUPPORTED";
export type OptionJudgement = { verdicts: OptionVerdict[]; evidence: string[] };
/** Judges every option against the passage only. Must not receive answerIndex. */
export type OptionJudge = (passage: string, item: { stem: string; options: readonly string[] }) => OptionJudgement;

export type PropositionVerdict = "ENTAILED" | "UNSUPPORTED";
/** Judges whether `proposition` is entailed by the cited passage evidence (paraphrase allowed). */
export type PropositionJudge = (evidenceText: string, proposition: string) => PropositionVerdict;

let optionJudge: OptionJudge | null = null;
let propositionJudge: PropositionJudge | null = null;
export const setOptionJudge = (j: OptionJudge | null): void => { optionJudge = j; };
export const setPropositionJudge = (j: PropositionJudge | null): void => { propositionJudge = j; };
export const getOptionJudge = (): OptionJudge | null => optionJudge;
export const getPropositionJudge = (): PropositionJudge | null => propositionJudge;

/** Passage sentences, 1-based when referenced by evidence. */
export const passageSentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
