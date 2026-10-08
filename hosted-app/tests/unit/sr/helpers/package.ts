import { UPSTREAM, PID, words } from "./artifacts";
import { canonicalHash } from "../../../../lib/sr/pipeline/hash";

/** A final package assembled from the consistent fixture chain (Roles 1-7 payloads + lock). */
export function buildValidPackage() {
  const sections = {
    spec: UPSTREAM[1], passage: UPSTREAM[2], assessment: UPSTREAM[3], meaningUnits: UPSTREAM[4],
    bpc: UPSTREAM[5], scoring: UPSTREAM[6], attemptContract: UPSTREAM[7]
  };
  const roleHashes = Object.fromEntries(
    (["spec", "passage", "assessment", "meaningUnits", "bpc", "scoring", "attemptContract"] as const).map((k, i) => [String(i + 1), canonicalHash(sections[k])])
  );
  return {
    schemaVersion: "1.0", packageId: `PKG-${PID}`, passageId: PID, packageVersion: 1,
    ...sections,
    lock: { roleHashes }
  } as Record<string, unknown> & typeof sections & { lock: { roleHashes: Record<string, string> } };
}
export { words };
