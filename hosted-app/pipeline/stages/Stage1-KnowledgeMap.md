# SpeedReader Pipeline — Stage 1: Knowledge Map Creation

**Version:** v0.2  
**Stage:** 01  
**Artifact:** Knowledge Map  
**Producer:** ChatGPT Work  
**Downstream eligibility:** Independent QA approval required

---

# 1. Purpose

Create the canonical instructional blueprint for a SpeedReader World/Band before any learner-facing passage is written.

The Knowledge Map defines:

- what reading competencies are developed;
- how those competencies progress;
- what each future passage is intended to accomplish;
- the content domain used for each passage;
- the comprehension demand;
- the learner evidence expected;
- the delivery sequence;
- the overall progression across the World/Band.

The Knowledge Map is a curriculum-planning artifact.

It must not contain finished learner-facing passages.

---

# 2. Stage Boundary

Stage 1 begins with certified upstream SpeedReader specifications.

Stage 1 ends when ChatGPT Work has:

1. created the complete Knowledge Map;
2. performed all required mechanical self-checks;
3. performed all required semantic self-checks;
4. corrected every defect it identified;
5. produced the final Stage 1 artifact;
6. marked that artifact `AWAITING_QA`.

Stage 1 does **not** certify its own output.

Independent certification belongs exclusively to the separate Stage 1 QA job.

---

# 3. Pipeline Position

```text
CERTIFIED UPSTREAM SPECIFICATIONS
              ↓
     STAGE 1 — CHATGPT WORK
      KNOWLEDGE MAP CREATION
              ↓
      Mechanical Self-Check
              ↓
       Semantic Self-Check
              ↓
     Correct Identified Defects
              ↓
       FINAL STAGE 1 OUTPUT
              ↓
          AWAITING_QA
              ↓
    SEPARATE INDEPENDENT QA JOB
```

The Stage 2 Content Job task must never receive a Knowledge Map whose independent QA status is not `PASS`.

---

# 4. Core Production Rule

ChatGPT Work is responsible for submitting a **production-quality candidate**, not a first draft.

Work must therefore:

**Create → inspect → test → correct → re-inspect → submit.**

Mechanical and semantic validation are part of the Work task itself.

They are production quality controls.

They are **not independent QA** and must never be represented as certification.

---

# 5. Mandatory Inputs

The Knowledge Map Work task may use only approved upstream specifications.

The exact applicable files may vary by World/Band, but the following categories are mandatory where applicable.

## 5.1 World/Band Definition

Defines:

- World;
- Band;
- target learner;
- expected entry capability;
- expected exit capability;
- target passage architecture;
- total scope;
- developmental intent.

---

## 5.2 Reading Stage Specification

Defines every Reading Stage.

For each Reading Stage, the specification must provide enough information to establish:

- competency;
- learner behaviour;
- measurable indicators;
- developmental trajectory;
- boundaries from neighbouring Reading Stages;
- what constitutes genuine mastery.

For World 1 Band A, the architecture currently contains:

```text
RS01 → RS15
```

---

## 5.3 P1→P10 Development Specification

Defines progression within each Reading Stage.

The Knowledge Map must preserve the distinction:

```text
Reading Stage
=
WHAT reading competency is being developed

P-level
=
HOW FAR development within that competency has progressed
```

P1→P10 must represent meaningful developmental progression.

Higher P-levels must not simply mean:

- harder vocabulary;
- longer sentences;
- more obscure subject matter;
- more words.

---

## 5.4 Comprehension Framework

Defines the comprehension demands that may be assigned to Knowledge Map rows.

These may include, where applicable:

- literal understanding;
- sequencing;
- relationships;
- cause and effect;
- inference;
- prediction;
- vocabulary in context;
- main idea;
- interpretation;
- synthesis;
- transfer.

The canonical framework governs which dimensions apply and how they progress.

---

## 5.5 Knowledge-Strand Framework

Defines:

- permitted strands;
- strand definitions;
- distribution requirements;
- repetition restrictions;
- balance requirements.

The Work task must not invent a new strand taxonomy unless the upstream specification explicitly permits it.

---

## 5.6 Content and Prose Architecture

Provides constraints that affect Knowledge Map planning, including where applicable:

- passage length;
- age appropriateness;
- oral-reading suitability;
- factual expectations;
- engagement expectations;
- topic suitability;
- India/world balance;
- prohibited patterns;
- safety constraints.

The Knowledge Map does not write prose, but its premises must be capable of supporting these requirements later.

---

## 5.7 Factual and Safety Rules

Defines topics requiring:

