# SpeedReader Pipeline — Stage 5: Production Package Creation

**Version:** v0.1  
**Stage:** 05  
**Artifact:** Production Package  
**Producer:** ChatGPT Work  
**Required upstream status:** Stage 02, Stage 03 and Stage 04 artifacts independently QA-approved  
**Work output root:** `D:\Sridhar\Projects\SpeedReader\pipeline\wip`  
**Approved artifact root:** `D:\Sridhar\Projects\SpeedReader\pipeline\approved`  
**Downstream eligibility:** Independent Stage 05 QA approval required

---

# 1. Purpose

Assemble the independently approved SpeedReader content artifacts into the final production-ready package consumed by the application.

Stage 05 combines:

```text
Approved Content Job
        +
Approved Passage
        +
Approved Assessment
        +
Required Runtime Metadata
        ↓
Production Package
```

Stage 05 is primarily an integration and packaging stage.

It must not redesign:

- curriculum;
- Reading Stage competency;
- P-level;
- passage prose;
- assessment questions;
- answer keys;
- scoring intent.

The package must faithfully preserve the exact approved upstream artifacts.

---

# 2. Stage Boundary

Stage 05 may begin only when the required upstream artifacts exist under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```

At minimum:

```text
Stage02 Content Job = QA PASS
Stage03 Passage = QA PASS
Stage04 Assessment = QA PASS
```

Stage 05 must never package content directly from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Stage 05 ends when ChatGPT Work has:

1. verified all required upstream approvals;
2. assembled the complete runtime package;
3. preserved exact upstream content;
4. added only permitted runtime metadata;
5. performed complete mechanical self-validation;
6. performed complete semantic/integration self-validation;
7. corrected all packaging defects;
8. saved the final candidate to Stage 05 WIP;
9. marked the package `AWAITING_QA`.

Stage 05 does not certify its own output.

---

# 3. Pipeline Position

```text
APPROVED STAGE 02 CONTENT JOB
             +
APPROVED STAGE 03 PASSAGE
             +
APPROVED STAGE 04 ASSESSMENT
             ↓
   STAGE 05 — CHATGPT WORK
    PRODUCTION PACKAGING
             ↓
     Mechanical Self-Check
             ↓
 Semantic / Integration Self-Check
             ↓
    Correct Packaging Defects
             ↓
      FINAL WIP PACKAGE
             ↓
pipeline\wip\stage05\production-packages
             ↓
        AWAITING_QA
             ↓
   SEPARATE STAGE 05 QA JOB
```

On QA PASS:

```text
pipeline\wip\stage05\production-packages
             ↓
            MOVE
             ↓
pipeline\approved\stage05\production-packages
```

Only the approved Stage 05 package is production-authoritative.

---

# 4. Core Production Rule

Stage 05 must follow:

```text
Verify approved sources
↓
Load exact approved artifacts
↓
Assemble package
↓
Add permitted runtime metadata
↓
Validate identities and mappings
↓
Validate content integrity
↓
Validate runtime completeness
↓
Correct defects
↓
Revalidate
↓
Save to WIP
↓
Submit for independent QA
```

Stage 05 must never silently improve or edit upstream content.

---

# 5. Mandatory Input Locations

## 5.1 Approved Content Job

Canonical source:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage02\content-jobs
```

---

## 5.2 Approved Passage

Canonical source:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage03\passages
```

---

## 5.3 Approved Assessment

Canonical source:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage04\assessments
```

Stage 05 must verify that all three artifacts belong to the same passage coordinate.

---

# 6. Upstream Certification Verification

Before packaging begins, Work must verify:

```text
Stage02 QA = PASS
Stage03 QA = PASS
Stage04 QA = PASS
```

for the exact artifacts being packaged.

Where available, verify:

- artifact ID;
- version;
- hash;
- source path;
- QA certificate;
- passage coordinate.

If any required artifact is:

