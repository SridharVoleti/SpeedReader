import { expect, test } from "@playwright/test";
import { highlight, watched, type WatchRequirement } from "./narrated-runner";

// Architecture controls from the frozen v2 domain demonstration.
// These DO NOT replace the independent implementation or release QA gates.
const controls: Array<WatchRequirement & { verify: (page: import("@playwright/test").Page) => Promise<void> }> = [
  {
    id: "AC-C01",
    title: "stale-rule scan",
    expected: "Obsolete, superseded rules are detected rather than silently reintroduced.",
    scope: "DOMAIN DEMONSTRATION",
    chapter: "Architecture control 1 of 5",
    verify: async (page) => {
      await expect(page.getByTestId("result-AC-C01")).toHaveText(
      "7 stale-rule patterns; detects 7/7 stale snippets; compliant code findings=0; allowlisted registry files=6"
      );
    }
  },
  {
    id: "AC-C05",
    title: "Level Up and evidence commit atomically",
    expected: "An interrupted commit does not partially apply Level Ups or evidence; retry is atomic.",
    scope: "DOMAIN DEMONSTRATION",
    chapter: "Architecture control 2 of 5",
    verify: async (page) => {
      await expect(page.getByTestId("result-AC-C05")).toHaveText(
      "failed mid-commit ok=false -> unchanged 90 WPM/4 records/v1; retry ok=true -> 91 WPM/5 records/v2; WPM/evidence disagreement rejected=true"
      );
    }
  },
  {
    id: "AC-C08",
    title: "operational observability",
    expected: "Operational events record defects without leaking internal learner states into the child interface.",
    scope: "DOMAIN DEMONSTRATION",
    chapter: "Architecture control 3 of 5",
    verify: async (page) => {
      await expect(page.getByTestId("result-AC-C08")).toHaveText(
      "7 ops event kinds; logged: LEARNER_NOT_GREEN,PRACTICE_SCHEDULING,ASR_TECHNICAL_UNCERTAINTY,CONTENT_DEFECT; technical retry logged as learner NOT_GREEN=false; learner-visible ops events=0"
      );
    }
  },
  {
    id: "AC-C06",
    title: "boundary matrix",
    expected: "Boundary cases around speed, readiness, and transitions return the approved decision.",
    scope: "DOMAIN DEMONSTRATION",
    chapter: "Architecture control 4 of 5",
    verify: async (page) => {
      await expect(page.getByTestId("result-AC-C06")).toHaveText(
      "boundary matrix 13/13 PASS; B03 91 WPM, LEVEL_UP; B09 90 WPM at pointer 151; B11 AWAITING_SPOKEN_EVIDENCE, evidence 0; B13 FORM_VERSION_MISMATCH"
      );
    }
  },
  {
    id: "AC-C03",
    title: "separate state",
    expected: "Core reading and News Reader maintain separate state and evidence.",
    scope: "DOMAIN DEMONSTRATION",
    chapter: "Architecture control 5 of 5",
    verify: async (page) => {
      await expect(page.getByTestId("result-AC-C03")).toHaveText(
      "aggregate domains: attempts,baselineWpm,canonicalPointer,core,learnerId,ledger,newsReader; generic score/level/status fields=0; News Reader state separate from core WPM state=true"
      );
    }
  },
];

for (const requirement of controls) {
  test(`[CONTROL] ${requirement.id} ${requirement.title}`, async ({ page }) => {
    await watched(page, requirement, async () => {
      await page.goto("/frozen-v2-demo");
      const result = page.getByTestId(`result-${requirement.id}`);
      await expect(result).toBeVisible();
      await highlight(page, result, "Checking the architecture control against its approved boundary assertion.", requirement);
      await requirement.verify(page);
    });
  });
}
