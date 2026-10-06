# SpeedReader Pipeline — Stage 4 QA: Assessment Independent Review

**Version:** v0.1  
**QA Gate:** Stage 04  
**Artifact under review:** Assessment Package  
**Producer:** Stage 04 — Assessment Creation Work Task  
**Independent QA Reviewer:** Claude  
**Required upstream status:** Stage 03 Passage QA = PASS  
**WIP root:** `D:\Sridhar\Projects\SpeedReader\pipeline\wip`  
**Approved root:** `D:\Sridhar\Projects\SpeedReader\pipeline\approved`  
**Downstream stage:** Stage 05 — Production Package

---

# 1. Purpose

Perform a complete independent review of every assessment package before it is allowed to become authoritative downstream content.

Stage 04 QA must determine whether the assessment:

- faithfully measures the approved learner-evidence targets;
- genuinely assesses the assigned Reading Stage competency;
- operates at the correct P-level;
- is fully supported by the approved passage;
- contains clear and unambiguous questions;
- contains correct and defensible answer keys;
- handles valid alternative responses appropriately;
- uses valid scoring rules;
- does not depend on prohibited outside knowledge;
- does not accidentally test unrelated skills;
- remains age appropriate;
- remains factually correct and safe;
- is suitable for production use.

Stage 04 QA reviews and certifies.

It does not create or repair assessment items.

---

# 2. Fundamental Gate Rule

Stage 05 may begin only when Stage 04 QA returns:

```text
PASS
```

for the exact assessment artifact under review.

None of the following authorize downstream progression:

```text
Stage 04 Work completed
Mechanical self-validation passed
Semantic self-validation passed
Questions look reasonable
Answer keys appear correct
Only minor uncertainty remains
```

Only independent Stage 04 QA certification authorizes promotion to `approved`.

---

# 3. Independence Rule

Claude must independently judge the assessment.

The reviewer must not rely on:

- ChatGPT Work's reasoning;
- Work's self-validation conclusion;
- Creator explanations;
- claims that questions were intentionally designed a certain way;
- assumptions about what a question "probably means."

The assessment must stand on its own against the approved upstream artifacts and governing specifications.

---

# 4. Mandatory QA Inputs

Stage 04 QA must receive:

## 4.1 WIP Assessment Artifact

The exact file under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage04\assessments
```

---

## 4.2 Approved Passage

The exact corresponding passage from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages
```

---

## 4.3 Approved Content Job

