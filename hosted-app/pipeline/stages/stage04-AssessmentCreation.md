# SpeedReader Pipeline — Stage 4: Assessment Creation

**Version:** v0.1  
**Stage:** 04  
**Artifact:** Assessment Package  
**Producer:** ChatGPT Work  
**Required upstream status:** Stage 03 Passage independently QA-approved  
**Work output root:** `D:\Sridhar\Projects\SpeedReader\pipeline\wip`  
**Approved artifact root:** `D:\Sridhar\Projects\SpeedReader\pipeline\approved`  
**Downstream eligibility:** Independent Stage 04 QA approval required

---

# 1. Purpose

Create the learner assessment associated with one independently approved SpeedReader passage.

Stage 04 converts:

```text
Approved Passage
+
Approved Content Job
        ↓
Assessment Package
```

The assessment must measure the intended comprehension and learner evidence already defined upstream.

Stage 04 must not invent a new learning objective.

It must not change:

- Reading Stage competency;
- P-level;
- comprehension target;
- learner-evidence requirement;
- passage meaning;
- assessment scope.

Its responsibility is to convert the already approved evidence requirements into valid assessment items.

---

# 2. Stage Boundary

Stage 04 may begin only when the exact passage being assessed exists under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

and has independently passed Stage 03 QA.

Stage 04 must never create an assessment from a passage under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Stage 04 ends when ChatGPT Work has:

1. verified the approved upstream artifacts;
2. identified the exact learner evidence to assess;
3. created the complete assessment package;
4. performed mechanical self-validation;
5. performed semantic self-validation;
6. corrected every defect identified internally;
7. revalidated the assessment;
8. saved the final candidate under the Stage 04 WIP location;
9. marked it `AWAITING_QA`.

Stage 04 does not certify its own output.

---

# 3. Pipeline Position

```text
APPROVED STAGE 03 PASSAGE
          +
APPROVED STAGE 02 CONTENT JOB
          ↓
 STAGE 04 — CHATGPT WORK
    ASSESSMENT CREATION
          ↓
 Mechanical Self-Check
          ↓
  Semantic Self-Check
          ↓
 Correct Identified Defects
          ↓
   FINAL ASSESSMENT
          ↓
pipeline\wip\stage04\assessments
          ↓
      AWAITING_QA
          ↓
 SEPARATE STAGE 04 QA JOB
```

On QA PASS:

```text
pipeline\wip\stage04\assessments
          ↓
         MOVE
          ↓
pipeline\approved\stage04\assessments
```

Only the approved assessment is eligible for Stage 05.

---

# 4. Core Production Rule

Assessment Creation must follow:

```text
Read approved Content Job
↓
Read approved Passage
↓
Identify required learner evidence
↓
Map evidence to assessment items
↓
Create questions / answer keys / evidence mapping
↓
Mechanical validation
↓
Semantic validation
↓
Correct defects
↓
Revalidate
↓
Save to WIP
↓
Submit for independent QA
```

The assessment must measure what the passage was designed to teach and reveal.

It must not become a separate curriculum-design exercise.

---

# 5. Mandatory Input Locations

Stage 04 may consume only approved upstream artifacts.

## 5.1 Approved Passage

Canonical source:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages
```

---

## 5.2 Approved Content Job

Canonical source:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage02\content-jobs
```

The Content Job supplies the authoritative:

- RS competency;
- P-level;
- comprehension target;
- learner evidence;
- assessment-support requirements.

The passage supplies the actual evidence available to the learner.

Both are required.

---

# 6. Upstream Certification Verification

Before assessment creation begins, Work must verify:

```text
Stage02 QA = PASS
Stage03 QA = PASS
```

for the exact Content Job and Passage being used.

The Passage ID and Job ID must match.

If any artifact:

- exists only in WIP;
- lacks valid approval;
- references a different passage;
- cannot be matched to its source;

then:

```text
STOP STAGE 04
```

---

# 7. Assessment Authority

The approved Content Job defines:

```text
WHAT learner evidence should be measured
```

The approved Passage defines:

```text
WHAT textual evidence is actually available
```

Stage 04 defines:

```text
HOW to elicit and score that evidence
```

Stage 04 must not redefine the learning target.

---

# 8. One Assessment Package per Passage

Each approved passage produces one assessment package unless a future certified specification explicitly defines otherwise.

Example:

```text
W1-BA-034.json
       ↓
ASSESS-W1-BA-034.json
```

The assessment package may contain multiple items.

---

# 9. Assessment Artifact Schema

Recommended minimum structure:

```json
{
  "assessment_id": "ASSESS-W1-BA-034",

  "passage_id": "W1-BA-034",
  "job_id": "JOB-W1-BA-034",

  "world": 1,
  "band": "A",

  "reading_stage": "RS04",
  "p_level": "P03",

  "delivery_round": 3,
  "delivery_session": 34,

  "comprehension_target": "",

  "learner_evidence_required": [],

  "assessment_items": [],

  "source_passage": {
    "artifact_path": "",
    "artifact_version": "",
    "artifact_hash": ""
  },

  "source_content_job": {
    "artifact_path": "",
    "artifact_version": "",
    "artifact_hash": ""
  },

  "work_self_validation": {},

  "status": "AWAITING_QA"
}
```

---

# 10. Assessment Item Schema

Each item should contain enough information for independent QA and later runtime scoring.

Recommended structure:

```json
{
  "item_id": "W1-BA-034-Q01",

  "item_type": "",

  "question": "",

  "expected_answer": "",

  "acceptable_answer_variants": [],

  "passage_evidence": [],

  "learner_evidence_measured": [],

  "comprehension_dimension": "",

  "scoring_rule": "",

  "outside_knowledge_required": false,

  "ambiguity_check": "PASS"
}
```

The exact schema may evolve as the assessment system matures.

---

# 11. Assessment Format Rule

Assessment format must follow the certified SpeedReader assessment specification.

Stage 04 must not invent a new response format simply because it is convenient.

Where applicable, permitted formats may include:

- spoken response;
- short text response;
- structured response;
- sequence reconstruction;
- evidence identification;
- other approved response formats.

If a particular format is prohibited by the governing specification, it must not be used.

---

# 12. Learner-Evidence Mapping

Every assessment item must explicitly map to at least one approved learner-evidence requirement.

The complete assessment package must collectively cover all mandatory learner-evidence requirements unless the canonical assessment specification states otherwise.

QA traceability must be possible:

```text
Learner Evidence Requirement
          ↓
Assessment Item
          ↓
Passage Evidence
          ↓
Scoring Rule
```

---

# 13. Evidence-First Question Design

Questions must be created from evidence actually available in the approved passage.

The Creator must not first invent a question and then search for a way to justify it.

Required order:

```text
Identify required learner evidence
↓
Locate supporting passage evidence
↓
Determine suitable elicitation method
↓
Write question
↓
Define answer
↓
Define scoring
```

---

# 14. Passage-Boundedness

Where the assessment is intended to measure passage comprehension, correct responses must be derivable from the passage.

Do not require outside knowledge unless the certified assessment specification explicitly permits it.

A child should not fail because they:

- lack unrelated science knowledge;
- do not know a difficult synonym;
- lack cultural background knowledge;
- do not remember information not contained in the passage.

---

# 15. RS Fidelity

The assessment must genuinely test the assigned Reading Stage behaviour.

The question must not merely test some fact contained in the same passage.

Example:

If the target competency requires connecting separated information, asking:

```text
What animal was mentioned?
```

would not provide evidence of that competency merely because the answer appears in the passage.

The item must elicit the intended reading behaviour.

---

# 16. P-Level Fidelity

The assessment must also operate at the intended P-level.

The elicitation demand must be neither:

- substantially below the target;
- nor substantially above it.

Difficulty must arise from the intended comprehension behaviour rather than:

- confusing wording;
- difficult vocabulary;
- unnecessary answer formatting;
- tricky distractors;
- hidden assumptions.

---

# 17. RS × P Integrity

Every assessment package must preserve:

```text
Correct competency
+
Correct developmental level
```

An assessment can fail even if the passage itself passed Stage 03.

Stage 04 must not weaken the learner demand during question creation.

---

# 18. Question Clarity

Every question must be understandable to the target learner.

Avoid:

- unnecessary complexity;
- double negatives;
- vague pronouns;
- unnecessary multi-part constructions;
- adult-style test language;
- hidden assumptions;
- wording more difficult than the passage itself without reason.

The challenge should come from comprehension, not question decoding.

---

# 19. One Defensible Interpretation

Every item must have a clear intended interpretation.

If two reasonable learners could understand the question differently:

```text
REVISE
```

Ambiguity in assessment invalidates the evidence.

---

# 20. Correct Answer Integrity

Every expected answer must be:

- supported by the passage;
- aligned to the question;
- aligned to the required competency;
- appropriate to the P-level.

The answer key must not demand wording more specific than the passage supports.

---

# 21. Multiple Valid Answers

If more than one response is legitimately correct, the assessment package must account for those variants.

Do not classify a valid alternative response as wrong merely because it differs from the preferred wording.