- factual verification;
- elevated factual scrutiny;
- specialist review;
- child-safety controls;
- cultural sensitivity;
- health/science safeguards;
- wildlife safeguards;
- geographic/historical verification.

Knowledge Map rows must carry appropriate flags forward.

---

# 6. Knowledge Map Creation Task

ChatGPT Work acts as the **Knowledge Map Planner**.

Its job is to create the complete instructional architecture for the World/Band.

For World 1 Band A:

```text
15 Reading Stages
×
10 P-levels
=
150 passage coordinates
```

Each coordinate represents one future learner-facing passage.

No passage may be written during Stage 1.

---

# 7. Mandatory Knowledge Map Row

Every passage coordinate must have an explicit row.

Minimum schema:

```json
{
  "passage_id": "W1-BA-001",

  "world": 1,
  "band": "A",

  "reading_stage": "RS01",
  "p_level": "P01",

  "delivery_round": 1,
  "delivery_session": 1,

  "knowledge_strand": "",

  "working_title": "",
  "content_concept": "",
  "content_premise": "",

  "rs_competency_target": "",
  "p_level_target": "",
  "comprehension_target": "",

  "learner_evidence_expected": [],

  "factual_review_required": false,
  "factual_review_level": "",

  "safety_review_required": false,
  "safety_categories": [],

  "generation_notes": [],

  "source_spec_versions": {}
}
```

Additional fields may be required by future SpeedReader specifications.

The Work task must preserve them when applicable.

---

# 8. Row Semantics

## 8.1 Passage ID

Must uniquely identify one passage coordinate.

No duplicates are permitted.

---

## 8.2 Reading Stage

Identifies the specific reading competency being developed.

The target must remain intrinsic to that Reading Stage.

---

## 8.3 P-Level

Identifies the developmental level within that Reading Stage.

The Knowledge Map must make it possible to answer:

> Why is this RS04-P03 rather than RS04-P01 or RS04-P08?

---

## 8.4 Knowledge Strand

Defines the content domain.

The strand is not the reading competency.

Example:

```text
Knowledge Strand:
Animals

Reading Stage:
RS07
```

The animal topic provides the subject matter.

RS07 provides the reading-development target.

These must not become conflated.

---

## 8.5 Content Concept

Defines what the learner will read about.

It must be more specific than a broad subject label.

Weak:

```text
Animals
```

Stronger:

```text
How ants divide work inside a colony
```

---

## 8.6 Working Title

Provides an editorial label.

It must not be treated as a substitute for the content specification.

A Passage Creator must never be expected to infer the whole passage from the title.

---

## 8.7 Content Premise

Defines the actual planned substance of the future passage.

It must contain enough specificity to constrain generation while leaving room for natural writing.

---

## 8.8 RS Competency Target

Defines what the passage must cause the learner to exercise from the applicable Reading Stage.

Generic wording such as:

```text
Understand the passage
```

is unacceptable.

---

## 8.9 P-Level Target

Defines the developmental demand appropriate to the assigned P-level.

It must be operational rather than cosmetic.

---

## 8.10 Comprehension Target

Defines what type of understanding the passage must support.

It must be compatible with:

- the Reading Stage;
- P-level;
- content premise;
- expected learner evidence.

---

## 8.11 Learner Evidence Expected

Defines observable evidence that could later demonstrate whether the learner exercised the intended capability.

This is not the final assessment question.

Example:

```text
- Identifies the relevant connected facts.
- Explains how the facts relate.
- Uses information present in the passage rather than outside knowledge.
```

---

# 9. World 1 Delivery Structure

For the current World 1 Band A architecture, learner delivery proceeds across Reading Stages before advancing to the next P-level.

```text
Round 1
RS01-P01
RS02-P01
RS03-P01
...
RS15-P01

Round 2
RS01-P02
RS02-P02
...
RS15-P02

...

Round 10
RS01-P10
...
RS15-P10
```

The delivery-session formula is:

```text
delivery_session =
(P_number - 1) × 15 + RS_number
```

This must be derived systematically.

It must not be manually improvised.

---

# 10. Progression Requirements

The Knowledge Map must demonstrate meaningful progression at several levels.

## 10.1 Within Each Reading Stage

For every RS:

```text
P1
↓
P2
↓
P3
↓
...
↓
P10
```

must form a defensible developmental sequence.

P10 cannot simply be P1 with:

- harder vocabulary;
- more facts;
- more sentences;
- a less familiar topic.

The underlying learner capability must mature.

---

## 10.2 Across Reading Stages

Reading Stages must remain semantically distinct.

The Work task must actively detect:

- duplicated competencies;
- neighbouring RS definitions collapsing into one another;
- generic targets reusable across every RS;
- rows assigned to the wrong Reading Stage.

