# SpeedReader — Final Frozen Product Requirements, Codex Instructions & Acceptance Criteria

**Version:** 2.0  
**Status:** FINAL / FROZEN PRODUCT ARCHITECTURE  
**Date:** 02 October 2026  
**Scope:** SpeedReader World 1 product behaviour, adaptive progression, comprehension, stamina, News Reader parallel track, implementation governance, and integration with the approved World 1 Band A Knowledge Map.

---

## 1. Purpose and authority

This document is the implementation contract for SpeedReader World 1.

It consolidates:
1. the already-approved **World 1 Band A Knowledge Map Acceptance Criteria** for the first 150 passages;
2. the subsequently frozen adaptive-learning and product decisions;
3. explicit supersession rules where later product decisions intentionally replace earlier assumptions; and
4. executable instructions and acceptance criteria for Codex/developers and independent QA.

The approved Knowledge Map is **not reopened** by this document. Where this document explicitly marks an older rule as **SUPERSEDED**, the replacement rule below has precedence for product implementation.

### 1.1 Normative precedence

If requirements appear to conflict, use this precedence:

1. **This v2.0 document — explicit FROZEN replacement/supersession rules**
2. **Approved World 1 Band A Knowledge Map Acceptance Criteria**
3. **Approved, version-locked implementation artifacts referenced by the Knowledge Map**
4. Older adaptive-engine drafts, spreadsheets, chat summaries, prototypes, or historical specifications

No developer or Codex task may silently restore a superseded rule.

### 1.2 Requirement states

- **FROZEN:** Product/architecture decision. Implementation must comply.
- **PROVISIONAL_PILOT:** Numeric calibration parameter may change from learner evidence without reopening architecture.
- **SUPERSEDED:** Must not be implemented.
- **OPEN:** None of the major World 1 product architecture items in this document remain open.

---

# 2. Product North Star

SpeedReader develops three connected outcomes:

> **Read faster. Understand deeply. Explain clearly.**

SpeedReader must remain confidence-first. Adaptive complexity is hidden; achievement is visible.

The system may detect difficulty internally, but the learner experience must never unnecessarily communicate failure, regression, remediation, peer inferiority, or loss of earned progress.

---

# 3. World architecture

## FR-001 — Five content-difficulty Worlds [FROZEN]

The product uses content-difficulty Worlds rather than age-group libraries:

- World 1 — VERY SIMPLE
- World 2 — SIMPLE
- World 3 — MEDIUM
- World 4 — HARD
- World 5 — VERY HARD

All learners begin in World 1 regardless of age.

World 1 language remains accessible and natural. Difficulty primarily grows through reading speed, passage length/stamina, comprehension, expression, fluency, and independence — not unnecessary vocabulary complexity.

## FR-002 — World 2+ direction [FROZEN BROAD ARCHITECTURE]

Later Worlds introduce additional reading strategies:

- World 2: skimming, scanning, keywords, locating information quickly.
- World 3: phrase/chunk reading, reduced word-by-word fixation, important vs supporting information.
- World 4: strategic variable speed, previewing, selective rereading, structure and arguments.
- World 5: applied high-speed reading using skimming, scanning, chunking, selective deep reading according to purpose.

Exact World 2–5 competency maps are future specifications and do not block World 1.

---

# 4. World 1 content architecture

## FR-003 — 1,500 canonical passages [FROZEN]

World 1 contains exactly 1,500 canonical sequential passages.

The first 150 passages retain the approved 15 RS × 10 P architecture and Knowledge Map requirements.

## FR-004 — First 150 passages [FROZEN]

Passages P1–P150 are exactly 100 words each and are displayed one word at a time.

The approved 15 RS competency tracks, P1→P10 comprehension progression, strand distribution, delivery order, evidence semantics, and other frozen Knowledge Map requirements remain normative except where this document explicitly supersedes a product-level rule.

## FR-005 — Stamina staircase [FROZEN]

After P150, passage length increases in 25-word steps using the “short bridges, big consolidation” pattern:

| Passage range | Words |
|---|---:|
| 1–150 | 100 |
| 151–175 | 125 |
| 176–200 | 150 |
| 201–225 | 175 |
| 226–300 | 200 |
| 301–325 | 225 |
| 326–350 | 250 |
| 351–375 | 275 |
| 376–450 | 300 |

The same pattern repeats for each subsequent 150-passage block: three 25-passage bridge steps of +25 words, followed by 75 passages consolidating at the next 100-word milestone.

P1500 reaches a 1,000-word passage.

## FR-006 — Stamina transition precedence [FROZEN]

When a canonical passage-length increase coincides with eligibility for a +1 WPM Level Up, **do not increase both dimensions on the same passage**.

The new passage length takes priority. The learner first experiences the longer passage at the current earned WPM. WPM progression resumes from subsequent valid new-passage evidence.

