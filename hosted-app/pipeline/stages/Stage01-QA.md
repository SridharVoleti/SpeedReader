# SpeedReader Pipeline — QA 01: Knowledge Map Independent Review

**Version:** v0.1  
**QA Gate:** 01  
**Artifact under review:** Knowledge Map  
**Producer:** Stage 01 — Knowledge Map Work Task  
**QA role:** Independent reviewer and certifier  
**Downstream stage:** Stage 02 — Content Job  
**Certification authority:** QA01 only

---

# 1. Purpose

Perform a complete, independent review of the Knowledge Map produced by Stage 01.

QA01 determines whether the Knowledge Map is sufficiently correct, complete, internally coherent, pedagogically sound and specification-compliant to become the canonical upstream source for downstream content generation.

QA01 is not a second content-planning task.

It must not:

- create missing Knowledge Map rows;
- rewrite defective rows;
- silently repair the artifact;
- reinterpret upstream requirements to make the artifact pass;
- reduce acceptance criteria;
- approve on the basis that defects can be corrected later.

QA01 must:

**inspect → challenge → verify → identify defects → classify severity → determine freeze impact → issue a verdict.**

---

# 2. Fundamental Gate Rule

Stage 02 must not begin unless QA01 returns:

```text
PASS
```

for the exact artifact version submitted.

The following do not authorize progression:

```text
Stage 01 completed
Work self-validation passed
Mechanical checks passed
Semantic self-check passed
Most rows are correct
Only a few defects remain
```

Only independent QA certification authorizes Stage 02.

---

# 3. Independence Rule

QA01 must approach the Knowledge Map as if it did not participate in its creation.

The Stage 01 Work task's conclusions must not be treated as evidence of correctness.

For example:

```text
"Work semantic self-check: PASS"
```

has no bearing on QA's own verdict.

QA must independently reproduce the reasoning necessary to determine compliance.

---

# 4. Required QA Inputs

QA01 must receive:

## A. Artifact under review

The complete submitted Knowledge Map.

For World 1 Band A this means the complete 150-row artifact, not a sample.

---

## B. Certified upstream specifications

All governing specifications relevant to Knowledge Map construction, including where applicable:

- World/Band definition;
- RS01–RS15 competency specification;
- P1→P10 progression specification;
- comprehension framework;
- knowledge-strand taxonomy and distribution rules;
- content/prose architecture relevant to planning;
- factual-review rules;
- safety rules;
- engagement principles;
- delivery-sequence rules;
- any global SpeedReader rules applicable to the map.

QA must verify the Knowledge Map **against these sources**, not merely assess whether it appears reasonable.

---

## C. Stage 01 production specification

QA should receive:

```text
Stage01-KnowledgeMap.md
```

to understand the production contract.

Stage 01's self-validation report may be present for auditability but must not be used as a substitute for independent verification.

---

# 5. Source Authority

If multiple specifications govern the same requirement:

1. use the formally active canonical specification;
2. prefer the newer focused specification when it explicitly supersedes older wording;
3. do not combine incompatible requirements silently;
4. flag genuine source conflicts as upstream blockers.

If QA cannot determine which requirement is authoritative:

```text
BLOCKED
```

rather than guessing.

---

# 6. Review Scope

QA01 is a **full-artifact review**.

For World 1 Band A, QA must review:

```text
ALL 150 ROWS
+
ALL 15 RS PROGRESSIONS
+
ALL 10 DELIVERY ROUNDS
+
WHOLE-MAP ARCHITECTURE
```

Sampling is not sufficient for certification.

Spot checks may be used as additional probes, but never as substitutes for complete coverage.

---

# 7. Two-Layer QA Model

QA01 must independently perform both:

```text
A. Structural / Mechanical Verification
B. Semantic / Pedagogical Verification
```

Both are components of the full QA review.

Passing structural checks alone never produces PASS.

---

# 8. Structural Verification

QA must independently verify the complete artifact.

For World 1 Band A, at minimum:

## 8.1 Row Count

Expected:

```text
150
```

No more and no fewer.

---

## 8.2 Coordinate Completeness

Expected matrix:

```text
RS01-P01 → RS01-P10
RS02-P01 → RS02-P10
...
RS15-P01 → RS15-P10
```

Every RS × P coordinate must exist exactly once.

---

## 8.3 Reading Stage Coverage

Expected:

```text
15 Reading Stages
10 rows per Reading Stage
```

---

## 8.4 P-Level Coverage

Expected:

```text
10 P-levels
15 rows per P-level
```

---

## 8.5 Passage IDs

Verify:

- uniqueness;
- correct format;
- correct mapping;
- no missing IDs;
- no duplicate IDs.

---

## 8.6 Delivery Sessions

Verify:

- unique values;
- complete sequence;
- correct mapping;
- no gaps;
- no duplicates.

For World 1 Band A:

```text
delivery_session =
(P_number - 1) × 15 + RS_number
```

---

## 8.7 Delivery Rounds

Verify that each P-level forms one complete delivery round across all applicable Reading Stages.

---

## 8.8 Mandatory Fields

Every row must contain every required field.

QA must distinguish between:

```text
field exists
```

and:

```text
field contains meaningful compliant information
```

A generic placeholder is not acceptable merely because the field is non-empty.

---

## 8.9 Enumerated Values

Verify that:

- RS values are valid;
- P-level values are valid;
- strand values belong to the approved ontology;
- review levels use approved categories;
- status/flag values are permitted.

---

## 8.10 Knowledge-Strand Distribution

Verify all governing distribution invariants.

For any rule requiring one occurrence of each strand per delivery round, verify the complete round rather than individual rows.

---

# 9. Semantic Row-Level Review

Every row must undergo independent semantic review.

The following dimensions are mandatory.

---

# 10. RS Competency Fidelity

For every row determine:

> Does this row genuinely exercise the competency assigned to its Reading Stage?

QA must verify:

- the target is intrinsic to the RS;
- the intended learner behaviour belongs to that RS;
- the premise can actually exercise that behaviour;
- the target has not collapsed into generic comprehension;
- the row is not more naturally assigned to another Reading Stage.

A row must fail if its RS label could be replaced with several other RS labels without meaningfully changing its target.

---

# 11. Intrinsic Competency Test

For each row conceptually remove:

```text
Reading Stage label
Reading Stage title
```

Then inspect the competency target.

Ask:

> Could an expert infer which reading capability this row intends to develop?

If not, the target is likely too generic.

Example of insufficient specificity:

```text
Understand important information in the passage.
```

This can apply almost anywhere.

QA must flag such formulations.

---

# 12. P-Level Fidelity

For every row determine:

> Does the intended learner demand genuinely correspond to the assigned P-level?

QA must reject progression based primarily on:

- harder vocabulary;
- longer words;
- obscure facts;
- longer sentences;
- topic unfamiliarity;
- cosmetic wording changes.

The progression must represent development of learner capability.

---

# 13. RS × P Interaction

Every row must satisfy both dimensions simultaneously.

QA must verify:

```text
Correct RS competency
AND
Correct developmental P-level
```

It is insufficient for a row to be:

```text
good RS07
but wrong P-level
```

or:

```text
good P05 difficulty
but actually exercising RS09
```

Either defect is a failure.

---

# 14. P1→P10 Progression Review

QA must review each Reading Stage as a complete sequence.

For every RS:

```text
P1 → P2 → P3 → ... → P10
```

verify that progression is:

- meaningful;
- ordered;
- cumulative where intended;
- developmentally defensible;
- free from regressions;
- free from duplicated levels;
- free from artificial jumps.

QA should explicitly compare neighbouring levels:

```text
P1 vs P2
P2 vs P3
...
P9 vs P10
```

and also compare:

```text
P1 vs P5 vs P10
```

to ensure overall progression is substantial.

---

# 15. Reading Stage Differentiation

QA must compare RS01–RS15 against one another.

Look for:

- semantic overlap;
- duplicate competencies;
- indistinguishable learner behaviours;
- neighbouring stages with unclear boundaries;
- stages that differ only in wording;
- rows consistently assigned to the wrong family.

If two Reading Stages are becoming operationally identical, this is an architectural defect rather than merely a row-writing issue.

---

# 16. Content-Pedagogy Fit

For every row ask:

> Can the proposed content premise naturally support the intended reading competency and P-level?

A premise may be interesting but pedagogically unsuitable.

A row fails when the future passage would have to be artificially manipulated to create the required competency evidence.

---

# 17. Content Premise Sufficiency

The content premise must be specific enough that downstream generation does not require substantial invention of the instructional design.

QA should reject rows such as:

```text
Topic: Space
Premise: Something about planets
```

