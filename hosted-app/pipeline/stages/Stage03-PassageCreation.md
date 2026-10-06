# SpeedReader Pipeline — Stage 3: Passage Creation

**Version:** v0.2  
**Stage:** 03  
**Artifact:** Learner-Facing Passage  
**Producer:** ChatGPT Work  
**Required upstream status:** Stage 02 Content Job independently QA-approved  
**Work output root:** `D:\Sridhar\Projects\SpeedReader\pipeline\wip`  
**Approved artifact root:** `D:\Sridhar\Projects\SpeedReader\pipeline\approved`  
**Downstream eligibility:** Independent Stage 03 QA approval required

---

# 1. Purpose

Create the final learner-facing SpeedReader passage from one independently approved Content Job.

Stage 03 converts:

```text
Certified Content Job
        ↓
Learner-Facing Passage
```

The passage must faithfully realize the approved:

- Reading Stage competency;
- P-level development target;
- content premise;
- comprehension target;
- learner-evidence requirement;
- required information structure;
- prose requirements;
- engagement requirements;
- factual controls;
- safety controls.

Stage 03 creates learner-facing content.

It does not create assessment questions.

It does not certify its own output.

---

# 2. Stage Boundary

Stage 03 may begin only when the exact Content Job being consumed exists in the approved pipeline area and has independently passed Stage 02 QA.

The Content Job must come from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

Stage 03 must never use a Content Job directly from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Stage 03 ends when ChatGPT Work has:

1. verified the approved upstream Content Job;
2. created the passage;
3. completed mechanical self-validation;
4. completed semantic self-validation;
5. corrected every defect it identified;
6. revalidated the corrected passage;
7. saved the finished candidate in the Stage 03 WIP location;
8. marked the artifact `AWAITING_QA`.

Stage 03 does not move its own artifact into `approved`.

Only independent Stage 03 QA may authorize that promotion.

---

# 3. Pipeline Position

```text
APPROVED STAGE 02 CONTENT JOB
            ↓
   STAGE 03 — CHATGPT WORK
      PASSAGE CREATION
            ↓
   Mechanical Self-Check
            ↓
    Semantic Self-Check
            ↓
   Correct Identified Defects
            ↓
       FINAL CANDIDATE
            ↓
pipeline\wip\stage03\passages
            ↓
      AWAITING_QA
            ↓
  SEPARATE STAGE 03 QA JOB
            ↓
       PASS / FAIL
```

On QA PASS:

```text
pipeline\wip\stage03\passages
            ↓
          MOVE
            ↓
pipeline\approved\stage03\passages
```

Only the approved copy becomes valid input for Stage 04.

---

# 4. Core Production Rule

ChatGPT Work must produce a production-quality candidate rather than a rough draft.

The required workflow is:

```text
Read approved Content Job
↓
Understand all constraints
↓
Plan passage
↓
Write passage
↓
Mechanical self-validation
↓
Semantic self-validation
↓
Correct defects
↓
Revalidate
↓
Save to WIP
↓
Submit for QA
```

The Work task must not knowingly pass unresolved defects to QA.

---

# 5. Mandatory Input Location

Stage 03 may consume only independently approved Stage 02 artifacts.

Canonical upstream root:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

Recommended Stage 02 input structure:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\
└── stage02\
    └── content-jobs\
        └── W1\
            └── BandA\
                └── JOB-W1-BA-034.json
```

If the required Content Job exists only under `wip`, Stage 03 must stop.

---

# 6. Mandatory Inputs

## 6.1 Approved Content Job

The Content Job is the immediate authoritative production contract.

Stage 03 must preserve all applicable:

- Passage ID;
- World;
- Band;
- Reading Stage;
- P-level;
- Delivery Round;
- Delivery Session;
- Knowledge Strand;
- Content Concept;
- Content Premise;
- RS competency;
- RS passage target;
- P-level definition;
- P-level target;
- comprehension target;
- learner evidence;
- required content elements;
- required information relationships;
- prose requirements;
- engagement requirements;
- factual requirements;
- safety requirements;
- assessment-support requirements;
- prohibited patterns;
- generation constraints.

---

## 6.2 Stage 02 QA Approval

Stage 03 must verify that the Content Job has genuinely been approved.

At minimum confirm:

```text
Stage02 QA status = PASS
```

and that the artifact being consumed is the exact artifact promoted into the approved directory.

If this cannot be established:

```text
STOP STAGE 03
```

---

# 7. Source Authority

The approved Content Job is the immediate generation contract.

If Stage 03 discovers an apparent contradiction between the approved Content Job and another governing specification:

```text
DO NOT SILENTLY RESOLVE IT
```

Instead mark:

```text
BLOCKED_BY_UPSTREAM
```

and identify the conflict.

Stage 03 must not modify curriculum intent merely to make passage writing easier.

---

# 8. One Job Produces One Passage

Each approved Content Job produces exactly one learner-facing passage unless a future certified pipeline specification explicitly introduces variants.

Example:

```text
JOB-W1-BA-034
        ↓