---

## 10.3 Across the Entire World

The learner journey should demonstrate:

- controlled increase in sophistication;
- sustained variety;
- balanced subject exposure;
- increasing independence;
- age-appropriate challenge;
- preservation of learner confidence.

---

# 11. Knowledge-Strand Distribution

The Work task must satisfy all applicable strand-distribution rules.

For the current World 1 architecture, every 15-session delivery round must preserve the approved strand distribution.

The planner must consider simultaneously:

```text
Reading competency
+
P-level progression
+
content suitability
+
strand balance
+
learner variety
+
engagement
```

The strand must never override the pedagogical purpose of the row.

---

# 12. Content Diversity

The Work task must actively avoid unnecessary repetition across the map.

Inspect for repeated:

- topics;
- settings;
- narrative structures;
- character archetypes;
- informational structures;
- opening patterns;
- conclusion patterns;
- scientific concepts;
- historical contexts;
- animals;
- locations;
- civic situations.

Repeated topics are allowed only where pedagogically justified.

Superficial renaming does not constitute diversity.

---

# 13. Engagement Planning

The Knowledge Map does not write the final passage, but each premise should have enough inherent interest to support an engaging passage later.

Avoid rows whose only possible realization would be:

- textbook definition;
- dry list of facts;
- forced moral lesson;
- contrived danger;
- generic school-style explanation.

The content premise should permit:

- curiosity;
- discovery;
- surprise;
- human relevance;
- narrative movement;
- useful information;

as appropriate to the content type.

---

# 14. Factual Classification

The Work task must classify factual-review needs during planning.

Recommended levels:

```text
NONE
STANDARD
ELEVATED
SPECIALIST
```

The applicable taxonomy must ultimately be governed by the canonical SpeedReader rules.

A topic must not be marked `NONE` merely because the Work task believes it already knows the facts.

---

# 15. Safety Classification

Potential safety implications must be anticipated during Knowledge Map creation.

Examples include:

- wildlife interaction;
- medical/health content;
- physical experiments;
- household hazards;
- road safety;
- water safety;
- fire;
- electricity;
- strangers;
- dangerous environments.

Appropriate safety flags must be carried downstream.

---

# 16. Source Traceability

Every map must identify the specification versions governing its creation.

At minimum:

```json
{
  "world_spec": "",
  "reading_stage_spec": "",
  "p_progression_spec": "",
  "comprehension_spec": "",
  "strand_spec": "",
  "content_rules": ""
}
```

Where practical, immutable hashes or commit references should eventually be recorded.

---

# 17. Work Self-Validation

Before submitting the Knowledge Map, ChatGPT Work must conduct a complete internal review.

This review contains two required layers:

```text
A. Mechanical Self-Check
B. Semantic Self-Check
```

Both must pass before submission.

---

# 18. Mechanical Self-Check

Mechanical validation must inspect the complete artifact.

For World 1 Band A, verify at minimum:

### Architecture

- exactly 150 rows;
- exactly 15 Reading Stages;
- exactly 10 P-levels per Reading Stage;
- exactly 15 rows per P-level;
- every RS × P coordinate exists exactly once.

### IDs

- Passage IDs are unique;
- IDs follow the approved pattern;
- no ID is missing.

### Delivery

- Delivery Session values are unique;
- all expected sessions exist;
- delivery formula is correct;
- no duplicate session assignment;
- no missing session.

### Required fields

- all mandatory fields exist;
- no prohibited null/blank fields;
- valid enum values are used where applicable.

### Strand structure

- distribution rules are satisfied;
- required per-round uniqueness is preserved where applicable.

### Metadata

- World and Band values are consistent;
- source versions are recorded;
- review flags use permitted values.

Any mechanical defect must be corrected before semantic self-review is considered complete.

---

# 19. Semantic Self-Check

Mechanical correctness is insufficient.

ChatGPT Work must independently challenge its own Knowledge Map for semantic quality.

The self-review must inspect **every row and the whole map**.

At minimum evaluate:

## 19.1 Reading Stage Fidelity

For every row:

- Does the target genuinely belong to the assigned RS?
- Could the same wording be copied unchanged to another RS?
- Has the competency been weakened into generic comprehension?
- Is the row actually exercising the Reading Stage rather than merely mentioning it?

---

## 19.2 P-Level Fidelity

For every row:

- Does the assigned demand genuinely fit its P-level?
- Is progression intrinsic?
- Is the difference from neighbouring P-levels meaningful?
- Is complexity being simulated through vocabulary instead of capability?

---

## 19.3 RS × P Interaction

Check that the row simultaneously preserves:

```text
RS competency
+
P-level development
```

