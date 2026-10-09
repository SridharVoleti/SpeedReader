# P10 readiness: executed rule table vs canonical v0.56 (2026-10-09)

Executed: `BLOCKER4-BANDA-READINESS-V1.0` (`lib/v2/p10-readiness.ts`, non-canonical flag set).
Compared with: `SpeedReader_W1_BandA_RS_Model_v0.56.csv` (P10 rows) in
`D:\Sridhar\Projects\SpeedReader_CC\SpeedReader_W1_BandA_v0.56_FINAL_FREEZE_CANDIDATE_FULL_PACKAGE`
(the folder `lib/sr/pipeline-v2/config.ts` names as the canonical dir). Produced by `lib/v2/readiness-ruleset-diff.ts`;
pinned by `tests/unit/v2/app-readiness-ruleset-diff.test.ts` (runs when the package folder exists).

Note: the folder is a FINAL_FREEZE_CANDIDATE and every threshold is `PROVISIONAL_PILOT`. Whether it is the *approved*
canonical package is a product decision this repo cannot confirm.

## Result: does NOT conform. 8 of 15 rule texts identical, 7 differ.

Identical: RS01, RS02, RS06, RS08, RS11, RS13, RS14, RS15.

| RS | Executed (v1.0) | v0.56 | Effect |
|---|---|---|---|
| RS03 | accuracy ≥98%, no repeated omission | exactly 20 scored function words, all assessable, 20/20, no repeated omission | Same pass line at n=20; v0.56 adds the fixed count and assessability requirement |
| RS04 | ending accuracy ≥95% over ≥8 tagged | exactly 8 scored, all assessable, 8/8, all 3 ending categories, ≥2 targets in each fixed third | Adds category and third-coverage requirements (not enforced today) |
| RS05 | ≥90% of tagged, ≥10 assessable | exactly 10 constructed, 10 assessable, ≥9/10 | Equivalent at n=10 |
| RS07 | eligible errors: ≥80% repaired in 3 s, ≤1 restart; none = auto success | cell holds the status mapping. Two pathways: DIRECT_REPAIR (≥3 eligible errors) and CLEAN_READING (≥3 valid recent RS07 samples, ≥300 assessable words); outcome subtypes REPAIR_DEMONSTRATED / CLEAN_READING_EVIDENCE; evidence minimums EVIDENCE-MIN-1.2 | Structural difference: `READY_NO_ERROR_OPPORTUNITY` is not a v0.56 status; needs a multi-sample evidence window |
| RS09 | compliance ≥85%, no boundary-linked omissions | exactly 7 scored terminal boundaries, ≥6/7, no boundary-linked omissions | Equivalent line (6/7 = 85.7%); adds the fixed count |
| RS10 | compliance ≥80%, no punctuation restarts | exactly 5 scored natural opportunities, ≥4/5, no punctuation restarts, ≥2 per half | Adds half-coverage requirement |
| RS12 | ≥80% recovered, ≤1 following-five error | exactly 5 tagged, ≥4/5, zero challenge-triggered restarts, ≤1 following-five error | Adds the zero challenge-triggered restart criterion |

Not in the executed table at all: **COMMON-ORAL-FLOOR-1.0**, conjunctive with every RS rule and without compensation:
every valid P10 primary/confirmation/replacement/revalidation form needs ≥90 assessable expected tokens,
first_pass_accuracy ≥85% and final_accuracy ≥90%; a valid floor miss is FAIL. (`p10-readiness.ts` has no floor.)

## What this means

- The percentage thresholds in the executed table are numerically consistent with v0.56 at the fixed counts, so a
  reading that passes v0.56 on RS01-RS06, RS08-RS15 rarely fails the executed table by threshold.
- The executed table is **more permissive** than v0.56 on structure: no fixed opportunity counts, no category/third/half
  coverage, no common oral floor, no challenge-triggered-restart rule, a different RS07 model.
- `p10-capture.ts` already measures most inputs these need; still missing for conformance: ending categories, per-third
  and per-half target coverage, challenge-triggered restarts, the common-floor check, and the RS07 multi-sample window.

## Decision needed (not taken here)

Whether to move the executor to v0.56 (and treat the package as approved canonical). Until then KM-004 / KM-006 stay
PARTIAL and `RULESET_IS_CANONICAL` stays false.
