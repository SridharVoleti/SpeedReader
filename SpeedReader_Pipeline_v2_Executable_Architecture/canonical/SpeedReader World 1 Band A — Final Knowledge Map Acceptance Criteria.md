# SpeedReader World 1 Band A — Final Knowledge Map Acceptance Criteria

## Purpose

This is the final acceptance gate for the World 1 Band A knowledge map covering the first 150 registry passages, approximately 100 words each, displayed one word at a time.

The knowledge map is considered **FINAL / FROZEN** only when every mandatory criterion below passes independent QA.

After this gate passes:

- architecture is frozen;
- competency definitions are frozen;
- progression logic is frozen;
- content-generation contracts are frozen;
- measurement semantics are frozen;
- readiness architecture is frozen;
- only explicitly provisional numerical thresholds, equivalent-form tolerances, recency limits and similar empirical parameters may later be recalibrated through their declared lifecycle;
- a future change to the frozen architecture requires a new version and explicit regression review.

---

# A. Canonical specification integrity

### AC-01 — One authoritative canonical source

There must be exactly one authoritative current specification for World 1 Band A.

It must explicitly state:

- current canonical version;
- which older versions it supersedes;
- precedence rules;
- whether the canonical artifact is:
  - one self-contained file, or
  - a version-locked canonical package consisting of the MD plus specifically named CSV/spec artifacts.

No required rule may depend implicitly on an older version.

**PASS condition:** A new developer or QA reviewer can identify every normative artifact and version without reconstructing history.

---

### AC-02 — No hidden normative dependencies

Every implementation-affecting requirement must exist in the canonical specification/package, including:

- RS competency definitions;
- P1→P10 targets;
- scoring semantics;
- evidence minimums;
- equivalent-form tolerances;
- comprehension blueprint definitions;
- factual/safety requirements;
- readiness-state transitions;
- reassessment/revalidation rules;
- prose-generation rules.

Phrases such as:

- “as previously defined”;
- “retain v0.x requirement”;
- “same as before”

must not carry normative meaning.

**PASS condition:** Zero load-bearing references to superseded artifacts.

---

### AC-03 — Version precedence is unambiguous

If multiple artifacts cover the same concept, exactly one version must be normative.

For example, there may not simultaneously be two different “normative” form-equivalence matrices such as v0.14 and v0.15 without an explicit precedence rule.

**PASS condition:** Every external matrix/spec referenced by the canonical package has one current normative version.

---

# B. 15 × 10 matrix architecture

### AC-04 — Matrix integrity

The knowledge map must contain exactly:

- 15 RS competency tracks;
- 10 passages per RS;
- 150 unique registry passage coordinates;
- 150 unique scheduled delivery sessions.

Delivery formula:

`delivery_session = (P - 1) × 15 + RS`

**PASS condition:** Automated validation finds zero missing coordinates, duplicates or formula mismatches.

---

### AC-05 — Correct learner delivery order

Learner delivery must be:

`RS01-P1 → RS02-P1 → ... → RS15-P1`

then:

`RS01-P2 → ... → RS15-P2`

through P10.

Registry passage ID must never be mistaken for chronological learner order.

**PASS condition:** Sorting by `delivery_session` reconstructs exactly ten complete RS01→RS15 rounds.

---

### AC-06 — Strand distribution invariant

Every 15-session delivery round must contain all 15 knowledge strands exactly once.

Across the complete 150 passages:

- every strand appears exactly 10 times;
- no round contains a duplicate strand;
- no round omits a strand.

**PASS condition:** 10/10 rounds contain 15/15 unique strands.

---

### AC-07 — RS/topic independence

Every RS must encounter 10 different strands.

After the RS competencies are defined, QA must additionally verify that no knowledge strand is systematically assigned only to unusually easy or unusually difficult RS constructions.

**PASS condition:** Topic cannot act as a hidden proxy for reading-skill difficulty.

---

# C. RS01–RS15 competency completeness

### AC-08 — Every RS is a genuine independent reading competency

Each RS must define:

1. competency name;
2. pedagogical purpose;
3. observable learner behaviour;
4. machine-computable measurement;
5. relevant error/event definitions;
6. P1 baseline behaviour;
7. P2→P9 development;
8. P10 success criterion;
9. passage-construction requirements;
10. insufficient-evidence behaviour.

RS number must answer:

**“Which reading behaviour is being trained?”**

It must not represent chronology or generic difficulty.

