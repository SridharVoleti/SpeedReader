# SpeedReader — Definitive App Requirements, Claude Code Implementation Plan & Acceptance Criteria

**Version:** 3.0  
**Date:** 09 October 2026  
**Status:** DEFINITIVE APP BASELINE — CONTENT REQUIREMENTS EXCLUDED  
**Product:** Babysteps SpeedReader  
**Repository:** `SridharVoleti/SpeedReader`  
**Implementation target:** Current SpeedReader repository, integrated into the Babysteps Consumer App Container

---

## 0. Purpose

This document is the **single consolidated application specification** for SpeedReader.

It consolidates the app/product decisions made across the SpeedReader project conversations, the frozen World 1 product requirements, the approved World 1 Band A runtime contracts, later product amendments, Babysteps platform integration rules, and the implementation/QA decisions already recorded in the repository.

This document covers **application behaviour only**.

### 0.1 Included

This specification covers:

- Babysteps container integration;
- authentication/session/learner context consumed by SpeedReader;
- initial reading-speed assessment;
- reader runtime;
- WPM progression;
- stamina progression;
- familiar-passage practice;
- comprehension capture and scoring orchestration;
- speech-to-text handling;
- Best Possible Comprehension delivery;
- learner feedback and celebrations;
- News Reader;
- reading telemetry;
- readiness/reassessment/revalidation runtime;
- evidence freshness;
- data model and persistence;
- calibration and analytics;
- mobile/browser behaviour;
- accessibility and child-facing UX rules;
- backend/API behaviour;
- observability and audit;
- Claude Code implementation sequence;
- automated and independent acceptance criteria.

### 0.2 Explicitly excluded — separate Content Requirements specification

The following are **not defined here** and must be maintained in the separate SpeedReader Content Requirements / Knowledge Map package:

- passage prose;
- passage titles, premises and stories;
- knowledge strands and strand goals;
- wisdom/trait intentions;
- vocabulary selection;
- factual/safety content rules;
- actual comprehension-question wording;
- actual keyed answers;
- actual meaning units;
- actual Best Possible Comprehension text;
- actual readiness-form prose;
- passage-generation prompts;
- content creator/QA-agent pipeline;
- passage authoring QA;
- content package production workflow.

The app **consumes** approved content contracts and executes their runtime/scoring semantics. It must not silently recreate or redefine content rules.

---

# 1. Authority and supersession

## APP-GOV-001 — One application source of truth

This v3.0 document becomes the authoritative application/product implementation contract.

After this document is frozen, developers and Claude Code must not reconstruct app behaviour from historical chat messages.

## APP-GOV-002 — Precedence before v3.0 freeze

The consolidation used this precedence:

1. explicit later product decisions and amendments;
2. `SpeedReader_Final_Frozen_Requirements_Codex_Acceptance_v2.0.md`;
3. applicable non-conflicting runtime rules from the approved World 1 Band A canonical package / acceptance criteria;
4. Babysteps platform contracts that SpeedReader inherits;
5. later requirement trackers for decisions not already contradicted by a higher-authority frozen rule;
6. historical prototypes, demos, spreadsheets and earlier chat assumptions.

After v3.0 is accepted, **v3.0 is the single app-level authority**.

## APP-GOV-003 — Requirement states

Every configurable requirement must be classified as one of:

- `FROZEN`
- `PROVISIONAL_PILOT`
- `CALIBRATION_REVIEW`
- `PRODUCTION_APPROVED`
- `SUSPENDED_RECALIBRATE`
- `SUPERSEDED`

A number being precise does not automatically make it empirically validated.

## APP-GOV-004 — No silent product redesign

Claude Code may choose implementation details, but may not:

- invent product rules;
- remove a frozen requirement because implementation is difficult;
- restore a superseded rule;
- merge separate state machines into one generic score/level;
- change learner-visible semantics without an explicit product version change.

If a low-level detail is not specified, isolate it behind configuration and document the assumption.

## APP-GOV-005 — Historical outcomes remain historical

Rule/config changes must never rewrite prior learner outcomes. Every historical attempt and progression decision remains associated with the versions that produced it.

---

# 2. Definitive supersession register

The following older behaviours are **not part of the current app**.

| Superseded behaviour | Definitive replacement |
|---|---|
| 1,050 World 1 passages | **1,500 canonical World 1 passages** |
| 6 fixed chunk-size worlds / 36-level demo | **5 content-difficulty Worlds**; detailed World 2–5 maps are future specifications |
| Age-group reading libraries | Every learner begins in **World 1**; route is personal |
| Fixed 100→200 word jump | **25-word stamina staircase** |
| Simultaneous speed + length increase | **Length increase takes precedence** |
| Oral + comprehension both required for WPM | **Comprehension alone controls WPM** |
| News Reader/oral failure blocks core progression | **News Reader is parallel and nonblocking** |
| WPM decrement after poor performance | **Earned WPM is never removed** |
| Familiar passage proves WPM progress | Familiar passage is **practice only** |
| Pass/fail and comprehension percentages shown to child | Scores/states are **internal only** |
| Runtime-generated readiness-critical forms | Only **pre-generated independently QA-approved equivalent forms** |
| Direct unlimited retries until one passes | Valid failure requires approved remediation/new cycle |
| “Graduated” terminology | **“You Levelled Up!”** for +1 WPM |
| Generic numbered level mixing dimensions | **One core Level Up = +1 WPM** |
| Device-specific normative News Reader voice | One policy: approved canonical audio when available; otherwise approved browser/on-device TTS fallback |
| 60% comprehension candidate | **Not active**; frozen passage GREEN threshold is **75%** |
| 28 inactive days as current pilot default | Latest app pilot default: **14 complete inactive days**; recency values remain configurable |
| Browser localStorage as production learner record | **Server-persisted learner/evidence store**; local state is only transient/cache |
| Legacy public demo routes as learner product | Production learner journey must use the v3 engine; diagnostics are protected/non-production |

---

# 3. Product North Star

## APP-NORTH-001 — Three outcomes

SpeedReader develops:

> **Read faster. Understand deeply. Explain clearly.**

## APP-NORTH-002 — Confidence-first

Adaptive complexity may be sophisticated internally, but the child experience must feel simple and encouraging.

Achievement is visible. Internal failure/remediation machinery is not.

## APP-NORTH-003 — Personal trajectory

Progress is primarily against the learner’s own valid history.

The product must not use:

- peer rank;
- class rank;
- leaderboard position;
- age-group percentile;
- another learner’s WPM;
- a universal expected improvement rate

to decide the learner’s progression or to message the learner.

---

# 4. Babysteps platform and container integration

## APP-PLAT-001 — Consumer App Container is the mandatory host

SpeedReader is a Babysteps hosted app and must conform to the standard Babysteps hosted-app contract.

The repository must continue to expose the app identity/manifest expected by the container.

## APP-PLAT-002 — Typed manifest contract

SpeedReader must declare at minimum:

- display name;
- cookie/session prefix;
- learner journey title/description;
- root layout;
- home/learner entry;
- permitted route modules.

Container code must not contain SpeedReader-specific product logic.

## APP-PLAT-003 — Standard launch protocol

SpeedReader must support the Babysteps app lifecycle/launch contract, including the platform equivalents of:

- health;
- launch;
- return;
- identity;
- authorized session bootstrap;
- progress sync.

The learner should enter SpeedReader already associated with the correct parent account and learner profile.

## APP-PLAT-004 — No duplicate authentication system

SpeedReader must **not** create a separate learner authentication product.

Inherited Babysteps identity rules:

- parent account owns access;
- parent uses the platform authentication mechanism;
- phone remains a platform-required parent field;
- learner DOB/profile comes from the platform;
- no learner login in V1.

SpeedReader receives a trusted learner/session context from the container.

## APP-PLAT-005 — No duplicate billing

SpeedReader must not implement independent billing/checkout inside the learning runtime.

Subscription/entitlement is a Babysteps platform responsibility.

The app consumes entitlement/session authorization.

## APP-PLAT-006 — Single active learner/device rule

The same learner must not run simultaneous active SpeedReader learning sessions on multiple devices.

Conflicts are resolved through the platform session policy/admin path.

## APP-PLAT-007 — Platform session envelope

Unless the Babysteps platform contract is explicitly changed, SpeedReader must respect:

