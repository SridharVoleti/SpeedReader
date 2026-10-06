# SpeedReader Pipeline — Stage 2: Content Job Creation

**Version:** v0.2  
**Stage:** 02  
**Artifact:** Content Job  
**Producer:** ChatGPT Work  
**Required upstream status:** Stage 01 Knowledge Map independently QA-approved  
**Downstream eligibility:** Independent Stage 02 QA approval required

---

# 1. Purpose

Convert one approved Knowledge Map coordinate into a complete, self-contained, generation-ready Content Job.

The Content Job is the formal contract between:

```text
Curriculum Planning
        ↓
Passage Creation
```

It must contain everything the Passage Creation stage needs to produce the correct learner-facing passage without inventing curriculum intent or reconstructing requirements from scattered source documents.

The Content Job does **not** contain the final passage.

---

# 2. Stage Boundary

Stage 2 begins only with a Knowledge Map artifact that has independently passed Stage 01 QA.

Stage 2 ends when ChatGPT Work has:

1. selected the required approved Knowledge Map coordinate;
2. gathered all applicable certified specifications;
3. compiled them into one Content Job;
4. performed complete mechanical self-validation;
5. performed complete semantic self-validation;
6. corrected every defect discovered internally;
7. produced the final Content Job artifact;
8. marked it `AWAITING_QA`.

Stage 2 does not certify its own output.

---

# 3. Pipeline Position

```text
CERTIFIED KNOWLEDGE MAP
          ↓
  STAGE 2 — CHATGPT WORK
    CONTENT JOB CREATION
          ↓
Mechanical Self-Validation
          ↓
 Semantic Self-Validation
          ↓
Correct Identified Defects
          ↓
 FINAL CONTENT JOB
          ↓
     AWAITING_QA
          ↓
SEPARATE STAGE 02 QA JOB
```

Stage 03 Passage Creation must never receive a Content Job whose Stage 02 QA status is not `PASS`.

---

# 4. Core Production Rule

The Content Job must be a **fully prepared execution contract**, not a loose prompt.

The Work task must follow:

```text
Retrieve
↓
Compile
↓
Expand
↓
Cross-check
↓
Self-review
↓
Correct
↓
Submit
```

The Passage Creator should not need to decide what the curriculum intended.

---

# 5. Mandatory Inputs

Only independently approved or otherwise certified inputs may be used.

## 5.1 Certified Knowledge Map

The selected row must come from the exact QA-approved Knowledge Map version.

The Content Job must preserve:

- Passage ID;
- World;
- Band;
- Reading Stage;
- P-level;
- Delivery Round;
- Delivery Session;
- Knowledge Strand;
- Working Title;
- Content Concept;
- Content Premise;
- RS competency target;
- P-level target;
- comprehension target;
- learner evidence;
- factual/safety flags;
- applicable generation notes.

These values may be expanded where required.

They must not be silently redesigned.

---

## 5.2 Reading Stage Specification

The exact applicable RS specification must provide:

- canonical competency;
- learner behaviour;
- measurable indicators;
- developmental expectations;
- boundaries from other Reading Stages;
- passage-relevant execution requirements.

---

## 5.3 P1→P10 Progression Specification

The exact assigned P-level must provide:

- developmental demand;
- comprehension sophistication;
- expected learner independence;
- complexity expectations;
- boundaries from adjacent P-levels.

---

## 5.4 Row-Level Passage Generation Specification

Where available, this should define the exact passage-generation requirements associated with the selected coordinate.

This may include:

- prose structure;
- content elements;
- information relationships;
- required cues;
- allowed complexity;
- prohibited shortcuts;
- assessment evidence requirements.

---

## 5.5 Prose and Oral-Reading Rules

Applicable requirements may include:

- exact word count;
- sentence characteristics;
- oral rhythm;
- age suitability;
- punctuation expectations;
- vocabulary expectations;
- narrative/informational style;
- engagement requirements;
- ending expectations;
- prohibited prose patterns.

---

## 5.6 Comprehension Requirements

The Content Job must carry forward the exact comprehension demand that the future passage must support.

The job must make clear:

- what information the learner must process;
- what relationship or meaning must be preserved;
- what kind of comprehension evidence must later be obtainable.

