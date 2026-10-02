import { describe, expect, it } from "vitest";
import { selectTransferEvidence, TransferCandidateContent } from "../../lib/retention";

// SR-R8-003: Unfamiliar-content transfer.
// "Advanced evidence includes independent content outside recently trained patterns."
// "Near-duplicate/recently trained form cannot satisfy transfer requirement."
describe("selectTransferEvidence", () => {
  it("selects content whose topic family was not recently trained", () => {
    const candidates: TransferCandidateContent[] = [
      { contentId: "passage-trained-1", topicFamily: "animals" },
      { contentId: "passage-novel-1", topicFamily: "space" }
    ];

    const result = selectTransferEvidence(candidates, ["animals"]);

    expect(result.contentId).toBe("passage-novel-1");
    expect(result.reasonCode).toBe("TRANSFER_ELIGIBLE_space");
  });

  it("a near-duplicate/recently trained form cannot satisfy the transfer requirement even if it's the only candidate", () => {
    const candidates: TransferCandidateContent[] = [{ contentId: "passage-trained-1", topicFamily: "animals" }];

    const result = selectTransferEvidence(candidates, ["animals"]);

    expect(result.contentId).toBeNull();
    expect(result.reasonCode).toBe("NO_TRANSFER_ELIGIBLE_CONTENT");
  });

  it("returns no eligible content when the candidate pool is empty", () => {
    const result = selectTransferEvidence([], []);

    expect(result.contentId).toBeNull();
    expect(result.reasonCode).toBe("NO_TRANSFER_ELIGIBLE_CONTENT");
  });

  it("selects freely among candidates when nothing has been recently trained", () => {
    const candidates: TransferCandidateContent[] = [{ contentId: "passage-any-1", topicFamily: "animals" }];

    const result = selectTransferEvidence(candidates, []);

    expect(result.contentId).toBe("passage-any-1");
    expect(result.reasonCode).toBe("TRANSFER_ELIGIBLE_animals");
  });

  it("is deterministic for identical inputs", () => {
    const candidates: TransferCandidateContent[] = [
      { contentId: "passage-trained-1", topicFamily: "animals" },
      { contentId: "passage-novel-1", topicFamily: "space" }
    ];

    expect(selectTransferEvidence(candidates, ["animals"])).toEqual(selectTransferEvidence(candidates, ["animals"]));
  });
});