This implements one meaningful challenge increase at a time.

## FR-007 — AC-53 replacement [FROZEN / SUPERSEDES OLD AC-53]

The old direct 100→200-word transition assumption is SUPERSEDED.

Replacement requirement **AC-53R — Progressive stamina-transition validity**:

Production validation must demonstrate that learners can transition through each World 1 stamina step — 100→125→150→175→200 and every subsequent +25-word increase — without unacceptable collapse in comprehension, completion burden, confidence, or engagement.

News Reader/oral performance is not a gate for this core reading transition.

---

# 5. Personal baseline and initial WPM assessment

## FR-008 — Ten-minute initial assessment [FROZEN]

Every new learner completes a **10-minute adaptive assessment** before normal World 1 training.

Its purpose is to determine where the learner stands **today** and establish the learner’s personal starting WPM.

The assessment:
- is not age-based;
- does not compare the learner with peers;
- must feel like part of the product rather than a high-stakes exam;
- uses comprehension as the decisive evidence for starting reading speed;
- must not use News Reader/oral communication performance to reduce or block the starting WPM;
- records the resulting starting WPM as the learner’s personal speed baseline.

The first canonical passage begins at the WPM established by this assessment.

The exact search/staircase mechanics used inside the ten-minute window are an implementation/calibration parameter, but they must be deterministic, auditable, bounded, and designed to find a sustainable starting WPM rather than the fastest single lucky attempt.

## FR-009 — Personal trajectory [FROZEN]

Progress must be evaluated primarily against the learner’s own valid history.

Never determine progression, difficulty, rewards, or improvement by comparing the learner with:
- another learner;
- an age-group average;
- a leaderboard;
- a universal expected rate of improvement.

Absolute World/readiness requirements may exist, but starting point, route, rate, and amount of practice are personal.

---

# 6. WPM progression and Level Ups

## FR-010 — World 1 speed ceiling [FROZEN]

World 1 maximum training/display speed is **150 WPM**.

150 WPM is a ceiling, not a compulsory completion target.

A learner may complete World 1 below 150 WPM if all applicable World 1 completion/readiness requirements are satisfied.

## FR-011 — Level semantics [FROZEN]

For the learner-facing core reading track:

> **+1 WPM = one Level Up = one Babystep.**

“Level Up” specifically means +1 WPM.

Comprehension, comprehension expression, stamina, fluency, and independence may be measured and celebrated, but they do not create separate numbered core Level Ups.

Use **“You Levelled Up!”** as the canonical achievement terminology. Do not use “graduated.”

## FR-012 — Comprehension is the only WPM gate [FROZEN]

Only comprehension evidence controls WPM progression.

News Reader/oral performance, pronunciation, delivery quality, intonation, or confidence must never block, reduce, or delay a core WPM Level Up.

## FR-013 — Passage GREEN threshold [FROZEN]

Each new canonical passage receives an internal comprehension score.

- Score ≥75% → `GREEN`
- Score <75% → `NOT_GREEN`

The exact score and GREEN/NOT_GREEN classification are internal and are never displayed to the learner.

Do not average passage percentages in a way that lets one very high score compensate for a passage below 75% when evaluating the first-five rule.

## FR-014 — First-five rule [FROZEN]

At the current earned WPM, evaluate the first five **new canonical passages** attempted at that WPM.

- 5/5 GREEN → +1 WPM Level Up
- 4/5 GREEN → +1 WPM Level Up
- 0/5, 1/5, 2/5, or 3/5 GREEN → HOLD current earned WPM and continue with the post-five rule

One below-threshold passage may therefore be treated as an outlier when 4/5 are GREEN.

## FR-015 — Post-five rule [FROZEN]

If the learner does not Level Up after the first five new passages at the current WPM:

- remain at the current earned WPM;
- from passage six onward require **3 consecutive GREEN new canonical passages**;
- a `NOT_GREEN` new passage resets the consecutive-GREEN streak;
- achieving 3 consecutive GREEN new passages triggers +1 WPM.

## FR-016 — Earned WPM is never removed [FROZEN]

Normal World 1 progression has **no WPM decrement mechanism**.

Once a learner earns a WPM level, it is not taken away because of later comprehension difficulty.

Rules such as “−1 WPM after ten passages,” “−1 after 0/5,” or automatic `STEP_DOWN` are SUPERSEDED.

Difficulty produces additional practice/support, not loss of earned progress.

---

# 7. Familiar-passage confidence practice

## FR-017 — Architectural rule [FROZEN]

> **New passages prove progress. Earlier passages practise progress.**

Only new canonical passages may provide evidence for a WPM Level Up.

Previously completed passages may be reused at the learner’s current earned WPM for confidence-building practice, but they cannot independently trigger a WPM Level Up.

## FR-018 — Practice behaviour [FROZEN]