---

## 5.7 Factual Rules

Where applicable, the job must contain specific factual controls.

Examples:

- facts requiring verification;
- claims that must remain conservative;
- terminology that must be accurate;
- concepts that must not be oversimplified misleadingly;
- India/world contextual requirements.

---

## 5.8 Safety Rules

Where applicable, the job must explicitly state:

- relevant safety category;
- behaviours that must not be encouraged;
- required conservative framing;
- prohibited imitable actions;
- age-appropriate safety boundaries.

---

## 5.9 Engagement Rules

The Content Job must preserve the applicable engagement architecture.

Where required, this may include:

- early hook;
- sustained mid-passage interest;
- meaningful payoff;
- curiosity;
- surprise;
- narrative movement;
- learner relevance.

Engagement must never override factual accuracy, safety, or pedagogical intent.

---

# 6. One Content Job = One Passage Coordinate

Each Content Job represents exactly one passage coordinate.

Example:

```text
World 1
Band A
RS04
P03
Passage ID: W1-BA-034
```

It must never combine multiple passage coordinates into one job unless a future pipeline specification explicitly permits batching.

---

# 7. Mandatory Content Job Schema

Minimum structure:

```json
{
  "job_id": "JOB-W1-BA-034",

  "passage_id": "W1-BA-034",

  "world": 1,
  "band": "A",

  "reading_stage": "RS04",
  "p_level": "P03",

  "delivery_round": 3,
  "delivery_session": 34,

  "knowledge_strand": "",

  "working_title": "",
  "content_concept": "",
  "content_premise": "",

  "rs_competency": "",
  "rs_target_for_this_passage": "",

  "p_level_definition": "",
  "p_level_target_for_this_passage": "",

  "comprehension_target": "",

  "learner_evidence_required": [],

  "required_content_elements": [],

  "required_information_relationships": [],

  "prose_requirements": {},

  "engagement_requirements": {},

  "factual_requirements": [],

  "safety_requirements": [],

  "assessment_support_requirements": [],

  "prohibited_patterns": [],

  "creative_freedom": [],

  "generation_constraints": [],

  "source_artifacts": {},

  "source_spec_versions": {},

  "work_self_validation": {},

  "status": "AWAITING_QA"
}
```

The schema may expand when future specifications require additional fields.

---

# 8. Knowledge Map Fidelity Rule

The Content Job may expand the approved Knowledge Map row.

It may not replace its meaning.

Example:

Approved Knowledge Map:

```text
Knowledge Strand:
Animals

Content Concept:
How ants divide work inside a colony

RS Target:
Track relationships between connected pieces of information
```

The Content Job may clarify how the passage must realize that requirement.

It must not change it into:

```text
Knowledge Strand:
Science

Topic:
Insect communication

Target:
Identify the main idea
```

That would be unauthorized curriculum drift.

---

# 9. RS Expansion

The Content Job must convert the Knowledge Map's RS target into a generation-ready requirement.

It should answer:

> What must the future passage contain so that the learner genuinely exercises this Reading Stage competency?

Example:

```json
{
  "rs_competency":
    "Track relationships between connected information.",

  "rs_target_for_this_passage":
    "The passage must contain at least two separated but meaningfully connected pieces of information whose relationship the learner needs to preserve while reading."
}
```

The expansion must remain faithful to the certified RS specification.

---

# 10. P-Level Expansion

The Content Job must operationalize the assigned P-level.

It must answer:

> What makes this particular passage P03 within this Reading Stage?

The job should clarify appropriate:

- cognitive demand;
- information complexity;
- independence requirement;
- relationship complexity;
- inference burden;
- comprehension depth;

according to the canonical P-level specification.

The job must not simulate progression merely through harder vocabulary.

---

# 11. RS × P Interaction

The Content Job must explicitly preserve both dimensions.

The future passage must be:

```text
Correct for the assigned RS
AND
Correct for the assigned P-level
```

The job should be specific enough that the Passage Creator cannot accidentally satisfy only one of the two.

---

# 12. Learner Evidence Required

This is a mandatory operational field.

It defines what learner behaviour the future passage must make measurable.

Example:

```json
"learner_evidence_required": [
  "Identify both relevant pieces of information.",
  "Explain how they are connected.",
  "Use evidence available within the passage."
]
```