The exact corresponding Content Job from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage02\content-jobs
```

---

## 4.4 Governing Specifications

All applicable certified specifications required to judge:

- RS competency;
- P-level progression;
- comprehension targets;
- assessment format;
- learner evidence;
- answer/scoring rules;
- response-mode requirements;
- factual/safety requirements;
- age appropriateness.

---

## 4.5 Stage 04 Production Contract

The reviewer must have:

```text
Stage04-AssessmentCreation.md
```

to understand the creation requirements.

---

# 5. Review Scope

QA must review the **entire assessment package**.

This means:

```text
every item
+
every expected answer
+
every acceptable-answer rule
+
every passage-evidence mapping
+
every learner-evidence mapping
+
every scoring rule
+
the assessment package as a whole
```

Sampling is not sufficient for certification.

---

# 6. Full Review Model

At minimum review:

```text
1. Upstream certification
2. Artifact identity
3. Assessment completeness
4. RS fidelity
5. P-level fidelity
6. Learner-evidence coverage
7. Passage-evidence validity
8. Question clarity
9. Question ambiguity
10. Answer-key correctness
11. Alternative-answer handling
12. Item-type validity
13. Scoring validity
14. Outside-knowledge dependency
15. Question independence
16. Redundancy
17. Assessment burden
18. Age appropriateness
19. Accidental writing/spelling burden
20. Accidental memory burden
21. Factual accuracy
22. Safety
23. Passage-integrity dependency
24. Whole-package coherence
25. Downstream readiness
```

This list defines minimum coverage, not maximum coverage.

---

# 7. Upstream Certification Verification

Before semantic review, verify:

```text
Stage02 QA = PASS
Stage03 QA = PASS
```

for the exact Content Job and Passage used.

Confirm that:

- IDs match;
- approved artifacts exist;
- versions/hashes match where available;
- the WIP assessment references the correct approved passage.

If any source is uncertified or mismatched:

```text
BLOCKED
```

---

# 8. Artifact Identity

Verify:

- Assessment ID;
- Passage ID;
- Job ID;
- World;
- Band;
- Reading Stage;
- P-level;
- Delivery Round;
- Delivery Session.

Any unexplained mismatch prevents PASS.

---

# 9. Assessment Completeness

Verify that every required assessment component exists.

Check:

- required number of items;
- valid item IDs;
- questions present;
- expected answers present;
- acceptable-answer rules present where needed;
- passage evidence present;
- learner-evidence mapping present;
- scoring rules present;
- item types valid;
- no placeholders such as `TBD`, `N/A`, or generic instructions.

A populated field must also contain meaningful information.

---

# 10. Learner-Evidence Coverage

The assessment package must collectively measure every required learner-evidence target from the approved Content Job, according to the governing assessment specification.

Create an explicit coverage view:

```text
Learner Evidence A → Q01
Learner Evidence B → Q02 / Q03
Learner Evidence C → Q04
```

Identify:

- uncovered evidence;
- weakly covered evidence;
- duplicated evidence;
- items that do not map to any required evidence.

Missing mandatory coverage is a MAJOR defect.

---

# 11. Reading Stage Fidelity

For every assessment item ask:

> What reading behaviour does this item actually measure?

That behaviour must align with the assigned RS competency.

A question about a passage fact does not automatically measure the intended Reading Stage.

Example:

If the competency requires connecting information from separate parts of the passage, asking:

```text
What colour was the object?
```

does not measure that competency merely because the fact appears in the same passage.

---

# 12. Intrinsic RS Test

Ignore metadata temporarily.

Read:

- passage;
- question;
- expected answer.

Ask:

> What skill must the learner demonstrate to answer this correctly?

The answer should clearly correspond to the intended RS.

If the item instead measures:

- simple recall;
- vocabulary;
- guessing;
- prior knowledge;
- writing ability;

when those are not the intended target, the item fails.

---

# 13. P-Level Fidelity

For each item determine:

> Is the reasoning/comprehension demand appropriate to this exact P-level?

Difficulty must not be generated artificially through:

- complicated question wording;
- unusually difficult vocabulary;
- unnecessary multi-part answers;
- obscure response formats;
- excessive memory load.

The intended developmental progression must drive difficulty.

---

# 14. RS × P Integrity

Every material assessment item must preserve:

```text
Correct RS behaviour
+
Correct P-level demand
```

An item may fail even when the approved passage itself passed Stage 03.

---

# 15. Passage Evidence Validity

For every expected answer, independently locate its supporting evidence in the approved passage.

Verify:

- the evidence actually exists;
- the evidence supports the answer;
- the mapping is not exaggerated;
- the answer does not require an unstated assumption;
- prohibited outside knowledge is unnecessary.

If the passage cannot support the answer, determine whether the problem is:

```text
Stage 04 assessment defect
```

or:

```text
UPSTREAM_DEFECT in Stage 03
```

Do not silently compensate.

---

# 16. Evidence Strength

The question must be answerable with adequate evidence.

Reject cases where the expected answer is merely:

- plausible;
- one possible interpretation;
- culturally assumed;
- scientifically likely;
- implied only through unsupported guesswork.

Assessment evidence must be defensible.

---

# 17. Question Clarity

Every question must be immediately understandable to the intended learner.

Review:

- grammar;
- pronouns;
- reference words;
- time reference;
- comparison basis;
- response expectation;
- unnecessary complexity.

Question decoding must not become the primary challenge unless explicitly intended.

---

# 18. Ambiguity Review

Actively search for multiple plausible interpretations.

Ask:

> Could two careful learners understand this question differently?

If yes, determine whether both interpretations produce different defensible answers.

If so:

```text
MAJOR defect
```

The item must not pass.

---

# 19. One Defensible Meaning

Questions should have one clear assessment intent.

This does not mean all valid responses must use identical wording.

It means the underlying semantic target must be clear.

Distinguish:

```text
different wording of the same correct idea
```

from:

```text
different substantive answers because the question is ambiguous
```

Only the former is acceptable.

---

# 20. Answer-Key Correctness

Challenge every expected answer.

Ask:

- Is it actually correct?
- Is it fully supported?
- Is it too narrow?
- Is it too broad?
- Is it more specific than the passage?
- Does it contain a new factual claim?
- Does it accidentally answer a different question?

Any incorrect key is a MAJOR defect.

---

# 21. Alternative Valid Answers

For open-response items, independently identify plausible alternative answers.

Check whether the scoring rule fairly recognizes semantically equivalent child responses.

The assessment should not reject a correct idea merely because the child used different natural language.

---

# 22. Over-Acceptance Risk

The opposite issue also matters.

Scoring must not accept vague responses that fail to demonstrate the target competency.

Example:

Required:

```text
Explain why event A caused event B.
```

Weak response:

```text
Because it happened.
```

must not receive full credit merely because it contains the word "because."

---

# 23. Scoring Validity

For every item verify:

- scoring rule corresponds to the question;
- scoring rule corresponds to learner evidence;
- correct responses receive credit;
- incorrect responses do not;
- partial-credit logic is defined where applicable;
- semantic equivalence is handled appropriately;
- spelling/grammar do not contaminate scoring unless explicitly relevant.

---

# 24. Binary Scoring

Where only binary scoring is permitted, ensure the correct/incorrect boundary is operationally clear.

Avoid answer keys requiring subjective reviewer judgment with no rule.

---

# 25. Partial Credit

Where partial credit is allowed, verify that partial performance represents meaningful partial evidence of the intended competency.

Do not award partial credit arbitrarily.

---

# 26. Accidental Writing Assessment

If comprehension is the target, minor spelling or grammar errors must not invalidate an otherwise correct response unless the governing scoring specification explicitly requires language correctness.

QA must check that response scoring measures the intended capability.

---

# 27. Accidental Vocabulary Assessment

A question should not require vocabulary more difficult than necessary to demonstrate the intended comprehension target.

If a learner understands the passage but cannot decode the question because of unrelated wording, assessment validity is weakened.

---

# 28. Accidental Memory Assessment

Determine whether the item creates unnecessary short-term-memory burden.

Do not require recall of multiple arbitrary details when the intended target is another competency.

Memory demands should be pedagogically justified.

---

# 29. Inference Item Review

For inference questions verify:

- relevant clues exist;
- clues collectively support the answer;
- inference is appropriate to P-level;
- the answer is not explicitly stated if inference is truly intended;
- alternative reasonable inferences are handled.

Inference must not become guessing.

---

# 30. Cause-and-Effect Item Review

Verify:

- the passage actually supports causation;
- temporal order is not mislabelled as cause;
- wording asks the intended relationship;
- expected answer reflects the supported causal link.

---

# 31. Sequencing Item Review

Verify:

- multiple meaningful steps/events exist;
- sequence is unambiguous;
- items are not interchangeable;
- task difficulty matches P-level.

---

# 32. Relationship Item Review

Where the target requires connecting information:

- both pieces must exist;
- both must be necessary;
- the item must actually require connection;
- one isolated fact must not be enough.

---

# 33. Main-Idea Item Review

Verify that:

- expected answer represents the passage's central meaning;
- an interesting detail is not mistaken for the main idea;
- multiple equally defensible main ideas do not exist because of weak passage structure or question wording.

---

# 34. Vocabulary-in-Context Review

Where permitted:

- meaning must be inferable from textual context;
- outside dictionary knowledge must not be essential;
- context clues must match the intended P-level.

---

# 35. Response-Format Validity

Check that the item format complies with the certified assessment specification.

Do not allow an unauthorized response format merely because it is easier to generate.

Where spoken, typed, structured, sequencing or another mode is required, the artifact must match that requirement.

---

# 36. Question Independence

Review all items together.

Determine whether one item gives away another item's answer.

Where this compromises measurement validity, classify it as a defect.

---

# 37. Redundancy Review

Check whether multiple questions essentially measure the same learner evidence using superficial rewording.

Redundancy may:

- inflate apparent assessment coverage;
- increase learner burden;
- bias scoring.

Repeated measurement is acceptable only when intentionally required.

---

# 38. Assessment Burden

Review the complete package as an experience.

Consider:

- number of questions;
- answer length;
- cognitive effort;
- oral/typing burden;
- learner age;
- passage length;
- session design.

A valid assessment should not become disproportionately exhausting.

---

# 39. Age Appropriateness

Evaluate:

- wording;
- scenarios;
- expected response;
- abstraction;
- instructions;
- emotional tone.

The assessment must be understandable and appropriate for the target learner.

---

# 40. Question Tone

Avoid questions that feel:

- punitive;
- patronizing;
- unnecessarily formal;
- intentionally tricky;
- like competitive exam traps;

unless the certified design explicitly requires that style.

The assessment should gather evidence, not defeat the learner.

---

# 41. Factual Integrity

Review every factual claim introduced in:

- questions;
- answer keys;
- response examples;
- scoring notes.

Stage 04 must not introduce new factual errors.

If the approved passage itself contains an apparent factual defect:

```text
UPSTREAM_DEFECT
```

Do not silently fix it in the assessment.

---

# 42. Safety Integrity

Review questions for unsafe implications.

Ensure assessment does not encourage children to:

- imitate dangerous actions;
- personally approach hazards;
- perform unsafe experiments;
- choose unsafe behaviour as a normalized response.

Safety review applies even if the passage itself was safe.

---

# 43. No New Teaching During Assessment

The assessment should not quietly introduce new instructional material before measurement.

Avoid:

- hints that reveal the answer;
- explanations embedded in the question;
- new facts;
- corrective teaching before scoring.

Unless explicitly required, assessment should measure the already completed reading experience.

---

# 44. Passage Integrity Rule

Stage 04 QA must never modify the approved Stage 03 passage.

If the assessment exposes a passage defect:

```text
UPSTREAM_DEFECT: STAGE03
```

The issue must return upstream.

Examples:

- insufficient evidence;
- ambiguous event order;
- intended inference explicitly stated;
- multiple valid interpretations caused by passage wording.

---

# 45. Content Job Integrity Rule

If QA discovers that the intended assessment target itself is defective:

```text
UPSTREAM_DEFECT: STAGE02
```

Examples:

- learner evidence cannot validly demonstrate the RS;
- comprehension requirement conflicts with P-level;
- evidence requirement itself is ambiguous.

Do not redesign Stage 02 inside QA04.

---

# 46. Full-Fledged Review Requirement

Stage 04 QA is not a checklist-only process.

Claude must actively challenge the assessment for:

- unexpected ambiguity;
- hidden answer leakage;
- scoring unfairness;
- subtle skill substitution;
- invalid assumptions;
- unusual learner responses;
- inappropriate difficulty;
- structural flaws not explicitly listed in this document.

The checklist is a minimum coverage framework.

---

# 47. Child-Response Challenge

For each open-response item, QA should mentally simulate several plausible child answers:

```text
clearly correct response
correct but differently worded response
partially correct response
vague response
common misconception
incorrect response
```

Verify that the scoring rule distinguishes them appropriately.

---

# 48. Adversarial Question Review

QA should attempt to break each item.

Ask:

- Can I answer this correctly without demonstrating the target skill?
- Can I demonstrate the target skill but still be marked wrong?
- Can I infer the answer from another question?
- Can I answer using outside knowledge rather than the passage?
- Is there another equally defensible answer?
- Does wording unintentionally reveal the answer?

If yes, investigate and classify appropriately.

---

# 49. Whole-Package Coherence

After item-level review, assess the package as a whole.

Ask:

- Does it measure the intended learner evidence comprehensively?
- Is the mix of items coherent?
- Does difficulty remain appropriate?
- Is anything over-tested?
- Is anything important untested?
- Does the overall scoring represent the intended competency fairly?

---

# 50. Defect Severity

Every finding must be classified.

## BLOCKER

A defect preventing trustworthy review or requiring upstream correction.

Examples:

- wrong/unapproved passage;
- mismatched Content Job;
- assessment built against wrong artifact;
- governing specifications conflict;
- required evidence fundamentally impossible to assess.

Any unresolved BLOCKER prevents PASS.

---

## MAJOR

A substantive assessment-validity defect.

Examples:

- wrong RS measured;
- wrong P-level;
- required learner evidence untested;
- unsupported expected answer;
- materially ambiguous question;
- multiple incompatible correct answers;
- incorrect scoring rule;
- prohibited outside knowledge required;
- factual error;
- unsafe prompt;
- assessment cannot validly measure intended comprehension.

Any unresolved MAJOR prevents PASS.

---

## MINOR

A localized issue that does not fundamentally invalidate measurement but still requires correction under the current standard.

Examples:

- awkward wording with one clear meaning;
- minor metadata inconsistency;
- limited scoring-rule clarity.

---

## OBSERVATION

A non-blocking improvement suggestion.

Observations must not be used to downgrade real defects.

---

# 51. Finding Format

Each finding should contain:

```text
Finding ID
Severity
Assessment ID
Item ID(s)
Affected field(s)
Governing requirement
Observed problem
Why it matters
Origin
Freeze impact
Acceptance criteria
```

Example:

```text
A-QA-011