- 45-minute learning sessions;
- 2 sessions per learner per week per app;
- every 6th platform learning session as a review session.

The SpeedReader passage engine must not hard-code a contradictory daily entitlement.

A session may contain multiple SpeedReader activities; passage progression and platform-session cadence are separate concepts.

## APP-PLAT-008 — Review-session integration

A platform review session must reuse already completed/approved practice material by default.

Review attempts are `FAMILIAR_PRACTICE` unless an explicitly approved assessment/revalidation form is scheduled.

Ordinary review practice must not:

- advance the canonical passage pointer;
- create WPM Level-Up evidence;
- rewrite original evidence.

## APP-PLAT-009 — Accidental-close resume

An accidentally closed SpeedReader learning session may resume within **15 minutes** using the same valid session context.

Resume must restore the learner’s safe activity position without duplicating committed evidence or awards.

After the resume window, start through the normal authorized session flow.

## APP-PLAT-010 — Return to Babysteps

Leaving SpeedReader must return control to the Babysteps container cleanly and sync the permitted progress summary.

---

# 5. Supported clients and infrastructure

## APP-INFRA-001 — Web-first, mobile-required

The learner experience must work on:

- desktop web;
- mobile web where supported;
- Babysteps Android mobile shell.

Mobile support is mandatory, not an afterthought.

## APP-INFRA-002 — Reference browser

The Babysteps reference browser/runtime is Chromium/Edge-compatible.

Speech/microphone capability must be explicitly detected rather than assumed.

## APP-INFRA-003 — Deployment

Current deployment architecture:

- application hosting: Vercel;
- application data: Supabase;
- primary deployment/data region: Singapore where the selected service permits;
- start lean and use free tiers where they meet the actual load;
- move to paid tiers only when scale/reliability requires it.

## APP-INFRA-004 — Speech cost principle

Initial SpeedReader speech features must prefer browser/on-device capabilities and must not introduce a paid STT/TTS dependency merely to reproduce functionality already available reliably in the reference environment.

Paid speech services may be introduced only through an explicit product/architecture change.

## APP-INFRA-005 — Email is not a SpeedReader runtime dependency

Resend/email is not required for the initial SpeedReader learner flow.

Messaging/email remains a platform concern unless a future app requirement explicitly adds it.

---

# 6. World architecture

## APP-WORLD-001 — Five Worlds

The product architecture contains:

1. World 1 — VERY SIMPLE
2. World 2 — SIMPLE
3. World 3 — MEDIUM
4. World 4 — HARD
5. World 5 — VERY HARD

All learners start in World 1.

## APP-WORLD-002 — World 1 implementation scope

World 1 is the fully specified current product.

The app architecture must avoid hard-coding assumptions that prevent World 2–5 from being added.

## APP-WORLD-003 — World 2–5 broad strategy support

Future worlds will introduce increasingly strategic reading:

- World 2: skimming, scanning, keywords, fast information location;
- World 3: phrase/chunk reading and important-vs-supporting information;
- World 4: variable speed, previewing, selective rereading, structure/arguments;
- World 5: applied high-speed reading using the appropriate strategy for purpose.

Exact curricula, rendering spans and competency maps are **not defined by this app-only document**.

---

# 7. World 1 canonical sequence and stamina

## APP-W1-001 — 1,500 canonical sequence positions

World 1 contains exactly **1,500 canonical sequential passage positions**.

The app stores and advances a canonical sequence pointer independently of practice/reassessment activities.

## APP-W1-002 — First 150

For canonical passages 1–150:

- target length = 100 canonical count tokens;
- display span = one word at a time;
- the approved 15 RS × 10 P coordinate system is consumed from the canonical package;
- learner delivery order follows `delivery_session`, not registry ID.

## APP-W1-003 — Stamina staircase

The canonical word-count schedule is:

| Passage range | Word count |
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

The same pattern repeats for each subsequent 150-passage block:

- first 25: previous milestone +25;
- next 25: +50;
- next 25: +75;
- final 75: consolidate at the next +100 milestone.

Passage 1500 is a **1,000-word** passage.

## APP-W1-004 — One meaningful challenge increase at a time

If a new stamina length begins at the same moment a +1 WPM award becomes eligible, the new length is experienced first at the previous/current WPM.

The speed increase may take effect only on subsequent valid new-passage evidence.

## APP-W1-005 — Progressive stamina validation

Production validation must demonstrate acceptable transition at every +25-word step.

There is no direct 100→200 jump.

## APP-W1-006 — Canonical sequence is not altered by practice

Familiar practice, News Reader, technical retry, reassessment and revalidation activities have their own event IDs and must not consume or renumber canonical progression positions.

---

# 8. Initial ten-minute assessment

## APP-ASSESS-001 — Mandatory new-learner baseline

Before normal World 1 progression, a new learner completes a **10-minute adaptive starting assessment**.

## APP-ASSESS-002 — Purpose

The assessment establishes the learner’s sustainable starting WPM **today**.

It is not an age-placement test and is not a peer-comparison test.

## APP-ASSESS-003 — Comprehension decides starting speed

Comprehension is the decisive evidence for starting WPM.

News Reader/oral delivery quality must not reduce or block the starting WPM.

## APP-ASSESS-004 — Deterministic and auditable

The assessment search algorithm may be calibrated, but it must be:

- bounded;
- deterministic for the same evidence/config;
- auditable;
- versioned;
- designed to avoid selecting a speed from one lucky attempt.

## APP-ASSESS-005 — Baseline persistence

Persist:

- assessment ID;
- learner ID;
- attempts/evidence;
- rules/config version;
- selected starting WPM;
- completion timestamp.

## APP-ASSESS-006 — First canonical passage

Canonical passage 1 begins at the stored personal starting WPM.

---

# 9. Core reader runtime

## APP-READ-001 — Canonical token stream

The renderer must consume the approved passage body through the canonical tokenizer/counting contract.

For the first 150 passages, the same immutable token indices used by the approved package must drive:

- one-word display;
- progress position;
- oral alignment where applicable;
- analytics/scoring coordinates.

Unassessable speech must never retokenize or renumber the passage.

## APP-READ-002 — WPM-driven display

The reader renders the approved token sequence at the active session WPM.

The core WPM is engine-owned evidence state, not a disposable UI-only speed value.

## APP-READ-003 — Passage completion event

A new canonical passage produces one idempotent completion event before progression decisions are made.

Duplicate/replayed client events must not duplicate attempts, evidence, rewards or Level Ups.

## APP-READ-004 — Nonblocking canonical progression

A weak oral result or a `NOT_GREEN` comprehension result does **not** lock the next canonical passage.

What may HOLD is the **WPM**, not the learner’s ability to continue reading.

## APP-READ-005 — Technical interruption

A technical failure must not be recorded as learner failure.

The reader must support safe retry/recovery while preserving the canonical sequence and already committed evidence.

## APP-READ-006 — Session boundary

A platform session ending must not corrupt a passage or create phantom completion.

Only a valid completion event enters progression evidence.

---

# 10. WPM progression

## APP-WPM-001 — World 1 ceiling

Maximum World 1 core display/training speed = **150 WPM**.

150 WPM is a ceiling, not a required graduation/completion speed.

## APP-WPM-002 — Level semantics

For core reading:

> **+1 WPM = one Level Up = one Babystep**

No other metric creates a numbered core Level Up.

## APP-WPM-003 — Comprehension-only WPM gate

Only the approved comprehension result controls core WPM progression.

The following never block or reduce WPM:

- News Reader score;
- oral pronunciation score;
- intonation;
- delivery confidence;
- missing News Reader attempt.

## APP-WPM-004 — Internal GREEN threshold

For a valid new canonical passage:

- comprehension score ≥75% → `GREEN`;
- comprehension score <75% → `NOT_GREEN`.

The 75% threshold is a **FROZEN product rule**.

## APP-WPM-005 — First-five rule

At a newly earned/current WPM, consider the first five `NEW_PROGRESSION` passages at that WPM:

- 5/5 GREEN → +1 WPM;
- 4/5 GREEN → +1 WPM;
- 0/5, 1/5, 2/5, 3/5 GREEN → HOLD current WPM and move to post-five logic.

Do not replace this with an average percentage.

## APP-WPM-006 — Post-five rule

If no Level Up occurred after the first five new passages:

- stay at current WPM;
- starting with new passage 6 at that WPM, require **3 consecutive GREEN** new canonical passages;
- any `NOT_GREEN` resets that streak to zero;
- 3 consecutive GREEN triggers +1 WPM.

## APP-WPM-007 — No decrement

Normal World 1 progression contains **no WPM decrement mechanism**.

Once earned, WPM cannot be taken away by later learner difficulty.

## APP-WPM-008 — 149→150 and ceiling behaviour

149 WPM can Level Up to 150 WPM.

At 150 WPM, continued valid reading may progress the sequence/readiness but can never award 151 WPM in World 1.

## APP-WPM-009 — Idempotent Level Up

Reprocessing the same completion event must not award a second Level Up.

## APP-WPM-010 — Atomic award

The WPM change, triggering evidence snapshot, explanation code and version references must commit atomically.

---

# 11. Familiar-passage confidence practice

## APP-PRAC-001 — Architectural rule

> **New passages prove progress. Earlier passages practise progress.**

## APP-PRAC-002 — Practice eligibility

When the learner is holding at the same WPM, the adaptive engine may insert already-completed passages for confidence practice.

## APP-PRAC-003 — Current WPM

A familiar passage is served at the learner’s **current earned WPM**, not necessarily the WPM at which it was first read.

## APP-PRAC-004 — `FAMILIAR_PRACTICE`

Every such attempt is explicitly typed `FAMILIAR_PRACTICE`.

## APP-PRAC-005 — Excluded from progression

Familiar practice:

- does not advance the canonical pointer;
- does not replace a new passage;
- does not rewrite the original attempt;
- does not count toward first-five evidence;
- does not count toward the three-consecutive-GREEN streak;
- may store separate practice analytics.

## APP-PRAC-006 — Return naturally

After practice, resume new canonical passages at the same earned WPM.

## APP-PRAC-007 — Learner does not see remediation state

Do not label the child as:

- failed;
- struggling;
- remedial;
- support mode;
- downgraded;
- moved back.

---

# 12. Comprehension evidence

## APP-COMP-001 — Hybrid model

Every `NEW_PROGRESSION` passage uses:

1. structured comprehension evidence; and
2. learner free spoken comprehension expression.

Both are stored separately.

## APP-COMP-002 — Weighting principle

Structured evidence must have the larger weight.

Spoken expression must have a lower but materially meaningful weight.

## APP-COMP-003 — Current pilot weighting

Initial configuration:

- structured questions = **70%**
- spoken expression = **30%**

Status: `PROVISIONAL_PILOT`.

This ratio must exist in one versioned configuration source, not duplicated in code.

## APP-COMP-004 — 75% threshold is independent of weight calibration

Changing the 70/30 weighting through calibration does not silently change the frozen 75% GREEN threshold.

## APP-COMP-005 — Structured item-level storage

Persist item-level:

- item ID;
- response;
- keyed/scored result;
- evidence/meaning-unit mapping where applicable;
- scoring version.

## APP-COMP-006 — P1→P10 runtime compatibility

For the first 150 passages, the question renderer/scorer must execute the approved P1→P10 comprehension contract supplied by the content package.

The app does not invent alternate comprehension levels.

## APP-COMP-007 — Free explanation prompt

The learner is invited to explain the passage in their own words, as though telling the story/explanation to someone else.

It must not require exact wording.

## APP-COMP-008 — Semantic evaluation

The spoken-expression evaluator rewards passage-supported:

- relevance;
- key events/ideas;
- useful supporting detail;
- relationships/connections;
- cause/effect or motivation;
- coherent sequencing;
- clarity;
- completeness.

It must not reward sophisticated vocabulary merely for sounding advanced.

## APP-COMP-009 — Accent/language fairness

The evaluator must not unfairly penalize:

- legitimate accent variation;
- Indian English pronunciation;
- ordinary grammar variation;
- dialect;
- speaking style;
- age-appropriate wording.

## APP-COMP-010 — Editable transcript

When browser STT is used:

1. retain the raw recognized transcript;
2. show the transcript to the learner;
3. allow the learner to correct recognition errors before submission;
4. retain the learner-confirmed/corrected transcript separately;
5. retain edit metadata sufficient to audit that a correction occurred;
6. lock the submitted transcript before scoring/BPC.

The learner-confirmed transcript represents the learner’s intended wording for semantic evaluation; the raw ASR transcript remains audit evidence.

## APP-COMP-011 — Browser-native STT

Initial implementation uses supported browser speech recognition APIs in the reference browser, with capability detection.

Unsupported/unavailable speech APIs must produce a graceful technical path, not learner failure.

## APP-COMP-012 — ASR is evidence, not truth

Low-confidence recognition must not automatically reduce the learner’s score.

Maintain explicit states such as:

- resolved;
- unresolved;
- technical invalidity.

## APP-COMP-013 — Technical spoken evidence

If spoken evidence cannot be used reliably:

- do not fabricate a low score;
- preserve the technical reason;
- offer the approved retry/fallback;
- do not contaminate immutable independent evidence.

## APP-COMP-014 — First-attempt independence

The original independent attempt remains immutable.

Any attempt after:

- hint;
- targeted remediation;
- model answer;
- Best Possible Comprehension exposure

must be marked assisted/instructional and cannot silently replace first-attempt independent evidence.

---

# 13. Best Possible Comprehension (BPC)

## APP-BPC-001 — Mandatory after completed passage scoring

Every completed passage must have a Best Possible Comprehension experience after learner evidence is submitted and locked.

This applies to both GREEN and NOT_GREEN passages.

## APP-BPC-002 — Ordering

BPC must not be available before independent scoring is committed.

## APP-BPC-003 — Purpose

BPC models how a strong reader would explain what was understood in a connected, child-friendly way.

## APP-BPC-004 — Not an answer-key dump

BPC is not:

- sentence-by-sentence repetition;
- mechanical paraphrase;
- merely quiz answers.

## APP-BPC-005 — Fidelity

BPC may connect supported meaning but must not invent unsupported:

- events;
- motives;
- facts;
- causal relationships;
- lessons;
- judgments;
- conclusions.

## APP-BPC-006 — Cross-World capability

The app architecture must support BPC in every World, with richer expression expectations as future World specifications require.

## APP-BPC-007 — Controlled production

Production BPC content should be pre-generated/QA-approved where deterministic child-safety/fidelity is required.

Uncontrolled runtime generation must not be allowed to contaminate scored evidence.

---

# 14. Learner feedback and motivation

## APP-UX-001 — Scores are private

Never show the learner:

- numeric comprehension percentage;
- the 75% threshold;
- `GREEN`;
- `NOT_GREEN`;
- `PASS`;
- `FAIL`;
- internal readiness states.

## APP-UX-002 — GREEN feedback

For a GREEN new passage:

- store exact score internally;
- count evidence;
- show positive appreciation;
- show BPC.

Do not say “you got 75%”.

## APP-UX-003 — NOT_GREEN feedback

For NOT_GREEN:

- store exact score internally;
- show neutral/encouraging language;
- show BPC;
- continue progression at the appropriate WPM;
- do not display failure language.

## APP-UX-004 — Level-Up celebration

A validated +1 WPM receives a larger celebration.

Canonical phrase:

> **You Levelled Up!**

Do not use “graduated” for this event.

## APP-UX-005 — Book-time impact

On Level Up, show an estimated real-world reading-time impact using a standard 50,000-word reference book.

Formula:

`estimated_minutes = 50,000 / WPM`

Show:

- old WPM → new WPM;
- estimated new reading time;
- approximate time saved versus previous WPM;
- optionally time saved versus original baseline.

Use “about” / “estimated”; do not promise real-book performance.

## APP-UX-006 — No peer comparison

No learner screen may display ranking, percentile or peer comparison.

## APP-UX-007 — Confidence-first language scan

Production learner routes must pass an automated language scan for prohibited internal/negative labels.

---

# 15. News Reader — parallel oral-communication track

## APP-NR-001 — Parallel namespace

News Reader is a distinct oral-communication track, separate from core WPM progression.

## APP-NR-002 — Purpose

News Reader may coach:

- oral reading;
- pronunciation;
- clarity;
- phrasing;
- meaningful pauses;
- emphasis;
- intonation;
- confidence;
- expressive communication.

## APP-NR-003 — Never a core gate

