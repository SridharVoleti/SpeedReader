# SpeedReader Pipeline — Stage 2 QA: Content Job Independent Review

**Version:** v0.1  
**QA Gate:** Stage 02  
**Artifact under review:** Content Job  
**Producer:** Stage 02 — Content Job Work Task  
**QA role:** Independent reviewer and certifier  
**Required upstream status:** Stage 01 Knowledge Map QA = PASS  
**Downstream stage:** Stage 03 — Passage Creation

---

# 1. Purpose

Perform a complete independent review of each Content Job before it is permitted to drive passage creation.

The Content Job is the execution contract between the approved Knowledge Map and the Passage Creation stage.

Therefore QA02 must determine whether the submitted Content Job:

- faithfully preserves the approved Knowledge Map;
- correctly applies all governing specifications;
- operationalizes the intended Reading Stage competency;
- operationalizes the intended P-level;
- defines sufficient learner evidence;
- supplies all requirements needed for deterministic passage creation;
- preserves factual and safety requirements;
- gives sufficient creative freedom for natural prose;
- contains no hidden ambiguity, contradiction, weakening or curriculum drift.

QA02 does not create or repair Content Jobs.

It reviews and certifies them.

---

# 2. Fundamental Gate Rule

Stage 03 Passage Creation must not receive a Content Job unless QA02 returns:

```text
PASS
```

for the exact submitted Content Job version.

The following do not authorize downstream progression:

```text
Stage 02 Work completed
Mechanical self-validation passed
Semantic self-validation passed
Content Job appears reasonable
Only small concerns remain
```

Only QA02 certification authorizes passage creation.

---

# 3. Independence Rule

QA02 must independently evaluate the artifact.

It must not trust:

- Stage 02's self-validation result;
- the Creator's explanation of intent;
- claims that requirements were satisfied;
- earlier drafts;
- assumptions about what the Content Job "probably means."

The review must be based on:

```text
Certified upstream sources
+
submitted Content Job
+
QA02 requirements
```

---

# 4. Mandatory QA Inputs

QA02 must receive:

## A. Submitted Content Job

The exact artifact being considered for certification.

---

## B. Certified Knowledge Map Source

The exact approved Knowledge Map version and row from which the Content Job was derived.

The corresponding Stage 01 QA certification must be valid.

---

## C. Governing Specifications

All applicable certified specifications, including where relevant:

- Reading Stage competency specification;
- P1→P10 progression specification;
- comprehension framework;
- row-level passage generation specification;
- prose requirements;
- oral-reading requirements;
- engagement requirements;
- factual rules;
- safety rules;
- assessment-support requirements;
- global SpeedReader content rules.

---

## D. Stage 02 Production Contract

QA02 should receive:

```text
Stage02-ContentJob.md
```

to understand what the producer was required to deliver.

---

# 5. Review Scope

QA02 reviews the **entire Content Job**.

No mandatory field or requirement may be excluded from review.

If Content Jobs are produced in batches, every Content Job must individually pass QA02.

Batch-level certification must not hide individual failures.

---

# 6. QA Review Model

QA02 must perform all of the following:

```text
1. Upstream certification verification
2. Source fidelity review
3. Structural completeness review
4. RS competency review
5. P-level review
6. RS × P interaction review
7. Comprehension review
8. Learner-evidence review
9. Content-contract review
10. Prose feasibility review
11. Engagement review
12. Assessment-readiness review
13. Factual review
14. Safety review
15. Determinism review
16. Creative-freedom review
17. Contradiction review
18. Downstream-readiness decision
```

Passing only some dimensions is insufficient.

---

# 7. Upstream Certification Verification

Before reviewing the Content Job itself, QA must confirm:

```text
Stage01 QA status = PASS
```

for the exact Knowledge Map artifact being referenced.

Verify where available:

- artifact ID;
- version;
- hash;
- commit;
- certification metadata.

If the Content Job was derived from an uncertified or different Knowledge Map version:

```text
BLOCKED
```

---

# 8. Coordinate Fidelity

Verify that the Content Job exactly matches the approved Knowledge Map row for:

- Passage ID;
- World;
- Band;
- Reading Stage;
- P-level;
- Delivery Round;
- Delivery Session;
- Knowledge Strand;
- Working Title where frozen;
- Content Concept;
- Content Premise;
- RS target;
- P-level target;
- Comprehension target;
- learner evidence;
- factual flags;
- safety flags.

Any unexplained change is curriculum drift.

---

