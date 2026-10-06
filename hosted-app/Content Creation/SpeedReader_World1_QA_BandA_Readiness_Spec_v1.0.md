# SpeedReader World 1 — Blocker 4 Band-A Readiness Specification v1.0

**Scope:** Blocker 4 only — replace the final-five-only readiness gate with a Band-A decision representing all 15 RS competencies.

**Band transition covered:** World 1 Band A (~100-word passages) → World 1 Band B (~200-word passages). The learner remains in **World 1 / one-word-at-a-time mode**. This is **not** World 1→World 2 graduation.

## 1. Frozen principle

The readiness architecture must represent the same competency architecture that was trained.

Because Band A trains **15 RS competencies**, the final oral-readiness decision must resolve **all 15 RS competencies**.

The canonical final evidence set is:

**Sessions 136–150 = RS01-P10 through RS15-P10.**

The old final-five sample (Sessions 146–150 = RS11–RS15 only) is not representative and may not be used as a graduation shortcut.

## 2. Progress is not readiness

Readiness asks: **Can the learner currently demonstrate the required Band-A competency?**

It does **not** ask: **Did the learner improve by a required percentage?**

A learner who was already strong at RS03-P1 does not need artificial numerical improvement to pass RS03 at P10. Conversely, large improvement from a weak baseline does not by itself prove P10 readiness if the P10 criterion is still missed.

Therefore:

- baseline/progress history is supporting diagnostic evidence;
- the valid P10 result is the primary final readiness evidence;
- earlier same-RS history may explain a result but cannot replace a missing P10 sample.

## 3. Complete P10 evidence round

| Final session | Passage | RS | Competency | P10 success rule |
|---:|---:|---|---|---|
| 136 | 010 | RS01 | Word-recognition accuracy | At P10: final_accuracy ≥97% and first_pass_accuracy ≥95%. Before P10, use the passage-specific target; oral results coach rather than block during Sessions 1–100. |
| 137 | 020 | RS02 | Sequential place-keeping | At P10: ≤2 sequence errors per 100 assessable words and no skip of 2+ consecutive expected words. |
| 138 | 030 | RS03 | Function-word fidelity | At P10: function_word_accuracy ≥98% with zero repeated omission pattern for the same common function word. |
| 139 | 040 | RS04 | Word-ending fidelity | At P10: ending_accuracy ≥95% across at least 8 tagged inflected words in the passage. |
| 140 | 050 | RS05 | Longer-word decoding | At P10: ≥90% of tagged longer words finally correct, with median target hesitation ≤3 s and no full-sentence restart caused by a target. |
| 141 | 060 | RS06 | Hesitation control | At P10: ≤3 >2-second hesitations per 100 assessable words and no unexplained silence >6 s. |
| 142 | 070 | RS07 | Efficient self-correction | At P10: if eligible errors occur, ≥80% are self-corrected within 3 s and ≤1 correction causes a full-sentence restart. If no eligible errors occur, mark skill success automatically. |
| 143 | 080 | RS08 | Repetition and restart control | At P10: ≤2 unnecessary repeated-word/phrase events and ≤1 full restart per 100 words. |
| 144 | 090 | RS09 | Sentence-boundary control | At P10: ≥85% sentence-boundary compliance and zero boundary-linked omitted first words. |
| 145 | 100 | RS10 | Internal-punctuation control | At P10: ≥80% internal-punctuation compliance and zero punctuation-triggered full restarts. |
| 146 | 110 | RS11 | Pace consistency | At P10: pace_spread ≤0.25 with no single quartile >35% slower than the learner's passage median. Absolute WPM is not compared with peers. |
| 147 | 120 | RS12 | Challenge-word recovery | At P10: ≥80% of tagged challenge words correct or self-corrected within 4 s, and ≤1 sequence error in the following five words. |
| 148 | 130 | RS13 | Mid-passage attention stability | At P10: middle-third accuracy is within 2 percentage points of first-third accuracy, no 2+ word skip, and no unexplained silence >6 s. |
| 149 | 140 | RS14 | Final-third stamina | At P10: final-third accuracy within 2 percentage points of first third and final-third WPM no more than 15% below first third. |
| 150 | 150 | RS15 | Integrated one-word fluency | At P10: final_accuracy ≥95%, sequence_errors ≤2, long hesitations ≤4, full restarts ≤1 and pace_spread ≤0.25. This is 100-word-band integration, not World 1→World 2 graduation. |

## 4. Per-RS readiness states

| Status | Meaning |
|---|---|
| **READY** | Valid P10 oral evidence meets every mandatory criterion in that RS P10 success rule. |
| **READY_NO_ERROR_OPPORTUNITY** | RS07 only: no eligible natural error occurred; per the RS07 P10 rule, the skill is treated as successful rather than penalised for having nothing to correct. |
| **REASSESS** | The P10 result cannot be judged because the sample is invalid, ASR uncertainty is unresolved, or the required tagged opportunities are insufficient. |
| **NOT_YET** | The P10 sample is valid but one or more mandatory RS P10 criteria are not met. |

### Important distinction

`REASSESS` is not failure. It means the system does not possess trustworthy evidence.

`NOT_YET` is also not a punitive failure state. It means that specific competency still needs coaching and fresh evidence.

## 5. Overall Band-A decision algorithm

Create a 15-element readiness vector:

`[RS01_status, RS02_status, ..., RS15_status]`

Then apply:

1. Evaluate every RS01-P10…RS15-P10 independently.
2. If any sample is technically/measurement-invalid, mark that RS `REASSESS`.
3. If a valid sample misses any mandatory P10 criterion, mark that RS `NOT_YET`.
4. Otherwise mark it `READY` (or RS07 `READY_NO_ERROR_OPPORTUNITY` when no eligible error occurred).
5. Check that all P10 comprehension gates have been resolved through the normal comprehension-remediation flow.
6. Set `BAND_A_READY = TRUE` **only when all 15 RS statuses are resolved as READY/READY_NO_ERROR_OPPORTUNITY and P10 comprehension is resolved**.

Formally:

`BAND_A_READY = all_15_RS_resolved_ready AND p10_comprehension_resolved`

### Forbidden aggregation

The following may **not** determine advancement:

- 3/5 of the final five;
- 12/15, 13/15, 14/15, or any other majority rule;
- weighted averaging across RS competencies;
- averaging strong RS values to cancel a weak RS;
- one integrated RS15 score used as a substitute for RS01–RS14;
- improvement-from-baseline used as a substitute for current P10 mastery.

A progress display may say **14/15 competencies ready**, but advancement remains open until the fifteenth competency is resolved.

## 6. Comprehension at the Band-A gate

Every Band-A passage already has a comprehension gate. The final readiness layer therefore does not invent a new global comprehension percentage.

For the P10 round:

- each Session 136–150 passage must complete its normal P10 mixed-mastery comprehension flow;
- any missed item follows targeted remediation and fresh replacement-item logic;
- Band-A cannot close while any P10 comprehension gate remains unresolved.

Oral readiness and comprehension remain separate dimensions. Strong oral performance cannot compensate for unresolved comprehension, and vice versa.

## 7. Targeted remediation and reassessment

An unresolved RS does **not** cause the learner to repeat all 15 final sessions.

For each `NOT_YET` RS:

1. identify the specific failed P10 criterion;
2. provide short targeted coaching/practice for that competency;
3. present a fresh unseen **100-word** passage designed for the **same RS at P10**;
4. preserve OS-1.0 scoring definitions and the same P10 success rule;
5. keep the comprehension level at P10 mixed mastery;
6. use a materially different topic/plot so memory cannot create a false pass;
7. update only that RS status.

For each `REASSESS` RS, skip competency coaching unless the child actually needs it; obtain a clean fresh sample first.

Already-ready competencies stay closed and are not repeated merely because another RS remains open.

## 8. Reassessment passage requirements

A fresh Band-A reassessment passage must:

- be unseen;
- contain exactly 100 words under COUNT-100;
- remain one-word-at-a-time;
- preserve the same RS/P10 oral-construction contract;
- preserve the same RS P10 scoring rule;
- use P10 mixed-mastery comprehension;
- satisfy all Blocker-2 prose/factual/safety gates;
- avoid near-duplicate plot/topic structure from the failed passage;
- be scored with the same OS scoring version unless a formally versioned migration has occurred.

## 9. Evidence precedence

When evidence conflicts, use this order:

1. **Valid fresh P10/reassessment evidence** — decisive for readiness.
2. **Previous same-RS P9/P8 evidence** — diagnostic/supporting only.
3. **RSx-P1 baseline/progress history** — diagnostic/supporting only.
4. **Other RS competencies** — never evidence for this RS.

This prevents a learner from being blocked by an old weak baseline after demonstrating current mastery, and prevents a strong unrelated competency from hiding a current weakness.

## 10. Parent/learner-facing readiness display

Recommended display:

- **15/15 ready — move to 200-word passages**
- **14/15 ready — one skill left: sentence-boundary control**
- **13/15 ready — two skills need another try**

Do not expose harsh language such as 'failed Band A'.

Do not show peer percentile or class rank.

Do not collapse all 15 competencies into a mysterious readiness percentage when the actionable information is which competency remains unresolved.

## 11. Machine decision pseudocode

```text
ready_count = 0
unresolved = []

for rs in RS01..RS15:
    sample = valid P10 sample or latest same-RS P10 reassessment

    if sample is not scoreable:
        status[rs] = REASSESS
        unresolved.append(rs)
    else if rs == RS07 and sample has zero eligible natural errors:
        status[rs] = READY_NO_ERROR_OPPORTUNITY
        ready_count += 1
    else if sample satisfies every mandatory P10 criterion for rs:
        status[rs] = READY
        ready_count += 1
    else:
        status[rs] = NOT_YET
        unresolved.append(rs)

oral_ready = (ready_count == 15)
band_a_ready = oral_ready AND all_P10_comprehension_gates_resolved
```

## 12. Blocker-4 QA acceptance gate

Blocker 4 is closed only if:

1. final readiness explicitly evaluates RS01–RS15, not only RS11–RS15;
2. Sessions 136–150 are recognized as the canonical complete P10 evidence round;
3. every RS has a specific P10 success criterion;
4. every RS produces an explicit readiness status;
5. no averaging/majority rule can hide a weak or unscored competency;
6. invalid evidence produces REASSESS, not fail/pass;
7. RS07 no-error opportunity is handled without manufacturing an error;
8. current P10 mastery, not amount of progress, determines readiness;
9. comprehension remains a separate required gate;
10. remediation/reassessment targets only unresolved RS tracks;
11. reassessment uses fresh unseen matched P10 passages;
12. Band-A advancement remains World 1 one-word-at-a-time and does not imply World 2 readiness.

## 13. Structural audit

- Final P10 sessions: **136–150**
- RS competencies represented: **15/15**
- Final P10 evidence rows: **15**
- Partial final-five shortcut: **prohibited**
- Cross-RS compensation: **prohibited**
- Targeted same-RS reassessment: **required when unresolved**
- Advancement condition: **15/15 oral RS resolved + P10 comprehension resolved**

**Freeze recommendation:** Treat this document + readiness matrix CSV as the Blocker-4 freeze candidate. With this correction, all four originally listed blockers have focused specifications ready for independent QA.