W1-BA-034
```

The Work task must not create alternative passage versions and choose among them downstream unless explicitly instructed.

---

# 9. Passage Artifact Schema

Recommended structure:

```json
{
  "passage_id": "W1-BA-034",
  "job_id": "JOB-W1-BA-034",

  "world": 1,
  "band": "A",

  "reading_stage": "RS04",
  "p_level": "P03",

  "delivery_round": 3,
  "delivery_session": 34,

  "title": "",
  "passage_text": "",

  "word_count": 100,

  "source_content_job": {
    "artifact_path": "",
    "artifact_version": "",
    "artifact_hash": ""
  },

  "work_self_validation": {},

  "status": "AWAITING_QA"
}
```

Internal metadata must remain separate from learner-facing prose.

---

# 10. Learner-Facing Content Rule

The passage itself must not expose:

- Reading Stage labels;
- P-level labels;
- Content Job terminology;
- learner-evidence terminology;
- QA terminology;
- pipeline instructions;
- metadata;
- generation notes;
- internal scoring rules.

The learner should experience natural reading material.

The instructional architecture must remain invisible.

---

# 11. Curriculum Fidelity

The Passage Creator may make creative writing decisions.

It may not make curriculum decisions.

## Creative decisions may include

- exact wording;
- sentence rhythm;
- transitions;
- imagery;
- permitted character names;
- presentation style;
- narrative voice where allowed;
- hook implementation.

## Frozen requirements include

- assigned RS;
- assigned P-level;
- content concept;
- premise;
- required information relationships;
- learner evidence;
- mandatory content;
- comprehension architecture;
- factual controls;
- safety controls;
- exact length where specified.

---

# 12. Reading Stage Realization

The assigned Reading Stage competency must exist in the actual text structure.

It is not sufficient for metadata to claim compliance.

Ask:

> What must the learner actively do while reading this passage that exercises the assigned RS competency?

The passage must make that behaviour necessary and observable.

---

# 13. P-Level Realization

The passage must implement the intended developmental level within the assigned Reading Stage.

P-level progression must not be simulated primarily through:

- difficult vocabulary;
- long words;
- complex names;
- excessive sentence length;
- obscure facts;
- unnecessary technical terminology.

Difficulty must emerge primarily from the intended reading/comprehension demand.

---

# 14. RS × P Integrity

The passage must simultaneously satisfy:

```text
Correct RS competency
+
Correct P-level demand
```

Both must be independently verified during Work self-validation.

---

# 15. Content-Premise Fidelity

The finished passage must genuinely realize the approved Content Concept and Content Premise.

The Creator must not drift into a more convenient adjacent topic.

Example:

Approved:

```text
How ants divide work inside a colony
```

must not quietly become:

```text
Interesting facts about ants
```

if that change weakens the intended instructional structure.

---

# 16. Required Content Elements

Every mandatory content element must appear meaningfully.

Required elements must not be inserted merely as isolated phrases to satisfy a checklist.

They must contribute naturally to the passage.

---

# 17. Required Information Relationships

The passage must contain every relationship required by the certified Content Job.

Possible structures include:

```text
cause → effect
event → consequence
problem → response
step → next step
fact A ↔ fact B
observation → inference
comparison A ↔ B
```

The relationship must be neither:

- so hidden that the learner has insufficient evidence;
- nor so explicitly explained that the intended comprehension work disappears.

The appropriate balance is determined by the assigned P-level.

---

# 18. Learner-Evidence Support

Every `learner_evidence_required` item in the approved Content Job must be supportable from the finished passage.

The Creator must verify:

1. relevant information exists;
2. that information is sufficiently clear;
3. the intended reading behaviour is necessary;
4. no prohibited outside knowledge is required.

If learner evidence cannot be obtained from the passage, revise it.

---

# 19. Assessment Neutrality

Stage 03 must prepare valid reading material, not pre-write assessment answers.

Do not distort prose by:

- repeating likely answers;
- marking facts as "important";
- inserting obvious clue phrases;
- over-explaining intended inference;
- creating unnatural sentence structures solely to support questions.

Assessment Creation happens only after Stage 03 QA approves the passage.

---

# 20. Word Count

Follow the exact word-count requirement from the certified Content Job.

Where the current Band-A contract requires:

```text
exactly 100 words
```

the learner-facing passage must contain exactly 100 words under the canonical SpeedReader word-count convention.

The title must not be counted unless the governing specification explicitly requires it.

---

# 21. Word-Count Integrity

Exact length is mandatory but must not damage prose quality.

Do not use:

- filler;
- redundant facts;
- unnecessary adjectives;
- unnatural contractions;
- awkward fragments;
- repeated ideas;
- weak closing sentences;

merely to reach the target.

If editing damages naturalness, rewrite the relevant sentence or passage.

Any modification after counting requires word count to be checked again.

---

# 22. Oral Readability

The passage must work as spoken text.

Review:

- sentence length;
- punctuation;
- rhythm;
- breath-group structure;
- pronoun clarity;
- pronunciation burden;
- transitions;
- syntactic simplicity appropriate to the stage.

Avoid unnecessary:

- nested clauses;
- unusual abbreviations;
- symbol-heavy constructions;
- tongue-twisting wording;
- dense proper nouns;
- excessive punctuation.

---

# 23. Age Appropriateness

The passage must suit the target learner in:

- vocabulary;
- emotional tone;
- concept presentation;
- background-knowledge requirement;
- scenario;
- sentence complexity;
- safety implications.

Age appropriateness does not mean eliminating intellectual challenge.

The reading demand should remain appropriate to the assigned RS/P coordinate.

For World 1 age-band collections, an older learner may receive a more mature topic while the prose remains simple and accessible. Vocabulary difficulty must not substitute for the assigned reading skill, speed, or stamina demand. Record whether the independent review found vocabulary overload or unnecessary stretch demands, and identify any primary gentle stretch. Do not mark the content language-QA approved until those concerns are resolved. At most one primary gentle stretch may be deliberate in a passage.

---

# 24. Natural Prose

The passage must read naturally.

It must not sound like:

- a specification converted into sentences;
- a generated template;
- a textbook definition;
- a list of disconnected facts;
- a comprehension worksheet;
- an assessment disguised as prose.

The learner should encounter coherent, enjoyable reading.

---

# 25. Engagement

Follow the certified engagement requirements.

Where required, ensure:

## Beginning

Provides a natural reason to continue reading.

## Middle

Develops information, action, curiosity or discovery.

## Ending

Provides a meaningful and satisfying completion.

Engagement should emerge from the subject matter and writing quality.

---

# 26. Engagement Restrictions

Do not manufacture engagement through:

- false information;
- unnecessary danger;
- fear;
- misleading suspense;
- manipulative emotional scenarios;
- forced morals;
- artificial cliff-hangers.

Not every passage needs to be a story.

Use the structure best suited to the approved Content Job.

---

# 27. Ending Quality

Avoid habitual generated endings such as:

```text
And that is why...
So always remember...
This teaches us that...
Isn't that amazing?
```

unless one is genuinely appropriate to the specific passage.

The ending should feel natural to the content type.

---

# 28. Factual Accuracy

All factual claims must be accurate enough for the intended learner level and comply with the approved Content Job.

The Creator must not introduce unnecessary factual claims merely for decoration.

If a factual detail is uncertain:

```text
DO NOT INVENT IT
```

Use a safer formulation or escalate if the detail is necessary.

---

# 29. Simplification Rule

Child-friendly simplification is permitted.

Distortion is not.

Simplification must preserve:

- essential truth;
- correct relationships;
- correct causality;
- appropriate certainty.

Avoid false universal claims.

---

# 30. Safety Compliance

The passage must satisfy every approved safety requirement.

The final prose must also be checked for new safety implications introduced during writing.

The passage should not accidentally model dangerous behaviour a child could imitate.

---

# 31. Work Self-Validation

Before saving the final candidate, ChatGPT Work must conduct:

```text
A. Mechanical Self-Validation
B. Semantic Self-Validation
```

Both must pass.

The Work task must correct all known defects before writing the final WIP artifact.

---

# 32. Mechanical Self-Validation

Verify at minimum:

## Identity

- Passage ID correct;
- Job ID correct;
- World correct;
- Band correct;
- RS correct;
- P-level correct;
- delivery metadata correct.

## Upstream Source

- approved Content Job used;
- Stage02 QA status verified;
- source path/version/hash recorded where available.

## Word Count

- exact required word count;
- correct counting convention.

## Artifact Structure

- all mandatory fields present;
- valid JSON where JSON is required;
- no placeholders;
- status = `AWAITING_QA`.

## Formatting

Check for:

- malformed punctuation;
- markdown accidentally included inside prose;
- truncated sentences;
- duplicate sentence fragments;
- metadata leaking into learner-facing content.

---

# 33. Semantic Self-Validation

The Work task must critically evaluate the final passage independently of its own drafting process.

At minimum review:

- RS fidelity;
- P-level fidelity;
- RS × P interaction;
- content-premise fidelity;
- required information relationships;
- learner-evidence support;
- comprehension integrity;
- prose quality;
- oral readability;
- engagement;
- age appropriateness;
- factual accuracy;
- safety;
- assessment readiness;
- over-explanation;
- under-specification.

---

# 34. RS Fidelity Self-Test

Ask:

> What textual evidence proves that this passage exercises the assigned Reading Stage?

The answer must identify concrete structures inside the passage.

If the answer is generic, revise.

---

# 35. P-Level Fidelity Self-Test

Ask:

> Why is this passage appropriate to this exact P-level rather than an adjacent level?

The answer should reference learner capability and information/comprehension demand, not merely vocabulary.

---

# 36. Comprehension Integrity Test

Verify that the passage actually requires the intended comprehension behaviour.

Examples:

If inference is targeted:

```text
the relevant conclusion should not simply be stated verbatim
```

unless permitted at that P-level.

If relationship tracking is targeted:

```text
the related information must genuinely need to be connected
```

If sequencing is targeted:

```text
multiple meaningful ordered elements must exist
```

---

# 37. Learner-Evidence Test

For every evidence requirement, identify exactly where the supporting information exists in the passage.

If evidence cannot be located clearly:

```text
FAIL SELF-VALIDATION
```

and revise.

---

# 38. Prose-Quality Test

Review the passage purely as writing.

Check:

- coherence;
- naturalness;
- grammar;
- sentence variety;
- transitions;
- rhythm;
- opening quality;
- ending quality;
- absence of filler.

A technically compliant passage with poor writing must not be submitted.

---

# 39. Oral-Reading Test

Mentally read the passage aloud.

Review:

- awkward phrasing;
- difficult word sequences;
- confusing pauses;
- long breath groups;
- unclear pronouns;
- excessive punctuation;
- unnatural cadence.

Correct identified issues.

---

# 40. Engagement Test

Review the learner experience through:

```text
Beginning
Middle
Ending
```

Ensure the passage sustains interest without artificial devices.

---

# 41. Factual Self-Review

Review every factual claim, including facts introduced creatively beyond the minimum requirements.

Check:

- accuracy;
- causality;
- quantities;
- terminology;
- scientific simplification;
- geographic/historical details where applicable.

Remove unnecessary factual risk.

---

# 42. Safety Self-Review

Review the complete final prose for:

- direct safety issues;
- imitable unsafe behaviour;
- unsafe implied behaviour;
- age-inappropriate scenarios;
- newly introduced risks.

Correct all identified issues.

---

# 43. Assessment-Readiness Test

Without writing assessment questions, verify:

> Could Stage 04 create valid questions that measure the required learner evidence using this passage alone?

If not, revise.

Stage 03 must not create the questions itself.

---

# 44. Over-Explanation Test

The passage must not solve the targeted reading work for the learner.

If the competency requires the learner to infer, connect, organize or interpret information, do not remove that cognitive work through unnecessary explanation.

---

# 45. Under-Evidence Test

The learner must still have enough information to succeed.

Difficulty must arise from the intended reading behaviour rather than from missing evidence or ambiguity.

---

# 46. Self-Correction Loop

Required Stage 03 loop:

```text
Create passage
↓
Mechanical self-check
↓
Semantic self-check
↓
Defect found?
   ↓ YES