**PASS condition:** All 15 tracks satisfy all ten requirements.

---

### AC-09 — No comprehension-dependent RS definition

An RS competency must remain meaningful regardless of whether the corresponding passage uses recall, inference, vocabulary or another comprehension level.

Definitions such as:

- “stable reading under inference”;
- “Band-A readiness stage”

are invalid because each RS appears from the first delivery round onward.

**PASS condition:** All 15 RS definitions are independent of P-level comprehension semantics.

---

### AC-10 — P1→P10 progression is executable

Each RS must contain ten explicitly defined development targets.

The progression must reflect real observable change, not merely ten different stories carrying the same RS label.

Targets must be mathematically meaningful for the available denominator.

Example defect to avoid:

- 2 targets with thresholds of 75%, 80% and 82% when all three effectively require 2/2.

**PASS condition:** Every progression step represents a genuinely distinguishable development target or intentionally shared band.

---

# D. Passage construction ↔ measurement consistency

### AC-11 — Construction counts and evidence minimums must agree

For every opportunity-dependent competency, these three contracts must be mutually consistent:

`P-level passage construction requirement`

`minimum evidence requirement`

`equivalent-form target count`

Particular mandatory audit:

- RS03 — function words;
- RS04 — inflected endings;
- RS05 — longer words;
- RS09 — terminal punctuation;
- RS10 — internal punctuation;
- RS12 — challenge words.

A passage may never be instructed to contain fewer measurement opportunities than are required to score it.

**PASS condition:** No RS can become `INSUFFICIENT_EVIDENCE` simply by following its own construction specification.

---

### AC-12 — RS05 contradiction resolved

RS05 must have one explicit evidence model:

either:

- a single P10 passage contains sufficient longer-word targets;

or:

- a formally defined multi-passage evidence window is used.

The current contradictory pattern such as “3–4 targets in the passage” versus “≥10 required to score” is prohibited.

**PASS condition:** A compliant RS05 P10 passage/cycle can actually produce valid evidence.

---

### AC-13 — RS12 contradiction resolved

The same requirement applies to RS12.

The current incompatible pattern such as “2–3 challenge words” versus “≥5 required” must be reconciled through either single-form construction or explicit pooled evidence.

**PASS condition:** A compliant RS12 P10 passage/cycle can actually produce valid evidence.

---

### AC-14 — Subsection evidence minima are numeric

Terms such as:

“coverage across all thirds”

must be quantitatively defined.

RS02 and RS08 may not use qualitative subsection-coverage language while sibling competencies specify explicit minima.

**PASS condition:** Every position-sensitive metric has machine-testable subsection requirements.

---

# E. Comprehension architecture

### AC-15 — P1→P10 comprehension progression remains fixed

The comprehension sequence must remain:

P1 — Direct recall  
P2 — Sequence  
P3 — Cause/effect  
P4 — Prediction  
P5 — Feelings/motivation  
P6 — Main idea  
P7 — Simple inference  
P8 — Vocabulary in context  
P9 — Judgment/application  
P10 — Mixed mastery

**PASS condition:** All 15 passages within one P-round use the same assigned comprehension level.

---

### AC-16 — P10 mixed-mastery coverage is explicit

The final 15 P10 passages must collectively cover all canonical comprehension dimensions with the frozen required distribution.

Each P10 passage must use an explicit four-item blueprint.

**PASS condition:** The 60 first-attempt P10 item slots exactly satisfy the declared coverage matrix.

---

### AC-17 — Primary P10 item is explicitly identified

If independent P10 mastery requires:

`≥3/4 AND designated primary item correct`

then every Q10 blueprint must explicitly define:

- which item position is primary; and/or
- which dimension is primary.

PRIMARY and CONFIRMATION forms must preserve that role.

**PASS condition:** Given any 4-response pattern, every implementation reaches the same pass/fail decision.

---

### AC-18 — One defensible answer per scored item

Every quiz item must have:

- one defensible keyed answer;
- sufficient passage evidence;
- no outside-knowledge dependency;
- no culturally narrow assumption;
- no equally valid alternate interpretation.

Dimension-specific evidence rules must be satisfied.

**PASS condition:** Independent QA cannot construct a second reasonable keyed answer from the passage.

---

### AC-19 — Instructional mastery and independent readiness remain separate

Post-hint/post-remediation success must never be counted as independent readiness evidence.

The system must store separately:

- first-attempt independent result;
- post-remediation instructional mastery.

**PASS condition:** Only fresh first-attempt evidence can enter final P10 certification.

---

# F. Oral-scoring determinism

### AC-20 — One deterministic scoring specification

The canonical package must define exactly:

- assessable expected words;
- first-pass accuracy;
- final accuracy;
- substitution;
- omission;
- insertion;
- repetition;
- accepted self-correction;
- self-correction latency;
- long hesitation;
- full restart;
- punctuation compliance;
- challenge-word recovery;
- active reading time;
- WPM;
- pace spread;
- ASR uncertainty;
- invalid sample;
- reassessment state.

**PASS condition:** Two conforming implementations produce the same metrics from the same validated input.

---

### AC-21 — ASR uncertainty never becomes automatic learner error

Low-confidence recognition must not automatically reduce a learner's score.

The scoring contract must define:

- confidence handling;
- alternate pronunciation/equivalence handling;
- unresolved-token handling;
- segment retry;
- recording-quality failure;
- versioning of ASR model/threshold changes.

**PASS condition:** Recognition uncertainty produces `UNRESOLVED`/`REASSESS`, not fabricated learner error.

---

### AC-22 — Accent fairness is explicit

Legitimate accent differences, including Indian English pronunciation variation, must never be scored as failure purely because they differ from a reference accent.

**PASS condition:** Accent is separated from lexical correctness.

---

### AC-23 — COUNT-100 is deterministic

One canonical tokenizer must define exactly what counts as a word for:

- contractions;
- hyphenated forms;
- numerals;
- currency;
- abbreviations;
- apostrophes;
- punctuation;
- proper nouns.

The same tokenizer must be used by:

authoring → QA → renderer → ASR alignment → WPM → equivalent-form validation.

**PASS condition:** Every conforming implementation returns exactly the same 100 lexical passage words.

---

### AC-24 — Third/quartile segmentation is deterministic

The specification must define exactly:

- which expected-word positions form first/middle/final thirds;
- which form quartiles;
- whether segment boundaries remain fixed when words become unassessable;
- how subsection WPM/accuracy denominators are calculated.

**PASS condition:** RS11/RS13/RS14 metrics are reproducible across implementations.

---

# G. Evidence sufficiency and sample validity

### AC-25 — Universal sample validity precedes RS scoring

Every P10 sample must first satisfy a shared validity floor before specialized RS criteria are evaluated.

The common floor must address:

- audio quality;
- assessable-word coverage;
- excessive unresolved ASR;
- passage completion;
- required subsection evidence;
- required tagged opportunities.

**PASS condition:** A specialized metric cannot become READY from an otherwise unusable sample.

---

### AC-26 — General quality floor is considered explicitly

A learner must not pass a specialized competency merely because an isolated metric is stable while overall reading on that passage is severely inaccurate.

Example defects to prevent:

- poor accuracy + stable pace → RS11 READY;
- equally poor first/middle accuracy → RS13 READY;
- poor reading + few hesitations → RS06 READY.

The final design must either include a common minimum oral-quality floor or formally justify another equivalent safeguard.

**PASS condition:** Specialized readiness cannot certify obviously poor underlying passage reading.

---

### AC-27 — Opportunity-count fairness

Percentage thresholds must behave consistently across equivalent forms.

If one error passes with 20 targets but fails with 8 targets, the construction/equivalence contract must explicitly resolve that granularity.

**PASS condition:** Equivalent learner behaviour on valid matched forms cannot flip readiness solely because the author supplied a different denominator.

---

# H. Personal progress validity

### AC-28 — Fifteen RS-specific baselines

Sessions 1–15 establish:

RS01-P1 through RS15-P1.

Session 1 is not a universal baseline.

**PASS condition:** Every later RS comparison references its own RS baseline/history.

---

### AC-29 — No cross-RS raw metric comparison

Progress must always be:

`same learner + same RS + later P`

Raw metrics from different RS competencies must never be averaged directly.

**PASS condition:** No learner-facing progress calculation compares unlike measures.

---

### AC-30 — Complete-round composites only

A 15-RS composite may only be shown after every RS has reached the same P level.

Partial milestones such as Session 100 must remain explicitly partial.

**PASS condition:** No partial round is presented as complete overall progress.

---

### AC-31 — Baseline mastery does not require artificial improvement

A learner already meeting a target at P1 must be recognised as baseline-strong.