Where open responses are permitted, include appropriate:

```text
acceptable_answer_variants
```

or a semantic scoring rule.

---

# 22. No Multi-Answer Ambiguity

There is an important distinction between:

```text
multiple equivalent valid phrasings
```

and:

```text
multiple substantively different answers because the question is ambiguous
```

The first may be acceptable.

The second is a defect.

---

# 23. Passage Evidence

Every item must record the passage evidence supporting the answer.

Evidence may reference:

- sentence;
- phrase;
- connected sentences;
- sequence of events;
- inference cues.

This traceability helps independent QA determine whether the item is valid.

---

# 24. Inference Questions

If the learner is expected to infer:

- the passage must contain adequate clues;
- the answer must not require unsupported imagination;
- the inference must be defensible;
- reasonable alternative inference should be considered.

Inference is not guessing.

---

# 25. Literal Questions

Where literal comprehension is intended, avoid disguising recall with unnecessarily tricky wording.

Literal questions should test retrieval of relevant meaning, not test-taking tricks.

---

# 26. Sequence Questions

For sequencing:

- multiple meaningful steps/events must exist;
- order must be textually defensible;
- no two steps should be interchangeable unless explicitly allowed;
- the question must test sequence comprehension rather than memory burden unrelated to the target.

---

# 27. Cause-and-Effect Questions

For cause/effect:

- causal evidence must exist;
- simple temporal order must not be mistaken for causation;
- answer must reflect the relationship actually supported by the passage.

---

# 28. Relationship Questions

Where the competency requires connecting information:

- both relevant pieces must exist;
- their relationship must be valid;
- the question must require the learner to connect them;
- one isolated fact must not be sufficient.

---

# 29. Main-Idea Questions

Where main idea is targeted:

- the answer should represent the passage as a whole or the intended section;
- a memorable detail must not be accepted as equivalent;
- the question must not have multiple equally defensible summaries.

---

# 30. Vocabulary-in-Context Questions

Where permitted:

- meaning should be inferable from context;
- the item should not rely on dictionary memorization;
- context clues should be appropriate to the P-level.

---

# 31. Question Independence

Assessment items should not unintentionally reveal answers to one another.

Check for:

```text
Question 2 gives away Question 1
Question 3 repeats the answer to Question 2
```

where such leakage would invalidate measurement.

---

# 32. Avoid Redundant Measurement

Multiple questions should not merely ask the same thing with superficial wording differences unless repeated measurement is intentionally specified.

Every item should have a clear purpose.

---

# 33. Assessment Length

The number of questions must follow the applicable canonical assessment specification.

Do not add questions merely because more coverage appears better.

Assessment burden must remain appropriate for:

- age;
- passage length;
- learner attention;
- session design.

---

# 34. Scoring Rule

Every item must have an explicit scoring rule.

The rule must define what constitutes:

```text
correct
partially correct
incorrect
```

where partial credit is permitted.

If only binary scoring is permitted:

```text
correct / incorrect
```

must be unambiguous.

---

# 35. Scoring Must Measure Meaning

Where open answers are allowed, scoring should not require exact wording unless exact wording is itself the target.

Equivalent child-friendly phrasing should be accepted when it demonstrates the intended understanding.

---

# 36. No Accidental Writing Assessment

SpeedReader comprehension assessment must not accidentally become a spelling or grammar test unless explicitly intended.

For example, a learner who gives the correct semantic answer with minor spelling errors should not automatically fail comprehension if the response policy permits semantic scoring.

The governing assessment specification determines exact behaviour.

---

# 37. No Accidental Memory Overload

Questions should measure the intended reading competency rather than unrelated short-term memory burden.

Do not require recall of excessive arbitrary details unless that is explicitly part of the target.

---

# 38. No Trick Questions

Assessment should not rely on:

- traps;
- misleading wording;
- tiny technicalities;
- deliberately deceptive distractors;
- "gotcha" interpretation.

Difficulty must remain pedagogically meaningful.

---

# 39. Age Appropriateness

Review:

- question wording;
- expected response length;
- required reasoning;
- response format;
- emotional tone.

A valid passage can still have an age-inappropriate assessment.

---

# 40. Factual Integrity

Assessment items and answer keys must not introduce factual claims beyond the passage unnecessarily.

Do not "correct" the passage by inserting external information into the answer key.

If a factual defect is discovered in the approved passage:

```text
UPSTREAM_DEFECT
```

The passage must return to Stage 03.

---

# 41. Safety Integrity

Assessment questions must not encourage unsafe behaviour.

