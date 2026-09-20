// SR-R1-005: Structured response types.
// Four authored item shapes - single choice, ordering, matching, constrained short answer -
// each with a matching response payload shape. A response is validated against its item's
// declared type before it is ever scored, so a malformed or mismatched payload is rejected
// rather than silently scored as wrong.

export type Option = { id: string; label: string };

// SR-R1-006: Basic constructs. R1's construct ontology - every item declares exactly one of
// these as its primary construct, so results can be reported per construct, not just overall.
export type ConstructId = "main_idea" | "detail" | "sequence_relationship";

// SR-R1-007: Mandatory gates. A mandatory item is non-compensable: failing it blocks PASS no
// matter how high the aggregate score is.
export type SingleChoiceItem = {
  itemId: string;
  itemType: "single_choice";
  constructId: ConstructId;
  mandatory: boolean;
  prompt: string;
  options: Option[];
  correctOptionId: string;
};

export type OrderingItem = {
  itemId: string;
  itemType: "ordering";
  constructId: ConstructId;
  mandatory: boolean;
  prompt: string;
  items: Option[];
  correctOrderIds: string[];
};

export type MatchingItem = {
  itemId: string;
  itemType: "matching";
  constructId: ConstructId;
  mandatory: boolean;
  prompt: string;
  left: Option[];
  right: Option[];
  correctPairs: Record<string, string>;
};

export type ConstrainedShortAnswerItem = {
  itemId: string;
  itemType: "constrained_short_answer";
  constructId: ConstructId;
  mandatory: boolean;
  prompt: string;
  minimumResponseWords: number;
  requiredKeywords: string[];
};

export type AssessmentItem = SingleChoiceItem | OrderingItem | MatchingItem | ConstrainedShortAnswerItem;

export type SingleChoiceResponse = { type: "single_choice"; selectedOptionId: string };
export type OrderingResponse = { type: "ordering"; orderedItemIds: string[] };
export type MatchingResponse = { type: "matching"; pairs: Record<string, string> };
export type ConstrainedShortAnswerResponse = { type: "constrained_short_answer"; text: string };

export type ResponsePayload =
  | SingleChoiceResponse
  | OrderingResponse
  | MatchingResponse
  | ConstrainedShortAnswerResponse;

export type ShapeValidationResult = { valid: true } | { valid: false; reasons: string[] };

export function validateResponseShape(item: AssessmentItem, response: unknown): ShapeValidationResult {
  const reasons: string[] = [];
  const candidate = response as { type?: unknown } | null | undefined;

  if (!candidate || typeof candidate !== "object") {
    return { valid: false, reasons: ["response is not an object"] };
  }
  if (candidate.type !== item.itemType) {
    return { valid: false, reasons: [`response type "${String(candidate.type)}" does not match item type "${item.itemType}"`] };
  }

  switch (item.itemType) {
    case "single_choice": {
      const r = response as Partial<SingleChoiceResponse>;
      if (typeof r.selectedOptionId !== "string") reasons.push("selectedOptionId must be a string");
      else if (!item.options.some((option) => option.id === r.selectedOptionId)) {
        reasons.push(`selectedOptionId "${r.selectedOptionId}" is not one of this item's options`);
      }
      break;
    }
    case "ordering": {
      const r = response as Partial<OrderingResponse>;
      const validIds = new Set(item.items.map((entry) => entry.id));
      if (!Array.isArray(r.orderedItemIds)) {
        reasons.push("orderedItemIds must be an array");
      } else {
        const uniqueIds = new Set(r.orderedItemIds);
        if (r.orderedItemIds.length !== item.items.length || uniqueIds.size !== item.items.length) {
          reasons.push("orderedItemIds must contain every item exactly once");
        } else if (r.orderedItemIds.some((id) => !validIds.has(id))) {
          reasons.push("orderedItemIds contains an id that is not part of this item");
        }
      }
      break;
    }
    case "matching": {
      const r = response as Partial<MatchingResponse>;
      const validLeft = new Set(item.left.map((entry) => entry.id));
      const validRight = new Set(item.right.map((entry) => entry.id));
      if (!r.pairs || typeof r.pairs !== "object") {
        reasons.push("pairs must be an object");
      } else {
        const leftIds = Object.keys(r.pairs);
        if (leftIds.length !== item.left.length || !item.left.every((entry) => entry.id in r.pairs!)) {
          reasons.push("pairs must cover every left item exactly once");
        }
        for (const [leftId, rightId] of Object.entries(r.pairs)) {
          if (!validLeft.has(leftId)) reasons.push(`pairs has an unknown left id "${leftId}"`);
          if (!validRight.has(rightId)) reasons.push(`pairs has an unknown right id "${rightId}"`);
        }
      }
      break;
    }
    case "constrained_short_answer": {
      const r = response as Partial<ConstrainedShortAnswerResponse>;
      if (typeof r.text !== "string") reasons.push("text must be a string");
      break;
    }
  }

  return reasons.length > 0 ? { valid: false, reasons } : { valid: true };
}