The system must not require arbitrary percentage improvement merely to prove development.

However, baseline mastery must not bypass whatever fresh P10 readiness confirmation is required.

**PASS condition:** Progress reporting and readiness certification are clearly separated.

---

# I. Readiness state machine

### AC-32 — One authoritative readiness ontology

There must be one state model.

Terms such as:

`READY`  
`BASELINE_MASTERY_CONFIRMED`  
`CONFIRMED_READY`  
`NOT_YET`  
`DISCORDANT_NOT_YET`  
`REASSESS`  
`REVALIDATION_DUE`

must have explicit relationships.

No two sections may imply different states can close the same RS.

**PASS condition:** One machine-readable transition graph fully determines every legal state transition.

---

### AC-33 — `CONFIRMED_READY` closure semantics are explicit

If the two-form model remains canonical, one P10 pass cannot close an RS.

The closure path must be explicit:

`PRIMARY → CONFIRMATION → CONFIRMED_READY`

subject to valid forms and evidence.

**PASS condition:** A single fresh reassessment pass cannot silently bypass confirmation.

---

### AC-34 — Baseline-mastery status is not confused with certification

`BASELINE_MASTERY_CONFIRMED` must be explicitly classified as either:

- a progress descriptor; or
- a readiness state with fully defined interaction with PRIMARY→CONFIRMATION.

It may not ambiguously bypass final P10 evidence.

**PASS condition:** Developers cannot interpret it in two different ways.

---

### AC-35 — All 15 competencies are required

Band A cannot close using:

- final five only;
- 3/5;
- 12/15;
- weighted averages;
- compensation by stronger RSs.

All required RS competencies must resolve.

**PASS condition:** Any unresolved required RS keeps Band A open.

---

### AC-36 — Oral and comprehension gates remain independent

Strong oral performance cannot compensate for unresolved comprehension and vice versa.

Final Band-A closure requires both readiness streams.

**PASS condition:** Separate state and evidence are stored for oral and comprehension.

---

# J. Confirmation, reassessment and revalidation forms

### AC-37 — Form-equivalence rules are fully present

Every RS must have explicit equivalence criteria for:

- vocabulary;
- syntax;
- sentence lengths;
- RS target opportunities;
- punctuation;
- local positional difficulty;
- comprehension blueprint;
- speech/ASR risk;
- content independence.

All tolerances must exist in the canonical package.

**PASS condition:** The validator can be implemented without consulting superseded versions.

---

### AC-38 — One authoritative form-equivalence version

There must not be competing “normative” v0.14/v0.15 matrices.

**PASS condition:** One version and one precedence rule.

---

### AC-39 — Confirmation form supply is operationally defined

The architecture must explicitly state where fresh forms come from:

- pre-authored validated bank;
- offline generated + QA-approved bank;
- runtime generation;
- or a defined hybrid.

**PASS condition:** Developer architecture can actually produce the required forms.

---

### AC-40 — Every generated readiness form passes the full content gate

PRIMARY, CONFIRMATION, reassessment and revalidation forms must all pass:

- applicable PG1–PG12;
- GENERAL;
- SCIENCE_FACT;
- CHILD_SAFETY;
- WILDLIFE_SAFETY;
- CHILD_MONEY;
- HEALTH_FACT;
- INDIA_CONTEXT;
- equivalent-form validator;
- evidence-minimum validator.

No dynamically generated form may bypass child-content QA.

**PASS condition:** Every learner-visible readiness form has the same safety/quality protection as registry passages.

---

### AC-41 — Readiness-form identity is separate from registry passage identity

The data model must distinguish:

- `registry_passage_id`;
- `form_family_id`;
- `assessment_form_id`;
- `delivery_event_id`;
- form role: PRIMARY / CONFIRMATION / REASSESSMENT / REVALIDATION.

Confirmation forms must not accidentally consume Passage 151, which belongs to the 200-word band.

**PASS condition:** Additional Band-A forms can exist without corrupting the 150-passage registry.

---

### AC-42 — Oral/comprehension orchestration is deterministic

When the same form carries both evidence streams, the specification must define cases such as:

- oral PASS / comprehension FAIL;
- oral FAIL / comprehension PASS;
- oral confirmation PASS / comprehension confirmation FAIL;
- technical failure in only one stream.

**PASS condition:** There is one unambiguous next action for every combined state.

---

### AC-43 — Retry lottery is prohibited