- missing;
- uncertified;
- mismatched;
- from WIP;
- from a different version;

then:

```text
STOP STAGE 05
```

---

# 7. One Production Package per Passage Coordinate

Each approved passage coordinate should produce one production package unless a later certified runtime architecture specifies otherwise.

Example:

```text
JOB-W1-BA-034
+
W1-BA-034
+
ASSESS-W1-BA-034
        ↓
PACKAGE-W1-BA-034
```

---

# 8. Production Package Role

The package should contain everything the SpeedReader application needs to deliver the content unit correctly.

This may include:

- identity;
- delivery position;
- learner-facing title;
- passage text;
- assessment;
- scoring metadata;
- RS/P metadata needed internally;
- content strand;
- runtime configuration;
- source provenance;
- version information.

Internal metadata must remain invisible to the learner unless explicitly intended.

---

# 9. Recommended Package Schema

Example minimum structure:

```json
{
  "package_id": "PACKAGE-W1-BA-034",

  "world": 1,
  "band": "A",

  "passage_id": "W1-BA-034",
  "job_id": "JOB-W1-BA-034",
  "assessment_id": "ASSESS-W1-BA-034",

  "reading_stage": "RS04",
  "p_level": "P03",

  "delivery_round": 3,
  "delivery_session": 34,

  "knowledge_strand": "",

  "learner_content": {
    "title": "",
    "passage_text": ""
  },

  "assessment": {},

  "runtime_metadata": {},

  "source_artifacts": {
    "content_job": {},
    "passage": {},
    "assessment": {}
  },

  "qa_provenance": {},

  "work_self_validation": {},

  "status": "AWAITING_QA"
}
```

The exact runtime schema may later be aligned to the SpeedReader application contract.

---

# 10. Identity Integrity

The following identifiers must all agree:

```text
Content Job passage_id
Passage passage_id
Assessment passage_id
Package passage_id
```

Similarly:

```text
Job ID
Assessment ID
World
Band
RS
P-level
Delivery Round
Delivery Session
```

must remain consistent.

Any mismatch must stop packaging.

---

# 11. Exact Passage Preservation

The production package must preserve the exact QA-approved learner-facing passage.

Stage 05 must not:

- rewrite wording;
- normalize punctuation;
- fix grammar;
- change capitalization;
- trim words;
- alter contractions;
- modify the title;
- change spacing in a way that alters content semantics.

If an upstream passage appears defective:

```text
UPSTREAM_DEFECT: STAGE03
```

Do not fix it inside Stage 05.

---

# 12. Exact Assessment Preservation

The production package must preserve the exact approved assessment semantics.

Stage 05 must not:

- rewrite questions;
- alter expected answers;
- change acceptable-answer rules;
- change evidence mapping;
- change scoring logic;
- remove items;
- add items.

If an upstream assessment appears defective:

```text
UPSTREAM_DEFECT: STAGE04
```

---

# 13. Content Job Preservation

Relevant curriculum metadata must remain faithful to the approved Content Job.

Do not change:

- RS;
- P-level;
- comprehension target;
- learner-evidence definitions;
- knowledge strand;
- delivery coordinate.

---

# 14. Runtime Metadata

Stage 05 may add runtime metadata only when permitted by the application/runtime specification.

Examples may include:

- schema version;
- package version;
- feature flags;
- response mode;
- TTS configuration references;
- assessment presentation configuration;
- telemetry labels;
- content release status.

Runtime metadata must not alter pedagogical meaning.

---

# 15. Learner-Facing vs Internal Fields

The production package must clearly distinguish:

```text
LEARNER-FACING
```

from:

```text
INTERNAL
```

Internal data such as:

- RS number;
- P-level;
- learner evidence;
- scoring metadata;
- QA provenance;
- source hashes;

must not accidentally appear in learner-facing UI.

---

# 16. Assessment Runtime Integrity