# 9. Source-Fidelity Rule

QA02 must distinguish between:

```text
AUTHORIZED EXPANSION
```

and:

```text
UNAUTHORIZED REINTERPRETATION
```

Authorized expansion adds execution detail without changing intent.

Unauthorized reinterpretation changes what the learner is expected to read, understand or demonstrate.

Example:

Approved requirement:

```text
Track the relationship between two separated pieces of information.
```

Acceptable expansion:

```text
The passage must include two meaningfully connected facts separated by intervening text, requiring the learner to preserve their relationship.
```

Unacceptable reinterpretation:

```text
Learner identifies the main idea.
```

---

# 10. Structural Completeness

Every mandatory Content Job field must:

- exist;
- contain meaningful content;
- use the correct structure;
- contain valid values.

A field containing:

```text
TBD
N/A
As appropriate
Use judgment
Something engaging
```

must not pass where the pipeline requires an operational specification.

---

# 11. Reading Stage Fidelity

QA must independently determine:

> If a Passage Creator follows this job exactly, will the resulting passage genuinely exercise the assigned Reading Stage competency?

Check:

- competency definition;
- required reading behaviour;
- information architecture;
- learner evidence;
- passage-specific target.

The Content Job must not merely mention the RS.

It must operationalize it.

---

# 12. Intrinsic RS Test

Conceptually remove the field:

```text
reading_stage = RSxx
```

Then inspect the job requirements.

Ask:

> Does the remaining Content Job still clearly describe the intended reading capability?

If the Content Job could be assigned to several Reading Stages without meaningful alteration, its RS specification is probably too generic.

This is a QA defect.

---

# 13. P-Level Fidelity

QA must independently verify the assigned P-level.

The Content Job must operationalize the exact developmental demand appropriate to that level.

Reject progression based mainly on:

- vocabulary difficulty;
- obscure topic choice;
- sentence length;
- word length;
- fact density.

The intended learner capability must meaningfully differ across P-levels.

---

# 14. Adjacent P-Level Comparison

Where needed, QA should compare the Content Job against the canonical requirements for:

```text
P(n-1)
P(n)
P(n+1)
```

to determine whether the assigned job belongs at the intended level.

For boundary levels, compare against the nearest available level.

---

# 15. RS × P Integrity

A Content Job passes only if:

```text
RS fidelity = PASS
AND
P-level fidelity = PASS
```

A correct RS with the wrong P-level fails.

A correct P-level with the wrong RS fails.

---

# 16. Content-Pedagogy Fit

QA must ask:

> Can the proposed content naturally carry the intended RS and P-level demands?

The Content Job should not require unnatural prose engineering merely to satisfy pedagogical requirements.

Flag cases where:

- the topic is poorly suited to the reading competency;
- required relationships are artificial;
- the content concept cannot support the intended evidence;
- the Creator would need to change the curriculum intent to make the passage work.

---

# 17. Content-Premise Sufficiency

The premise must provide enough information to constrain passage creation.

QA should ask:

> Does the Passage Creator know what the passage is actually about?

Too vague:

```text
Write about space.
```

More deterministic:

```text
Explain how astronauts keep floating objects from drifting away inside a spacecraft, using a simple everyday-object example.
```

The exact specificity required depends on the governing specification.

---

# 18. Required Content Elements

Review every required content element for:

- source authority;
- relevance;
- pedagogical necessity;
- feasibility;
- internal consistency.

QA must flag both:

```text
missing required elements
```

and:

```text
invented unnecessary requirements
```

---

# 19. Information Architecture

Where the reading competency depends on textual relationships, the Content Job must specify them sufficiently.

Examples:

- sequence;
- cause/effect;
- comparison;
- problem/solution;
- evidence/conclusion;
- connected facts;
- inference cues.

QA must determine whether the planned information architecture genuinely supports the target competency.

---

# 20. Comprehension Alignment

Verify alignment among:

```text
RS competency
↓
P-level demand
↓
Content premise
↓
Information structure
↓
Comprehension target
↓
Learner evidence
```

These must describe one coherent instructional event.

A contradiction anywhere in this chain prevents PASS.

---

# 21. Learner Evidence Review

The `learner_evidence_required` field must be independently assessed.

Evidence must be:

- observable;
- specific;
- aligned to the RS;
- aligned to the P-level;
- derivable from the future passage;
- measurable through later assessment.

Weak:

```text
Learner understands what happened.
```

Stronger:

```text
Learner identifies the two relevant events and explains how the first influenced the second using text evidence.
```