This is not an assessment question.

It is the evidence requirement that later Assessment Creation must be able to convert into valid assessment.

---

# 13. Required Content Elements

The Content Job must list content that must appear in the passage.

Example:

```json
"required_content_elements": [
  "Introduce the ant colony naturally.",
  "Show at least two distinct worker roles.",
  "Show how those roles contribute to one shared outcome."
]
```

These requirements must come from the approved curriculum and generation specifications.

Do not over-constrain stylistic details unless required.

---

# 14. Required Information Relationships

Where the RS or comprehension target depends on relationships within text, the Content Job must make those relationships explicit for the Passage Creator.

Examples:

```text
cause → effect
event → consequence
problem → response
observation → inference
fact A ↔ fact B
sequence step 1 → step 2 → step 3
comparison A ↔ B
```

The Passage Creator should not have to infer what structure the passage needs.

---

# 15. Comprehension Target

The job must describe the exact comprehension behaviour the future passage must support.

It must align with:

```text
RS competency
+
P-level
+
content premise
+
learner evidence
```

These cannot operate as independent fields.

---

# 16. Assessment Support Requirement

Stage 2 does not create assessments.

However, the Content Job must ensure that the future passage contains enough evidence for valid assessment.

Example:

```json
"assessment_support_requirements": [
  "The causal relationship must be supported by passage evidence.",
  "The learner must not need outside knowledge to answer.",
  "At least one valid evidence-based response must be possible."
]
```

This prevents a later assessment stage from trying to manufacture questions unsupported by the passage.

---

# 17. Prose Requirements

The Content Job must explicitly carry every prose requirement that applies.

Examples:

```json
"prose_requirements": {
  "exact_word_count": 100,
  "oral_readability": true,
  "age_appropriate": true,
  "natural_sentence_flow": true,
  "forced_filler_prohibited": true
}
```

If the canonical specification defines more precise rules, those exact rules must be included.

---

# 18. Engagement Requirements

Where applicable:

```json
"engagement_requirements": {
  "early_hook": true,
  "mid_passage_pull": true,
  "ending_payoff": true,
  "forced_moral_prohibited": true,
  "artificial_cliffhanger_prohibited": true
}
```

The exact contract should come from certified SpeedReader engagement specifications.

---

# 19. Factual Requirements

The job must make factual obligations explicit.

Weak:

```text
Be accurate.
```

Stronger:

```json
"factual_requirements": [
  "Do not imply all ants perform identical roles.",
  "Do not attribute human intention or planning as scientific fact.",
  "Any biological claims must remain appropriate to the targeted level of explanation."
]
```

The Content Job should provide enough control to prevent predictable factual drift.

---

# 20. Safety Requirements

Safety instructions must be operational.

Weak:

```text
Keep safe.
```

Stronger:

```json
"safety_requirements": [
  "Do not encourage a child to disturb an ant nest.",
  "Observation may be framed as from a safe distance.",
  "Do not suggest handling unknown insects."
]
```

---

# 21. Prohibited Patterns

Known failure patterns applicable to the coordinate must be included.

Examples:

- generic textbook opening;
- forced moral lesson;
- repetitive sentence structure;
- filler added to reach word count;
- unsupported scientific claims;
- exposing internal RS/P language;
- solving the intended comprehension challenge explicitly for the learner;
- excessive explanation that removes the need for comprehension;
- unnecessary danger;
- content premise drift.

---

# 22. Creative Freedom

The Content Job must clearly distinguish between:

```text
FROZEN
```

and:

```text
CREATIVE
```

## Frozen

May include:

- instructional target;
- RS;
- P-level;
- knowledge strand;
- premise;
- required content;
- factual constraints;
- safety constraints;
- comprehension evidence;
- length.

## Creative

May include where unrestricted:

- exact wording;
- sentence rhythm;
- character names;
- imagery;
- sensory details;
- transitions;
- hook implementation;
- narrative voice;
- specific natural phrasing.

The purpose is to preserve curriculum while allowing high-quality prose.

---

# 23. Source Traceability

Every Content Job must retain exact source references.

Example:

```json
"source_artifacts": {
  "knowledge_map_artifact": "W1-BA-KNOWLEDGE-MAP"
}
```

and:

```json
"source_spec_versions": {
  "knowledge_map": "1.0",
  "reading_stage_spec": "1.0",
  "p_progression_spec": "1.0",
  "prose_spec": "1.0",
  "assessment_framework": "1.0",
  "safety_rules": "1.0"
}
```

Where available, exact artifact hashes or repository commit references should also be recorded.

---

# 24. Upstream Certification Check

Before creating the Content Job, Work must verify:

```text
Stage01 QA status = PASS
```

and that the exact Knowledge Map artifact/version being used is the certified version.

If this cannot be established:

```text
STOP STAGE 2
```

---

# 25. Work Self-Validation

Before submission, ChatGPT Work must perform two complete self-validation layers:

```text
A. Mechanical Self-Validation
B. Semantic Self-Validation
```

The Content Job must not be submitted until both pass.

---

# 26. Mechanical Self-Validation

Verify at minimum:

## Identity

- Job ID present.
- Passage ID present.
- IDs correctly correspond.
- World correct.
- Band correct.
- Reading Stage correct.
- P-level correct.

## Delivery

- Delivery Round correct.
- Delivery Session correct.
- Values match certified Knowledge Map.

## Required Fields

- every mandatory field exists;
- required arrays are present;
- required objects are present;
- prohibited blank/null values are absent.

## Enumerated Values

- RS valid;
- P-level valid;
- review classifications valid;
- strand value belongs to canonical ontology.

## Source Traceability

- Knowledge Map version recorded;
- relevant spec versions recorded;
- certified source artifact correctly referenced.

## Status

Before independent QA:

```text
status = AWAITING_QA
```

No other approval state is permitted.

---

# 27. Semantic Self-Validation

The Work task must critically review the completed Content Job against all governing sources.

---

# 28. Source Fidelity Check

Compare every inherited field against the certified Knowledge Map.

Verify:

- no curriculum drift;
- no unapproved title change;
- no changed concept;
- no changed strand;
- no changed RS;
- no changed P-level;
- no changed delivery mapping;
- no weakened learner evidence.

---

# 29. RS Fidelity Check

Ask:

> If the Passage Creator followed this job exactly, would the resulting passage genuinely exercise the assigned RS competency?

If not, the job must be corrected.

---

# 30. P-Level Fidelity Check

Ask:

> Does this job operationalize the correct P-level within this Reading Stage?

Compare against adjacent levels where necessary.

Reject:

- artificial vocabulary-only progression;
- excessive complexity;
- insufficient complexity;
- ambiguity between neighbouring P-levels.

---

# 31. RS × P Integrity Check

Determine whether the Content Job preserves both dimensions simultaneously.

A job that correctly captures RS04 but accidentally describes P07 difficulty for a P03 coordinate is defective.

---

# 32. Content-Pedagogy Fit

Ask:

> Can the prescribed content naturally produce the required learner behaviour?

If the passage would need contrived wording or artificial structure to satisfy the competency, the job must be corrected or escalated upstream.

---

# 33. Learner Evidence Sufficiency

Check that:

- evidence is observable;
- evidence matches the RS;
- evidence matches the P-level;
- the content premise can actually produce that evidence;
- later assessment can plausibly test it.

---

# 34. Assessment Readiness

The Content Job should allow Stage 04 to create valid assessment later without:

- inventing missing information;
- depending on outside knowledge;
- changing the passage objective;
- testing an unrelated capability.

---

# 35. Prose Feasibility

Check that the complete requirement set can realistically fit within the target passage constraints.

For example:

```text
exactly 100 words
+
required facts
+
RS behaviour
+
P-level demand
+
engagement
+
natural oral rhythm
```

must be jointly achievable.

If not, do not send an impossible job downstream.

---

# 36. Engagement Feasibility

Ensure the content premise and constraints still allow a natural, interesting passage.

The job must not over-specify the passage until it becomes mechanical or unnatural.

---

# 37. Factual Risk Review

Reassess whether the factual controls are sufficient for the planned content.

Do not simply inherit a risk flag mechanically.

If Stage 2 identifies an overlooked factual risk, it must escalate it appropriately.

---

# 38. Safety Risk Review