News Reader cannot:

- block WPM Level Up;
- reduce earned WPM;
- block the next canonical passage;
- block core World progression;
- substitute for comprehension GREEN evidence.

## APP-NR-004 — Shared passage, separate evidence

The same canonical passage may be used, but News Reader attempts and metrics use separate state/evidence.

## APP-NR-005 — Reference delivery policy

Reference priority:

1. approved canonical pre-generated reference audio, when an asset exists and passes its asset/version/hash/QA contract;
2. otherwise browser/on-device TTS.

## APP-NR-006 — Interim TTS policy

Until canonical audio exists:

- target pace = **145 WPM**;
- female voice only;
- prefer Microsoft Neerja when exposed by the browser;
- otherwise choose the best available female English voice;
- Indian English is preferred where available;
- do not select a male voice;
- apply the same selection policy on every supported client.

## APP-NR-007 — Browser TTS

Use browser/on-device `speechSynthesis`-class capability with explicit capability detection for the interim reference.

## APP-NR-008 — Read-along highlight

The highlighted learner-visible word must follow the reference narration in the approved read-along behaviour, sentence by sentence.

## APP-NR-009 — Two-read coaching

Where the activity uses the two-read model:

- child may read the same passage aloud twice;
- store attempts separately;
- compute improvement/delta;
- frame second read as practice, not punishment.

## APP-NR-010 — Missing microphone is nonblocking

Unavailable/denied microphone may disable/defer News Reader capture but must not mutate core WPM or canonical progression.

---

# 16. Oral-reading telemetry and first-150 competency diagnostics

These capabilities are retained as diagnostic/competency evidence. **They do not override the v3 rule that News Reader/oral performance cannot block core WPM or core World progression.**

## APP-ORAL-001 — Telemetry capture

Where oral reading is captured, support at minimum:

- expected tokens;
- aligned correct words;
- substitutions;
- omissions;
- insertions;
- repetitions;
- accepted self-corrections;
- self-correction latency;
- long hesitations;
- full restarts;
- completion time;
- WPM;
- punctuation handling;
- unfamiliar/challenge-word recovery;
- ASR confidence/uncertainty;
- sample validity.

## APP-ORAL-002 — Deterministic scoring order

For applicable canonical oral-scoring contracts:

1. validate recording/sample;
2. tokenize/normalize expected text using canonical tokenizer;
3. align spoken events;
4. classify substitution/omission/insertion/repetition;
5. identify accepted self-corrections;
6. compute first-pass/final accuracy;
7. compute time/WPM/hesitation/restart/punctuation/recovery;
8. apply the supplied RS/P rule;
9. resolve attempt outcome before lifecycle decisions.

## APP-ORAL-003 — Sample validity before specialist score

Invalid/unusable audio must be resolved before a specialized oral metric can pass.

## APP-ORAL-004 — ASR uncertainty is not child error

Low-confidence/unresolved recognition is unassessable/technical evidence, not an automatic pronunciation or reading error.

## APP-ORAL-005 — Accent fairness

Accent alone is never a lexical failure.

## APP-ORAL-006 — Same-RS personal baseline

For the first 150 architecture, Sessions 1–15 establish the 15 RS-specific P1 baselines.

Never treat Session 1 as the global baseline for all RSs.

## APP-ORAL-007 — No cross-RS raw comparison

Progress comparison is:

`same learner + same RS + later P`

Do not average unlike raw RS metrics into a misleading “overall improvement %”.

## APP-ORAL-008 — Competency timelines

Internal/parent reporting may show the 15 competency trajectories separately.

A complete composite may be shown only at a complete round boundary.

## APP-ORAL-009 — Baseline strength

A learner already strong at P1 is recognized as baseline-strong; do not invent a requirement that the child must numerically “improve” just to prove progress.

---

# 17. Readiness, reassessment and controlled forms

## APP-READY-001 — Controlled readiness forms

Readiness-critical PRIMARY, CONFIRMATION, reassessment and revalidation evidence must use pre-generated, independently QA-approved equivalent forms.

Runtime AI-generated unapproved content cannot certify readiness.

## APP-READY-002 — Identity separation

Persist separate identifiers for:

- canonical/registry passage;
- form family;
- assessment form;
- delivery event;
- attempt;
- form role.

Readiness forms must not consume/renumber canonical World 1 positions.

## APP-READY-003 — Attempt outcome ontology

Support at minimum:

- `PASS`
- `FAIL`
- `TECHNICAL_INVALID`
- `INSUFFICIENT_EVIDENCE`
- `INVALID_FORM`

Technical/evidence/form invalidity is not learner failure.

## APP-READY-004 — Attempt roles

Support the canonical lifecycle roles required by the current approved scoring contract, including:

- `PRIMARY`
- `NEW_CYCLE_PRIMARY`
- `CONFIRMATION`
- `NEW_CYCLE_CONFIRMATION`
- `TECHNICAL_REPLACEMENT`
- `REVALIDATION`

## APP-READY-005 — Initial confirmation cannot be skipped

Where a readiness stream uses two-form confirmation, a PRIMARY pass moves to CONFIRMATION; one primary pass cannot silently close the stream.

## APP-READY-006 — No retry lottery

A valid learner failure cannot be followed by unlimited fresh forms until a pass appears.

A failed cycle requires the approved remediation/learning path and then a new cycle.

All valid results remain in history.

## APP-READY-007 — Technical replacement preserves lifecycle phase

A technical-invalid/insufficient-evidence/invalid-form outcome must not advance or fail the learner lifecycle.

It produces the appropriate replacement requirement for the same protected role.

## APP-READY-008 — Core progression precedence

Any historical readiness/oral rule that would make News Reader/oral communication a blocker for core WPM or core World progression is superseded.

Readiness diagnostics may remain available, but they do not contradict APP-NR-003.

---

# 18. Evidence recency and revalidation

## APP-RECENCY-001 — Current evidence principle

Readiness evidence represents current demonstrated ability and cannot remain current indefinitely.

## APP-RECENCY-002 — Versioned configurable clocks

The architecture supports separate auditable triggers based on:

- calendar age;
- subsequent valid learning sessions;
- inactivity.

The first configured trigger to fire makes affected evidence due for revalidation.

## APP-RECENCY-003 — Current pilot defaults

Current `PROVISIONAL_PILOT` defaults:

- calendar age: **more than 56 completed calendar days** after the evidence anchor;
- subsequent valid Band-A sessions: **more than 16** after the anchor;
- inactivity: **14 complete learner-local calendar days** without a completed SpeedReader learning activity.

The 14-day inactivity default is the later app decision and replaces the earlier 28-day inactivity pilot value.

These values are configuration, not hard-coded constants scattered through the code.

## APP-RECENCY-004 — Independent evidence streams

Where separate evidence streams are maintained, a stale/invalid stream must not silently overwrite an unrelated current stream.

## APP-RECENCY-005 — First trigger wins

As soon as one applicable recency trigger is satisfied:

- affected evidence becomes non-current;
- revalidation is due;
- the triggering reason is persisted.

## APP-RECENCY-006 — Version invalidation has precedence

A materially incompatible scoring/threshold/tokenizer/evidence-rule change invalidates affected prior evidence regardless of elapsed-time clocks.

Version invalidation requires a new compatible readiness cycle, not a one-form stale-evidence shortcut.

## APP-RECENCY-007 — Revalidation pass/fail

For a recency-only revalidation:

- valid pass → current evidence with new anchor;
- valid failure → remediation then a full new cycle for the affected stream;
- technical invalidity / insufficient evidence / invalid form → keep revalidation pending and replace evidence/form appropriately.

## APP-RECENCY-008 — Audit

Persist enough data to reproduce every recency/revalidation decision, including:

- learner;
- RS/stream where applicable;
- anchor event/time;
- learner-local date basis;
- evaluation time;
- age/session/inactivity calculations;
- first trigger;
- rules/scoring/config/form versions;
- resulting state.

---

# 19. World 1 completion

## APP-CLOSE-001 — P1500 alone is not mastery

Reaching canonical passage 1500 completes the World 1 sequence but does not by itself certify mastery.

## APP-CLOSE-002 — 150 WPM is not required

A learner may satisfy World 1 core completion below 150 WPM.

## APP-CLOSE-003 — Level Ups are not readiness certification