When progression stalls, the adaptive engine may select earlier passages the learner has already completed and present them at the learner’s **current earned WPM**.

These familiar passages are `PRACTICE_ONLY`.

They:
- do not advance the 1,500-passage canonical sequence;
- do not replace a new canonical passage;
- do not alter the original attempt’s historical score;
- do not independently count toward first-five or three-consecutive-GREEN progression evidence;
- may store practice analytics separately;
- are used to reduce content novelty, strengthen current-speed comfort, and rebuild confidence.

After practice, the learner returns naturally to new canonical passages at the same earned WPM.

## FR-019 — Support is invisible [FROZEN]

Internal support/practice state must not be exposed to the learner.

Do not show:
- “support mode”;
- “remedial”;
- “failed”;
- “struggling”;
- “downgraded”;
- “moved back”;
- or similar negative state labels.

The learner should experience continued reading and encouragement.

---

# 8. Comprehension assessment

## FR-020 — Hybrid evidence model [FROZEN]

Every new canonical passage uses two sources of comprehension evidence:

1. **Structured comprehension questions**
2. **Spoken free-text comprehension expression**

Both contribute to the internal comprehension score.

Structured questions carry the larger weight. Spoken free-text carries a slightly lower but meaningful weight because SpeedReader must improve not only understanding but also the learner’s ability to express what was understood.

## FR-021 — Weighting lifecycle [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]

The architectural principle is FROZEN:

> structured-question evidence > spoken-expression evidence, while spoken expression remains materially consequential.

Initial implementation may use **70% structured questions / 30% spoken expression** as `PROVISIONAL_PILOT`.

The exact ratio may be recalibrated from learner evidence without reopening the architecture, provided:
- structured questions retain the larger weight;
- spoken expression remains meaningful;
- changes are versioned and auditable;
- calibration cannot silently redefine the ≥75% GREEN threshold unless separately approved.

## FR-022 — Structured question alignment [FROZEN]

Questions must align to the approved P1→P10 comprehension progression:

1. Direct recall
2. Sequence
3. Cause and effect
4. Prediction
5. Feelings/motivation
6. Main idea
7. Simple inference
8. Vocabulary in context
9. Judgment/application
10. Mixed mastery

Question scoring must be deterministic and stored at item level.

## FR-023 — Spoken comprehension expression [FROZEN]

The learner is asked to explain what they understood in their own words and to **detail it out like telling the story to someone**.

The spoken-expression evaluator should reward, where supported by the passage:
- relevance;
- key events/ideas;
- useful supporting details;
- connections between events/ideas;
- cause/effect or motivation;
- coherent sequencing;
- clarity and completeness of expression.

It must not reward sophisticated vocabulary merely for sounding advanced.

It must not unfairly penalise:
- accent;
- ordinary grammar variation;
- dialect;
- speaking style;
- age-appropriate wording.

The purpose is richer thinking and clearer expression, not a spoken-English contest.

## FR-024 — ASR uncertainty [FROZEN]

Speech-recognition uncertainty must never be converted automatically into learner error.

If spoken evidence is technically unusable or uncertain:
- mark the affected evidence as unresolved/technical;
- request a natural retry when appropriate;
- do not fabricate a low comprehension score from recognition failure;
- preserve audit data explaining why the evidence was not scored normally.

---

# 9. Best Possible Comprehension

## FR-025 — After every passage [FROZEN]

After the learner has submitted and the system has completed scoring, every passage must provide a **Best Possible Comprehension** explanation.

It is shown/heard only after scoring so it cannot contaminate the evidence for that passage.

## FR-026 — Story-style explanation [FROZEN]

Best Possible Comprehension is not:
- a sentence-by-sentence repetition;
- a mechanical paraphrase;
- merely the correct answer to the questions.

It is a child-friendly, connected explanation that models how a strong reader would tell another person what they understood.

Where supported by the passage, it connects:

> what happened / what the passage says → why it happened / how ideas connect → what mattered → what can reasonably be understood from it.

It should read or sound like a coherent story/explanation.

## FR-027 — Fidelity [FROZEN]

Best Possible Comprehension may clarify and connect supported meaning, but must never invent:
- events;
- motives;
- facts;
- causal relationships;
- lessons;
- judgments;
- conclusions

that are not supported by the passage.

## FR-028 — Permanent cross-World feature [FROZEN]

Comprehension expression and Best Possible Comprehension are permanent SpeedReader features across all Worlds.

Their sophistication increases with content difficulty:

- World 1: connected retelling of events/ideas, reasons, feelings, consequences, key meaning.
- World 2: clear explanation distinguishing important information from supporting detail.
- World 3: connected ideas, relationships, inference, coherent organisation.
- World 4: arguments, viewpoints, evidence, implications, deeper meaning.
- World 5: synthesis of complex material into a clear structured explanation in the learner’s own words.

---