A valid failure cannot be followed by unlimited fresh attempts until one passes.

A new readiness cycle requires the defined intervening learning/remediation block.

Every valid assessment-cycle result is retained.

**PASS condition:** Best-of-many selection is impossible.

---

# K. Evidence recency

### AC-44 — Confirmed evidence has an explicit freshness model

The specification must define:

- when readiness becomes stale;
- what triggers revalidation;
- separate oral/comprehension freshness anchors;
- what happens after valid revalidation failure;
- version incompatibility rules.

**PASS condition:** Old readiness evidence cannot remain silently valid indefinitely.

---

### AC-45 — Recency numbers may remain provisional

Calendar/session/inactivity thresholds may remain `PROVISIONAL_PILOT` at knowledge-map freeze if:

- architecture is complete;
- values are clearly marked provisional;
- calibration lifecycle is specified;
- production certification is disabled until approval.

**PASS condition:** Provisional numeric assumptions cannot masquerade as validated production standards.

---

# L. Row-level content completeness

### AC-46 — Every one of the 150 rows is generation-complete

Every row must expose or resolve at least:

- passage ID;
- delivery session;
- RS;
- P level;
- title;
- knowledge strand;
- strand goal;
- premise;
- comprehension target;
- quiz blueprint;
- designated primary item where required;
- wisdom/trait intent;
- hook/pull/payoff intent;
- RS/P construction instruction;
- required target/opportunity count;
- accessibility/global-context requirement;
- factual/safety tags;
- checkpoint metadata where applicable.

**PASS condition:** A writer does not need to invent missing curriculum intent.

---

### AC-47 — Row-level safety tags are explicit

A title alone must not require a writer to infer whether a passage needs:

`SCIENCE_FACT`  
`CHILD_SAFETY`  
`WILDLIFE_SAFETY`  
`CHILD_MONEY`  
`HEALTH_FACT`  
`INDIA_CONTEXT`

**PASS condition:** Applicable QA gates are directly attached to each row/form.

---

# M. Prose-generation acceptance

### AC-48 — PG1–PG12 are all mandatory

Every final passage must pass the complete prose gate, including:

- row fidelity;
- unambiguous comprehension;
- oral compatibility;
- speech/accent fairness;
- controlled stretch vocabulary;
- implicit wisdom;
- duplicate control;
- first-100 confidence protection;
- natural exact-100-word prose;
- Babysteps effortless-learning test;
- engagement ≥5/6;
- all applicable factual/safety/cultural gates.

**PASS condition:** Failure of any single gate prevents prose freeze.

---

### AC-49 — Exact 100 words never overrides quality

A passage that reaches 100 words through filler, clipped grammar, unnatural connectors, scientific distortion or awkward speech rhythm fails.

**PASS condition:** Natural prose and exact count both hold.

---

### AC-50 — Nearby-duplicate QA uses learner order

Duplicate checks must use actual delivery-session order, not registry-ID adjacency.

**PASS condition:** The learner does not experience repetitive plot/hook/lesson patterns within the defined local delivery window.

---

### AC-51 — First 100 sessions preserve confidence

Sessions 1–100 must avoid:

- trick questions;
- humiliation;
- punitive rereading;
- abrupt difficulty spikes;
- vocabulary overload;
- unnecessary fear;
- multiple simultaneous stretch demands.

**PASS condition:** The intended experience remains “I can do this and want another passage.”

---

# N. 100→200 transition validity

### AC-52 — Band-A readiness represents all 15 competencies

Sessions 136–150 provide the full P10 competency round, supplemented by required confirmation evidence.

No final-five shortcut is permitted.

**PASS condition:** Every required oral and comprehension stream resolves.

---

### AC-53 — Functional Band-B transition must be validated empirically

The knowledge map may freeze with provisional thresholds, but production approval must test whether learners meeting Band-A criteria can actually handle the 200-word band without unacceptable:

- accuracy collapse;
- comprehension collapse;
- excessive completion burden;
- stamina collapse;
- confidence/engagement collapse.

No peer percentile is required.

**PASS condition for production:** Threshold-passing learners show acceptable early Band-B performance under the frozen calibration protocol.

---

# O. Calibration lifecycle

### AC-54 — Numeric thresholds have declared status

Every empirical numeric criterion must carry a lifecycle status such as:

`PROVISIONAL_PILOT`  
`CALIBRATION_REVIEW`  
`PRODUCTION_APPROVED`  
`SUSPENDED_RECALIBRATE`