Neither dimension may erase the other.

---

## 19.4 Content-Pedagogy Fit

Ask:

> Can this premise genuinely produce a passage that exercises the intended learner behaviour?

If not, redesign the row before submission.

---

## 19.5 Learner-Evidence Sufficiency

Check whether the planned content can later yield observable evidence of the intended capability.

Do not create rows where the stated learning target could not realistically be assessed from the resulting passage.

---

## 19.6 Progression Review

For each RS, review P1→P10 as one sequence.

Confirm that progression:

- is coherent;
- increases meaningfully;
- has no regression;
- has no duplicated level;
- does not jump implausibly;
- reaches the intended exit capability.

---

## 19.7 Cross-RS Differentiation

Compare Reading Stages against one another.

Look for:

- semantic overlap;
- duplicate learner behaviours;
- competency boundaries that are too vague;
- rows effectively belonging to another RS.

---

## 19.8 Content Quality

Review all planned premises for:

- relevance;
- age appropriateness;
- intrinsic interest;
- conceptual clarity;
- diversity;
- feasibility within the target passage length.

---

## 19.9 Factual Risk

Identify rows whose premises could create:

- misleading simplification;
- controversial factual claims;
- incorrect science;
- historical distortion;
- cultural distortion;
- unsafe inference.

Correct classifications before submission.

---

## 19.10 Whole-Map Coherence

Review the 150-row map as one learner experience.

Ask:

- Does it feel intentionally designed?
- Is variety sufficient?
- Does any domain dominate unintentionally?
- Are developmental transitions sensible?
- Are topics unnecessarily repetitive?
- Are some stretches much weaker or less engaging than others?
- Does World 1 collectively support its intended exit capability?

---

# 20. Self-Correction Requirement

If Work identifies an issue during either self-check, it must correct the artifact before submission.

The cycle is:

```text
Create
↓
Mechanical Self-Check
↓
Semantic Self-Check
↓
Defects Found?
   ↓ YES
Correct
↓
Repeat affected checks
↓
No unresolved defects
↓
Submit
```

Work must not knowingly submit unresolved defects merely because independent QA will review the artifact later.

---

# 21. Self-Validation Report

The final Stage 1 output should include a concise internal validation record.

Example:

```json
{
  "work_self_validation": {
    "mechanical_check": "PASS",
    "semantic_check": "PASS",
    "unresolved_known_defects": 0
  }
}
```

This is informational only.

It has **no certification authority**.

---

# 22. Output Artifacts

Stage 1 should produce at minimum:

```text
knowledge_map.json
```

and, where useful for review:

```text
knowledge_map.csv
```

Optional human-readable form:

```text
knowledge_map.md
```

All formats must represent the same canonical content.

---

# 23. Stage Status

After Work completes creation and self-validation:

```text
status = AWAITING_QA
```

The Work task must not set:

```text
PASS
CERTIFIED
APPROVED
CANONICAL
```

Those statuses belong exclusively to the independent QA process.

---

# 24. Independent QA Boundary

Stage 1 ends before independent QA begins.

The separate QA job must receive:

- the final Knowledge Map artifact;
- governing upstream specifications;
- applicable QA instructions.

The QA job independently decides:

```text
PASS
FAIL_REWORK
BLOCKED
```

The Work task's internal self-validation must not influence the QA reviewer's conclusion.

---

# 25. Rework Boundary

If independent QA returns `FAIL_REWORK`:

```text
QA findings
     ↓
Stage 1 Work task
     ↓
Correct Knowledge Map
     ↓
Repeat mechanical self-check
     ↓
Repeat semantic self-check
     ↓
Submit new artifact version
     ↓
Independent QA reviews again
```

The previous QA result cannot certify the revised artifact.

---

# 26. Upstream Blocker Rule

If Stage 1 discovers that the governing specifications are:

- contradictory;
- incomplete;
- semantically ambiguous;
- impossible to satisfy simultaneously;

Work must not invent a resolution.

The affected work must be marked:

```text
BLOCKED_BY_UPSTREAM_SPEC
```

and the conflict documented.

---

# 27. Downstream Rule

No Stage 2 Content Job may be created from the Stage 1 artifact merely because Work completed it successfully.

Stage 2 eligibility requires:

```text
Independent QA status = PASS
```

against the exact Knowledge Map version being consumed.

---

# 28. Stage 1 Success Condition

Stage 1 production is complete when:

> ChatGPT Work has created the complete Knowledge Map, mechanically validated it, semantically reviewed it in full, corrected all defects it identified, and submitted the final artifact for independent QA without claiming certification.

The Knowledge Map becomes eligible for Stage 2 only after the separate QA job independently approves it.