# 10. Learner feedback and confidence

## FR-029 — Numeric comprehension is private [FROZEN]

Never display the learner’s numeric comprehension score, 75% threshold, GREEN/NOT_GREEN state, or PASS/FAIL state.

Store them internally for progression and analytics.

## FR-030 — ≥75% is a celebration [FROZEN]

When a new passage scores ≥75%:
- store the exact internal score;
- classify it GREEN;
- provide positive learner-facing appreciation/celebration;
- provide Best Possible Comprehension;
- count it toward applicable Level-Up evidence.

Do not say “you got 75%.”

## FR-031 — Below 75% remains positive [FROZEN]

When a passage scores below 75%:
- store the exact internal score;
- classify it NOT_GREEN;
- do not show failure language or the score;
- provide neutral, encouraging feedback;
- provide Best Possible Comprehension;
- continue naturally according to the adaptive rules.

## FR-032 — Level-Up celebration [FROZEN]

A validated +1 WPM advancement receives a larger celebration than an individual GREEN passage.

Canonical phrase:

> **You Levelled Up!**

## FR-033 — Book-time impact [FROZEN]

On each validated +1 WPM Level Up, show the learner an estimated real-world reading-time impact using a standard reference book of **50,000 words (~200 pages)**.

Formula:

`estimated_minutes = 50,000 / WPM`

Show:
- previous WPM → new WPM;
- estimated time at the new WPM in hours/minutes;
- approximate time saved versus the previous WPM;
- optionally cumulative time saved versus the learner’s original baseline.

Use “about” or “estimated.” Never promise exact real-book performance.

---

# 11. News Reader — parallel oral communication track

## FR-034 — Parallel track [FROZEN]

**News Reader is a separate, parallel oral communication track.**

It is not a gate for core SpeedReader WPM progression.

Its purpose is to develop:
- oral reading;
- pronunciation;
- clarity;
- phrasing;
- meaningful pauses;
- emphasis;
- intonation;
- confidence;
- expressive oral communication.

## FR-035 — Independence from core progression [FROZEN]

News Reader performance must never:
- block a core WPM Level Up;
- reduce earned WPM;
- delay canonical passage progression solely because oral delivery is weak;
- become a mandatory core-reading GREEN light.

A learner may be strong in silent/core reading while still developing oral communication, and vice versa.

## FR-036 — Shared content, separate state [FROZEN]

News Reader may use the same canonical passage, but:
- core reading evidence and News Reader evidence are stored separately;
- each track has its own metrics/state;
- News Reader results cannot be substituted for comprehension evidence.

## FR-037 — Reference delivery [FROZEN]

The News Reader reference should model professional, clear Indian-English newsreader qualities:
- clarity;
- confidence;
- precision;
- meaningful pauses;
- appropriate emphasis;
- controlled pitch and intonation;
- no exaggerated drama.

~~Use the same canonical pre-generated reference audio across supported platforms. Do not rely on device-specific runtime TTS for the normative reference performance.~~ *(Superseded by Amendment A1, below.)*

**Amendment A1 (2026-10-06) — interim text-to-speech reference.** Until canonical pre-generated reference audio exists, the News Reader reference is produced by on-device text-to-speech:
- speech pace is **145 words per minute**;
- the voice is **female**, following the Course 1 audio reference: Microsoft Neerja when the browser exposes it, otherwise the best available female English voice (Indian English preferred); male voices are never selected;
- the same pace and voice policy apply on every supported platform; the exact timbre depends on the voices installed on the device;
- the highlighted word follows the voice, sentence by sentence;
- when canonical pre-generated reference audio is approved for a passage (valid asset, hash, version and QA of all seven qualities above), that audio takes precedence over text-to-speech.

## FR-038 — Oral two-read coaching [FROZEN]

Where the News Reader activity uses the two-read pattern:
- the child may read the same passage aloud twice;
- store attempts independently;
- calculate improvement/delta;
- frame the second read as practice, not punishment.

This track may have its own coaching and future achievements, but those do not alter the core WPM Level-Up state machine.

## FR-039 — Supersession of oral-as-core-gate [FROZEN]

Any older product rule that makes oral/News Reader performance a mandatory gate for **core reading progression or core World progression** is SUPERSEDED.

Oral communication remains important, but it belongs to the parallel News Reader track.

---

# 12. World 1 completion and readiness

## FR-040 — Passage 1500 is not sufficient by itself [FROZEN]

Reaching P1500 completes the canonical World 1 passage sequence but does not, by passage count alone, prove World 1 mastery.

World 1 progression/completion must also satisfy the applicable core reading competency/readiness requirements defined by the canonical specification.

## FR-041 — 150 WPM is not mandatory [FROZEN]

A learner does not need to reach 150 WPM to complete World 1.

150 WPM is the World 1 ceiling.

## FR-042 — Level Ups do not substitute for readiness [FROZEN]