even if other metadata exists.

The premise should establish what the passage is actually about while preserving reasonable creative freedom.

---

# 18. Working Title Review

The title must:

- reasonably correspond to the planned content;
- not contradict the premise;
- not substitute for a missing premise.

A creative title cannot compensate for an underspecified content contract.

---

# 19. Comprehension Alignment

For every row verify:

```text
Content premise
↕
RS target
↕
P-level target
↕
Comprehension target
↕
Learner evidence
```

These elements must form one coherent instructional design.

QA should flag cases where, for example:

- the comprehension target asks for inference but the premise provides only explicit recall;
- the learner evidence tests sequencing when the assigned target is cause/effect;
- the planned content cannot generate the required evidence.

---

# 20. Learner Evidence Quality

Expected learner evidence must be:

- observable;
- conceptually relevant;
- appropriate to the RS;
- appropriate to the P-level;
- achievable from the planned passage;
- sufficiently specific for later assessment design.

Weak evidence:

```text
Learner understands the passage.
```

Stronger evidence:

```text
Learner identifies the two relevant events and explains how the first caused the second using information from the passage.
```

---

# 21. Assessment Feasibility

QA is not creating assessments at Stage 1.

However, it must determine whether the planned row could later support valid assessment.

Ask:

> If this passage were generated correctly, could we obtain credible evidence that the learner exercised the intended competency?

If the answer is no, the row should not pass.

---

# 22. Knowledge-Strand Fidelity

For every row verify:

- the assigned content genuinely belongs to the specified strand;
- strand assignment follows the approved taxonomy;
- no strand is being stretched merely to satisfy distribution rules.

---

# 23. Strand Distribution Quality

QA must assess both formal compliance and semantic quality.

A distribution may be numerically perfect yet educationally weak.

QA should look for:

- repeated themes disguised under different strands;
- excessive concentration of similar content;
- poor variety within a delivery round;
- predictable topic cycling;
- accidental subject dominance.

---

# 24. Content Diversity Review

Review the whole map for repetition in:

- topic;
- concept;
- animal/species;
- setting;
- location;
- profession;
- invention;
- historical event;
- scientific mechanism;
- narrative structure;
- problem situation;
- informational pattern.

Distinguish:

```text
intentional pedagogical revisit
```

from:

```text
unnecessary repetition
```

---

# 25. Engagement Potential

The Knowledge Map is not final prose, but the planned content should give downstream passage generation sufficient opportunity for learner engagement.

QA should flag premises likely to produce:

- dry textbook exposition;
- fact dumps;
- repetitive definitions;
- forced morals;
- school worksheet tone;
- artificial danger used solely for excitement.

The overall World should offer varied forms of curiosity and interest.

---

# 26. Age Appropriateness

Review:

- conceptual complexity;
- situations;
- vocabulary implied by the premise;
- emotional content;
- danger;
- cultural assumptions;
- prior-knowledge burden.

A topic may be factually correct but inappropriate for the intended learner.

---

# 27. Factual-Risk Classification

QA must independently assess whether each row's factual-review classification is adequate.

Do not assume Stage 01 classified risks correctly.

Review topics involving, for example:

- science;
- health;
- history;
- geography;
- technology;
- wildlife;
- civics;
- economics;
- cultural/religious information.

If factual claims will require verification downstream, the row must carry the proper requirement.

---

# 28. Safety-Risk Classification

QA must independently evaluate safety implications.

Check whether applicable categories were overlooked, including:

- wildlife;
- fire;
- electricity;
- roads;
- water;
- medicine;
- physical experimentation;
- tools;
- dangerous locations;
- interactions with strangers;
- potentially imitable unsafe behaviour.

Missing a necessary safety flag is a QA defect.

---

# 29. Whole-Map Learner Journey

After row-level review, QA must evaluate World/Band A as one complete learning experience.

Ask:

- Is progression coherent?
- Is challenge increasing appropriately?
- Is learner confidence protected?
- Is sufficient variety maintained?
- Are some Reading Stages systematically weaker than others?
- Are particular P-levels underdeveloped?
- Does the World converge on the intended exit capability?
- Does the overall map feel intentionally architected rather than generated row by row?

---

# 30. Delivery-Round Review

Each learner delivery round must also be reviewed as an experience.

For each round ask:

- Are all required Reading Stages represented?
- Is content variety adequate?
- Are strands appropriately distributed?
- Are several adjacent passages too similar?
- Is difficulty balanced appropriately?
- Could the round become monotonous despite formal correctness?

---

# 31. Determinism / Downstream Readiness

QA must determine whether each row contains sufficient specification for Stage 02 Content Job creation.

The row must not require Stage 02 to invent core curriculum intent.

QA should ask:

> Can the Content Job stage expand this row using certified specifications without deciding what the row was supposed to mean?

If not, Stage 1 is incomplete.

---

# 32. Internal Contradictions

QA must look for contradictions such as:

- premise incompatible with strand;
- learner evidence incompatible with comprehension target;
- RS target inconsistent with RS definition;
- P-level target outside the assigned level;
- safety flag contradicting generation notes;
- duplicated Passage ID attached to different coordinates.

Contradictions must not be resolved silently by QA.

---

# 33. Upstream Specification Defects

QA may discover that the Knowledge Map defect originates upstream.

Examples:

- RS competency itself is ambiguous;
- two certified RS specifications overlap;
- P5 and P6 are not meaningfully distinguishable;
- strand taxonomy is incomplete;
- distribution requirement contradicts another active rule.

Such findings must be classified as:

```text
UPSTREAM_BLOCKER
```

The Knowledge Map should not be forced to compensate for a defective specification.

---

# 34. Regression Review

When reviewing a revised Knowledge Map, QA must verify:

1. reported defects were corrected;
2. corrections actually satisfy acceptance criteria;
3. no new defects were introduced;
4. unaffected sections remain intact;
5. global architecture still passes.

QA must not limit a re-review only to previously reported rows when the correction could have cross-map effects.

---

# 35. Defect Severity Model

Every finding must receive a severity.

## BLOCKER

A defect that prevents trustworthy downstream use.

Examples:

- incorrect architecture;
- unresolved upstream conflict;
- missing RS/P coordinates;
- fundamental semantic collapse between Reading Stages;
- progression architecture invalid;
- Knowledge Map cannot support deterministic downstream generation.

One unresolved BLOCKER prevents PASS.

---

## MAJOR

A significant defect affecting pedagogical correctness or downstream content quality.

Examples:

- row assigned to wrong RS;
- P-level mismatch;
- content premise cannot support intended competency;
- generic learner evidence;
- incorrect factual/safety classification;
- substantial progression gap.

Any unresolved MAJOR prevents PASS.

---

## MINOR

A genuine defect that does not fundamentally invalidate the instructional design.

Examples might include:

- limited metadata inconsistency;
- non-critical title/premise wording mismatch;
- localized clarity issue.

Minor findings should still be corrected unless explicitly accepted by the governing QA policy.

---

## OBSERVATION

Non-blocking improvement suggestion.

An observation must not be used to conceal an actual defect.

---

# 36. Freeze Impact

For every BLOCKER and MAJOR finding, QA must state:

```text
Freeze Impact: YES
```

meaning the Knowledge Map must not become canonical.

For minor issues, QA should explicitly state whether they prevent certification under the current acceptance policy.

---

# 37. Finding Format

Every defect should include:

```text
Finding ID
Severity
Affected row(s) / RS / P-level / map section
Requirement violated
Observed problem
Why it matters
Freeze impact
Acceptance criteria for correction
```

Example:

```text
KM-QA-017

Severity: MAJOR

Affected:
RS07-P04

Requirement:
RS07 competency must remain intrinsic and operational.

Finding:
The stated learner target is generic main-idea comprehension and
does not require the relationship-tracking behaviour specified for RS07.

Why it matters:
A downstream passage could satisfy this row without exercising RS07.

Freeze Impact:
YES

Acceptance Criteria:
Revise the row so the learner must preserve and relate the connected
information intrinsic to RS07 while retaining the intended P04 demand.
```

QA specifies what must become true.

QA does not write the corrected row.

---

# 38. QA Report Structure

QA01 should produce a review report containing at minimum:

## Executive verdict

```text
PASS
FAIL_REWORK
BLOCKED
```

## Coverage statement

Example:

```text
150/150 rows reviewed
15/15 RS progressions reviewed
10/10 delivery rounds reviewed
Whole-map architecture reviewed
```

## Readiness assessment

A concise explanation of whether the artifact is safe to feed downstream.

## Strengths

Important architecture or execution strengths worth preserving.

## Findings

All defects grouped by severity.

