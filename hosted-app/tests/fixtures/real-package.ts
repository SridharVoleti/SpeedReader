// A realistic approved-package fixture built through the REAL pipeline code (store -> QA-approved role artifacts ->
// publishPackage final gate -> promotion). Used by the vitest integration tests and by the Playwright global setup.
// The story is the existing Level 1 passage; the structure follows the canonical package schema.

import { join } from "node:path";
import { createStore } from "../../lib/sr/pipeline/storage";
import { canonicalHash } from "../../lib/sr/pipeline/hash";
import { publishPackage, wipPackagePath } from "../../lib/sr/pipeline/publish";

export const REAL_PASSAGE_ID = "W1-0001";
export const REAL_PACKAGE_ID = `PKG-${REAL_PASSAGE_ID}`;

const text =
  "Ravi visited a small shop near his home after school. He bought a pencil, a notebook, and a packet of biscuits. " +
  "The shopkeeper was busy helping another customer and gave Ravi extra change by mistake. Ravi counted the money outside the shop and noticed the mistake. " +
  "He went back immediately and returned the extra coins. The shopkeeper smiled and thanked him for being honest. " +
  "Ravi felt proud because he had done the right thing even when nobody was watching.";
const wordCount = text.trim().split(/\s+/).length;

export const realPayloads = (): Record<number, Record<string, unknown>> => ({
  1: { passageId: REAL_PASSAGE_ID, sequence: 1, rsId: "RS01", pId: "P01", targetWords: wordCount, complexity: { maxSentenceWords: 14, vocabularyBand: "A", maxClausesPerSentence: 2 } },
  2: { passageId: REAL_PASSAGE_ID, text, wordCount },
  3: {
    passageId: REAL_PASSAGE_ID,
    items: [
      { itemId: "I1", stem: "What did Ravi buy?", options: ["A pencil, a notebook and biscuits", "A bag and a bottle", "Only sweets"], answerIndex: 0, primary: true, evidence: { quote: "He bought a pencil, a notebook, and a packet of biscuits." } },
      { itemId: "I2", stem: "Why did the shopkeeper give extra change?", options: ["He was busy and made a mistake", "He wanted Ravi to leave", "Ravi asked for it"], answerIndex: 0, primary: false, evidence: { quote: "gave Ravi extra change by mistake" } },
      { itemId: "I3", stem: "What did Ravi do after counting the money?", options: ["Went back and returned the extra coins", "Spent it", "Hid it"], answerIndex: 0, primary: false, evidence: { quote: "He went back immediately and returned the extra coins." } },
      { itemId: "I4", stem: "How did Ravi feel at the end?", options: ["Proud", "Angry", "Afraid"], answerIndex: 0, primary: false, evidence: { quote: "Ravi felt proud" } }
    ]
  },
  4: {
    passageId: REAL_PASSAGE_ID,
    units: [
      { muId: "MU1", text: "Ravi bought a pencil, a notebook, and a packet of biscuits", factIds: ["F1"], evidence: { sentences: [2] } },
      { muId: "MU2", text: "The shopkeeper gave Ravi extra change by mistake", factIds: ["F2"], evidence: { sentences: [3] } },
      { muId: "MU3", text: "Ravi returned the extra coins", factIds: ["F3"], evidence: { sentences: [5] } },
      { muId: "MU4", text: "Ravi felt proud because he had done the right thing", factIds: ["F4"], evidence: { sentences: [7] } }
    ]
  },
  5: { passageId: REAL_PASSAGE_ID, text: "Ravi bought some things from a shop. The shopkeeper gave him too much change by mistake. Ravi went back and returned the extra coins, and he felt proud.", factIds: ["F1", "F2", "F3", "F4"] },
  6: { passageId: REAL_PASSAGE_ID, ruleId: "P10_FIRST_ATTEMPT_3_OF_4_PRIMARY", primaryItemId: "I1", itemPoints: { I1: 25, I2: 25, I3: 25, I4: 25 } },
  7: {
    passageId: REAL_PASSAGE_ID,
    outcomes: [
      { state: "PASS", nextAction: "CONTINUE_NEXT_PASSAGE", oralReady: true, comprehensionReady: true },
      { state: "FAIL", nextAction: "CONTINUE_NEXT_PASSAGE", oralReady: false, comprehensionReady: false }
    ]
  }
});

/** Build and publish the package into `<base>/approved` through the real pipeline. Returns the roots to configure the app with. */
export function seedApprovedPackage(base: string) {
  const store = createStore({ wipRoot: join(base, "wip"), approvedRoot: join(base, "approved"), qaActors: ["qa-agent"] });
  const payloads = realPayloads();
  for (let role = 1; role <= 7; role++) {
    const wip = join(store.roots.wip, `role${role}`, `${REAL_PASSAGE_ID}.json`);
    store.writeWip(wip, JSON.stringify(payloads[role]));
    store.approve({ actor: "qa-agent", verdict: "PASS", wipPath: wip, hash: canonicalHash(payloads[role]) });
  }
  const section = (r: number) => payloads[r];
  const pkg = {
    schemaVersion: "1.0", packageId: REAL_PACKAGE_ID, passageId: REAL_PASSAGE_ID, packageVersion: 1,
    spec: section(1), passage: section(2), assessment: section(3), meaningUnits: section(4), bpc: section(5), scoring: section(6), attemptContract: section(7),
    lock: { roleHashes: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((r) => [String(r), canonicalHash(payloads[r])])) }
  };
  store.writeWip(wipPackagePath(store, REAL_PACKAGE_ID), JSON.stringify(pkg));
  const result = publishPackage(store, { packageId: REAL_PACKAGE_ID, actor: "qa-agent", expectedPackageVersion: 1 });
  if (!result.promoted) throw new Error(`seed publish failed: ${result.reason}: ${result.problems.join("; ")}`);
  return { store, roots: { wip: store.roots.wip, approved: store.roots.approved }, packageId: REAL_PACKAGE_ID };
}