WPM Level Ups are personal speed achievements and do not replace any applicable approved core readiness evidence.

## APP-CLOSE-004 — News Reader cannot block core World progression

Weak/missing News Reader evidence does not prevent core World advancement once applicable core reading requirements are satisfied.

---

# 20. Attempt and event model

## APP-DATA-001 — Explicit attempt type

Every activity attempt must carry a non-null type from the approved ontology.

At minimum support:

- `NEW_PROGRESSION`
- `FAMILIAR_PRACTICE`
- `INITIAL_ASSESSMENT`
- `ASSESSMENT`
- `REASSESSMENT`
- `REVALIDATION`
- `NEWS_READER`
- technical replacement role where required by readiness.

## APP-DATA-002 — Required attempt fields

Every relevant attempt persists at minimum:

- attempt ID;
- idempotency/event key;
- learner ID;
- authorized app-session ID;
- canonical passage ID where applicable;
- registry/RS/P coordinate where applicable;
- form family/form ID where applicable;
- attempt type/role;
- displayed WPM;
- word count;
- start/completion timestamps;
- structured-question evidence;
- spoken evidence status;
- raw transcript where captured;
- learner-confirmed transcript where captured;
- internal comprehension score where applicable;
- GREEN/NOT_GREEN where applicable;
- News Reader metrics where applicable;
- readiness outcome where applicable;
- Level-Up state before/after;
- canonical pointer before/after;
- technical/ASR state;
- assistance/exposure flags;
- scoring/rules/config/content versions.

## APP-DATA-003 — Immutable evidence

Committed historical attempts are immutable.

Corrections use:

- explicit correction records;
- replacement links;
- superseding events;
- versioned decisions.

Do not mutate history to make the latest result look cleaner.

## APP-DATA-004 — Evidence separation

The data model must make it impossible for:

- familiar practice to count as new-progression evidence;
- News Reader evidence to count as comprehension GREEN;
- post-BPC attempts to overwrite independent evidence;
- technical invalidity to become learner failure;
- diagnostic oral metrics to mutate core WPM.

## APP-DATA-005 — Decision ledger

Persist progression decisions independently from raw attempts, with:

- decision ID;
- input evidence IDs;
- decision type (`LEVEL_UP`, `HOLD`, etc.);
- explanation/reason code;
- before/after WPM;
- rule/config versions;
- timestamp.

## APP-DATA-006 — Explainability

For every Level Up/HOLD, the backend must reconstruct the decision without chat history.

Examples:

- `LEVEL_UP:first_five_green=4/5`
- `HOLD:first_five_green=3/5`
- `LEVEL_UP:post_five_consecutive_green=3`
- `PRACTICE_ONLY:excluded_from_progression_evidence`

These codes are internal.

## APP-DATA-007 — Transaction safety

Progression update + decision ledger + evidence snapshot must commit atomically.

## APP-DATA-008 — Idempotency

Client retries, network retries and event replay cannot duplicate:

- attempts;
- canonical advancement;
- Level Ups;
- celebrations;
- recency counters.

## APP-DATA-009 — Server persistence

Production learner state/evidence must be server-persisted.

Browser `localStorage` may be used only for non-authoritative transient UI/cache state.

## APP-DATA-010 — Supabase responsibility

SpeedReader’s Supabase data store contains SpeedReader learning/runtime data.

Account authentication/billing authority remains the Babysteps platform.

---

# 21. Suggested production database domains

Claude Code should implement equivalent normalized domains; exact table names may differ, but domain separation must remain.

## APP-DB-001 — Learner app state

Store SpeedReader-specific state such as:

- learner ID;
- World;
- canonical pointer;
- current earned WPM;
- initial baseline WPM;
- current WPM evidence-window start;
- post-five streak;
- last completed learning date;
- active config versions.

## APP-DB-002 — Attempts

Immutable attempt/event table as defined above.

## APP-DB-003 — Structured responses

One row/object per scored structured item.

## APP-DB-004 — Spoken evidence

Separate speech/transcript/evaluation record linked to attempt.

## APP-DB-005 — Progression decisions

Immutable decision ledger.

## APP-DB-006 — Practice selection/history

Store why a familiar passage was selected and its practice outcome without contaminating canonical evidence.

## APP-DB-007 — News Reader attempts

Separate News Reader metrics/state namespace.

## APP-DB-008 — Readiness cycles/forms

Store:

- cycle;
- protected role;
- selected approved form;
- outcome;
- remediation/new-cycle transitions;
- evidence-current flags.

## APP-DB-009 — Calibration versions

Versioned threshold/config table or equivalent immutable configuration registry.

## APP-DB-010 — Content package identity

Each delivered/scored activity must identify the approved content package/version/hash or equivalent immutable content revision.

---

# 22. Parent/progress reporting

## APP-REPORT-001 — Child vs parent visibility

Child-facing feedback follows confidence-first privacy rules.

A parent/internal report may contain more detail, but must still avoid misleading cross-RS comparisons.

## APP-REPORT-002 — Personal progress

Reports focus on:

- personal starting WPM;
- current earned WPM;
- Level Ups;
- canonical passage/stamina progress;
- personal historical trend;
- competency timelines where available;
- practice/readiness status in parent-appropriate language;
- News Reader improvement separately.

## APP-REPORT-003 — No peer rank

Do not add peer rank/percentile to parent reports as a progression mechanic unless the product architecture is explicitly changed.

## APP-REPORT-004 — Complete-round composites only

For first-150 RS reporting, a 15-RS composite may be shown only after every RS has reached the same P level.

---

# 23. Calibration and product analytics

## APP-CAL-001 — Versioned pilot parameters

Pilot/calibration parameters live in one versioned configuration source.

Examples:

- 70/30 comprehension weighting;
- initial-assessment search parameters;
- ASR confidence thresholds;
- oral scoring empirical thresholds where still provisional;
- recency limits.

## APP-CAL-002 — Frozen 75% rule

The 75% passage GREEN threshold is not a routine calibration parameter.

Changing it requires an explicit product version/approval.

## APP-CAL-003 — Post-launch calibration evidence

After sufficient real usage, the product may review:

- score distributions;
- cohort size;
- passage splits;
- RS/P splits where applicable;
- device/browser effects;
- ASR uncertainty;
- progression rate;
- time to Level Up;
- practice frequency;
- false-ready/false-not-ready indicators where readiness is evaluated;
- stamina transition outcomes;
- retention/engagement.

## APP-CAL-004 — No automatic threshold mutation

Analytics may recommend calibration; production thresholds/config do not auto-change from learner data.

Every change requires explicit approval/versioning/effective date.

## APP-CAL-005 — Historical replay

The system must be able to replay a historical decision under its original config and reproduce the same result.

---

# 24. Mobile, browser, accessibility and reliability

## APP-NFR-001 — Responsive learner journey

All learner screens must be usable on phone, tablet and desktop.

The mobile journey is a first-class release target.

## APP-NFR-002 — Microphone permissions

Request microphone permission only when a speech activity needs it.

Permission denial must be handled as a capability/technical condition, not learner failure.

## APP-NFR-003 — Capability detection

Detect at runtime:

- microphone availability;
- speech recognition API;
- speech synthesis API;
- available voices;
- audio playback support.

## APP-NFR-004 — Graceful degradation

Missing optional speech capability cannot corrupt or reduce core reading state.

## APP-NFR-005 — Accessibility QA

Every production learner flow must pass the Babysteps accessibility QA gate, including practical keyboard/focus/readability/touch usability appropriate to the supported devices.

## APP-NFR-006 — Child usability

No production flow should expose developer concepts such as:

- rule IDs;
- raw state names;
- hashes;
- attempt outcomes;
- `GREEN`;
- `NOT_GREEN`;
- stack traces;
- debug telemetry.

## APP-NFR-007 — Diagnostics protection

Developer/demo/diagnostic routes must be:

- removed from production navigation; and
- protected or excluded from production deployment where they expose internal learner states.

The legacy 36-level demo must not remain the actual learner journey.

## APP-NFR-008 — Fail safe

On ambiguous/technical state:

- do not penalize;
- do not fabricate evidence;
- do not award from invalid evidence;
- preserve earned WPM;
- preserve committed history;
- recover naturally.

## APP-NFR-009 — Performance