Verify that the packaged assessment retains:

- correct question order;
- item IDs;
- answer keys;
- scoring rules;
- response types;
- learner-evidence mappings.

Packaging must not break assessment behaviour.

---

# 17. Delivery Integrity

The package must retain the exact approved delivery information.

For World 1 Band A, verify:

```text
delivery_session =
(P_number - 1) × 15 + RS_number
```

where applicable.

The package must not accidentally assign content to the wrong learner session.

---

# 18. Cross-Artifact Traceability

The final package must record exactly which approved artifacts created it.

Recommended structure:

```json
"source_artifacts": {
  "content_job": {
    "path": "",
    "version": "",
    "hash": ""
  },
  "passage": {
    "path": "",
    "version": "",
    "hash": ""
  },
  "assessment": {
    "path": "",
    "version": "",
    "hash": ""
  }
}
```

Where hashing is not yet available, preserve at minimum exact paths and versions.

---

# 19. QA Provenance

The package should preserve certification provenance for every upstream artifact.

Example:

```json
"qa_provenance": {
  "stage02": {
    "status": "PASS"
  },
  "stage03": {
    "status": "PASS"
  },
  "stage04": {
    "status": "PASS"
  }
}
```

If certificate IDs/hashes exist, include them.

---

# 20. No WIP Dependency

The production package must contain zero authoritative references to WIP artifacts.

Before submission, Work must search package metadata for:

```text
\pipeline\wip\
```

No runtime source dependency may point there.

All upstream references must resolve to:

```text
\pipeline\approved\
```

---

# 21. Runtime Self-Containment

The package should contain or reference everything required by the runtime contract.

The application must not need to reconstruct curriculum intent from planning files.

Stage 05 should identify missing runtime dependencies before submission.

---

# 22. Schema Compliance

The package must follow the certified SpeedReader runtime schema.

If the application schema does not yet exist or conflicts with the packaging requirements:

```text
BLOCKED_BY_RUNTIME_SPEC
```

Do not invent an unofficial production schema and treat it as final.

---

# 23. Production Package Must Not Become a New Content Stage

Packaging must remain integration-oriented.

Stage 05 must not:

- generate new passage content;
- generate new questions;
- add educational explanations;
- create hints;
- alter pedagogy;
- revise upstream content.

Any newly required learner-facing content should return to the appropriate upstream stage.

---

# 24. Work Self-Validation

Before saving the Stage 05 candidate, ChatGPT Work must perform:

```text
A. Mechanical Self-Validation
B. Semantic / Integration Self-Validation
```

Both must pass.

---

# 25. Mechanical Self-Validation

Verify at minimum:

## Source Approval

- Stage02 artifact exists under approved;
- Stage03 artifact exists under approved;
- Stage04 artifact exists under approved;
- PASS status confirmed.

## Identity

- Package ID valid;
- Passage ID consistent;
- Job ID consistent;
- Assessment ID consistent;
- World consistent;
- Band consistent;
- RS consistent;
- P-level consistent;
- delivery metadata consistent.

## Structure

- valid package schema;
- mandatory fields present;
- no prohibited null fields;
- valid data types;
- arrays/objects correctly structured;
- no placeholders.

## Source Paths

- all authoritative source paths use `approved`;
- zero WIP source dependencies.

## Status

Final candidate status must be:

```text
AWAITING_QA
```

---

# 26. Exact-Content Comparison

Work must compare the packaged learner-facing passage against the approved Stage 03 passage.

They must match exactly according to the pipeline's artifact comparison policy.

Similarly compare packaged assessment content with the approved Stage 04 artifact.

Any unauthorized difference must be corrected before submission.

---

# 27. Semantic / Integration Self-Validation

Work must evaluate the package as a complete runtime unit.

At minimum review:

- passage identity;
- assessment identity;
- RS/P metadata;
- learner-facing content integrity;
- question/answer integrity;
- runtime metadata;
- learner/internal field separation;
- scoring preservation;
- delivery mapping;
- provenance;
- downstream usability.

