// SR-R1-003: Approved-file-only content.
// Learner content may only come from versioned, approved files. Anything missing an approval
// status, a content/schema version, or carrying an unsupported schema version is blocked before
// it can ever reach a learner, and the block is logged as CONTENT_INVALID rather than silently
// dropped.

export const CONTENT_SCHEMA_VERSION = "1.0";

export type ApprovalStatus = "WIP" | "APPROVED" | "RETIRED";

export type ContentFile = {
  content_id: string;
  content_version: string;
  schema_version: string;
  approval_status: ApprovalStatus;
};

export type ContentGateResult<T> =
  | { valid: true; content: T }
  | { valid: false; reasonCode: "CONTENT_INVALID"; contentId: string | undefined; reasons: string[] };

export function gateContent<T extends Partial<ContentFile>>(raw: T): ContentGateResult<T> {
  const reasons: string[] = [];

  if (!raw.content_id) reasons.push("missing content_id");
  if (!raw.content_version) reasons.push("missing content_version");
  if (!raw.schema_version) {
    reasons.push("missing schema_version");
  } else if (raw.schema_version !== CONTENT_SCHEMA_VERSION) {
    reasons.push(`unsupported schema_version "${raw.schema_version}"`);
  }
  if (!raw.approval_status) {
    reasons.push("missing approval_status");
  } else if (raw.approval_status !== "APPROVED") {
    reasons.push(`content not approved (approval_status="${raw.approval_status}")`);
  }

  if (reasons.length > 0) {
    return { valid: false, reasonCode: "CONTENT_INVALID", contentId: raw.content_id, reasons };
  }
  return { valid: true, content: raw };
}

export function loadApprovedContent<T extends Partial<ContentFile>>(
  rawItems: T[],
  onInvalid: (result: Extract<ContentGateResult<T>, { valid: false }>) => void = (result) =>
    console.error("CONTENT_INVALID", result)
): T[] {
  const approved: T[] = [];
  for (const raw of rawItems) {
    const result = gateContent(raw);
    if (result.valid) {
      approved.push(result.content);
    } else {
      onInvalid(result);
    }
  }
  return approved;
}