Reader timing must remain stable enough that configured WPM is not materially distorted by avoidable client rendering delays.

Timing-sensitive behaviour must be tested in the reference browser and mobile environment.

---

# 25. Privacy and cross-app telemetry

## APP-PRIV-001 — Least necessary learner data

SpeedReader stores only data necessary for learning, evidence, audit, safety and approved analytics.

## APP-PRIV-002 — Container identity

Do not replicate parent credentials inside SpeedReader application tables.

Use platform learner/account identifiers and authorized session claims.

## APP-PRIV-003 — Structured cross-app progress only

When reporting back to Babysteps, share approved structured progress fields.

Raw speech transcript/audio or unstructured child messages must not become general cross-app telemetry unless an explicit privacy contract authorizes it.

## APP-PRIV-004 — No public debug evidence

Raw learner evidence, transcripts, internal scores and readiness states must never be exposed through public diagnostic routes.

---

# 26. Application APIs/domain services

The concrete route names may vary, but the app must expose equivalent server/domain capabilities.

## APP-API-001 — Bootstrap

Authorized bootstrap returns:

- learner context;
- entitlement/session context;
- SpeedReader state;
- next allowed activity;
- active config/version identifiers;
- client capability requirements.

## APP-API-002 — Initial assessment

Start/submit/finalize initial assessment idempotently.

## APP-API-003 — Next activity

A deterministic scheduler chooses among:

- new canonical progression;
- familiar practice;
- platform review;
- approved readiness/revalidation;
- News Reader/parallel activity where applicable.

The scheduler must preserve each domain’s evidence rules.

## APP-API-004 — Passage completion

Server receives completion/evidence, validates it, stores immutable attempt, scores comprehension, makes progression decision and returns child-safe feedback.

## APP-API-005 — Speech evidence

Speech/transcript submission supports:

- raw transcript;
- corrected transcript;
- confidence/technical state;
- evaluator output;
- rule version.

## APP-API-006 — BPC retrieval

BPC becomes available only after scoring evidence is locked.

## APP-API-007 — News Reader

Separate start/submit/reference/coaching path and state.

## APP-API-008 — Progress

Return child-safe progress and separately authorized parent/internal detail.

## APP-API-009 — Resume

Resume a valid accidental-close session without duplicating committed events.

## APP-API-010 — Calibration/ops

Authorized internal endpoints/jobs may expose aggregate calibration/operational metrics but never child-facing internal state.

---

# 27. Runtime use of the approved first-150 Knowledge Map

The app does not duplicate content rules, but it must execute the following approved runtime contracts for the first 150 passages where they remain compatible with v3.

## APP-KM-001 — Correct delivery coordinate

Use canonical `delivery_session`, RS and P metadata supplied by the approved package.

## APP-KM-002 — Shared canonical tokenizer

Use the package tokenizer/counting version for:

- renderer;
- token positions;
- applicable ASR alignment;
- scoring denominators;
- WPM coordinates.

## APP-KM-003 — Fixed segment coordinates

Where scoring uses thirds/quartiles, use the canonical fixed token-coordinate segmentation supplied by the package.

Unassessable audio does not cause resegmentation.

## APP-KM-004 — Deterministic scoring contracts

The app executes the versioned canonical scoring/attempt contract rather than locally inventing RS thresholds.

## APP-KM-005 — Attempt validity first

Technical validity/evidence sufficiency is resolved before PASS/FAIL.

## APP-KM-006 — Primary/confirmation lifecycle

Where applicable, execute the canonical protected-role transitions exactly.

## APP-KM-007 — P10 primary item

Where an approved readiness form defines a designated primary item/dimension, execute the supplied rule exactly.

## APP-KM-008 — No compensation across independent evidence types

Do not allow one evidence stream to overwrite or fabricate another.

Core product progression precedence in this v3 document still applies.

## APP-KM-009 — Package/version validation

Reject mixed, missing or hash/version-incompatible normative content/scoring packages.

Production must fail closed rather than silently combining versions.

---

# 28. Claude Code implementation rules

## CLAUDE-001 — Read before editing

Before changing code, Claude Code must read:

1. this v3.0 app specification;
2. the current approved first-150 canonical Knowledge Map package required for runtime;
3. the current repository traceability report;
4. existing `hosted-app/lib/v2` domain modules/tests;
5. Babysteps container contracts.

## CLAUDE-002 — Reuse verified domain logic

Do not rebuild working v2 domain modules simply to reorganize code.

Reuse/refactor them only when needed to integrate the definitive learner journey.

## CLAUDE-003 — TDD for every requirement

For each implementation slice:

1. map requirement → test;
2. write/update a failing test first where behaviour is not already covered;
3. make the smallest compliant implementation;
4. run targeted test;
5. refactor;
6. run the full relevant suite.

## CLAUDE-004 — Traceability is mandatory

Maintain a machine-readable or Markdown traceability matrix with:

- requirement ID;
- module(s);
- tests;
- migration/schema;
- UI route/component;
- status;
- verification evidence;
- unresolved blocker if any.

## CLAUDE-005 — Do not implement content authoring

Claude Code’s app task must not modify passage-generation/content-pipeline rules unless separately instructed by the Content Requirements specification.

---

# 29. Claude Code implementation sequence

This is the recommended implementation order. Complete each phase with tests before advancing.

## Phase 0 — Baseline, branch and traceability

1. Create a dedicated implementation branch.
2. Run current build/tests.
3. Record baseline failures.
4. Generate/update requirement traceability.
5. Inventory existing v2 modules.
6. Identify stale production paths:
   - 36-level/6-world learner demo;
   - 70-point legacy unlock;
   - localStorage-authoritative progress;
   - public diagnostic routes;
   - any WPM decrement;
   - oral-as-core-gate;
   - direct 100→200 jump.
7. Do **not** delete working v2 domain modules.

**Exit:** baseline report + stale-rule inventory + requirement-to-module plan.

## Phase 1 — Canonical domain configuration

Implement one versioned app-rule/config registry covering:

- five worlds;
- World 1 1,500 sequence;
- stamina staircase;
- 150 WPM ceiling;
- 75% frozen GREEN threshold;
- 70/30 pilot weighting;
- News Reader reference policy;
- recency pilot values;
- tokenizer/content/scoring versions.

Remove duplicated magic numbers.

**Exit:** all configuration governance/unit tests pass.

## Phase 2 — Production persistence

Replace in-memory/browser-authoritative progress with Supabase-backed persistence.

Implement migrations/domain repositories for:

- learner app state;
- attempts;
- structured responses;
- spoken evidence;
- progression decisions;
- familiar practice;
- News Reader;
- readiness cycles/forms;
- recency/evidence state;
- calibration versions.

Add idempotency keys, unique constraints and transactional progression.

**Exit:** persistence integration tests + transaction/idempotency tests pass.

## Phase 3 — Babysteps container/session integration

Wire:

- identity/manifest;
- authorized bootstrap;
- learner context;
- session authorization;
- return/progress sync;
- same-learner concurrent-session protection;
- 45-minute/2-per-week host contract;
- every-6th review marker;
- 15-minute accidental-close resume.

SpeedReader must not add independent login/payment flows.

**Exit:** container contract integration tests and resume/concurrency tests pass.

## Phase 4 — Initial assessment learner flow

Build real learner UI for the ten-minute baseline:

- child-friendly intro;
- bounded adaptive attempts;
- comprehension evidence;
- deterministic baseline selection;
- store selected starting WPM;
- first passage starts at baseline.

No News Reader gate.

**Exit:** AC-P01 end-to-end passes.

## Phase 5 — Production reader

Replace legacy learner demo with the v3 reader:

- approved content loader;
- canonical tokenizer;
- one-word first-150 rendering;
- WPM timing;
- completion event;
- canonical pointer;
- mobile/responsive layout;
- safe session interruption/resume.

**Exit:** real learner route uses v3 engine, not demo state.

## Phase 6 — Structured comprehension

Implement the approved question renderer/scorer:

- item-level responses;
- canonical P-level metadata;
- deterministic score;
- immutable submission.

Question content comes from approved content package, not app code.

**Exit:** item-level scoring tests + E2E passage completion path pass.

## Phase 7 — Spoken comprehension + transcript correction

Implement:

- microphone permission;
- browser STT capability detection;
- raw transcript;
- editable learner-confirmed transcript;
- submit lock;
- semantic evaluator;
- explicit uncertainty state;
- graceful technical fallback.