WPM Level Ups are personal speed-development evidence and motivational achievements.

They do not substitute for required competency/readiness evidence.

## FR-043 — News Reader does not block World progression [FROZEN]

News Reader/oral communication mastery is parallel and must not prevent a learner who has satisfied the core World 1 reading requirements from progressing in the core SpeedReader World architecture.

---

# 13. Reassessment, equivalent forms and evidence governance

## FR-044 — Readiness-critical forms [FROZEN]

Confirmation, reassessment, revalidation, or other readiness-critical evidence must use **pre-generated, independently QA-approved equivalent passages/forms**.

Do not generate readiness-critical assessment material dynamically at learner runtime.

Runtime AI may coach or explain, but certification evidence must come from controlled approved material.

## FR-045 — Evidence recency [FROZEN PRINCIPLE / PROVISIONAL_PILOT PARAMETER]

Readiness evidence must represent current ability. Very old evidence cannot remain valid indefinitely.

The existence of a recency/revalidation rule is FROZEN.

The exact inactivity/session/calendar threshold is `PROVISIONAL_PILOT` and must be calibrated from learner evidence, versioned, and auditable.

## FR-046 — Threshold lifecycle [FROZEN GOVERNANCE]

Numerical thresholds not explicitly frozen by product decision must use lifecycle states:

- `PROVISIONAL_PILOT`
- `CALIBRATION_REVIEW`
- `PRODUCTION_APPROVED`
- `SUSPENDED_RECALIBRATE`

Calibration may adjust empirical numbers but may not silently change frozen semantics or architecture.

---

# 14. Data and audit requirements

## FR-047 — Attempt types [FROZEN]

Every reading attempt must identify at minimum:
- learner;
- canonical passage ID;
- whether the attempt is `NEW_PROGRESSION`, `FAMILIAR_PRACTICE`, `ASSESSMENT`, `REASSESSMENT`, or `NEWS_READER`;
- displayed WPM;
- passage word count;
- timestamp;
- structured-question evidence;
- spoken-expression evidence status;
- internal comprehension score where applicable;
- GREEN/NOT_GREEN where applicable;
- Level-Up state before/after;
- technical/ASR uncertainty state;
- rules/spec version used.

## FR-048 — Evidence separation [FROZEN]

The system must prevent accidental evidence leakage:
- familiar practice cannot count as new progression evidence;
- News Reader cannot count as comprehension GREEN evidence;
- post-model-answer interaction cannot retroactively improve the original passage score;
- technical retries cannot be silently recorded as learner failures;
- historical attempts are immutable; corrections use explicit replacement/audit records.

## FR-049 — Explainability [FROZEN]

For every WPM Level Up or HOLD, the backend must be able to explain the decision from stored evidence without reconstructing chat history.

Example:
- `LEVEL_UP: first_five_green_count=4/5`
- `HOLD: first_five_green_count=3/5`
- `LEVEL_UP: post_five_consecutive_green=3`
- `PRACTICE_ONLY: excluded_from_progression_evidence`

Learner-facing UI must not expose negative internal labels.

---

# 15. Codex implementation instructions

These instructions are normative for any Codex/developer task implementing SpeedReader.

## CODEX-01 — Do not redesign

Implement this specification as written.

Do not:
- simplify away a requirement;
- introduce peer comparison;
- reintroduce WPM decrement;
- make News Reader a speed gate;
- count familiar practice as progression evidence;
- expose internal comprehension percentages;
- invent a new World/Level model;
- change the 1,500-passage stamina staircase;
- modify the approved first-150 Knowledge Map semantics unless an explicit supersession exists in this document.

If an implementation detail is genuinely unspecified, isolate it behind configuration and document the assumption. Do not silently create a new product rule.

## CODEX-02 — Separate domain state machines

Implement at least these separate domains:

1. **Initial Assessment**
2. **Core Reading / WPM Progression**
3. **Canonical Passage Sequence / Stamina**
4. **Comprehension Scoring**
5. **Familiar Practice**
6. **Best Possible Comprehension**
7. **News Reader**
8. **Readiness/Reassessment**
9. **Calibration/Versioning**

Do not use one generic “score” or “level” field to represent all domains.

## CODEX-03 — Core WPM state machine

Pseudocode:

```text
on NEW_PROGRESSION passage completed:
    comprehension = score(structured_questions, spoken_expression)

    if comprehension >= 75:
        result = GREEN
    else:
        result = NOT_GREEN

    store exact score internally
    never show numeric score to learner

    if current_wpm >= 150:
        do not increase WPM
        continue other development
        return

    evidence = NEW_PROGRESSION attempts at current_wpm since it was earned

    if count(evidence) <= 5:
        if count(evidence) == 5:
            if green_count(evidence[1..5]) >= 4:
                level_up(+1 WPM)
            else:
                enter_internal_practice_eligible_state()
    else:
        if last_3_NEW_PROGRESSION_attempts_are_GREEN:
            level_up(+1 WPM)

    never decrement earned WPM
```

