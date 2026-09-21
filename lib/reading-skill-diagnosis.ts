// SR-R5-001: RS competency integration.
// "Consume approved RS competency tags/evidence from content files." "Attempt evidence
// attributes to relevant RS without hard-coded passage IDs." Every item's RS attribution comes
// entirely from authored tag data (content files) joined against attempt results - this module
// never special-cases a specific passage, item or RS identifier.

export type RsTaggedItem = {
  itemId: string;
  rsId: string;
  evidenceTag: string;
};

export type RsAttributedEvidence = {
  rsId: string;
  evidenceTag: string;
  itemId: string;
  matched: boolean;
};

export function attributeEvidenceToRs<T extends { itemId: string; matched: boolean }>(
  results: T[],
  itemRsTags: RsTaggedItem[]
): RsAttributedEvidence[] {
  const tagByItemId = new Map(itemRsTags.map((tag) => [tag.itemId, tag]));
  const attributed: RsAttributedEvidence[] = [];

  for (const result of results) {
    const tag = tagByItemId.get(result.itemId);
    if (!tag) continue; // no authored RS tag for this item - never guess one
    attributed.push({
      rsId: tag.rsId,
      evidenceTag: tag.evidenceTag,
      itemId: result.itemId,
      matched: result.matched
    });
  }

  return attributed;
}

// SR-R5-002: Bottleneck reason codes.
// "Diagnose bottleneck only when configured evidence minimums are satisfied." "Below minimum
// returns INSUFFICIENT_EVIDENCE; sufficient pattern returns deterministic bottleneck code."
export type BottleneckCode = "INSUFFICIENT_EVIDENCE" | "BOTTLENECK_DETECTED" | "NO_BOTTLENECK";

export type BottleneckDiagnosis = {
  rsId: string;
  evidenceCount: number;
  bottleneckCode: BottleneckCode;
};

export function diagnoseBottleneck(
  evidence: RsAttributedEvidence[],
  rsId: string,
  minimumEvidenceCount: number,
  failureRateThreshold: number
): BottleneckDiagnosis {
  const relevant = evidence.filter((item) => item.rsId === rsId);
  const evidenceCount = relevant.length;

  if (evidenceCount < minimumEvidenceCount) {
    return { rsId, evidenceCount, bottleneckCode: "INSUFFICIENT_EVIDENCE" };
  }

  const failedCount = relevant.filter((item) => !item.matched).length;
  const failureRate = failedCount / evidenceCount;
  const bottleneckCode: BottleneckCode = failureRate >= failureRateThreshold ? "BOTTLENECK_DETECTED" : "NO_BOTTLENECK";
  return { rsId, evidenceCount, bottleneckCode };
}