Revise
↓
Recount words
↓
Repeat mechanical validation
↓
Repeat semantic validation
↓
No known unresolved defect
↓
Save final WIP artifact
```

No draft should be submitted to QA merely to see what QA says.

---

# 47. Upstream Defect Rule

If Stage 03 discovers that the approved Content Job cannot reasonably produce a compliant passage, it must stop.

Examples:

- contradictory requirements;
- impossible length;
- insufficient premise;
- incompatible RS/P demand;
- factual requirement cannot safely be satisfied;
- safety requirement conflicts with mandatory content.

Set:

```text
BLOCKED_BY_UPSTREAM
```

and report the issue to Stage 02.

Do not silently rewrite the approved Content Job.

---

# 48. Work Self-Validation Record

The passage artifact should contain:

```json
{
  "work_self_validation": {
    "mechanical_check": "PASS",
    "semantic_check": "PASS",
    "word_count_check": "PASS",
    "rs_fidelity_check": "PASS",
    "p_level_check": "PASS",
    "content_fidelity_check": "PASS",
    "learner_evidence_check": "PASS",
    "oral_readability_check": "PASS",
    "engagement_check": "PASS",
    "factual_check": "PASS",
    "safety_check": "PASS",
    "assessment_readiness_check": "PASS",
    "unresolved_known_defects": 0
  }
}
```

This record has no QA-certification authority.

---

# 49. WIP Output Location

All Stage 03 output must be created under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Recommended structure:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\
└── stage03\
    └── passages\
        └── W1\
            └── BandA\
                └── W1-BA-034.json
```