Important: `FAMILIAR_PRACTICE` attempts are excluded from `evidence`.

## CODEX-04 — Stamina collision rule

Before scheduling a passage:
- determine canonical passage word count;
- detect whether this passage introduces a new +25-word stamina step;
- if a speed Level Up would otherwise take effect on that same passage, apply the longer passage first at the prior earned WPM;
- speed increase may apply only on subsequent valid evidence.

The implementation must make the precedence deterministic and testable.

## CODEX-05 — Practice selection

When support is needed:
- choose only passages already completed by that learner;
- serve them at the learner’s current earned WPM;
- mark attempts `FAMILIAR_PRACTICE`;
- preserve original canonical sequence pointer;
- never count practice toward Level-Up evidence;
- return to new canonical content without learner-facing remediation labels.

Selection strategy may optimise recency, confidence, topic interest, or prior success, but cannot violate the rules above.

## CODEX-06 — Comprehension scoring

Implement structured questions and spoken expression as separately stored components.

Initial pilot configuration:
- structured questions: 70%
- spoken expression: 30%
- GREEN threshold: 75%

Do not hard-code the 70/30 ratio in multiple places. Store it in versioned calibration/configuration.

The 75% GREEN threshold is a frozen product rule and requires explicit product change to alter.

## CODEX-07 — Spoken-expression evaluator

The evaluator must return:
- score/component evidence;
- evidence coverage;
- uncertainty/technical state;
- short coaching signals.

It must evaluate meaning and expression, not accent prestige or vocabulary sophistication.

ASR uncertainty must be represented explicitly and must not become a learner error.

## CODEX-08 — Best Possible Comprehension generator

Generate only after learner evidence is locked.

Input must include the approved passage and its validated comprehension metadata.

Output must:
- be child-appropriate;
- be connected and story-like;
- model strong comprehension expression;
- explain relationships supported by the passage;
- avoid sentence-by-sentence copying;
- avoid unsupported facts/inferences.

Where production safety requires deterministic quality, use pre-generated/QA-approved Best Possible Comprehension content rather than uncontrolled runtime generation.

## CODEX-09 — Learner-facing feedback contract

The learner UI may show:
- encouragement;
- small celebration after GREEN;
- “You Levelled Up!” after validated +1 WPM;
- new WPM;
- estimated 50,000-word book time;
- time saved;
- Best Possible Comprehension;
- positive News Reader coaching.

The learner UI must not show:
- numeric comprehension percentage;
- GREEN/NOT_GREEN;
- PASS/FAIL;
- support/remedial state;
- WPM downgrade;
- peer rank/comparison;
- “failed to level up.”

## CODEX-10 — News Reader isolation

Implement News Reader as a separate state/metrics namespace.

A News Reader failure, low score, missing attempt, or unavailable microphone must not mutate:
- core WPM;
- core Level-Up evidence;
- canonical core passage progression;
- core World completion state.

## CODEX-11 — Version everything that affects decisions

Persist the rule/config version with every scored attempt and progression decision, including:
- comprehension weighting version;
- scoring model version;
- tokenizer/counting version;
- passage/content version;
- readiness rule version.

A later calibration change must not rewrite historical outcomes.

## CODEX-12 — Fail safe

On technical uncertainty:
- do not penalise the learner;
- do not fabricate evidence;
- do not Level Up from incomplete/invalid evidence;
- preserve current earned WPM;
- offer a natural retry or continue according to approved technical-recovery rules.

---

# 16. Acceptance criteria — product behaviour

## AC-P01 — Ten-minute baseline
**PASS:** A new learner completes a bounded ten-minute assessment, receives a stored personal starting WPM, and P1 begins at that WPM. No age/peer comparison or News Reader gate is used.

## AC-P02 — Personal progression
**PASS:** Two learners with different starting WPMs can follow different speed trajectories while consuming the same canonical World 1 sequence.

## AC-P03 — 150 WPM ceiling
**PASS:** No World 1 core passage is scheduled above 150 WPM; reaching 150 does not terminate other development.

## AC-P04 — First-five 4/5
**PASS:** For NEW_PROGRESSION outcomes `[GREEN, GREEN, NOT_GREEN, GREEN, GREEN]`, learner earns exactly +1 WPM after the fifth valid new passage.

## AC-P05 — First-five 3/5
**PASS:** For 3/5 GREEN, learner remains at current earned WPM and no decrement occurs.

## AC-P06 — Three-consecutive post-five
**PASS:** After an unsuccessful first-five window, exactly three consecutive GREEN NEW_PROGRESSION passages trigger +1 WPM.

