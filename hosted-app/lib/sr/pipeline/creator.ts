// SR-014.. - Role-specific creator prompts and the creator-side output check (complete, bounded,
// provenance recorded, WIP-only, no self-certification).

import { roleById, type RoleId } from "./roles";
import { specFor } from "./role-specs";
import { DEFECT_RECORD_PROMPT } from "./defects";

export type Envelope = {
  role: RoleId;
  artifactType: string;
  status: "WIP";
  location: string;
  provenance?: { role: RoleId; inputs: { role: RoleId; hash: string }[]; createdAt: string; creator: string };
  payload: Record<string, unknown>;
};

export function buildCreatorPrompt(id: RoleId): string {
  const r = roleById(id);
  const spec = specFor(id);
  return [
    `You are Role ${r.id}: ${r.name}.`,
    `You produce ONLY the ${r.owns} artifact with exactly these fields: ${spec.fields.join(", ")}.`,
    r.upstream.length ? `Inputs must be QA-approved artifacts from Roles ${r.upstream.join(", ")}; never read WIP as authoritative.` : "You have no upstream inputs.",
    "Store output as WIP under pipeline/wip and record provenance (role, input hashes, createdAt, creator).",
    "Run your self-check, then hand off. Do not certify or self-certify your own output; an independent QA decides.",
    DEFECT_RECORD_PROMPT
  ].join("\n");
}

export function checkCreatorOutput(id: RoleId, a: Envelope, approvedInputs: { role: RoleId; hash: string }[]) {
  const r = roleById(id);
  const spec = specFor(id);
  const problems: string[] = [];
  if (a.role !== id || a.artifactType !== r.owns) problems.push(`not a role ${id} ${r.owns} artifact`);
  for (const f of spec.fields) if (!(f in (a.payload ?? {}))) problems.push(`missing field ${f}`);
  for (const k of Object.keys(a.payload ?? {})) if (!spec.fields.includes(k)) problems.push(`unexpected field ${k} (outside owned artifact)`);
  if (!a.provenance) problems.push("provenance not recorded");
  else for (const u of r.upstream) {
    const want = approvedInputs.find((i) => i.role === u)?.hash;
    if (!a.provenance.inputs.some((i) => i.role === u && i.hash === want)) problems.push(`provenance lacks approved input from role ${u}`);
  }
  if (!/(^|[\/])wip[\/]/.test(a.location ?? "")) problems.push("output must be stored as WIP under pipeline/wip");
  if (Object.keys(a).some((k) => /^qa|verdict|approved/i.test(k))) problems.push("self-certification fields present");
  return { ok: problems.length === 0, problems };
}
