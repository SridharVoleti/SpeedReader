// Canonical Band A identities from the approved 15 × 10 registry. Age bands select
// different prose, never a different RS definition or knowledge-strand framework.
export const RS_IDS = [
  "RS01", "RS02", "RS03", "RS04", "RS05", "RS06", "RS07", "RS08",
  "RS09", "RS10", "RS11", "RS12", "RS13", "RS14", "RS15"
] as const;

export type RsId = (typeof RS_IDS)[number];

export const KNOWLEDGE_STRANDS = [
  "Self & Character",
  "Family & Friendship",
  "School & Learning",
  "Play, Games & Sports",
  "Animals & Living World",
  "Nature & Environment",
  "Science & How Things Work",
  "Making, Building & Inventing",
  "India Around Us",
  "Our World & Journeys",
  "Community & Civic Life",
  "Money, Resources & Choices",
  "Health, Body & Safety",
  "Mystery, Logic & Observation",
  "Imagination, Art & Wonder"
] as const;

export type KnowledgeStrand = (typeof KNOWLEDGE_STRANDS)[number];

export type BandACoordinate = {
  deliverySequence: number;
  rsId: RsId;
  pLevel: number;
  knowledgeStrand: KnowledgeStrand;
};

export function bandACoordinate(deliverySequence: number): BandACoordinate {
  if (!Number.isInteger(deliverySequence) || deliverySequence < 1 || deliverySequence > 150) {
    throw new RangeError("Band A delivery sequence must be 1..150");
  }
  const rsIndex = (deliverySequence - 1) % 15;
  const roundIndex = Math.floor((deliverySequence - 1) / 15);
  return {
    deliverySequence,
    rsId: RS_IDS[rsIndex],
    pLevel: roundIndex + 1,
    knowledgeStrand: KNOWLEDGE_STRANDS[(rsIndex + roundIndex) % 15]
  };
}

export function isRsId(value: string): value is RsId {
  return (RS_IDS as readonly string[]).includes(value);
}

export function isKnowledgeStrand(value: string): value is KnowledgeStrand {
  return (KNOWLEDGE_STRANDS as readonly string[]).includes(value);
}
