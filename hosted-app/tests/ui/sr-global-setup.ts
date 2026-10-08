import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { seedApprovedPackage } from "../fixtures/real-package";

// Builds the approved package set the app serves during e2e runs, using the real store + final-QA publish path.
export default function globalSetup() {
  const base = resolve(__dirname, "../../../.sr-e2e");
  rmSync(base, { recursive: true, force: true });
  seedApprovedPackage(base);
}
