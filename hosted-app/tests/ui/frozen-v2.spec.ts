import { expect, test } from "@playwright/test";

// v2.0 Final Frozen Requirements - one assertion block per implemented FR.
test("FR-001 five Worlds, everyone starts in World 1", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-001")).toHaveText(
    "1:VERY SIMPLE | 2:SIMPLE | 3:MEDIUM | 4:HARD | 5:VERY HARD; every learner starts in World 1"
  );
});

test("FR-002 World 2+ strategy direction", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  const text = await page.getByTestId("result-FR-002").textContent();
  expect(text).toContain("W2=skimming+scanning+keywords+locating-information-quickly");
  expect(text).toContain("W5=skimming+scanning+chunking+selective-deep-reading-by-purpose");
});

test("FR-003 1,500 canonical passages", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-003")).toHaveText(
    "1500 sequential passages, 0 structural errors; first 150 = 15 RS x 10 P"
  );
});

test("FR-004 first 150 passages are 100 words, one word at a time", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-004")).toHaveText(
    "P150 = 100 words, ONE_WORD_AT_A_TIME, RS15/P10; sample text errors 0; 100 single-word steps"
  );
});

test("FR-005 stamina staircase", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-005")).toHaveText(
    "P1=100 P151=125 P176=150 P226=200 P376=300 P1500=1000; 37 steps"
  );
});

test("FR-006 length increase takes precedence over a same-passage Level Up", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-006")).toHaveText(
    "P151 at 125w 90WPM (level-up deferred=true); P161 at 125w 91WPM (level-up applied=true)"
  );
});

test("FR-007 AC-53R replaces AC-53", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-007")).toHaveText(
    "36 transitions; sample PASS; no data INSUFFICIENT_EVIDENCE; AC-53 superseded=true"
  );
});

test("FR-008 ten-minute initial assessment finds a sustainable starting WPM", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-008")).toHaveText(
    "limit 95 -> start 90 WPM in 10 attempts; limit 45 -> start 40 WPM; budget 600s"
  );
});

test("FR-009 progress is personal, never peer-compared", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-009")).toHaveText(
    "learner A 40->42 (+2); learner B 110->113 (+3); peer comparison rejected=true"
  );
});

test("FR-010 World 1 speed ceiling", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-010")).toHaveText(
    "max 150 WPM; 151 schedulable=false; clamp(180)=150; at 150 other development continues=true"
  );
});

test("FR-011 +1 WPM is one Level Up; other dimensions are not numbered", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-011")).toHaveText(
    '+1 WPM = 1 Level Up; 60->75 WPM = 15 Level Ups; "You Levelled Up!"; stamina celebration numbered=false'
  );
});

test("FR-012 oral/News Reader signals cannot affect the WPM gate", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-012")).toHaveText(
    "oral/news/pronunciation/confidence at 0 -> same gate evidence: true; gate sees 4 fields"
  );
});

test("FR-013 75% GREEN threshold, counted per passage", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-013")).toHaveText(
    "threshold 75%; 75%=GREEN; 74.99%=NOT_GREEN; [100,100,74,60,70] GREEN count=2 (average ignored)"
  );
});

test("FR-014 first-five rule", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-014")).toHaveText(
    "5/5=LEVEL_UP 4/5=LEVEL_UP 3/5=HOLD 1/5=HOLD 0/5=HOLD"
  );
});

test("FR-015 post-five rule", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-015")).toHaveText(
    "NNNNN+GGG -> 91 WPM; NNNNN+GGNGG -> 90 WPM (streak reset); NNNGGG -> 90 WPM"
  );
});

test("FR-016 earned WPM is never removed", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-016")).toHaveText(
    "12 NOT_GREEN passages from 90 WPM -> 90 WPM; outcomes NONE/LEVEL_UP/HOLD_AFTER_FIVE; 3 decrement rules superseded"
  );
});

test("FR-017 only new passages prove progress", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-017")).toHaveText(
    "50 GREEN practice -> 90 WPM; 4 new + 3 practice -> 90 WPM; 5 new -> 91 WPM"
  );
});

test("FR-018 familiar practice at current WPM, pointer unchanged", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-018")).toHaveText(
    "serve P003 at 97 WPM as FAMILIAR_PRACTICE; after 5 practice: pointer 4, WPM 97, 5 analytics rows"
  );
});

test("FR-019 support is invisible to the learner", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-019")).toHaveText(
    "8 internal states -> learner copy; violations in shown copy: 0; \"struggling\" flagged=true"
  );
});

test("FR-020 hybrid comprehension evidence", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-020")).toHaveText(
    "structured 4 items stored separately from spoken; weights 0.7/0.3 (calibration-2026-10-pilot-1); one result; without spoken: AWAITING_SPOKEN_EVIDENCE"
  );
});