## AC-P07 — Streak reset
**PASS:** A NOT_GREEN new passage after one or two post-five GREEN passages resets the consecutive-GREEN count.

## AC-P08 — No decrement
**PASS:** No normal comprehension pattern can reduce an already earned WPM.

## AC-P09 — Familiar practice exclusion
**PASS:** Any number of GREEN familiar-practice attempts cannot independently trigger a Level Up or advance the canonical passage pointer.

## AC-P10 — Familiar practice speed
**PASS:** Familiar passages are served at the learner’s current earned WPM, not their historical WPM.

## AC-P11 — Invisible support
**PASS:** Learner-facing screens contain no remediation/support/failure/downgrade labels when familiar practice is activated.

## AC-P12 — Hybrid comprehension
**PASS:** Each new passage stores structured-question evidence and spoken-expression evidence separately and produces one auditable internal comprehension result.

## AC-P13 — 75% privacy
**PASS:** ≥75% is internally GREEN and <75% is NOT_GREEN, but neither the percentage nor classification appears in learner UI.

## AC-P14 — Spoken expression meaningful
**PASS:** Spoken expression contributes a lower but material configured weight to comprehension; it is not a zero-weight decorative feature.

## AC-P15 — ASR fairness
**PASS:** An ASR-unresolved spoken response cannot automatically become a low learner comprehension score.

## AC-P16 — Best Comprehension ordering
**PASS:** Best Possible Comprehension is unavailable until the learner’s response is submitted and scoring evidence is locked.

## AC-P17 — Best Comprehension quality
**PASS:** Independent QA confirms the model explanation is connected/story-like, materially richer than mechanical repetition, child-appropriate, and contains no unsupported facts or motives.

## AC-P18 — Every passage
**PASS:** Every completed passage has a Best Possible Comprehension experience, including NOT_GREEN passages.

## AC-P19 — Level-Up semantics
**PASS:** Core learner-facing numbered Level Up changes only when WPM increases by exactly 1.

## AC-P20 — Level-Up book time
**PASS:** A Level Up displays estimated 50,000-word book time and time saved versus prior WPM using the defined formula and “about/estimated” wording.

## AC-P21 — Stamina staircase
**PASS:** Automated validation of all 1,500 canonical passage IDs produces the approved word-count staircase and P1500 = 1,000 words.

## AC-P22 — No double jump
**PASS:** A passage introducing a new stamina length is not simultaneously the first passage at a newly increased WPM.

## AC-P23 — News Reader isolation
**PASS:** Manipulating News Reader scores cannot change core WPM progression outcomes.

## AC-P24 — News Reader parallel metrics
**PASS:** News Reader stores oral communication metrics separately and can provide coaching without core-reading penalties.

## AC-P25 — World completion below 150
**PASS:** Test fixture demonstrates a learner can satisfy core World 1 completion/readiness below 150 WPM when all other applicable core requirements are met.

## AC-P26 — Passage count alone insufficient
**PASS:** Reaching P1500 without required core readiness evidence does not falsely certify World 1 mastery.

## AC-P27 — Approved reassessment forms
**PASS:** Readiness-critical reassessment references an approved equivalent form ID/version; runtime-generated unapproved content cannot be used as certification evidence.

## AC-P28 — Auditability
**PASS:** Every Level Up/HOLD can be reconstructed from immutable attempt records and versioned rules without chat history.

## AC-P29 — Confidence-first language
**PASS:** QA scan finds zero prohibited learner-facing negative state labels and zero peer-comparison mechanics in core progression.

## AC-P30 — Cross-platform consistency
**PASS:** Core progression decisions are server/domain-rule driven and identical for equivalent evidence across supported clients; News Reader reference delivery follows one policy on every platform: approved canonical pre-generated audio where it exists, otherwise text-to-speech at 145 WPM with a female voice (FR-037, Amendment A1).

---

# 17. Acceptance criteria — Codex engineering gate

## AC-C01 — No stale-rule implementation
Repository search and automated tests show no active implementation of:
- two-green-light WPM gating;
- oral-as-core-speed-gate;
- −1 WPM regression;
- ten-passage automatic decrement;
- familiar-practice-as-progression-evidence;
- age-based starting WPM;
- direct 100→200 stamina jump.

## AC-C02 — Explicit attempt type
Every scored attempt has a non-null attempt type from the approved ontology.

## AC-C03 — Separate state
Core reading, practice, News Reader, readiness, and calibration states are not conflated into one status field.

## AC-C04 — Idempotent progression
Reprocessing the same completed attempt cannot award a second Level Up.

## AC-C05 — Transaction safety
A Level Up and its evidence snapshot are committed atomically. Partial failures cannot create WPM/evidence disagreement.