Keep raw/corrected transcript separate.

**Exit:** ASR uncertainty and edit-history tests pass; no ASR-only learner failure.

## Phase 8 — Hybrid scoring/progression transaction

Wire:

- structured component;
- spoken component;
- configured 70/30;
- frozen 75 threshold;
- GREEN/NOT_GREEN internal result;
- first-five rule;
- post-five streak;
- no decrement;
- 150 ceiling;
- stamina collision rule;
- atomic decision ledger.

**Exit:** all AC-P03–P10/P12–P15/P19/P21–P22 and boundary tests pass.

## Phase 9 — Familiar practice and review sessions

Implement deterministic practice selection from completed passages.

Ensure:

- current WPM;
- `FAMILIAR_PRACTICE`;
- no progression evidence;
- no canonical pointer advance;
- invisible support wording;
- every-6th platform review integrates through practice semantics.

**Exit:** practice property tests + learner-language tests pass.

## Phase 10 — BPC

Wire approved BPC content after scoring lock.

Guarantee:

- not available before scoring;
- available for GREEN and NOT_GREEN;
- exposure/assistance logged;
- later attempts cannot replace independent evidence.

**Exit:** BPC ordering/exposure tests pass; semantic content QA remains separate.

## Phase 11 — Learner feedback/celebrations

Build:

- passage encouragement;
- Level-Up animation/message;
- new WPM;
- 50,000-word estimated book time;
- time saved.

Run automated leak scan for internal states/negative labels.

**Exit:** real learner UI passes AC-P13/P19/P20/P29.

## Phase 12 — News Reader

Implement separate News Reader screens/state:

- reference TTS policy;
- female voice selection;
- 145 WPM;
- read-along highlighting;
- microphone capture;
- two-read attempt/delta;
- positive coaching;
- strict isolation from core progression.

**Exit:** News Reader E2E + isolation property tests pass.

## Phase 13 — First-150 oral diagnostics/readiness runtime

Integrate the canonical scoring package rather than hard-coding local thresholds.

Implement:

- telemetry capture/alignment;
- sample validity;
- RS-specific personal histories;
- controlled form bank selection;
- protected roles/outcomes;
- technical replacement;
- no retry lottery;
- primary/confirmation/revalidation orchestration.

Do not allow these diagnostics to violate the v3 nonblocking core WPM/World rules.

**Exit:** applicable Knowledge Map runtime ACs and edge cases pass.

## Phase 14 — Recency/revalidation

Implement configurable recency clocks and audit.

Current pilot defaults:

- >56 calendar days;
- >16 subsequent valid sessions;
- 14 complete inactive days.

Implement version invalidation precedence and revalidation outcomes.

**Exit:** exact-boundary and version-invalidation tests pass.

## Phase 15 — Parent/progress experience

Build parent/internal progress views with:

- starting/current WPM;
- passage/stamina progress;
- Level Ups;
- same-RS competency trajectories;
- News Reader separately;
- no peer ranking.

**Exit:** reporting correctness tests pass.

## Phase 16 — Calibration/ops

Add aggregate operational/calibration reporting:

- score distribution;
- progression distribution;
- practice frequency;
- ASR uncertainty;
- device/browser splits;
- stamina transitions;
- recency/revalidation load;
- config/version adoption.

No automatic threshold mutation.

**Exit:** calibration report is reproducible from stored evidence.

## Phase 17 — Production hardening

1. Remove production navigation to old demo routes.
2. Protect internal diagnostic routes.
3. Verify child-facing state leakage scan.
4. Verify authorization on learner/parent APIs.
5. Verify idempotency and replay safety.
6. Run mobile/reference-browser checks.
7. Verify no content-package mixed versions.
8. Verify deployment env configuration.
9. Build production artifact.

**Exit:** production candidate created; **not yet certified**.

## Phase 18 — Independent QA

Developer/Claude Code self-validation is necessary but cannot certify production.

Independent QA must execute:

- requirement traceability;
- product AC suite;
- engineering AC suite;
- applicable Knowledge Map runtime ACs;
- real learner journey;
- mobile/browser QA;
- accessibility/child-usability QA;
- stale-rule scan;
- contradiction scan.

Only independent QA may issue final PASS.

---

# 30. Required automated test commands

The repository currently provides equivalent commands and they should remain green:

```bash
npm run test:unit
npm run test:backend
npm run test:ui
npm run qa:sr
npm run build
```

Claude Code must also run any newly added Supabase/integration tests required by the implementation.

A `NOT_EXECUTED` mandatory test is not a PASS.

---

# 31. Product acceptance criteria

The original frozen v2 product ACs are retained below, with app-integration additions.

## Core product ACs

### AC-P01 — Ten-minute baseline
**PASS:** A new learner completes a bounded ten-minute assessment, receives a stored personal starting WPM, and first canonical passage begins at it. No age/peer or News Reader gate is used.

### AC-P02 — Personal progression
**PASS:** Two learners with different starting WPMs can follow different speed trajectories while consuming the same canonical sequence.

### AC-P03 — 150 WPM ceiling
**PASS:** No World 1 core passage is scheduled above 150 WPM.

### AC-P04 — First-five 4/5
**PASS:** `[GREEN, GREEN, NOT_GREEN, GREEN, GREEN]` gives exactly +1 WPM after the fifth valid new passage.

### AC-P05 — First-five 3/5
**PASS:** 3/5 GREEN holds WPM; no decrement.

### AC-P06 — Post-five G-G-G
**PASS:** After failing to Level Up in first five, exactly three consecutive GREEN new passages trigger +1 WPM.

### AC-P07 — Streak reset
**PASS:** A NOT_GREEN after one/two post-five GREEN resets the streak.

### AC-P08 — No decrement
**PASS:** No normal comprehension sequence can reduce earned WPM.

### AC-P09 — Familiar practice excluded
**PASS:** Any number of familiar-practice successes cannot Level Up or advance canonical sequence.

### AC-P10 — Familiar practice uses current WPM
**PASS:** Familiar passage is served at current earned WPM.

### AC-P11 — Invisible support
**PASS:** Learner screens contain no remedial/failure/downgrade state when practice activates.

### AC-P12 — Hybrid comprehension
**PASS:** Structured and spoken evidence are stored separately and produce one auditable internal result.

### AC-P13 — 75% privacy
**PASS:** ≥75 internal GREEN and <75 NOT_GREEN; child sees neither percentage nor state.

### AC-P14 — Spoken expression meaningful
**PASS:** Spoken component has a lower but material configured weight.

### AC-P15 — ASR fairness
**PASS:** Unresolved ASR cannot automatically become a low learner score.

### AC-P16 — BPC ordering
**PASS:** BPC is unavailable before learner evidence is submitted and scoring locked.

### AC-P17 — BPC semantic quality
**PASS:** Independent content QA confirms BPC is connected, child-appropriate and contains no unsupported facts/motives.

### AC-P18 — BPC for every completed passage
**PASS:** GREEN and NOT_GREEN completions both receive BPC.

### AC-P19 — Level-Up semantics
**PASS:** Core numbered Level Up changes only with exactly +1 WPM.

### AC-P20 — Book-time impact
**PASS:** Level Up shows correct 50,000-word estimated time/time-saved math with “about/estimated” wording.

### AC-P21 — Stamina staircase
**PASS:** All 1,500 IDs generate the approved word-count schedule and P1500 = 1,000 words.

### AC-P22 — No double jump
**PASS:** A new stamina length is not simultaneously first passage at a newly increased WPM.

### AC-P23 — News Reader isolation
**PASS:** Changing News Reader evidence cannot change core WPM output.

### AC-P24 — News Reader parallel metrics
**PASS:** Oral metrics/coaching are stored separately and do not penalize core reading.

### AC-P25 — World completion below 150
**PASS:** A valid fixture can complete applicable core requirements below 150 WPM.

### AC-P26 — Passage count alone insufficient
**PASS:** P1500 alone does not falsely certify mastery.

### AC-P27 — Approved reassessment forms
**PASS:** Certification evidence references approved equivalent form/version; unapproved runtime content cannot certify.

### AC-P28 — Auditability
**PASS:** Every Level Up/HOLD is reconstructed from immutable evidence + versioned rules.