---

# 28. Passage–Assessment Pairing

Verify that the packaged assessment belongs to the packaged passage.

Ask:

> Can every assessment question still be answered using this exact packaged passage?

If not, packaging is wrong or an upstream mismatch exists.

---

# 29. Curriculum Metadata Integrity

Verify that the package's:

```text
RS
P-level
knowledge strand
delivery position
```

all match approved upstream data.

No runtime transformation may alter them.

---

# 30. Learner Presentation Integrity

Check whether internal metadata could accidentally leak into learner-facing output.

Examples of fields that normally remain internal:

```text
RS04
P03
learner_evidence_required
QA status
artifact hash
scoring key
expected answer
```

The runtime package must make appropriate presentation boundaries possible.

---

# 31. Assessment Security / Separation

Where answer keys or scoring rules are packaged alongside learner-facing questions, the structure must keep them logically separated so the application does not accidentally display them before response submission.

Stage 05 must respect the runtime application's assessment-security design.

---

# 32. Runtime Ordering

Verify any required ordering, including:

- passage before assessment;
- question order;
- item sequencing;
- delivery position.

Packaging must preserve the certified instructional flow.

---

# 33. Character and Encoding Integrity

Verify that packaging has not introduced:

- broken quotation marks;
- corrupted apostrophes;
- invalid Unicode;
- escaped text rendered incorrectly;
- malformed line breaks;
- encoding artifacts.

Learner-facing text must remain intact.

---

# 34. JSON / Data Integrity

Where JSON is used, verify:

- valid JSON;
- correctly escaped strings;
- no duplicate object keys where prohibited;
- correct array order;
- no accidental type conversion;
- no truncated content.

---

# 35. Word Count Preservation

Where exact passage word count is part of the approved contract, confirm that packaging did not alter the passage text in a way that changes word count.

The Stage 03 approved value must remain preserved.

---

# 36. Assessment Scoring Preservation

Verify that packaging does not modify:

- full-credit conditions;
- partial-credit conditions;
- acceptable alternatives;
- binary scoring logic;
- response type.

Any transformation affecting scoring is a packaging defect.

---

# 37. No Silent Normalization

Do not apply generic cleanup routines that could change certified content.

Examples:

- auto-title capitalization;
- punctuation normalization;
- whitespace rewriting with semantic effect;
- quote replacement;
- automatic spell correction;
- sentence reformatting.

Approved content is immutable unless reopened upstream.

---

# 38. Package Versioning

Every production package should include a package version.

Example:

```text
PACKAGE-W1-BA-034
version: 1
```

If Stage 05 packaging changes without upstream content changes, increment according to the pipeline versioning policy.

If upstream content changes, a new package must be generated from the newly approved artifacts.

---

# 39. Upstream Change Detection

If any source artifact changes after package creation:

```text
Content Job changed
OR
Passage changed
OR
Assessment changed
```

the existing package must no longer be considered current.

Stage 05 must be rerun using the newly approved versions.

---

# 40. Self-Correction Loop

Required Stage 05 workflow:

```text
Assemble package
↓
Mechanical self-validation
↓
Semantic/integration self-validation
↓
Packaging defect found?
   ↓ YES
Correct package
↓
Repeat validations
↓
No unresolved known defects
↓
Save final WIP package
```

Stage 05 must not send a known integration defect to QA.

---

# 41. Upstream Defect Rule

If Stage 05 discovers a defect in approved upstream content:

```text
DO NOT FIX IT IN THE PACKAGE
```

Examples:

- passage metadata mismatches Content Job;
- assessment references wrong learner evidence;
- answer key appears invalid;
- approved artifact lacks required runtime information.

Mark:

```text
BLOCKED_BY_UPSTREAM
```

and identify the responsible stage.

---