For example, avoid prompts that ask the child what they personally would do in a dangerous situation if that framing could normalize unsafe action, unless the certified curriculum explicitly requires safe-decision assessment.

---

# 42. Passage Integrity Rule

Stage 04 must never modify the approved Stage 03 passage.

If assessment creation reveals that valid questions cannot be produced from the passage:

```text
DO NOT PATCH THE PASSAGE
```

Report:

```text
BLOCKED_BY_UPSTREAM
```

and return the defect to Stage 03.

---

# 43. Work Self-Validation

Before submission, ChatGPT Work must perform:

```text
A. Mechanical Self-Validation
B. Semantic Self-Validation
```

Both must pass.

---

# 44. Mechanical Self-Validation

Verify at minimum:

## Identity

- Assessment ID correct.
- Passage ID correct.
- Job ID correct.
- World/Band correct.
- RS correct.
- P-level correct.
- delivery metadata correct.

## Source Approval

- Passage exists in `approved`.
- Content Job exists in `approved`.
- correct certifications verified.

## Item Structure

For every item:

- Item ID unique.
- Question present.
- Expected answer present.
- evidence mapping present.
- learner-evidence mapping present.
- scoring rule present.
- item type valid.

## Completeness

- required number of items present;
- all required learner evidence covered;
- no placeholder values;
- valid output schema.

## Status

Final WIP artifact must contain:

```text
status = AWAITING_QA
```

---

# 45. Semantic Self-Validation

Work must independently challenge the assessment package.

At minimum inspect:

- RS fidelity;
- P-level fidelity;
- learner-evidence coverage;
- passage evidence;
- question clarity;
- ambiguity;
- answer correctness;
- alternative valid answers;
- scoring validity;
- assessment burden;
- age appropriateness;
- question independence;
- factual integrity;
- safety;
- downstream usability.

---

# 46. RS Fidelity Self-Test

For every item ask:

> What learner behaviour does this question actually measure?

Compare it to the assigned RS competency.

If the item merely tests an easy detail unrelated to the RS:

```text
REVISE
```

---

# 47. P-Level Self-Test

Ask:

> Why is this question appropriate to the assigned P-level?

The answer should reflect developmental demand.

If difficulty comes mainly from wording or answer complexity, revise.

---

# 48. Learner-Evidence Coverage Test

Create an internal mapping:

```text
Evidence Requirement 1
→ Q01 / Q02

Evidence Requirement 2
→ Q03

...
```

Verify every mandatory evidence target is measured appropriately.

Do not submit with uncovered evidence requirements.

---

# 49. Passage Evidence Test

For every expected answer:

1. locate supporting passage evidence;
2. verify the passage genuinely supports it;
3. verify no prohibited external knowledge is required.

If evidence is missing:

```text
UPSTREAM_DEFECT
```

or revise the question if the issue is Stage 04 design.

---

# 50. Ambiguity Self-Test

For every question actively search for:

- alternate interpretations;
- multiple incompatible answers;
- unclear pronouns;
- vague references;
- time ambiguity;
- unclear comparison basis.

If ambiguity exists, rewrite the question.

---

# 51. Answer-Key Challenge

Attempt to disprove the expected answer.

Ask:

- Is another response equally defensible?
- Is the answer more specific than the text supports?
- Does the answer require assumptions?
- Is it actually measuring another comprehension skill?

Revise when necessary.

---

# 52. Child-Response Simulation

Mentally simulate plausible responses from the intended learner.

Check whether:

- a correct understanding could be unfairly marked wrong;
- a weak understanding could accidentally receive credit;
- wording creates unnecessary confusion;
- the scoring rule handles natural child phrasing.

---

# 53. Question Leakage Test

Review all assessment items together.

Ensure one item does not inadvertently reveal another item's answer where that compromises validity.

---

# 54. Redundancy Test

Determine whether multiple questions provide genuinely different evidence.

Remove or revise redundant items unless repeated evidence is explicitly required.

---

# 55. Assessment Burden Test

Evaluate the package as a complete learner experience.

Ask:

- Is the number of questions appropriate?
- Is expected response effort reasonable?
- Does assessment remain proportional to a short passage?
- Does it unnecessarily extend the session?

---

# 56. Factual Self-Review

Review:

- question wording;
- answer keys;
- explanatory metadata where learner-facing;
- scoring notes.

Ensure Stage 04 introduced no new factual errors.

---

# 57. Safety Self-Review

Review the assessment independently for:

- unsafe behavioural prompts;
- problematic personal scenarios;
- newly introduced risky examples.

Correct before submission.

---

# 58. Assessment Neutrality Test