### AC-P29 — Confidence-first language
**PASS:** Child-facing scan finds zero prohibited negative/internal labels and zero peer-comparison mechanics.

### AC-P30 — Cross-platform policy
**PASS:** Equivalent evidence gives identical server/domain progression decisions; News Reader uses approved audio or the 145-WPM female-TTS fallback policy.

---

# 32. Application-integration acceptance criteria

### AC-A01 — Container contract
**PASS:** SpeedReader launches through the Babysteps container with valid identity/manifest and trusted learner context.

### AC-A02 — No app-specific login
**PASS:** Production learner route has no independent SpeedReader credential flow.

### AC-A03 — No app billing
**PASS:** Production learner route consumes entitlement; no SpeedReader checkout is required.

### AC-A04 — Session envelope
**PASS:** Unauthorized/out-of-entitlement session cannot start; authorized session respects platform session metadata.

### AC-A05 — 15-minute resume
**PASS:** Resume inside window restores safe state without duplicate completion; outside window requires normal new session authorization.

### AC-A06 — Concurrent device protection
**PASS:** Second simultaneous learner session is rejected/handled through platform policy without corrupting evidence.

### AC-A07 — Every sixth review
**PASS:** Platform review marker produces review/practice behaviour that cannot advance canonical pointer or WPM by ordinary practice.

### AC-A08 — Production persistence
**PASS:** Clearing browser storage does not erase authoritative learner progress.

### AC-A09 — Idempotent completion
**PASS:** Replaying identical completion event produces exactly one attempt, one canonical advancement and at most one Level Up.

### AC-A10 — Atomic Level Up
**PASS:** Simulated transaction failure cannot leave WPM changed without the matching evidence/decision ledger or vice versa.

### AC-A11 — Editable transcript
**PASS:** Raw STT transcript and learner-confirmed corrected transcript are both retained; scoring uses the locked learner-confirmed semantic submission.

### AC-A12 — Speech capability fallback
**PASS:** Unsupported/denied speech capability does not create learner failure or mutate earned WPM.

### AC-A13 — BPC contamination barrier
**PASS:** Exposure to BPC occurs only after independent evidence lock; later evidence is marked assisted.

### AC-A14 — Recency boundary
**PASS:** Current pilot configuration deterministically marks inactivity revalidation due after 14 complete learner-local inactive days; historical 28-day default is absent.

### AC-A15 — Recency first-trigger rule
**PASS:** Calendar/session/inactivity clocks can each independently trigger due state; exact trigger is stored.

### AC-A16 — Version invalidation
**PASS:** Incompatible rule version invalidates affected evidence even when recency clocks have not fired.

### AC-A17 — No retry lottery
**PASS:** Repeated valid failures cannot cycle through fresh approved forms until a pass without required remediation/new cycle.

### AC-A18 — Legacy demo not production journey
**PASS:** Production home/learner entry uses v3 runtime; old 36-level demo cannot be mistaken for the child product.

### AC-A19 — Diagnostics protected
**PASS:** Public unauthenticated routes cannot expose raw internal learner states, transcripts or diagnostic harnesses.

### AC-A20 — Mobile learner flow
**PASS:** Baseline → reading → comprehension → transcript → feedback/BPC → next activity completes on supported mobile reference environment.

### AC-A21 — Server authority
**PASS:** Client manipulation of localStorage/UI state cannot award WPM, advance canonical pointer or change evidence.

### AC-A22 — Content-package version safety
**PASS:** Mixed/missing/hash-incompatible normative content/scoring package fails closed.

### AC-A23 — Child-facing privacy
**PASS:** Raw transcript/internal score/readiness outcome is not leaked into ordinary child progress UI.

### AC-A24 — Parent detail separation
**PASS:** Parent/internal detail endpoints require appropriate authorization and do not alter learner evidence.

---

# 33. Engineering acceptance criteria

### AC-C01 — Stale-rule scan
Repository search/tests find no active production implementation of:

- legacy 6-world/36-level progression;
- 70-point unlock;
- oral-as-core-WPM gate;
- WPM decrement;
- familiar-practice progression evidence;
- age-based starting WPM;
- direct 100→200 stamina jump;
- 60% active GREEN threshold;
- 28-day current inactivity default.

### AC-C02 — Explicit attempt type
Every scored attempt has an approved non-null type/role.

### AC-C03 — Separate state machines
Core WPM, canonical sequence/stamina, comprehension, familiar practice, News Reader, readiness and calibration are not represented by one generic status field.

### AC-C04 — Deterministic progression
Same immutable history + same rule/config versions → same decision.

### AC-C05 — Idempotency
Reprocessing same event cannot duplicate award/progression.

### AC-C06 — Transaction safety
Progression and evidence ledger are atomic.

### AC-C07 — Boundary suite
Automated tests include at minimum:

- 74.99 / just below 75;
- exactly 75;
- 4/5 GREEN;
- 3/5 GREEN;
- post-five G-G-G;
- post-five G-G-N-G-G-G;
- 149→150;
- already 150;
- every stamina boundary;
- practice inserted between new attempts;
- duplicate event replay;
- app close/resume;
- ASR unresolved;
- microphone denied;
- News Reader low/missing/high;
- readiness form version mismatch;
- technical invalidity;
- insufficient evidence;
- inactivity 13/14/15-day boundary;
- 16/17 subsequent-session boundary;
- 56/57 calendar-day boundary;
- version invalidation.

### AC-C08 — One configuration authority
Pilot parameters exist in one versioned config source.

### AC-C09 — Historical version retention
Every scored attempt/decision retains versions used.

### AC-C10 — Observability
Logs distinguish:

- content/package defect;
- scoring defect;
- ASR/technical uncertainty;
- internal NOT_GREEN;
- practice scheduling;
- Level Up;
- stamina boundary;
- recency/revalidation;
- version invalidation;
- authorization/session problem.

### AC-C11 — No learner leakage
Observability/internal reason codes do not leak to learner UI.

### AC-C12 — Automated suites
Mandatory unit/backend/UI/QA/build commands all pass.

### AC-C13 — Independent QA
Claude Code/developer self-tests do not constitute production certification.

Only a separate independent QA review may issue final PASS.

---

# 34. Release gate

A SpeedReader app release is eligible for independent QA only when:

1. all FROZEN app requirements above are implemented;
2. all applicable first-150 Knowledge Map runtime contracts pass;
3. no superseded behaviour is active in production paths;
4. pilot parameters are centralized and versioned;
5. production learner route uses the new engine;
6. authoritative persistence is server-side;
7. initial assessment is live;
8. hybrid comprehension is live;
9. editable transcript/ASR uncertainty path is live;
10. familiar practice is isolated from progression evidence;
11. BPC is delivered only after scoring;
12. News Reader is isolated from core progression;
13. recency/version invalidation is deterministic;
14. container/session/resume rules pass;
15. mobile/browser/accessibility gates pass;
16. all mandatory automated tests pass;
17. Claude Code produces a full traceability report;
18. stale-rule scan is clean;
19. no open BLOCKER defects remain;
20. independent QA issues the final PASS.

---

# 35. Definition of done

The SpeedReader **application** is done when it is:

- **integrated** — it behaves as a Babysteps hosted app rather than a standalone identity/billing silo;
- **personal** — baseline, WPM route and practice adapt to the individual;
- **non-punitive** — difficulty never removes earned WPM or publicly labels the child as failed;
- **comprehension-led** — comprehension alone controls core WPM advancement;
- **auditable** — every progression decision is reproducible from immutable evidence and versions;
- **separated** — practice, News Reader, readiness and core progression cannot contaminate one another;
- **speech-fair** — ASR uncertainty/accent are not fabricated learner errors;
- **mobile-ready** — the complete child journey works in the supported mobile environment;
- **safe under interruption** — resume/retry/replay cannot corrupt state;
- **calibration-aware** — empirical pilot numbers can evolve without changing frozen product semantics;
- **content-decoupled** — approved content packages can evolve under their separate content specification without requiring app redesign;
- **testable** — all product and engineering ACs have executable evidence;
- **independently certifiable** — developer/Claude self-validation hands off to separate QA for the only final PASS.

**APP ARCHITECTURE BASELINE: DEFINITIVE v3.0**  
**CONTENT REQUIREMENTS: SEPARATE SPECIFICATION**
