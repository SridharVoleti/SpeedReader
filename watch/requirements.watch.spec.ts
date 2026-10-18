import { expect, test } from "@playwright/test";
import { highlight, watched, type WatchRequirement } from "./narrated-runner";

/**
 * These are observable DOMAIN-DEMONSTRATION checks, never certification of the
 * actual learner application. Assertions are preserved from the repository's
 * frozen-v2.spec.ts; requirement descriptions are authored from the authoritative
 * frozen v2.0 specification. Real-learner journeys live in learner.watch.spec.ts.
 */
const cases: Array<WatchRequirement & { verify: (page: import("@playwright/test").Page) => Promise<void> }> = [
  {
    id: "FR-001",
    title: "five Worlds, everyone starts in World 1",
    expected: "Five content-difficulty worlds exist, and every learner starts in World 1.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-001")).toHaveText(
      "1:VERY SIMPLE | 2:SIMPLE | 3:MEDIUM | 4:HARD | 5:VERY HARD; every learner starts in World 1"
      );
    }
  },
  {
    id: "FR-002",
    title: "World 2+ strategy direction",
    expected: "Worlds 2 through 5 introduce increasingly strategic reading skills, ending with purpose-directed reading.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      const text = await page.getByTestId("result-FR-002").textContent();
      expect(text).toContain("W2=skimming+scanning+keywords+locating-information-quickly");
      expect(text).toContain("W5=skimming+scanning+chunking+selective-deep-reading-by-purpose");
    }
  },
  {
    id: "FR-003",
    title: "1,500 canonical passages",
    expected: "World 1 specifies 1,500 canonical sequential passages with a 15-strand, 10-comprehension-level foundation.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-003")).toHaveText(
      "1500 sequential passages, 0 structural errors; first 150 = 15 RS x 10 P"
      );
    }
  },
  {
    id: "FR-004",
    title: "first 150 passages are 100 words, one word at a time",
    expected: "The first 150 passages are exactly 100 words and displayed one word at a time.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-004")).toHaveText(
      "P150 = 100 words, ONE_WORD_AT_A_TIME, RS15/P10; sample text errors 0; 100 single-word steps"
      );
    }
  },
  {
    id: "FR-005",
    title: "stamina staircase",
    expected: "The approved stamina staircase grows through 25-word bridges to 1,000 words at passage 1,500.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-005")).toHaveText(
      "P1=100 P151=125 P176=150 P226=200 P376=300 P1500=1000; 37 steps"
      );
    }
  },
  {
    id: "FR-006",
    title: "length increase takes precedence over a same-passage Level Up",
    expected: "A passage-length increase takes priority over a simultaneous WPM increase; only one challenge increases at a time.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-006")).toHaveText(
      "P151 at 125w 90WPM (level-up deferred=true); P161 at 125w 91WPM (level-up applied=true)"
      );
    }
  },
  {
    id: "FR-007",
    title: "AC-53R replaces AC-53",
    expected: "The obsolete 100-to-200-word jump is replaced by progressive stamina-transition validation.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-007")).toHaveText(
      "36 transitions; sample PASS; no data INSUFFICIENT_EVIDENCE; AC-53 superseded=true"
      );
    }
  },
  {
    id: "FR-008",
    title: "ten-minute initial assessment finds a sustainable starting WPM",
    expected: "A bounded 10-minute baseline assessment derives a sustainable starting reading speed using comprehension.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-008")).toHaveText(
      "limit 95 -> start 90 WPM in 10 attempts; limit 45 -> start 40 WPM; budget 600s"
      );
    }
  },
  {
    id: "FR-009",
    title: "progress is personal, never peer-compared",
    expected: "Improvement uses each learner's own history; peer rankings do not determine progress.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-009")).toHaveText(
      "learner A 40->42 (+2); learner B 110->113 (+3); peer comparison rejected=true"
      );
    }
  },
  {
    id: "FR-010",
    title: "World 1 speed ceiling",
    expected: "World 1 training never exceeds 150 words per minute; learning continues at the ceiling.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-010")).toHaveText(
      "max 150 WPM; 151 schedulable=false; clamp(180)=150; at 150 other development continues=true"
      );
    }
  },
  {
    id: "FR-011",
    title: "+1 WPM is one Level Up; other dimensions are not numbered",
    expected: "Each earned one-word-per-minute improvement counts as one Level Up; other dimensions are not numbered.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-011")).toHaveText(
      '+1 WPM = 1 Level Up; 60->75 WPM = 15 Level Ups; "You Levelled Up!"; stamina celebration numbered=false'
      );
    }
  },
  {
    id: "FR-012",
    title: "oral/News Reader signals cannot affect the WPM gate",
    expected: "Only eligible comprehension evidence controls core reading-speed progression; oral and News Reader scores do not.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-012")).toHaveText(
      "oral/news/pronunciation/confidence at 0 -> same gate evidence: true; gate sees 4 fields"
      );
    }
  },
  {
    id: "FR-013",
    title: "75% GREEN threshold, counted per passage",
    expected: "A passage at 75 percent counts as GREEN and 74.99 percent does not; decisions count passages, not averages.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-013")).toHaveText(
      "threshold 75%; 75%=GREEN; 74.99%=NOT_GREEN; [100,100,74,60,70] GREEN count=2 (average ignored)"
      );
    }
  },
  {
    id: "FR-014",
    title: "first-five rule",
    expected: "At the first five new passages at a speed, four or five GREEN results earn a Level Up; three or fewer hold.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-014")).toHaveText(
      "5/5=LEVEL_UP 4/5=LEVEL_UP 3/5=HOLD 1/5=HOLD 0/5=HOLD"
      );
    }
  },
  {
    id: "FR-015",
    title: "post-five rule",
    expected: "After the first-five window, three consecutive eligible GREEN passages are required for advancement.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-015")).toHaveText(
      "NNNNN+GGG -> 91 WPM; NNNNN+GGNGG -> 90 WPM (streak reset); NNNGGG -> 90 WPM"
      );
    }
  },
  {
    id: "FR-016",
    title: "earned WPM is never removed",
    expected: "An earned reading speed never decreases because of subsequent unsuccessful passages.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-016")).toHaveText(
      "12 NOT_GREEN passages from 90 WPM -> 90 WPM; outcomes NONE/LEVEL_UP/HOLD_AFTER_FIVE; 3 decrement rules superseded"
      );
    }
  },
  {
    id: "FR-017",
    title: "only new passages prove progress",
    expected: "Only first encounters with new canonical passages qualify as progression evidence.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-017")).toHaveText(
      "50 GREEN practice -> 90 WPM; 4 new + 3 practice -> 90 WPM; 5 new -> 91 WPM"
      );
    }
  },
  {
    id: "FR-018",
    title: "familiar practice at current WPM, pointer unchanged",
    expected: "Familiar practice uses previously completed passages at the current speed without advancing the canonical pointer.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-018")).toHaveText(
      "serve P003 at 97 WPM as FAMILIAR_PRACTICE; after 5 practice: pointer 4, WPM 97, 5 analytics rows"
      );
    }
  },
  {
    id: "FR-019",
    title: "support is invisible to the learner",
    expected: "Internal support labels are never revealed as discouraging messages to learners.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-019")).toHaveText(
      "8 internal states -> learner copy; violations in shown copy: 0; \"struggling\" flagged=true"
      );
    }
  },
  {
    id: "FR-020",
    title: "hybrid comprehension evidence",
    expected: "Structured questions and spoken explanation are combined under separately recorded evidence and approved weights.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-020")).toHaveText(
      "structured 4 items stored separately from spoken; weights 0.7/0.3 (calibration-2026-10-pilot-1); one result; without spoken: AWAITING_SPOKEN_EVIDENCE"
      );
    }
  },
  {
    id: "FR-021",
    title: "weighting lifecycle",
    expected: "Only approved calibration weights may be used; frozen threshold values cannot be silently modified.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-021")).toHaveText(
      "70/30 ok; 65/35 ok; 50/50 rejected; 100/0 rejected; GREEN threshold stays 75%"
      );
    }
  },
  {
    id: "FR-022",
    title: "structured questions aligned to P1-P10",
    expected: "Structured questions align to P1 through P10 comprehension levels with deterministic scoring.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-022")).toHaveText(
      "10 types P1=DIRECT_RECALL P10=MIXED_MASTERY; items q1:DIRECT_RECALL=1,q2:SIMPLE_INFERENCE=0; deterministic=true"
      );
    }
  },
  {
    id: "FR-023",
    title: "spoken expression rewards meaning, not vocabulary or accent",
    expected: "Oral explanation is evaluated for understood meaning rather than accent or elaborate vocabulary.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-023")).toHaveText(
      "retelling covers 6/6 ideas (strong=true); fancy vocabulary adds nothing=true; dialect keeps coverage=true; unrelated covers 0/6"
      );
    }
  },
  {
    id: "FR-024",
    title: "ASR uncertainty is never learner error",
    expected: "Uncertain speech recognition is technical uncertainty, never a learner comprehension failure.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-024")).toHaveText(
      "low confidence -> UNRESOLVED_TECHNICAL (ASR_LOW_CONFIDENCE); silence -> NO_SPEECH_DETECTED; comprehension AWAITING_SPOKEN_EVIDENCE, classification null; retries 0/1/2 -> RETRY/RETRY/CONTINUE_WITHOUT_PROGRESSION_EVIDENCE"
      );
    }
  },
  {
    id: "FR-025",
    title: "Best Possible Comprehension only after scoring",
    expected: "Best Possible Comprehension becomes available only after submission and completed scoring.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-025")).toHaveText(
      "before submit NOT_SUBMITTED; after submit SCORING_NOT_LOCKED; locked GREEN available=true; locked NOT_GREEN available=true"
      );
    }
  },
  {
    id: "FR-026",
    title: "BPC is a story-style explanation",
    expected: "Best Possible Comprehension explains the story naturally rather than copying a passage or answer key.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-026")).toHaveText(
      "story-style explanation findings: 0; passage copied back: rejected; answer key: rejected"
      );
    }
  },
  {
    id: "FR-027",
    title: "BPC never invents unsupported content",
    expected: "Best Possible Comprehension remains faithful to supplied facts and never invents unsupported details.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-027")).toHaveText(
      "faithful explanation supported=true; invented motive flagged: loved; invented facts flagged: brought,ladder,dog,yesterday"
      );
    }
  },
  {
    id: "FR-028",
    title: "expression and BPC are permanent across Worlds",
    expected: "Explanation and Best Possible Comprehension features remain present throughout all five worlds.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-028")).toHaveText(
      "both features active in 5/5 Worlds; sophistication 1<2<3<4<5; W1 focus: 5 expectations; W4 includes arguments"
      );
    }
  },
  {
    id: "FR-029",
    title: "numeric comprehension is private",
    expected: "The learner interface never reveals private numeric comprehension or internal GREEN / FAIL states.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-029")).toHaveText(
      "3 passages shown to learner with 0 numeric/state leaks; internal score kept (0.75); leak guard trips on score=true"
      );
    }
  },
  {
    id: "FR-030",
    title: ">=75% is a celebration",
    expected: "At 75 percent or above, provide positive appreciation, retain exact scoring internally, and count qualifying evidence.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-030")).toHaveText(
      "GREEN stored as GREEN with exact score kept=true; celebration SMALL; BPC offered=true; message mentions number=false; five GREEN -> 91 WPM (LEVEL_UP)"
      );
    }
  },
  {
    id: "FR-031",
    title: "below 75% remains positive",
    expected: "Below 75 percent, preserve the exact result internally while giving neutral, encouraging feedback.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-031")).toHaveText(
      "below-75 stored as NOT_GREEN (exact score kept=true); celebration NONE; BPC offered=true; digits/failure words shown=false; 8 low passages keep 90 WPM"
      );
    }
  },
  {
    id: "FR-032",
    title: "Level Up is celebrated more than a GREEN passage",
    expected: "A validated Level Up receives a larger celebration than a single successful passage.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-032")).toHaveText(
      "single GREEN celebration SMALL; Level Up celebration LARGE (\"You Levelled Up!\"), new WPM 91; larger=true"
      );
    }
  },
  {
    id: "FR-033",
    title: "book-time impact on Level Up",
    expected: "Each Level Up shows an approximate time-saving estimate for a 50,000-word reference book.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-033")).toHaveText(
      "90->91 WPM: 50,000-word book 9 hours 9 minutes, saves about 6 minutes; since baseline about 4 hours 44 minutes; wording estimated+about=true; shown on Level Up=true"
      );
    }
  },
  {
    id: "FR-034",
    title: "News Reader is a separate parallel track",
    expected: "News Reader is a parallel activity whose oral performance does not gate core WPM.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-034")).toHaveText(
      "9 oral purposes; gates core=false; 5 zero-score News Reader attempts stored (5) and core stays 90 WPM with 0 evidence; mic unavailable stored as MIC_UNAVAILABLE"
      );
    }
  },
  {
    id: "FR-035",
    title: "News Reader is independent of core progression",
    expected: "News Reader outcomes never change core passage progression or earned reading speed.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-035")).toHaveText(
      "five GREEN passages -> WPM@pointer: no News Reader 91@6; worst oral 91@6; best oral 91@6; identical=true"
      );
    }
  },
  {
    id: "FR-036",
    title: "shared content, separate state",
    expected: "Core reading and News Reader can share text but never interchange their result records.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-036")).toHaveText(
      "P001 shared: 1 comprehension record(s), 3 oral record(s); oral counted as comprehension: no; substitution refused=true"
      );
    }
  },
  {
    id: "FR-037",
    title: "reference delivery: pre-generated audio, else TTS at 145 WPM female",
    expected: "Reference news-reading audio selects approved pre-generated speech or a defined text-to-speech fallback.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-037")).toHaveText(
      "7 reference qualities; 4 platforms resolve 1 identical asset; device TTS asset rejected=true; no asset -> TTS 145 WPM female=true"
      );
    }
  },
  {
    id: "FR-038",
    title: "oral two-read coaching",
    expected: "Two-read oral coaching records each read independently and compares improvement without punishment.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-038")).toHaveText(
      "reads stored independently; delta 0.3 improved=true; lower second read improved=false; both framed as practice=true; punishing words=false"
      );
    }
  },
  {
    id: "FR-039",
    title: "oral-as-core-gate is superseded",
    expected: "Superseded rules cannot make oral reading a mandatory core promotion gate.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-039")).toHaveText(
      "14 superseded rules recorded; core WPM gates: COMPREHENSION; oral gates rejected 3/3; comprehension-only gate list accepted=true; SUP-03 \"News Reader is a parallel oral communication track\""
      );
    }
  },
  {
    id: "FR-040",
    title: "passage 1500 alone does not prove mastery",
    expected: "Finishing all 1,500 passages does not itself prove World 1 readiness.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-040")).toHaveText(
      "P1500 done without readiness: SEQUENCE_COMPLETE_READINESS_PENDING; 14/15 ready: SEQUENCE_COMPLETE_READINESS_PENDING (missing RS15); 15/15 ready: WORLD1_COMPLETE; ready but P900: IN_PROGRESS"
      );
    }
  },
  {
    id: "FR-041",
    title: "150 WPM is not mandatory",
    expected: "A learner can complete World 1 without reaching the 150 WPM ceiling when readiness is proven.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-041")).toHaveText(
      "completes at 60 WPM=WORLD1_COMPLETE; at 90 WPM=WORLD1_COMPLETE; at 149 WPM=WORLD1_COMPLETE; at 150 WPM=WORLD1_COMPLETE; 150 WPM but readiness missing=SEQUENCE_COMPLETE_READINESS_PENDING; ceiling is a requirement=false"
      );
    }
  },
  {
    id: "FR-042",
    title: "Level Ups do not substitute for readiness",
    expected: "Personal WPM Level Ups are not substitutes for independent readiness evidence.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-042")).toHaveText(
      "12 Level Ups earned (60->72 WPM); readiness missing 15/15; World 1 status with 12 Level Ups but no readiness: SEQUENCE_COMPLETE_READINESS_PENDING"
      );
    }
  },
  {
    id: "FR-043",
    title: "News Reader does not block World progression",
    expected: "Weak News Reader performance cannot block otherwise qualified core World 1 progression.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-043")).toHaveText(
      "ready + no News Reader: advance to World 2; ready + worst oral: advance to World 2; ready + mic unavailable: advance to World 2; not ready + perfect oral: hold (SEQUENCE_COMPLETE_READINESS_PENDING)"
      );
    }
  },
  {
    id: "FR-044",
    title: "readiness-critical forms are pre-approved",
    expected: "Readiness-critical checks use independently approved equivalent forms and reject version mismatches.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-044")).toHaveText(
      "approved form: accepted; runtime-generated id: UNKNOWN_FORM; version mismatch: FORM_VERSION_MISMATCH; unapproved form: FORM_NOT_APPROVED; next unused equivalent after A: RS03-B"
      );
    }
  },
  {
    id: "FR-045",
    title: "readiness evidence recency",
    expected: "Readiness evidence must remain recent; expired competency evidence requires reassessment.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-045")).toHaveText(
      "recent evidence current=true; 21-month-old current=false; 500 sessions later current=false; policy PROVISIONAL_PILOT v=recency-2026-10-pilot-1; one stale competency -> SEQUENCE_COMPLETE_READINESS_PENDING (missing RS06)"
      );
    }
  },
  {
    id: "FR-046",
    title: "threshold lifecycle governance",
    expected: "Thresholds follow the registered governance lifecycle, distinguishing frozen and calibratable settings.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-046")).toHaveText(
      "4 states; 6 frozen + 10 calibratable thresholds; change ASR confidence: allowed; change 75% GREEN threshold: blocked; PROVISIONAL->APPROVED directly: blocked"
      );
    }
  },
  {
    id: "FR-047",
    title: "attempt records carry every required field",
    expected: "Every attempt records its type, timing, content, evidence, decisions, and rule versions.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-047")).toHaveText(
      "5 frozen records; last: NEW_PROGRESSION P005 @90WPM 100w, spoken SCORED, Level-Up 90->91 (LEVEL_UP), 6 rule versions; types 5; News Reader record with comprehension rejected=true"
      );
    }
  },
  {
    id: "FR-048",
    title: "evidence separation guards",
    expected: "Practice, oral attempts, edited answers, and technical retries cannot contaminate first-attempt evidence.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-048")).toHaveText(
      "edit after model answer blocked=true; technical retry stored as failure=false; original record kept (a1 score 0.6) while effective view uses a1-corrected; original frozen=true"
      );
    }
  },
  {
    id: "FR-049",
    title: "Level Up and HOLD decisions are explainable",
    expected: "Each Level Up or HOLD can be reconstructed and explained from a stored decision ledger.",
    scope: "DOMAIN DEMONSTRATION",
    verify: async (page) => {
      await expect(page.getByTestId("result-FR-049")).toHaveText(
      "LEVEL_UP: first_five_green_count=4/5; HOLD: first_five_green_count=3/5; LEVEL_UP: post_five_consecutive_green=3; replay consistent with stored state=true"
      );
    }
  },
];

for (const [index, requirement] of cases.entries()) {
  requirement.chapter = `Requirement ${index + 1} of ${cases.length}`;
  test(`[DOMAIN] ${requirement.id} ${requirement.title}`, async ({ page }) => {
    await watched(page, requirement, async () => {
      await page.goto("/frozen-v2-demo");
      const result = page.getByTestId(`result-${requirement.id}`);
      await expect(result).toBeVisible();
      await highlight(page, result, "Comparing the demonstrated result with the frozen specification.", requirement);
      await requirement.verify(page);
    });
  });
}