**PASS condition:** A precise number is never mistaken for an empirically proven number merely because it appears in the specification.

---

### AC-55 — Comprehension hard gates also require calibration

The comprehension certification rule itself—including:

- 3/4 threshold;
- primary-item requirement;
- two-form confirmation;
- form difficulty equivalence

must have a declared empirical-validation lifecycle, just as oral thresholds do.

**PASS condition:** Oral rules are not treated as provisional while comprehension rules are assumed automatically valid.

---

### AC-56 — Whole-gate calibration is required

Production validation must evaluate the complete conjunctive readiness system, not merely each RS independently.

The calibration must inspect:

- false-ready rate;
- false-not-ready rate;
- proportion needing reassessment;
- time to clear Band A;
- cumulative burden of 15 oral + 15 comprehension streams;
- subgroup/device/accent effects;
- recency/revalidation burden;
- early Band-B predictive validity.

**PASS condition:** The complete system is usable, not merely each component in isolation.

---

# P. Machine audit and regression protection

### AC-57 — Every structural invariant has an automated test

At minimum validate:

- 150 unique registry coordinates;
- 150 unique scheduled sessions;
- delivery formula;
- 15 RS × 10 P;
- 15 strands per delivered round;
- 10 occurrences per strand;
- one P1–P10 sequence per RS;
- comprehension level alignment;
- checkpoint placement;
- required row fields;
- evidence minima;
- construction/evidence consistency;
- P10 coverage;
- primary-item definition;
- readiness-state validity.

**PASS condition:** Automated suite = 100% PASS.

---

### AC-58 — Boundary/edge-case test suite exists

Regression QA must explicitly test:

- ASR-unscorable segments;
- exact evidence minimums;
- minimum ±1 opportunity;
- denominator granularity;
- single error at boundary thresholds;
- invalid form;
- technically invalid audio;
- PRIMARY pass / CONFIRMATION fail;
- oral pass / comprehension fail;
- stale evidence;
- version invalidation;
- baseline mastery;
- RS07 no-error pathway;
- repeated valid readiness-cycle failure.

**PASS condition:** Every defined edge case has one expected deterministic result.

---

### AC-59 — No unresolved contradiction remains

Final independent QA must perform a contradiction sweep across:

- prose requirements;
- P ladders;
- evidence minima;
- equivalent-form requirements;
- scoring definitions;
- state transitions;
- readiness formulas.

**PASS condition:** Zero mutually impossible or contradictory normative rules.

---

# Q. Final freeze rule

The World 1 Band A knowledge map may be declared:

## `KNOWLEDGE_MAP_FINAL_FREEZE`

only when:

1. **AC-01 through AC-59 all PASS**;
2. there are **zero open BLOCKER defects**;
3. there are **zero unresolved specification MAJOR defects** affecting interpretation or implementation;
4. all 150 registry rows are complete and machine-valid;
5. canonical artifacts/package are version-locked;
6. independent QA issues a final PASS;
7. all remaining unvalidated numerical assumptions are explicitly classified as `PROVISIONAL_PILOT` rather than production-approved.

At this point, subsequent empirical calibration does **not** reopen the knowledge map unless calibration discovers that:

- an RS competency itself is invalid;
- progression architecture is wrong;
- passage construction cannot measure the intended skill;
- a safety/pedagogical assumption is structurally unsound;
- or a frozen semantic rule must change.

Ordinary threshold tuning within the declared lifecycle is **calibration, not knowledge-map redesign**.

---

# Final definition of “done”

The knowledge map is done when it is:

**complete** — nothing required for implementation is missing;

**internally consistent** — no rule contradicts another;

**executable** — developers can implement every rule deterministically;

**measurable** — every competency has sufficient valid evidence;

**auditable** — every important invariant can be mechanically checked;

**pedagogically coherent** — the 15 RS tracks and P1→P10 development genuinely train reading;

**child-safe and confidence-preserving** — quality and safety cannot be traded for measurement;

**self-referenced** — learner progress is against their own valid same-RS evidence;

**non-compensatory at readiness** — weak required competencies cannot be hidden by strong ones;

**version-governed** — there is one authoritative current truth;

and **calibration-aware** — provisional numbers are allowed for controlled pilot use but are never misrepresented as validated production standards.

Once all of these conditions are independently verified, the World 1 Band A knowledge map should be considered **FINAL**.