import { expect, test } from "@playwright/test";
import { highlight, watched, type WatchRequirement } from "./narrated-runner";

// These cases validate observable domain demonstrations only.
// They MUST NOT be represented as passing end-to-end learner requirements.
const cases: Array<WatchRequirement & { match: RegExp }> = [
  { id: "FR-001", title: "Five difficulty worlds", expected: "Five worlds, all starting in World 1.", match: /1:VERY SIMPLE.*5:VERY HARD; every learner starts in World 1/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-003", title: "Canonical World 1 passage architecture", expected: "1,500 sequential passage slots with zero structural errors and 15 strands across 10 levels. This demonstrates the catalog model, not authored content availability.", match: /1500 sequential passages, 0 structural errors; first 150 = 15 RS x 10 P/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-004", title: "First 150 passage display rules", expected: "Passage 150 targets exactly 100 words, one word per step, at strand 15 and comprehension level 10.", match: /P150 = 100 words, ONE_WORD_AT_A_TIME, RS15\/P10; sample text errors 0; 100 single-word steps/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-005", title: "Stamina staircase", expected: "Passage length rises from 100 words to 1,000 words at passage 1,500.", match: /P1=100 P151=125 P176=150 P226=200 P376=300 P1500=1000; 37 steps/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-006", title: "Only one difficulty increase at a time", expected: "At passage 151, passage length increases while the WPM increase is deferred.", match: /P151 at 125w 90WPM \(level-up deferred=true\); P161 at 125w 91WPM \(level-up applied=true\)/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-008", title: "Sustainable initial reading speed", expected: "The bounded assessment selects a sustainable WPM, not a single lucky maximum.", match: /limit 95 -> start 90 WPM in 10 attempts; limit 45 -> start 40 WPM; budget 600s/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-010", title: "World 1 speed limit", expected: "Speed is capped at 150 words per minute while other learning continues.", match: /max 150 WPM; 151 schedulable=false; clamp\(180\)=150; at 150 other development continues=true/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-012", title: "Comprehension controls WPM progression", expected: "Poor oral and News Reader scores do not change the core WPM gate.", match: /oral\/news\/pronunciation\/confidence at 0 -> same gate evidence: true; gate sees 4 fields/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-013", title: "GREEN comprehension threshold", expected: "Exactly 75 percent is GREEN; 74.99 percent is not. Count eligible passages, not averages.", match: /threshold 75%; 75%=GREEN; 74\.99%=NOT_GREEN; \[100,100,74,60,70\] GREEN count=2 \(average ignored\)/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-014", title: "First-five passage rule", expected: "Four or five GREEN results out of the first five earn a Level Up; three or fewer hold.", match: /5\/5=LEVEL_UP 4\/5=LEVEL_UP 3\/5=HOLD 1\/5=HOLD 0\/5=HOLD/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-016", title: "Earned speed is never lost", expected: "Repeated NOT GREEN passages never decrease an earned reading speed.", match: /12 NOT_GREEN passages from 90 WPM -> 90 WPM/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-017", title: "Only new passages qualify for progression", expected: "Practice passages cannot create a WPM Level Up.", match: /50 GREEN practice -> 90 WPM; 4 new \+ 3 practice -> 90 WPM; 5 new -> 91 WPM/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-024", title: "Speech recognition uncertainty", expected: "Low confidence audio is a technical uncertainty, not a learner comprehension failure.", match: /low confidence -> UNRESOLVED_TECHNICAL \(ASR_LOW_CONFIDENCE\)/, scope: "DOMAIN DEMONSTRATION" },
  { id: "FR-034", title: "Independent News Reader track", expected: "News Reader attempts never become core comprehension evidence.", match: /gates core=false/, scope: "DOMAIN DEMONSTRATION" }
];

for (const req of cases) {
  test(`[DOMAIN] ${req.id} ${req.title}`, async ({ page }) => {
    await watched(page, req, async () => {
      await page.goto("/frozen-v2-demo");
      const output = page.getByTestId(`result-${req.id}`);
      await expect(output).toBeVisible();
      await highlight(page, output, "Inspecting the live domain-model result.", req);
      await expect(output).toHaveText(req.match);
    });
  });
}