The assessment should measure learner understanding without changing the lesson.

Do not introduce:

- teaching explanations;
- hints that reveal answers unless explicitly part of the assessment design;
- new facts;
- corrective instruction before scoring.

Those belong elsewhere in the learning experience.

---

# 59. Self-Correction Loop

Required workflow:

```text
Create assessment
↓
Mechanical self-check
↓
Semantic self-check
↓
Defect found?
   ↓ YES
Revise
↓
Repeat mechanical validation
↓
Repeat semantic validation
↓
No unresolved known defect
↓
Save final WIP artifact
```

Do not submit a weak assessment merely to let QA discover its problems.

---

# 60. Upstream Defect Rule

Stage 04 may discover that assessment cannot be validly created because the approved Passage or Content Job is defective.

Examples:

- required evidence absent from passage;
- intended inference is explicitly stated;
- multiple interpretations exist because of passage ambiguity;
- approved learner evidence cannot be elicited;
- Content Job and Passage do not align.

Set:

```text
BLOCKED_BY_UPSTREAM
```

Do not modify approved upstream artifacts.

Return the issue to the appropriate stage.

---

# 61. Work Self-Validation Record

Recommended structure:

```json
{
  "work_self_validation": {
    "mechanical_check": "PASS",
    "semantic_check": "PASS",
    "upstream_certification_check": "PASS",
    "rs_fidelity_check": "PASS",
    "p_level_check": "PASS",
    "learner_evidence_coverage_check": "PASS",
    "passage_evidence_check": "PASS",
    "ambiguity_check": "PASS",
    "answer_key_check": "PASS",
    "scoring_check": "PASS",
    "age_appropriateness_check": "PASS",
    "factual_check": "PASS",
    "safety_check": "PASS",
    "unresolved_known_defects": 0
  }
}
```

This record is informational only.

It is not independent QA certification.

---

# 62. WIP Output Location

All Stage 04 output must be created under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Recommended structure:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\
└── stage04\
    └── assessments\
        └── W1\
            └── BandA\
                └── ASSESS-W1-BA-034.json
```

Stage 04 Work must never write directly into `approved`.

---

# 63. WIP Status

Every Stage 04 candidate remains:

```text
AWAITING_QA
```

while under:

```text
pipeline\wip
```

Work self-validation does not authorize promotion.

---

# 64. Independent QA Boundary

The separate Stage 04 QA reviewer should receive:

```text
Approved Content Job
+
Approved Passage
+
WIP Assessment Package
+
Applicable Certified Specifications
+
Stage04-QA.md
```

The reviewer independently decides:

```text
PASS
FAIL_REWORK
BLOCKED
```

---

# 65. QA PASS Promotion Rule

On Stage 04 QA `PASS`, the exact reviewed assessment artifact must move from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage04\assessments\...
```

to:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments\...
```

No content modification may occur during promotion.

---

# 66. QA Failure Rule

If QA returns:

```text
FAIL_REWORK
```

the artifact remains under WIP.

ChatGPT Work must:

1. read the QA findings;
2. revise only within Stage 04 scope;
3. repeat full mechanical self-validation;
4. repeat full semantic self-validation;
5. save the revised WIP artifact;
6. submit it for full independent QA again.

---

# 67. QA Blocked Rule

If QA returns:

```text
BLOCKED
```

the artifact remains under WIP.

The appropriate upstream stage must be reopened.

No Stage 05 work may begin.

---

# 68. Exact-Artifact Promotion Rule

Approval applies only to the exact assessment artifact reviewed.

Any change after approval invalidates certification for the modified artifact.

The changed file must return to WIP and undergo QA again.

---

# 69. Approved Artifact Authority

After QA PASS:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments\...
```

becomes the only authoritative Stage 04 assessment artifact.

Downstream stages must never consume the corresponding WIP version.

---

# 70. Downstream Access Rule

Stage 05 Production Package Creation may use assessments only from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments
```

and passages only from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages
```

No WIP artifact may enter Stage 05.

---

# 71. Stage 04 Success Condition

Stage 04 production is complete when:

> ChatGPT Work has transformed one independently approved learner-facing passage and its approved Content Job into a complete assessment package that validly measures the intended Reading Stage competency, P-level and learner evidence; uses only defensible passage evidence; contains clear, age-appropriate and unambiguous questions and scoring rules; has passed full mechanical and semantic self-validation; and has been saved under the canonical WIP directory for independent QA.

Stage 04 becomes downstream-authoritative only when the separate Stage 04 QA job returns `PASS` and the exact reviewed artifact is moved into:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```