// SR-030 - The common defect record used by every creator and QA prompt. QA routes a defect directly to
// the originating owner (not merely the preceding role) and lists the descendants it affects.

export const DEFECT_FIELDS = ["defect_id", "violated_rule", "evidence", "owner_role", "return_to_role", "affected_dependencies"] as const;

export const DEFECT_RECORD_PROMPT = [
  "Defect record (use exactly these fields for every defect):",
  ...DEFECT_FIELDS.map((f) => `- ${f}`),
  "Route each defect directly to the originating owner_role (return_to_role), even when that is not the immediately preceding role."
].join("\n");