test("FR-021 weighting lifecycle", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-021")).toHaveText(
    "70/30 ok; 65/35 ok; 50/50 rejected; 100/0 rejected; GREEN threshold stays 75%"
  );
});

test("FR-022 structured questions aligned to P1-P10", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-022")).toHaveText(
    "10 types P1=DIRECT_RECALL P10=MIXED_MASTERY; items q1:DIRECT_RECALL=1,q2:SIMPLE_INFERENCE=0; deterministic=true"
  );
});

test("FR-023 spoken expression rewards meaning, not vocabulary or accent", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-023")).toHaveText(
    "retelling covers 6/6 ideas (strong=true); fancy vocabulary adds nothing=true; dialect keeps coverage=true; unrelated covers 0/6"
  );
});

test("FR-024 ASR uncertainty is never learner error", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-024")).toHaveText(
    "low confidence -> UNRESOLVED_TECHNICAL (ASR_LOW_CONFIDENCE); silence -> NO_SPEECH_DETECTED; comprehension AWAITING_SPOKEN_EVIDENCE, classification null; retries 0/1/2 -> RETRY/RETRY/CONTINUE_WITHOUT_PROGRESSION_EVIDENCE"
  );
});

test("FR-025 Best Possible Comprehension only after scoring", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-025")).toHaveText(
    "before submit NOT_SUBMITTED; after submit SCORING_NOT_LOCKED; locked GREEN available=true; locked NOT_GREEN available=true"
  );
});

test("FR-026 BPC is a story-style explanation", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-026")).toHaveText(
    "story-style explanation findings: 0; passage copied back: rejected; answer key: rejected"
  );
});

test("FR-027 BPC never invents unsupported content", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-027")).toHaveText(
    "faithful explanation supported=true; invented motive flagged: loved; invented facts flagged: brought,ladder,dog,yesterday"
  );
});

test("FR-028 expression and BPC are permanent across Worlds", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-028")).toHaveText(
    "both features active in 5/5 Worlds; sophistication 1<2<3<4<5; W1 focus: 5 expectations; W4 includes arguments"
  );
});

test("FR-029 numeric comprehension is private", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-029")).toHaveText(
    "3 passages shown to learner with 0 numeric/state leaks; internal score kept (0.75); leak guard trips on score=true"
  );
});

test("FR-030 >=75% is a celebration", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-030")).toHaveText(
    "GREEN stored as GREEN with exact score kept=true; celebration SMALL; BPC offered=true; message mentions number=false; five GREEN -> 91 WPM (LEVEL_UP)"
  );
});

test("FR-031 below 75% remains positive", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-031")).toHaveText(
    "below-75 stored as NOT_GREEN (exact score kept=true); celebration NONE; BPC offered=true; digits/failure words shown=false; 8 low passages keep 90 WPM"
  );
});

test("FR-032 Level Up is celebrated more than a GREEN passage", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-032")).toHaveText(
    "single GREEN celebration SMALL; Level Up celebration LARGE (\"You Levelled Up!\"), new WPM 91; larger=true"
  );
});

test("FR-033 book-time impact on Level Up", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-033")).toHaveText(
    "90->91 WPM: 50,000-word book 9 hours 9 minutes, saves about 6 minutes; since baseline about 4 hours 44 minutes; wording estimated+about=true; shown on Level Up=true"
  );
});

test("FR-034 News Reader is a separate parallel track", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-034")).toHaveText(
    "9 oral purposes; gates core=false; 5 zero-score News Reader attempts stored (5) and core stays 90 WPM with 0 evidence; mic unavailable stored as MIC_UNAVAILABLE"
  );
});

test("FR-035 News Reader is independent of core progression", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-035")).toHaveText(
    "five GREEN passages -> WPM@pointer: no News Reader 91@6; worst oral 91@6; best oral 91@6; identical=true"
  );
});

test("FR-036 shared content, separate state", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-036")).toHaveText(
    "P001 shared: 1 comprehension record(s), 3 oral record(s); oral counted as comprehension: no; substitution refused=true"
  );
});

test("FR-037 canonical pre-generated reference audio", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-037")).toHaveText(
    "7 reference qualities; 4 platforms resolve 1 identical asset; device TTS reference rejected=true"
  );
});

test("FR-038 oral two-read coaching", async ({ page }) => {
  await page.goto("/frozen-v2-demo");
  await expect(page.getByTestId("result-FR-038")).toHaveText(
    "reads stored independently; delta 0.3 improved=true; lower second read improved=false; both framed as practice=true; punishing words=false"
  );
});