Severity:
MAJOR

Assessment:
ASSESS-W1-BA-034

Item:
W1-BA-034-Q02

Requirement:
Question must measure the required RS relationship-tracking behaviour.

Finding:
The question can be answered by recalling one isolated sentence and
does not require the learner to connect the two relevant pieces of information.

Why it matters:
A learner could receive full credit without demonstrating the intended
Reading Stage competency.

Origin:
Stage 04

Freeze Impact:
YES

Acceptance Criteria:
The revised item must require use of both relevant passage elements
and demonstrate the intended relationship at the assigned P-level.
```

QA defines the correction target.

QA does not write the replacement question.

---

# 52. QA Report Structure

The report should contain:

## Artifact Identification

- Assessment ID;
- Passage ID;
- Job ID;
- WIP path;
- approved Passage source;
- approved Content Job source;
- artifact version/hash where available.

## Executive Verdict

```text
PASS
FAIL_REWORK
BLOCKED
```

## Review Coverage

Confirm:

- all assessment items reviewed;
- all answer keys reviewed;
- all learner-evidence mappings reviewed;
- all scoring rules reviewed;
- package-level review completed.

## Strengths

Important qualities worth preserving.

## Findings

Grouped by severity.

## Upstream Defects

Separate Stage 03 or Stage 02 issues.

## Acceptance Criteria

Clear requirements for successful re-review.

## Downstream Authorization

Explicitly state:

```text
AUTHORIZED
```

or:

```text
NOT AUTHORIZED
```

for Stage 05.

---

# 53. PASS Criteria

PASS requires:

- correct approved upstream artifacts;
- artifact identity correct;
- all required assessment fields complete;
- all mandatory learner evidence covered;
- RS fidelity passes;
- P-level fidelity passes;
- passage evidence supports every key;
- every question is clear;
- no material ambiguity;
- expected answers correct;
- valid alternative answers handled;
- scoring rules valid;
- no prohibited outside knowledge;
- no accidental skill substitution;
- question independence acceptable;
- redundancy acceptable;
- assessment burden appropriate;
- age appropriateness passes;
- factual review passes;
- safety review passes;
- whole-package validity passes;
- zero unresolved BLOCKER findings;
- zero unresolved MAJOR findings.

For this pipeline:

```text
NO CONDITIONAL PASS
```

---

# 54. FAIL_REWORK

Use when defects can be corrected entirely within Stage 04.

The assessment remains in:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Required flow:

```text
QA findings
↓
Stage 04 ChatGPT Work
↓
Assessment revision
↓
Mechanical self-validation
↓
Semantic self-validation
↓
Updated WIP artifact
↓
Stage 04 QA full independent re-review
```

Nothing moves to `approved`.

---

# 55. BLOCKED

Use when Stage 04 cannot safely resolve the issue.

Possible causes:

- Stage 03 passage defect;
- Stage 02 Content Job defect;
- conflicting assessment specification;
- unavailable approved upstream artifact;
- unresolvable target ambiguity.

The appropriate upstream stage must reopen.

---

# 56. Re-Review Rule

A revised assessment is a new review artifact.

QA must re-evaluate:

- all previous findings;
- acceptance criteria;
- changed questions;
- changed answers;
- changed scoring;
- learner-evidence coverage;
- item interaction;
- whole-package coherence;
- regressions.

Do not approve solely because previously reported wording changed.

---

# 57. Promotion on PASS

When and only when QA returns:

```text
PASS
```

the exact reviewed assessment artifact must move from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage04\assessments\...
```

to:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments\...
```

No content modification may occur during promotion.

---

# 58. Exact-Artifact Rule

Approval applies only to the exact assessment reviewed.

If any question, answer, scoring rule, metadata field or other artifact content changes after PASS, the changed artifact must return to WIP and undergo QA again.

---

# 59. QA Traceability

The QA report should remain associated with the promoted assessment.

Record at minimum:

```text
Assessment ID
QA verdict
QA spec version
review date/time
source WIP path
approved destination path
finding counts
artifact hash where available
```

---

# 60. Approved Artifact Authority

After promotion, only:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments
```

contains authoritative Stage 04 output.

Any corresponding WIP artifact is non-authoritative.

---

# 61. Downstream Access Rule

Stage 05 may consume only:

```text
approved Stage 02 Content Job
+
approved Stage 03 Passage
+
approved Stage 04 Assessment
```

No Stage 05 process may consume a Stage 04 artifact from WIP.

---

# 62. Core QA Principle

The reviewer is not asking:

> Are these reasonable questions?

The correct question is:

> Does this exact assessment package validly, fairly and unambiguously measure the learner evidence defined upstream, using only evidence available in the approved passage, at the intended Reading Stage and P-level?

If that cannot be demonstrated:

```text
DO NOT PASS
```

---

# 63. Stage 04 QA Success Condition

Stage 04 QA is complete when:

> Every assessment item, answer, evidence mapping and scoring rule has been independently reviewed against the approved Passage, Content Job and governing SpeedReader specifications; RS/P fidelity, learner-evidence coverage, ambiguity, answer validity, scoring fairness, factual integrity, safety and whole-package assessment validity have all been evaluated; all defects have been classified with explicit acceptance criteria; and an independent certification decision has been issued.

If the decision is `PASS`, the exact reviewed artifact is moved from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

to:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

Only that approved assessment becomes eligible for Stage 05 — Production Package.