---

# 22. Evidence Sufficiency

QA must ask:

> If the passage satisfied this job perfectly, would the planned learner evidence actually demonstrate the intended competency?

If not, the Content Job fails even if the prose instructions are otherwise strong.

---

# 23. Assessment Readiness

Stage 02 does not create the assessment.

However QA must determine whether the Content Job can later support a valid assessment.

The future assessment must not require:

- outside knowledge unless explicitly allowed;
- invented facts;
- unstated relationships;
- unrelated vocabulary knowledge;
- a different competency from the passage target.

The Content Job should contain enough evidence architecture to make valid assessment possible.

---

# 24. Prose Requirement Completeness

QA must verify that all applicable prose constraints were correctly carried into the job.

Potential examples include:

- exact word count;
- oral-readability requirements;
- sentence requirements;
- punctuation limits;
- vocabulary controls;
- natural rhythm;
- age appropriateness;
- genre constraints;
- prohibited prose patterns.

Missing a mandatory prose requirement is a QA defect.

---

# 25. Prose Feasibility

QA must determine whether all requirements can coexist within the target passage length and style.

For example:

```text
100 words
+
5 required facts
+
3 distinct events
+
complex inference
+
strong hook
+
ending payoff
```

may become structurally impossible.

QA must detect over-constrained jobs before passage generation begins.

---

# 26. Oral-Reading Suitability

Because the downstream artifact is used in SpeedReader, QA must evaluate whether the Content Job is compatible with oral reading.

The job should not force:

- unnatural sentence complexity;
- excessive punctuation;
- tongue-twisting phrasing;
- unsuitable abbreviations;
- overly dense technical vocabulary;
- structures incompatible with the target Reading Stage.

---

# 27. Engagement Contract Review

Verify that the Content Job provides enough room for genuine learner engagement.

Where required, confirm support for:

- early hook;
- curiosity;
- mid-passage continuation value;
- satisfying payoff.

Also ensure it does not force:

- exaggerated danger;
- false suspense;
- forced moralizing;
- contrived twist;
- manipulative emotional content.

---

# 28. Creative Freedom Review

The Content Job must be deterministic about learning intent without dictating the exact prose.

QA should evaluate both extremes.

## Under-specified

The Passage Creator must invent curriculum decisions.

Fail.

## Over-specified

The Passage Creator is effectively forced to paraphrase a hidden passage blueprint sentence by sentence.

Also defective unless explicitly intended.

The correct Content Job provides:

```text
tight pedagogical control
+
reasonable writing freedom
```

---

# 29. Factual Requirement Review

QA independently reviews factual controls.

Ask:

- Is factual verification required?
- Is the risk level correct?
- Are important claims constrained?
- Could the Creator make a misleading simplification?
- Are any required facts themselves questionable?
- Does the Content Job encourage anthropomorphism presented as fact?
- Are time-sensitive facts being used where a stable fact would be better?

Missing factual controls must be reported.

---

# 30. Safety Requirement Review

QA independently verifies safety needs.

Potential categories include:

- wildlife;
- health;
- medicine;
- food;
- water;
- road safety;
- fire;
- electricity;
- chemicals;
- tools;
- heights;
- strangers;
- physical experiments.

The Content Job must not rely on the future Passage Creator to notice obvious safety implications independently.

---

# 31. Prohibited-Pattern Review

Verify that applicable known failure patterns are explicitly prevented where necessary.

Examples:

- forced morals;
- filler;
- generic textbook prose;
- excessive explanation;
- giving away the comprehension challenge;
- unsupported factual claims;
- unsafe imitation;
- internal pipeline terminology;
- curriculum drift.

---

# 32. Contradiction Review

QA must actively search for conflicts within the job.

Examples:

```text
Learner must infer the cause.
```

versus:

```text
The cause must be stated explicitly twice.
```

or:

```text
Exactly 100 words
```

versus:

```text
Minimum 120 words
```

or:

```text
No external knowledge required
```

versus:

```text
Learner must know what photosynthesis means beforehand.
```

Any unresolved material contradiction prevents PASS.

---

# 33. Hidden Dependency Review

The Content Job should be self-contained for passage generation.

QA must identify requirements that exist only implicitly in external sources.

Ask:

> Would a Passage Creator miss an important requirement if given only this certified job plus explicitly permitted runtime references?

If yes, the Content Job is incomplete.

---

# 34. Determinism Test

QA should apply this test:

> If two competent Passage Creators independently received this Content Job, would they preserve the same instructional intent, learner evidence, topic, RS behaviour and P-level demand?

The wording of the final passage may differ.

The curriculum result should not.

If substantially different pedagogical interpretations remain possible:

```text
FAIL_REWORK
```

---

# 35. Curriculum-Drift Test

Compare the job against the approved Knowledge Map.

Look for subtle drift such as:

- changing the topic emphasis;
- replacing a relationship skill with recall;
- changing the learner evidence;
- introducing a new concept;
- removing a difficult requirement;
- simplifying the P-level;
- converting informational content into a different pedagogical structure.

Unauthorized drift is a MAJOR defect.

---

# 36. Downstream-Feasibility Test

QA must determine:

> Can Stage 03 produce a high-quality passage from this job without resolving unresolved curriculum decisions?

If Stage 03 would need to decide:

- what the learner should learn;
- which information relationship matters;
- what P-level demand applies;
- what evidence is required;
- which safety rule applies;

then Stage 02 is incomplete.

---

# 37. Upstream Defect Detection

QA02 may determine that the Content Job cannot be corrected without changing Stage 01.

Examples:

- Knowledge Map premise is inherently insufficient;
- RS target is invalid;
- assigned P-level is wrong;
- learner evidence is impossible;
- Stage 01 contains contradictory requirements.

In such cases:

```text
UPSTREAM_DEFECT
```

must be reported.

QA02 must not instruct Stage 02 to silently rewrite the approved Knowledge Map.

---

# 38. Full-Fledged Review Requirement

QA02 must not behave as a checklist-only validator.

The reviewer must actively look for:

- unexpected weaknesses;
- semantic gaps not anticipated by the checklist;
- systemic patterns;
- hidden assumptions;
- regression risks;
- unintended downstream consequences.

The listed criteria define the minimum review scope, not the maximum.

---

# 39. Defect Severity

Every QA finding must be classified.

## BLOCKER

Prevents trustworthy passage generation or indicates an upstream problem that cannot safely be resolved inside Stage 02.

Examples:

- uncertified Knowledge Map input;
- contradictory governing specifications;
- fundamentally ambiguous instructional intent;
- Content Job built against wrong coordinate;
- impossible constraint combination.

Any unresolved BLOCKER prevents PASS.

---

## MAJOR

A substantial defect likely to produce incorrect or pedagogically invalid passage content.

Examples:

- wrong RS operationalization;
- wrong P-level;
- curriculum drift;
- insufficient learner evidence;
- incorrect content premise;
- missing factual/safety requirement;
- under-specified generation contract;
- substantial over-specification making natural prose impossible.

Any unresolved MAJOR prevents PASS.

---

## MINOR

A localized issue that does not fundamentally invalidate the Content Job but still requires correction under the current pipeline standard.

Examples:

- limited metadata clarity;
- localized ambiguity;
- non-critical wording issue in a generation note.

---

## OBSERVATION

A non-blocking improvement suggestion.

Do not use `OBSERVATION` to downgrade a genuine compliance defect.

---

# 40. Finding Format

Every finding should contain:

```text
Finding ID
Severity
Affected Content Job
Affected field(s)
Governing requirement
Observed defect
Why it matters
Upstream or Stage 02?
Freeze impact
Acceptance criteria
```

Example:

```text
CJ-QA-008

Severity:
MAJOR

Affected:
JOB-W1-BA-034

Fields:
rs_target_for_this_passage
learner_evidence_required

Requirement:
The Content Job must operationalize the certified RS04 competency.

Finding:
The job converts the RS04 target into generic fact recall.
The learner evidence can be satisfied without exercising RS04.

Why it matters:
Stage 03 could generate a technically compliant passage that
does not develop the intended Reading Stage competency.

Origin:
Stage 02

Freeze Impact:
YES

Acceptance Criteria:
The job must require the information structure and learner behaviour
intrinsic to RS04 while preserving the approved P03 demand.
```

QA states what must become true.

QA does not write the corrected Content Job.

---

# 41. QA Report

The Stage 02 QA report should contain:

## Executive verdict

```text
PASS
FAIL_REWORK
BLOCKED
```

## Artifact identification

- Job ID;
- Passage ID;
- artifact version/hash where available;
- source Knowledge Map version.

## Review coverage

Confirm all mandatory QA dimensions were reviewed.

## Strengths

Important qualities worth preserving.

## Findings

All defects grouped by severity.

## Cross-cutting concerns

Where reviewing a batch, identify repeated systemic problems.