# 42. Runtime Specification Blocker

If correct packaging cannot be completed because application/runtime requirements are unclear or conflicting:

```text
BLOCKED_BY_RUNTIME_SPEC
```

Do not invent a permanent production contract by assumption.

---

# 43. Work Self-Validation Record

Recommended structure:

```json
{
  "work_self_validation": {
    "mechanical_check": "PASS",
    "semantic_integration_check": "PASS",
    "upstream_certification_check": "PASS",
    "identity_integrity_check": "PASS",
    "passage_preservation_check": "PASS",
    "assessment_preservation_check": "PASS",
    "delivery_mapping_check": "PASS",
    "runtime_schema_check": "PASS",
    "learner_internal_separation_check": "PASS",
    "provenance_check": "PASS",
    "wip_dependency_check": "PASS",
    "unresolved_known_defects": 0
  }
}
```

This is production metadata only.

It does not constitute independent QA approval.

---

# 44. WIP Output Location

All Stage 05 candidate output must be created under:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip
```

Recommended structure:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\
└── stage05\
    └── production-packages\
        └── W1\
            └── BandA\
                └── PACKAGE-W1-BA-034.json
```

Stage 05 Work must never write directly into the approved directory.

---

# 45. WIP Status

Every Stage 05 candidate remains:

```text
AWAITING_QA
```

while located in:

```text
pipeline\wip
```

Work self-validation never authorizes production use.

---

# 46. Independent QA Boundary

The separate Stage 05 QA reviewer must receive:

```text
Approved Content Job
+
Approved Passage
+
Approved Assessment
+
WIP Production Package
+
Applicable Runtime Schema
+
Stage05-QA.md
```

The QA reviewer independently returns:

```text
PASS
FAIL_REWORK
BLOCKED
```

---

# 47. QA PASS Promotion Rule

On Stage 05 QA `PASS`, the exact reviewed production package must be moved from:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\wip\stage05\production-packages\...
```

to:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage05\production-packages\...
```

The package must not be modified during promotion.

---

# 48. QA Failure Rule

If QA returns:

```text
FAIL_REWORK
```

the package remains in WIP.

ChatGPT Work must:

1. read the QA findings;
2. correct packaging defects only;
3. rerun mechanical self-validation;
4. rerun semantic/integration self-validation;
5. save the revised WIP artifact;
6. resubmit for full independent QA.

---

# 49. QA Blocked Rule

If QA returns:

```text
BLOCKED
```

the package remains in WIP.

The appropriate upstream stage or runtime specification must be reopened.

No deployment may begin.

---

# 50. Exact-Artifact Promotion Rule

QA approval applies only to the exact package reviewed.

Any modification after QA PASS invalidates approval for the changed artifact.

The changed package must return to WIP and undergo Stage 05 QA again.

---

# 51. Approved Artifact Authority

After QA PASS:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved\stage05\production-packages
```

becomes the authoritative content source for downstream deployment/integration.

No WIP package may be deployed.

---

# 52. Deployment Boundary

Stage 05 ends at approved production-package creation.

It does not itself:

- deploy to Supabase;
- publish to production;
- modify the live application;
- activate learner delivery.

Deployment should remain a separate downstream workflow so content certification and deployment risk remain independent.

---

# 53. Stage 05 Success Condition

Stage 05 production is complete when:

> ChatGPT Work has assembled only independently approved upstream artifacts into one complete, traceable, schema-valid production package; preserved the approved passage and assessment exactly; correctly maintained identity, RS/P, delivery and runtime metadata; performed complete mechanical and semantic/integration self-validation; corrected all known packaging defects; and saved the final candidate under the canonical WIP directory for independent QA.

Stage 05 becomes production-authoritative only after independent Stage 05 QA returns `PASS` and the exact reviewed package is moved into:

```text
D:\Sridhar\Projects\SpeedReader\pipeline\approved
```