Stage 03 Work must not write directly to the approved directory.

---

# 50. WIP Artifact Status

Every newly created or revised Stage 03 artifact must remain:

```text
AWAITING_QA
```

while under:

```text
pipeline\wip
```

It must never be treated as authoritative simply because Work self-validation passed.

---

# 51. Independent QA Boundary

After creation, the exact WIP artifact is handed to the separate Stage 03 QA process.

The QA reviewer receives:

```text
Approved Content Job
+
WIP Passage Artifact
+
Applicable Certified Specifications
+
Stage03-QA.md
```

The QA reviewer independently decides:

```text
PASS
FAIL_REWORK
BLOCKED
```

---

# 52. QA PASS Promotion Rule

If Stage 03 QA returns `PASS`, the exact reviewed artifact is moved from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage03\passages\...
```

to:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages\...
```

The promoted file must be the exact artifact that QA reviewed.

No modification may occur during or after promotion.

---

# 53. Approved Artifact Rule

Only the artifact under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

is considered Stage 03 authoritative output.

The approved artifact becomes eligible input for Stage 04.

The WIP artifact does not.

---

# 54. QA Failure Rule

If Stage 03 QA returns:

```text
FAIL_REWORK
```

the artifact remains under:

```text
pipeline\wip
```

The Work task must:

