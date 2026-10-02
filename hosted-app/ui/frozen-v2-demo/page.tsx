"use client";

// Live-verification page for the v2.0 Final Frozen Requirements. Each implemented FR adds one
// entry below that runs the real module and renders its observable result, so the deployed
// site can be checked end to end (see hosted-app/tests/ui/frozen-v2.spec.ts).

import { startingWorld, WORLDS } from "../../lib/v2/worlds";
import { worldStrategies } from "../../lib/v2/world-strategies";
import { first150Architecture, validateWorld1Catalog, WORLD1_PASSAGE_COUNT } from "../../lib/v2/catalog";
import { foundationSpec, presentationChunks, validateFoundationPassageText } from "../../lib/v2/foundation";
import { passageWords, staircaseTable } from "../../lib/v2/stamina";
import styles from "../page.module.css";

type Check = { id: string; title: string; result: string };

const checks: Check[] = [
  {
    id: "FR-001",
    title: "Five content-difficulty Worlds",
    result: `${WORLDS.map((w) => `${w.id}:${w.difficulty}`).join(" | ")}; every learner starts in World ${startingWorld({ age: 7 }).id}`
  },
  {
    id: "FR-002",
    title: "World 2+ strategy direction",
    result: [2, 3, 4, 5].map((id) => `W${id}=${worldStrategies(id).join("+")}`).join(" | ")
  },
  {
    id: "FR-003",
    title: "1,500 canonical passages",
    result: `${WORLD1_PASSAGE_COUNT} sequential passages, ${validateWorld1Catalog(Array.from({ length: WORLD1_PASSAGE_COUNT }, (_, i) => ({ sequence: i + 1 }))).length} structural errors; first 150 = ${new Set(first150Architecture().map((c) => c.rsId)).size} RS x ${new Set(first150Architecture().map((c) => c.pLevel)).size} P`
  },
  {
    id: "FR-004",
    title: "First 150 passages",
    result: (() => {
      const sample = Array.from({ length: 100 }, (_, i) => `w${i}`).join(" ");
      const spec = foundationSpec(150);
      return `P150 = ${spec.words} words, ${spec.display}, ${spec.coordinate.rsId}/P${spec.coordinate.pLevel}; sample text errors ${validateFoundationPassageText(sample).length}; ${presentationChunks(sample).length} single-word steps`;
    })()
  },
  {
    id: "FR-005",
    title: "Stamina staircase",
    result: `P1=${passageWords(1)} P151=${passageWords(151)} P176=${passageWords(176)} P226=${passageWords(226)} P376=${passageWords(376)} P1500=${passageWords(1500)}; ${staircaseTable().length} steps`
  }
];

export default function FrozenV2Demo() {
  return (
    <main className={styles.shell}>
      <h1>Frozen requirements v2.0 - live checks</h1>
      <ul>
        {checks.map((c) => (
          <li key={c.id} data-testid={`check-${c.id}`}>
            <strong>{c.id}</strong> {c.title}: <span data-testid={`result-${c.id}`}>{c.result}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