Reassess safety requirements in the fully expanded job.

The Content Job often contains more detail than the Knowledge Map, so additional safety implications may become visible at this stage.

These must not be ignored.

---

# 39. Contradiction Check

Look for contradictions across the Content Job.

Examples:

```text
exact word count = 100
```

but:

```text
minimum word count = 120
```

or:

```text
do not explain the cause explicitly
```

while another requirement says:

```text
state the cause directly in the first sentence
```

Any unresolved contradiction prevents submission.

---

# 40. Over-Specification Check

The Content Job must be deterministic in curriculum intent without prescribing every sentence.

Work must identify whether the job has become so restrictive that:

- natural prose is impossible;
- engagement is suppressed;
- every passage would sound templated;
- the Passage Creator has no useful creative freedom.

If so, reduce only non-canonical over-specification.

Do not weaken curriculum requirements.

---

# 41. Under-Specification Check

The opposite failure must also be detected.

Ask:

> Could two competent Passage Creators interpret this job in substantially different pedagogical ways?

If yes, the Content Job may be too vague.

Core curriculum intent must be deterministic.

---

# 42. Self-Correction Requirement

If Work identifies any issue:

```text
Create Content Job
↓
Mechanical Self-Validation
↓
Semantic Self-Validation
↓
Issue found?
    ↓ YES
Correct
↓
Repeat affected checks
↓
No unresolved known defects
↓
Submit
```

Do not knowingly pass a defect to independent QA.

---

# 43. Upstream Defect Rule

Stage 2 may discover that a valid Content Job cannot be created because Stage 1 or an upstream specification is defective.

Examples:

- Knowledge Map premise too vague;
- RS target contradictory;
- learner evidence impossible;
- source specifications conflict;
- P-level requirement ambiguous.

Stage 2 must not silently repair upstream curriculum.

Instead mark:

```text
BLOCKED_BY_UPSTREAM
```

and identify:

- affected source;
- conflict;
- why Stage 2 cannot safely resolve it.

The issue must return to the correct upstream stage.

---

# 44. Work Self-Validation Record

The final Content Job should contain:

```json
"work_self_validation": {
  "mechanical_check": "PASS",
  "semantic_check": "PASS",
  "source_fidelity_check": "PASS",
  "rs_p_alignment_check": "PASS",
  "downstream_feasibility_check": "PASS",
  "unresolved_known_defects": 0
}
```

This is production metadata only.

It has no certification authority.

---

# 45. Output Artifact

Stage 2 produces:

```text
content_job.json
```

Recommended location:

```text
artifacts/
└── content-jobs/
    └── W1/
        └── BandA/
            └── JOB-W1-BA-034.json
```

---

# 46. Output Status

After successful Stage 2 self-validation:

```text
status = AWAITING_QA
```

ChatGPT Work must never mark the job:

```text
PASS
CERTIFIED
QA_APPROVED
DOWNSTREAM_ELIGIBLE
```

---

# 47. Independent QA Boundary

The completed artifact is handed to the separate Stage 02 QA job.

Stage 02 QA must independently review:

```text
Certified Knowledge Map
+
Applicable Certified Specifications
+
Submitted Content Job
```

The QA reviewer must not rely on Work's internal self-validation conclusion.

---

# 48. Rework Flow

If independent QA returns:

```text
FAIL_REWORK
```

then:

```text
QA findings
↓
Stage 2 Work task
↓
Correct Content Job
↓
Mechanical self-validation again
↓
Semantic self-validation again
↓
Submit new artifact version
↓
Stage 02 QA reviews again
```

The previous certification status does not carry forward.

---

# 49. Downstream Access Rule

Stage 03 Passage Creation must not begin merely because the Content Job exists.

It must require:

```text
Stage02 QA status = PASS
```

for the exact Content Job version being consumed.

---

# 50. Stage 2 Success Condition

Stage 2 production is complete when:

> ChatGPT Work has transformed one independently approved Knowledge Map coordinate into a complete, self-contained, traceable, generation-ready Content Job; mechanically and semantically validated it in full; corrected all defects it identified; and submitted it for independent QA without claiming certification.

Only independent Stage 02 QA approval makes that Content Job eligible for Stage 03 — Passage Creation.