## Cross-cutting patterns

Systemic problems affecting multiple rows.

## Regression risks

Where applicable.

## Acceptance criteria

What must be true before re-review can pass.

## Final certification status

Explicitly state whether downstream use is authorized.

---

# 39. QA Outcomes

QA01 returns exactly one of:

```text
PASS
FAIL_REWORK
BLOCKED
```

---

# 40. PASS

PASS is permitted only when:

- required full review coverage is complete;
- no unresolved BLOCKER exists;
- no unresolved MAJOR exists;
- all mandatory architectural requirements pass;
- RS fidelity passes;
- P-level progression passes;
- semantic differentiation passes;
- downstream determinism is sufficient;
- factual/safety planning is adequate;
- no unresolved specification conflict exists.

QA must not use:

```text
PASS WITH MAJOR ISSUES
CONDITIONAL PASS
MOSTLY PASS
```

unless a future global pipeline specification explicitly introduces such states.

For the MVP, certification is binary:

```text
PASS
or
NOT PASS
```

---

# 41. FAIL_REWORK

Use when the artifact is correctable within Stage 01.

The QA report must provide actionable defect findings and acceptance criteria.

The artifact returns to the Stage 01 Work task.

After revision:

```text
Work self-validates again
↓
new artifact version submitted
↓
QA01 performs independent review again
```

The earlier QA result does not transfer to the revised artifact.

---

# 42. BLOCKED

Use when QA determines that Stage 01 cannot safely resolve the problem because the governing inputs are defective or incomplete.

Typical examples:

- contradictory certified specifications;
- undefined RS competency;
- missing P-level progression requirement;
- unresolved architectural rule;
- incompatible source authorities.

The pipeline stops until the upstream issue is resolved.

---

# 43. Certification Artifact

On PASS, QA01 produces a certificate bound to the exact artifact.

Minimum structure:

```json
{
  "qa_gate": "QA01-KnowledgeMap",
  "artifact_type": "KnowledgeMap",
  "artifact_id": "W1-BA-KNOWLEDGE-MAP",
  "artifact_version": "",
  "artifact_hash": "sha256:...",

  "review_coverage": {
    "rows_expected": 150,
    "rows_reviewed": 150,
    "reading_stages_expected": 15,
    "reading_stages_reviewed": 15,
    "delivery_rounds_expected": 10,
    "delivery_rounds_reviewed": 10,
    "whole_map_reviewed": true
  },

  "blockers": 0,
  "majors": 0,

  "qa_status": "PASS",
  "certified": true,

  "qa_spec_version": "0.1",
  "certified_at": ""
}
```

---

# 44. Exact-Artifact Rule

Certification applies only to the exact reviewed artifact.

If the Knowledge Map changes after PASS:

```text
even one row
even one field
even one requirement
```

the existing certificate does not automatically cover the new artifact.

The modified artifact must undergo QA again according to impact and pipeline policy.

---

# 45. Downstream Authorization

Stage 02 may begin only when it can verify:

```text
QA01 status = PASS
```

and:

```text
certificate artifact version/hash
=
Knowledge Map version/hash being consumed
```

Otherwise:

```text
STOP
```

---

# 46. QA Role Boundary

QA01 may:

- inspect;
- compare;
- challenge;
- calculate;
- trace;
- identify;
- classify;
- explain;
- specify acceptance criteria;
- certify.

QA01 may not:

- rewrite Knowledge Map rows;
- patch the artifact;
- create replacement content;
- silently correct values;
- make curriculum decisions on behalf of Stage 01;
- approve an artifact containing known freeze-impact defects.

---

# 47. Core QA Principle

The purpose of QA01 is not to prove that Stage 01 did good work.

Its purpose is to determine independently whether the Knowledge Map is safe enough to become the foundation for every downstream SpeedReader content artifact.

The correct outcome may therefore be:

```text
PASS
```

or:

```text
STOP AND FIX
```

The pipeline must prefer stopping an uncertain Knowledge Map over propagating a curriculum defect into Content Jobs, passages, assessments and production content.

---

# 48. QA01 Success Condition

QA01 is complete when:

> The complete Knowledge Map has been independently reviewed against all governing specifications, every row and progression has been evaluated, architectural and semantic integrity have been verified, defects have been classified with acceptance criteria, and an explicit certification decision has been issued.

Only a `PASS` certificate permits Stage 02 — Content Job Creation.