## AC-C06 — Boundary tests
Automated tests cover at minimum:
- exactly 75%;
- just below 75%;
- 4/5 GREEN;
- 3/5 GREEN;
- post-five G-G-G;
- post-five G-G-N-G-G-G;
- current WPM 149→150;
- current WPM 150;
- stamina-boundary passage;
- familiar-practice inserted between new attempts;
- ASR unresolved;
- News Reader missing/low/high;
- reassessment form version mismatch.

## AC-C07 — Configuration governance
Provisional parameters exist in one versioned configuration source and historical attempts retain the version used.

## AC-C08 — Observability
Operational logs can distinguish:
- content defect;
- scoring defect;
- ASR/technical uncertainty;
- learner NOT_GREEN;
- practice scheduling;
- Level Up;
- stamina boundary;
without exposing negative internal labels to the learner.

## AC-C09 — Deterministic decision service
Given the same immutable attempt history and same rule/config versions, the progression engine returns the same result.

## AC-C10 — Independent QA gate
A Codex implementation is not production-approved merely because its own tests pass. It must pass independent QA against this document and the approved Knowledge Map package.

---

# 18. Codex task prompt — canonical implementation instruction

Use the following block as the top-level instruction when handing implementation to Codex:

```text
Implement SpeedReader World 1 strictly against:
1. SpeedReader_Final_Frozen_Requirements_Codex_Acceptance_v2.0
2. the approved SpeedReader World 1 Band A Knowledge Map package.

Precedence: explicit v2.0 supersession rules override older product assumptions. Otherwise the approved Knowledge Map remains normative.

Do not redesign product behaviour.

Before coding:
- create a requirements traceability matrix mapping every FR, CODEX instruction and applicable Knowledge Map AC to code modules and tests;
- identify any existing repository behaviour that conflicts with v2.0;
- mark conflicting stale rules for removal/replacement.

During implementation:
- keep Initial Assessment, Core Reading/WPM, Stamina, Comprehension, Familiar Practice, Best Comprehension, News Reader, Readiness, and Calibration as separable domain concerns;
- preserve immutable attempt evidence and rule versions;
- implement learner-facing confidence rules exactly;
- never make News Reader a core progression gate;
- never decrement earned WPM;
- never count familiar practice as progression evidence;
- never expose numeric comprehension scores.

Before handoff:
1. run all mechanical/unit/integration tests;
2. run semantic validation against every acceptance criterion;
3. produce a traceability report with PASS/FAIL and evidence for every applicable AC;
4. produce a stale-rule scan showing superseded behaviours are absent;
5. do not claim production PASS.

Place implementation-stage outputs in the canonical WIP location configured for the SpeedReader pipeline. Independent QA must review the completed artifact/code and is the only authority that may certify PASS and allow downstream advancement.
```

---

# 19. Supersession register

The following historical assumptions are explicitly SUPERSEDED:

| Historical rule/assumption | Final replacement |
|---|---|
| Age-group passage libraries | Content-difficulty Worlds; all learners start World 1 |
| Two green lights for WPM (comprehension + oral) | Comprehension only |
| Oral/News Reader blocks core reading progress | News Reader is a parallel oral communication track |
| Stable success across generic 3–5 sessions | First-five 4/5, then 3 consecutive GREEN |
| −1 WPM after poor performance | Earned WPM is never removed |
| −1 WPM after 0/5 or after ten attempts | Familiar confidence practice at current WPM |
| Familiar passage can prove progress | New passages prove progress; earlier passages practise progress |
| Learner sees score/pass/fail | Numeric score/state internal only |
| Best answer = answer key/paraphrase | Story-style Best Possible Comprehension |
| Direct 100→200 stamina transition | 25-word stamina staircase |
| Simultaneous speed + length jump | Length first; no same-passage double jump |
| “Graduated” terminology | “You Levelled Up!” |
| Core Level may mix dimensions | Core Level Up = +1 WPM |
| Runtime-generated readiness-critical form | Pre-generated independently QA-approved equivalent form |

---

# 20. Final definition of done

SpeedReader World 1 implementation is ready for independent QA only when:

1. all FROZEN requirements in this document are implemented;
2. all applicable approved Knowledge Map ACs pass;
3. all superseded behaviours are absent;
4. all PROVISIONAL_PILOT values are clearly versioned/configurable;
5. automated structural and boundary tests pass;
6. learner-facing confidence rules pass UX/content QA;
7. progression decisions are deterministic and auditable;
8. News Reader is demonstrably isolated from core WPM progression;
9. familiar practice is demonstrably excluded from progression evidence;
10. Best Possible Comprehension is delivered after scoring and passes semantic fidelity QA;
11. Codex/developer self-validation is complete; and
12. a separate independent QA job issues the only certification that permits downstream advancement.

**FINAL PRODUCT ARCHITECTURE STATUS: FROZEN**

Further changes to a FROZEN rule require explicit versioning, impact analysis, regression review, and approval. Calibration of declared PROVISIONAL_PILOT parameters does not reopen the architecture.