## Upstream defects

Separate Stage 01/specification defects from Stage 02 defects.

## Acceptance criteria

Clear requirements for successful re-review.

## Certification decision

Explicitly state whether Stage 03 is authorized.

---

# 42. QA Outcomes

QA02 returns exactly one of:

```text
PASS
FAIL_REWORK
BLOCKED
```

---

# 43. PASS Criteria

PASS requires all of the following:

- certified Stage 01 source verified;
- source fidelity passes;
- required fields are complete;
- RS fidelity passes;
- P-level fidelity passes;
- RS × P interaction passes;
- comprehension alignment passes;
- learner evidence is sufficient;
- content requirements are complete;
- assessment readiness passes;
- prose requirements are complete and feasible;
- engagement requirements are appropriate;
- factual controls are adequate;
- safety controls are adequate;
- no material contradiction remains;
- instructional determinism is sufficient;
- creative freedom is reasonable;
- Stage 03 can execute without curriculum invention;
- zero unresolved BLOCKER findings;
- zero unresolved MAJOR findings.

For the MVP:

```text
No conditional PASS.
```

---

# 44. FAIL_REWORK

Use when defects can be corrected within Stage 02 without altering certified upstream curriculum.

The artifact returns to Stage 02 Work.

Required flow:

```text
QA findings
↓
Stage 02 Work rework
↓
Stage 02 mechanical self-validation
↓
Stage 02 semantic self-validation
↓
new Content Job version
↓
QA02 full independent review
```

---

# 45. BLOCKED

Use when:

- upstream certification is invalid;
- governing sources conflict;
- approved Knowledge Map itself must change;
- the intended instructional contract cannot be resolved within Stage 02;
- another upstream dependency is missing.

The pipeline stops until the upstream issue is resolved and re-certified.

---

# 46. Re-Review Rule

QA02 must review the revised artifact independently.

At minimum verify:

- every previous finding;
- acceptance criteria;
- affected neighbouring requirements;
- no new regressions;
- source fidelity remains intact;
- overall downstream readiness still passes.

Do not approve solely because previously reported text was changed.

---

# 47. Certification Artifact

On PASS, QA02 creates a certificate bound to the exact Content Job.

Minimum structure:

```json
{
  "qa_gate": "Stage02-QA",
  "artifact_type": "ContentJob",

  "job_id": "JOB-W1-BA-034",
  "passage_id": "W1-BA-034",

  "artifact_version": "",
  "artifact_hash": "sha256:...",

  "knowledge_map_artifact": "",
  "knowledge_map_version": "",

  "qa_status": "PASS",
  "certified": true,

  "blockers": 0,
  "majors": 0,

  "qa_spec_version": "0.1",
  "certified_at": ""
}
```

---

# 48. Exact-Artifact Certification Rule

Certification applies only to the exact Content Job reviewed.

Any post-certification modification invalidates downstream authorization for the changed artifact.

The revised artifact must return to QA02.

---

# 49. Downstream Authorization

Stage 03 Passage Creation may consume the Content Job only when:

```text
Stage02 QA status = PASS
```

and the certificate corresponds to the exact artifact/version/hash supplied to Stage 03.

Otherwise:

```text
STOP
```

---

# 50. QA Role Boundary

QA02 may:

- inspect;
- compare;
- challenge;
- trace;
- identify defects;
- classify severity;
- identify upstream causes;
- specify acceptance criteria;
- certify.

QA02 may not:

- rewrite the Content Job;
- change the Knowledge Map;
- create a replacement premise;
- silently add missing requirements;
- resolve curriculum ambiguity by assumption;
- generate the passage;
- approve known MAJOR/BLOCKER defects.

---

# 51. Core QA Principle

The Content Job is the last curriculum-control artifact before learner-facing prose is generated.

QA02 must therefore ask:

> If this Content Job were followed perfectly, would it reliably produce the passage we actually intend?

If the answer is uncertain:

```text
DO NOT PASS
```

It is cheaper and safer to correct ambiguity at Stage 02 than after hundreds of passages have been generated.

---

# 52. Stage 02 QA Success Condition

QA02 is complete when:

> The submitted Content Job has been independently reviewed against the certified Knowledge Map and all governing specifications; instructional fidelity, RS/P alignment, evidence, feasibility, factual/safety requirements, determinism and downstream readiness have all been verified; every defect has been classified with acceptance criteria; and an explicit certification decision has been issued.

Only `PASS` authorizes Stage 03 — Passage Creation.