export type ItemScoreResult = {
  itemId: string;
  constructId: ConstructId;
  itemResult: "correct" | "incorrect" | "invalid_response";
  points: number;
};

const WORD_RE = /[a-zA-Z']+/g;
function normalizeWords(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((word) => word.toLowerCase());
}

export function scoreItem(item: AssessmentItem, response: unknown): ItemScoreResult {
  const shape = validateResponseShape(item, response);
  if (!shape.valid) {
    return { itemId: item.itemId, constructId: item.constructId, itemResult: "invalid_response", points: 0 };
  }

  switch (item.itemType) {
    case "single_choice": {
      const r = response as SingleChoiceResponse;
      const correct = r.selectedOptionId === item.correctOptionId;
      return {
        itemId: item.itemId,
        constructId: item.constructId,
        itemResult: correct ? "correct" : "incorrect",
        points: correct ? 1 : 0
      };
    }
    case "ordering": {
      const r = response as OrderingResponse;
      const correct =
        r.orderedItemIds.length === item.correctOrderIds.length &&
        r.orderedItemIds.every((id, index) => id === item.correctOrderIds[index]);
      return {
        itemId: item.itemId,
        constructId: item.constructId,
        itemResult: correct ? "correct" : "incorrect",
        points: correct ? 1 : 0
      };
    }
    case "matching": {
      const r = response as MatchingResponse;
      const correctPairs = item.correctPairs;
      const correct = Object.entries(correctPairs).every(([leftId, rightId]) => r.pairs[leftId] === rightId);
      return {
        itemId: item.itemId,
        constructId: item.constructId,
        itemResult: correct ? "correct" : "incorrect",
        points: correct ? 1 : 0
      };
    }
    case "constrained_short_answer": {
      const r = response as ConstrainedShortAnswerResponse;
      const words = normalizeWords(r.text);
      const hasEnoughWords = words.length >= item.minimumResponseWords;
      const hasKeywords = item.requiredKeywords.every((keyword) => words.includes(keyword.toLowerCase()));
      const correct = hasEnoughWords && hasKeywords;
      return {
        itemId: item.itemId,
        constructId: item.constructId,
        itemResult: correct ? "correct" : "incorrect",
        points: correct ? 1 : 0
      };
    }
  }
}

export type ConstructOutcome = { constructId: ConstructId; correct: number; total: number };

// SR-R1-006: "result reports construct outcomes" - aggregate correct/total per construct across
// a set of scored items, so a learner's outcome can be reported by construct, not just overall.
export function summarizeConstructOutcomes(results: ItemScoreResult[]): ConstructOutcome[] {
  const byConstruct = new Map<ConstructId, ConstructOutcome>();
  for (const result of results) {
    const existing = byConstruct.get(result.constructId) ?? {
      constructId: result.constructId,
      correct: 0,
      total: 0
    };
    existing.total += 1;
    if (result.itemResult === "correct") existing.correct += 1;
    byConstruct.set(result.constructId, existing);
  }
  return [...byConstruct.values()];
}

// SR-R1-007: Mandatory gates.
// "Passage comprehension is not solely an average percentage."
// "Configured mandatory gate failure prevents PASS even if aggregate threshold is exceeded;
//  reason is recorded."
export type ComprehensionEvaluation = {
  aggregateScore: number;
  mandatoryGateFailed: boolean;
  failedMandatoryItemIds: string[];
  comprehensionState: "PASS" | "FAIL";
  reasonCode: "PASS" | "AGGREGATE_BELOW_THRESHOLD" | "MANDATORY_GATE_FAILED";
};

export function evaluateComprehension(
  items: AssessmentItem[],
  results: ItemScoreResult[],
  passThresholdPercent: number
): ComprehensionEvaluation {
  const resultByItemId = new Map(results.map((result) => [result.itemId, result]));

  const failedMandatoryItemIds = items
    .filter((item) => item.mandatory)
    .filter((item) => resultByItemId.get(item.itemId)?.itemResult !== "correct")
    .map((item) => item.itemId);
  const mandatoryGateFailed = failedMandatoryItemIds.length > 0;

  const correctCount = results.filter((result) => result.itemResult === "correct").length;
  const aggregateScore = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

  if (mandatoryGateFailed) {
    return {
      aggregateScore,
      mandatoryGateFailed,
      failedMandatoryItemIds,
      comprehensionState: "FAIL",
      reasonCode: "MANDATORY_GATE_FAILED"
    };
  }

  const passed = aggregateScore >= passThresholdPercent;
  return {
    aggregateScore,
    mandatoryGateFailed,
    failedMandatoryItemIds,
    comprehensionState: passed ? "PASS" : "FAIL",
    reasonCode: passed ? "PASS" : "AGGREGATE_BELOW_THRESHOLD"
  };
}