1. read the QA findings;
2. revise the passage;
3. rerun full mechanical self-validation;
4. rerun full semantic self-validation;
5. overwrite or create a new WIP version according to the pipeline versioning policy;
6. resubmit for complete independent QA.

Nothing moves to `approved`.

---

# 55. QA Blocked Rule

If QA returns:

```text
BLOCKED
```

the artifact remains in WIP.

The pipeline must identify the appropriate upstream stage that needs reopening.

No downstream stage may begin.

---

# 56. Exact-Artifact Promotion Rule

Approval belongs only to the exact file reviewed.

If the passage changes after QA PASS—even by one word—the new artifact must return to:

```text
pipeline\wip
```

and undergo Stage 03 QA again.

No post-approval editorial adjustment is allowed without re-certification.

---

# 57. Downstream Access Rule

Stage 04 Assessment Creation must read its passage only from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages
```

Stage 04 must never use:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage03\passages
```

even if the filename is identical.

---

# 58. Stage 03 Success Condition

Stage 03 production is complete when:

> ChatGPT Work has converted one independently approved Content Job into a natural, engaging, accurate, safe and age-appropriate learner-facing passage; faithfully realized its RS competency, P-level and required learner evidence; performed complete mechanical and semantic self-validation; corrected all known defects; and saved the final candidate under the canonical WIP directory for independent QA.

Stage 03 becomes **fully complete and downstream-authoritative only after independent QA returns PASS and moves the exact approved artifact into:**

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
