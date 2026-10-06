# SpeedReader — World 1 Band A Canonical Specification v0.25

**Status:** v0.25 is the self-contained canonical specification for World 1 Band A (Passages 001–150, ~100 words, one-word visual span). It preserves v0.24 and formally separates learner progress descriptors from readiness-cycle states so baseline mastery cannot bypass the P10 PRIMARY→CONFIRMATION requirement.

## Canonicality and versioning — normative

**v0.25 supersedes v0.1–v0.24 for implementation of World 1 Band A / Passages 001–150.**

A developer, passage writer, quiz writer or QA reviewer must be able to implement and audit Passages 001–150 using **this file alone**.

### Sole normative source

`SpeedReader_W1_BandA_Spec_v0.25.md` is the **sole normative implementation source** for this canonical version.

All other v0.21 artifacts are supporting mirrors or audit artifacts:

- CSV registries/models/contracts = machine-readable mirrors;
- QA issue tracker = audit/governance tracker;
- creator validation = creator-side evidence of implementation;
- changelog = historical record;
- package manifest = machine-readable description of artifact roles.

No supporting artifact may introduce a normative requirement that is absent from this specification.

### Precedence

1. **This v0.25 Markdown specification wins over every other artifact.**
2. All v0.25 CSVs must mirror this specification.
3. If a v0.21 CSV conflicts with the Markdown, the CSV is defective and must be regenerated; it does not override the Markdown.
4. All v0.21 and earlier files are historical evidence only and are non-normative.
5. Older equivalence models—including v0.14 `MFORM-1.1` and v0.15 `EQUIV-2.1` artifacts—carry **zero current normative authority**.
6. Future canonical versions must copy forward all still-valid normative requirements or explicitly replace them; they may not rely on an older file to supply implementation meaning.

### Self-containment rule

Every acceptance threshold, QA gate, progression rule, readiness rule, prose-generation rule, scoring definition, evidence minimum, recency rule, comprehension-coverage rule, and equivalent-form tolerance required for implementation must appear in this Markdown file.

Machine-readable mirrors are allowed for automation, but consulting them must never be necessary to discover a requirement.

## Core correction

Passage IDs are **registry coordinates**, not chronological session numbers. Each RS competency track contains 10 passages. The learner receives P1 from RS1→RS15, then P2 from RS1→RS15, and so on.

**Delivery formula:** `delivery_session = (stage_passage_no - 1) × 15 + reading_stage_no`.

This makes the two progressions independent and compatible:
- **Horizontally across a 15-session block:** 15 parallel reading-skill competency tracks RS01→RS15 are interleaved.
- **Vertically across P1→P10:** comprehension progresses slowly from direct recall to mixed mastery.
- Every 15-session comprehension block contains all **15 knowledge strands exactly once**.
- Every RS competency track contains **10 different knowledge strands**, preventing topic from being confounded with the reading skill being trained.

## Frozen design assumptions
- Audience: beginner readers; India-primary, globally accessible.
- World 1 visual span remains **one word at a time** throughout all 1,050 World 1 passages.
- Registry Passages 001–150 target **100 words exactly**. Passage 151 begins the 200-word band but remains World 1 / one-word span.
- **Delivery Sessions 1–100** are confidence-first. Oral metrics coach but do not block progression; comprehension mastery does.
- No peer comparison, percentile, leaderboard or class rank. Progress is self-referenced only.
- Every passage follows Babysteps: effortless learning, curiosity, useful knowledge, gentle stretch and no preaching.
- Wisdom is a design intention, usually latent; prose should not habitually state the moral.


## BLOCKER 2 closure — delivered-round strand invariant

The learner-facing sequence, not registry row order, is the source of truth.

**Frozen invariant:** Every delivered round of 15 sessions must contain **all 15 knowledge strands exactly once**. Across Passages 001–150, each strand must therefore appear **exactly 10 times** in total.

The registry exposes `delivery_round`, `round_position`, and `round_strand_qa` so this invariant is machine-auditable. No earlier version is required to interpret or enforce it.

| Delivery round | Sessions | Stage position | Comprehension level | Unique strands | QA |
|---:|---:|---|---|---:|---|
| 1 | 001–015 | P1 | Direct recall of one clear event, person, object or outcome. | 15/15 | **PASS** |
| 2 | 016–030 | P2 | Simple sequence: what happened first, next and last. | 15/15 | **PASS** |
| 3 | 031–045 | P3 | Recognise a simple cause and its effect. | 15/15 | **PASS** |
| 4 | 046–060 | P4 | Predict a likely next event from obvious clues. | 15/15 | **PASS** |
| 5 | 061–075 | P5 | Identify a character feeling and the reason for a choice. | 15/15 | **PASS** |
| 6 | 076–090 | P6 | Distinguish the central idea from a supporting detail. | 15/15 | **PASS** |
| 7 | 091–105 | P7 | Infer one unstated but strongly supported idea. | 15/15 | **PASS** |
| 8 | 106–120 | P8 | Infer the meaning of one gentle stretch word from context. | 15/15 | **PASS** |
| 9 | 121–135 | P9 | Judge a simple choice and transfer the idea to a new but similar situation. | 15/15 | **PASS** |
| 10 | 136–150 | P10 | Blend recall, sequence, cause/effect, inference, main idea and judgment. | 15/15 | **PASS** |

### Regression gate

Any future remap fails QA if **any** 15-session delivery round contains a duplicate strand or omits a strand, even if the overall 150-passage totals still equal 10 per strand.

The required automated check is:

1. Sort by `delivery_session`.
2. Partition into ten consecutive blocks of 15.
3. Require `COUNT(DISTINCT knowledge_strand) = 15` for every block.
4. Require every strand count across all 150 passages to equal 10.


## RS terminology correction — frozen in v0.5

`RS` no longer means a sequential difficulty stage where RS15 is inherently harder than RS01.

Under the corrected 15 × 10 matrix, **RS01–RS15 are 15 parallel oral-reading competency tracks**. The learner meets all 15 tracks during every 15-session round. Each track develops vertically from **P1 baseline → P10 controlled mastery**.

Therefore:

- RS number answers: **Which reading behaviour are we training?**
- P number answers: **How developed is that behaviour inside this 100-word band?**
- Comprehension level also follows P1→P10, but reading-skill success is measured independently from quiz success.
- During Delivery Sessions 1–100, oral-skill misses produce coaching and personal-progress feedback; they do **not** become a harsh unlock failure.
- RS15 is **Integrated one-word fluency**, not “World 1 graduation.” Its P10 cell at Session 150 contributes to 100-word-band readiness only.

## Oral metric definitions used by RS01–RS15

To make the competency rules executable, use these common definitions after ASR confidence filtering:

- `assessable expected words` = expected passage words excluding segments invalidated by recording failure or unresolved low-confidence ASR.
- `first_pass_accuracy` = expected words spoken correctly before any self-correction ÷ assessable expected words.
- `final_accuracy` = expected words correct after accepted self-corrections ÷ assessable expected words.
- `sequence_errors` = confirmed omissions + insertions + reorderings.
- `long_hesitations_2s` = non-punctuation silent gaps longer than 2 seconds, excluding recording faults.
- `full_restart` = learner returns to the beginning of the current sentence or farther without an app prompt.
- `pace_spread` = (fastest quartile WPM − slowest quartile WPM) ÷ median quartile WPM, after excluding punctuation pauses and unscored audio.
- `pp` = percentage points.
- Accent variation alone is never an error. A word is scored wrong only after the ASR safeguard rules establish that the spoken output genuinely differs from the expected word.

## RS01–RS15 executable competency specification

| RS | Competency | Observable oral behaviour | Measurement | P10 success |
|---:|---|---|---|---|
| RS01 | **Word-recognition accuracy** — Recognise and say each expected word accurately while remaining in one-word visual mode. | The spoken token matches the expected word; substitutions and omissions are rare, and a corrected word is distinguished from a first-pass correct word. | first_pass_accuracy = first-pass correct expected words / assessable expected words; final_accuracy = correct words after accepted self-corrections / assessable expected words. | At P10: final_accuracy ≥97% and first_pass_accuracy ≥95%. Before P10, use the passage-specific target; oral results coach rather than block during Sessions 1–100. |
| RS02 | **Sequential place-keeping** — Keep the exact left-to-right word sequence without losing place. | The learner avoids skipped words, inserted words and order changes, including immediately after punctuation or a difficult word. | sequence_errors = confirmed omissions + insertions + reorderings; also record longest consecutive-word skip. | At P10: ≤2 sequence errors per 100 assessable words and no skip of 2+ consecutive expected words. |
| RS03 | **Function-word fidelity** — Read short grammatical words accurately instead of skipping or replacing them. | Words such as a, an, the, of, to, in, on, is, was, are, and, but are spoken when present and are not casually substituted. | function_word_accuracy = correct tagged function words / assessable tagged function words; track function-word omissions separately. | At P10: function_word_accuracy ≥98% with zero repeated omission pattern for the same common function word. |
| RS04 | **Word-ending fidelity** — Preserve meaningful word endings while reading aloud. | Plural, tense and progressive endings such as -s, -es, -ed and -ing are not dropped or changed when clearly present. | ending_accuracy = correct tagged inflected-word forms / assessable tagged inflected-word forms; classify dropped or changed endings separately. | At P10: ending_accuracy ≥95% across at least 8 tagged inflected words in the passage. |
| RS05 | **Longer-word decoding** — Read familiar or decodable 2–4 syllable words without losing the passage. | The learner attempts the whole word, may briefly segment it, then continues without abandoning the sentence or restarting broadly. | long_word_accuracy on writer-tagged 2–4 syllable targets; long_word_hesitation = time from target appearance to completed spoken word. | At P10: ≥90% of tagged longer words finally correct, with median target hesitation ≤3 s and no full-sentence restart caused by a target. |
| RS06 | **Hesitation control** — Recover from uncertainty without long silent stalls. | Pauses before ordinary words become shorter over time; a difficult word may cause a pause, but the learner resumes calmly. | long_hesitations_2s = count of non-punctuation silent gaps >2 s; longest_hesitation; exclude recording faults and ASR-uncertain segments. | At P10: ≤3 >2-second hesitations per 100 assessable words and no unexplained silence >6 s. |
| RS07 | **Error monitoring & efficient repair** — Maintain accurate reading by noticing and efficiently repairing genuine misreads when they occur, without requiring the passage to manufacture an error. | When a genuine misread occurs, the learner repairs the word or very short phrase promptly and continues locally. When too few natural errors occur to estimate repair rate, readiness may be supported only by sustained recent clean-reading evidence; that pathway must not be labelled as direct self-correction demonstration. | eligible_errors; timely_self_corrected_errors; uncorrected_eligible_errors; self_correction_rate = timely_self_corrected_errors / eligible_errors when eligible_errors ≥3; correction_latency_seconds; correction_triggered_full_restarts; recent_valid_RS07_samples; recent_assessable_words; recent_first_pass_accuracy. | P10 uses two non-equivalent evidence pathways over the recent RS07 evidence window (normally P8, P9, P10, same scoring version). DIRECT_REPAIR path: if ≥3 eligible natural errors occur, ≥80% must be self-corrected within 3 s, with ≤1 correction-triggered full restart and ≤1 uncorrected eligible error. CLEAN_READING path: if <3 eligible errors occur, require ≥3 valid recent RS07 samples including P10, ≥300 assessable words total, recent first-pass accuracy ≥99%, zero uncorrected eligible errors, and zero correction-triggered full restarts. DIRECT_REPAIR may yield READY_REPAIR_DEMONSTRATED. CLEAN_READING may yield READY_CLEAN_READING_EVIDENCE but must not be described as direct self-correction demonstration. Otherwise assign REASSESS_RS07_EVIDENCE when evidence is insufficient, or NOT_YET when valid evidence shows unresolved repair errors. |
| RS08 | **Repetition and restart control** — Continue forward without unnecessary word repetitions, phrase repetitions or full restarts. | The learner does not repeatedly reread already-correct material simply because of uncertainty; purposeful brief self-correction is excluded. | unnecessary_repeats + full_restarts; separately record repetition used solely for accepted self-correction. | At P10: ≤2 unnecessary repeated-word/phrase events and ≤1 full restart per 100 words. |
| RS09 | **Sentence-boundary control** — Recognise sentence endings orally while keeping one-word visual tracking. | At full stops, question marks and exclamation marks, the learner makes a brief natural boundary pause and begins the next sentence cleanly. | sentence_boundary_compliance = eligible terminal marks followed by 150–1800 ms pause / eligible terminal marks; boundary_linked_omissions. | At P10: ≥85% sentence-boundary compliance and zero boundary-linked omitted first words. |
| RS10 | **Internal-punctuation control** — Respond to commas and similar internal punctuation without turning them into full stops or ignoring them completely. | The learner makes a shorter internal pause at commas where appropriate, then continues the same sentence without losing place. | internal_punctuation_compliance = eligible commas/semicolons/colons followed by 80–900 ms pause / eligible internal marks; punctuation-triggered restarts. | At P10: ≥80% internal-punctuation compliance and zero punctuation-triggered full restarts. |
| RS11 | **Pace consistency** — Maintain a calm, reasonably even oral pace rather than rushing and stalling. | The learner's speed across the four quarters of the passage stays increasingly stable, after excluding punctuation pauses and unscored audio. | Compute WPM for four equal assessable-word quartiles. pace_spread = (max quartile WPM - min quartile WPM) / median quartile WPM. | At P10: pace_spread ≤0.25 with no single quartile >35% slower than the learner's passage median. Absolute WPM is not compared with peers. |
| RS12 | **Challenge-word recovery** — Handle a deliberately gentle unfamiliar or low-frequency word without losing confidence or abandoning the passage. | The learner attempts the tagged challenge word, corrects if needed, and reads the following five words without a broad restart. | challenge_word_final_accuracy; recovery_time; post_challenge_5word_sequence_errors; challenge-triggered restarts. | At P10: ≥80% of tagged challenge words correct or self-corrected within 4 s, and ≤1 sequence error in the following five words. |
| RS13 | **Mid-passage attention stability** — Keep place, accuracy and continuity through the middle of a 100-word passage. | The learner does not drift, skip a cluster of words or lose accuracy simply because the initial novelty has passed. | Compare middle-third final_accuracy and WPM with first-third values; record middle-third multiword skips and unexplained silences. | At P10: middle-third accuracy is within 2 percentage points of first-third accuracy, no 2+ word skip, and no unexplained silence >6 s. |
| RS14 | **Final-third stamina** — Finish a 100-word passage with reading quality close to the way it began. | Accuracy does not collapse and pace does not sharply slow or rush during the final third. | Compare final-third final_accuracy and WPM with first-third values; record error-rate increase in final third. | At P10: final-third accuracy within 2 percentage points of first third and final-third WPM no more than 15% below first third. |
| RS15 | **Integrated one-word fluency** — Combine core World 1 one-word behaviours across the whole 100-word passage. | The learner reads accurately, keeps sequence, avoids excessive hesitation/restarts and maintains a stable finish without being pushed to read multiple words at once. | Integrated bundle: final_accuracy, sequence_errors, long_hesitations_2s, full_restarts and pace_spread. Comprehension remains a separate score. | At P10: final_accuracy ≥95%, sequence_errors ≤2, long hesitations ≤4, full restarts ≤1 and pace_spread ≤0.25. This is 100-word-band integration, not World 1→World 2 graduation. |

## P1→P10 development inside each RS

The following is the reading-skill ladder. It is **independent of passage topic** and runs vertically down each RS column.

### RS01 — Word-recognition accuracy

**Competency:** Recognise and say each expected word accurately while remaining in one-word visual mode.

**Observable behaviour:** The spoken token matches the expected word; substitutions and omissions are rare, and a corrected word is distinguished from a first-pass correct word.

**Measurement:** first_pass_accuracy = first-pass correct expected words / assessable expected words; final_accuracy = correct words after accepted self-corrections / assessable expected words.

**P10 success rule:** At P10: final_accuracy ≥97% and first_pass_accuracy ≥95%. Before P10, use the passage-specific target; oral results coach rather than block during Sessions 1–100.

| P | Development target |
|---:|---|
| P1 | Baseline on familiar high-frequency words. |
| P2 | Final accuracy ≥90%. |
| P3 | Final accuracy ≥91%. |
| P4 | Final accuracy ≥92%. |
| P5 | Final accuracy ≥93%. |
| P6 | Final accuracy ≥94%. |
| P7 | Final accuracy ≥95%. |
| P8 | Final accuracy ≥95% with one gentle low-frequency word. |
| P9 | Final accuracy ≥96% and first-pass accuracy ≥94%. |
| P10 | Final accuracy ≥97% and first-pass accuracy ≥95%. |

### RS02 — Sequential place-keeping

**Competency:** Keep the exact left-to-right word sequence without losing place.

**Observable behaviour:** The learner avoids skipped words, inserted words and order changes, including immediately after punctuation or a difficult word.

**Measurement:** sequence_errors = confirmed omissions + insertions + reorderings; also record longest consecutive-word skip.

**P10 success rule:** At P10: ≤2 sequence errors per 100 assessable words and no skip of 2+ consecutive expected words.

| P | Development target |
|---:|---|
| P1 | Baseline sequence-error count. |
| P2 | ≤7 sequence errors or clear improvement from RS02 baseline. |
| P3 | ≤6 sequence errors. |
| P4 | ≤5 sequence errors; no 3-word skip. |
| P5 | ≤5 sequence errors with clean sentence transitions. |
| P6 | ≤4 sequence errors. |
| P7 | ≤4 sequence errors after one challenge word. |
| P8 | ≤3 sequence errors. |
| P9 | ≤3 sequence errors; no 2-word skip. |
| P10 | ≤2 sequence errors; no 2+ word skip. |

### RS03 — Function-word fidelity

**Competency:** Read short grammatical words accurately instead of skipping or replacing them.

**Observable behaviour:** Words such as a, an, the, of, to, in, on, is, was, are, and, but are spoken when present and are not casually substituted.

**Measurement:** function_word_accuracy = correct tagged function words / assessable tagged function words; track function-word omissions separately.

**P10 success rule:** At P10: function_word_accuracy ≥98% with zero repeated omission pattern for the same common function word.

| P | Development target |
|---:|---|
| P1 | Baseline on naturally occurring function words. |
| P2 | Function-word accuracy ≥90%. |
| P3 | ≥92%. |
| P4 | ≥93%; no repeated omission of the same function word. |
| P5 | ≥94%. |
| P6 | ≥95%. |
| P7 | ≥96% through sentence transitions. |
| P8 | ≥96% with denser connective words. |
| P9 | ≥97%. |
| P10 | ≥98% and no repeated omission pattern. |

### RS04 — Word-ending fidelity

**Competency:** Preserve meaningful word endings while reading aloud.

**Observable behaviour:** Plural, tense and progressive endings such as -s, -es, -ed and -ing are not dropped or changed when clearly present.

**Measurement:** ending_accuracy = correct tagged inflected-word forms / assessable tagged inflected-word forms; classify dropped or changed endings separately.

**P10 success rule:** At P10: ending_accuracy ≥95% across at least 8 tagged inflected words in the passage.

| P | Development target |
|---:|---|
| P1 | Baseline using naturally occurring endings. |
| P2 | At least 5 tagged ending targets; ≥80% correct. |
| P3 | At least 6 targets; ≥83%. |
| P4 | ≥85%. |
| P5 | ≥88%. |
| P6 | ≥90%. |
| P7 | ≥91% across mixed -s/-ed/-ing forms. |
| P8 | ≥92%. |
| P9 | ≥94%. |
| P10 | At least 8 targets; ≥95%. |

### RS05 — Longer-word decoding

**Competency:** Read familiar or decodable 2–4 syllable words without losing the passage.

**Observable behaviour:** The learner attempts the whole word, may briefly segment it, then continues without abandoning the sentence or restarting broadly.

**Measurement:** long_word_accuracy on writer-tagged 2–4 syllable targets; long_word_hesitation = time from target appearance to completed spoken word.

**P10 success rule:** At P10: exactly 10 tagged longer-word opportunities must be constructed and at least 10 must remain assessable; ≥90% (therefore at least 9/10 when the denominator is 10) must be finally correct, median target hesitation ≤3 s, and no full-sentence restart may be caused by a target.

| P | Development target |
|---:|---|
| P1 | Baseline with 1 gentle 2-syllable target. |
| P2 | 1–2 targets; ≥75% finally correct. |
| P3 | 2 targets; ≥80%. |
| P4 | 2 targets; ≥82%. |
| P5 | 2–3 targets; ≥84%. |
| P6 | 3 targets; ≥85%. |
| P7 | 3 targets; ≥87%. |
| P8 | 3 targets including one 3–4 syllable word; ≥88%. |
| P9 | 3–4 targets; ≥90%, median target hesitation ≤4 s. |
| P10 | Exactly 10 tagged targets; ≥90% (at least 9/10), median hesitation ≤3 s, no target-caused full restart. |

### RS06 — Hesitation control

**Competency:** Recover from uncertainty without long silent stalls.

**Observable behaviour:** Pauses before ordinary words become shorter over time; a difficult word may cause a pause, but the learner resumes calmly.

**Measurement:** long_hesitations_2s = count of non-punctuation silent gaps >2 s; longest_hesitation; exclude recording faults and ASR-uncertain segments.

**P10 success rule:** At P10: ≤3 >2-second hesitations per 100 assessable words and no unexplained silence >6 s.

| P | Development target |
|---:|---|
| P1 | Baseline hesitation count and longest pause. |
| P2 | ≤8 long hesitations or ≥10% improvement from baseline. |
| P3 | ≤7. |
| P4 | ≤6. |
| P5 | ≤6 with no unexplained silence >8 s. |
| P6 | ≤5. |
| P7 | ≤5 after a challenge word. |
| P8 | ≤4. |
| P9 | ≤4 with no unexplained silence >7 s. |
| P10 | ≤3 with no unexplained silence >6 s. |

### RS07 — Error monitoring & efficient repair

**Competency:** Maintain accurate reading by noticing and efficiently repairing genuine misreads when they occur, without requiring the passage to manufacture an error.

**Observable behaviour:** When a genuine misread occurs, the learner repairs the word or very short phrase promptly and continues locally. When too few natural errors occur to estimate repair rate, readiness may be supported only by sustained recent clean-reading evidence; that pathway must not be labelled as direct self-correction demonstration.

**Measurement:** eligible_errors; timely_self_corrected_errors; uncorrected_eligible_errors; self_correction_rate = timely_self_corrected_errors / eligible_errors when eligible_errors ≥3; correction_latency_seconds; correction_triggered_full_restarts; recent_valid_RS07_samples; recent_assessable_words; recent_first_pass_accuracy.

**P10 success rule:** P10 uses two non-equivalent evidence pathways over the recent RS07 evidence window (normally P8, P9, P10, same scoring version). DIRECT_REPAIR path: if ≥3 eligible natural errors occur, ≥80% must be self-corrected within 3 s, with ≤1 correction-triggered full restart and ≤1 uncorrected eligible error. CLEAN_READING path: if <3 eligible errors occur, require ≥3 valid recent RS07 samples including P10, ≥300 assessable words total, recent first-pass accuracy ≥99%, zero uncorrected eligible errors, and zero correction-triggered full restarts. DIRECT_REPAIR may yield READY_REPAIR_DEMONSTRATED. CLEAN_READING may yield READY_CLEAN_READING_EVIDENCE but must not be described as direct self-correction demonstration. Otherwise assign REASSESS_RS07_EVIDENCE when evidence is insufficient, or NOT_YET when valid evidence shows unresolved repair errors.

| P | Development target |
|---:|---|
| P1 | Observe natural error-monitoring/repair behaviour; no opportunity = `NO_OPPORTUNITY`, not success/failure. |
| P2 | Reinforce local spontaneous repair; no opportunity remains `NO_OPPORTUNITY`. |
| P3 | If natural errors occur, target ≥40% accepted repair; otherwise record `NO_OPPORTUNITY`. |
| P4 | If natural errors occur, target ≥50% accepted repair. |
| P5 | Target ≥55%; correction normally limited to word/short phrase. |
| P6 | Target ≥60%. |
| P7 | Target ≥65% with repair latency ≤4 s when opportunities occur. |
| P8 | Target ≥70% and begin the recent P8–P10 evidence window; accumulate clean-reading exposure when opportunities are sparse. |
| P9 | Target ≥75% within 3 s and ≤1 correction-triggered full restart; continue evidence accumulation. |
| P10 | Apply the two-pathway `DIRECT_REPAIR` / `CLEAN_READING` evidence rule; never auto-pass a single no-error sample. |

### RS08 — Repetition and restart control

**Competency:** Continue forward without unnecessary word repetitions, phrase repetitions or full restarts.

**Observable behaviour:** The learner does not repeatedly reread already-correct material simply because of uncertainty; purposeful brief self-correction is excluded.

**Measurement:** unnecessary_repeats + full_restarts; separately record repetition used solely for accepted self-correction.

**P10 success rule:** At P10: ≤2 unnecessary repeated-word/phrase events and ≤1 full restart per 100 words.

| P | Development target |
|---:|---|
| P1 | Baseline unnecessary-repeat and restart count. |
| P2 | ≤8 events or ≥10% improvement from baseline. |
| P3 | ≤7. |
| P4 | ≤6. |
| P5 | ≤5. |
| P6 | ≤5 with ≤3 full restarts. |
| P7 | ≤4 with ≤2 full restarts. |
| P8 | ≤4 with ≤2 full restarts after a challenge word. |
| P9 | ≤3 with ≤1 full restart. |
| P10 | ≤2 with ≤1 full restart. |

### RS09 — Sentence-boundary control

**Competency:** Recognise sentence endings orally while keeping one-word visual tracking.

**Observable behaviour:** At full stops, question marks and exclamation marks, the learner makes a brief natural boundary pause and begins the next sentence cleanly.

**Measurement:** sentence_boundary_compliance = eligible terminal marks followed by 150–1800 ms pause / eligible terminal marks; boundary_linked_omissions.

**P10 success rule:** At P10: ≥85% sentence-boundary compliance and zero boundary-linked omitted first words.

| P | Development target |
|---:|---|
| P1 | Baseline boundary pauses; use clear short sentences. |
| P2 | ≥50% compliant boundaries. |
| P3 | ≥55%. |
| P4 | ≥60%. |
| P5 | ≥65%. |
| P6 | ≥70%. |
| P7 | ≥75% with no more than 1 boundary-linked omission. |
| P8 | ≥78%. |
| P9 | ≥82% and zero boundary-linked omissions. |
| P10 | ≥85% and zero boundary-linked omissions. |

### RS10 — Internal-punctuation control

**Competency:** Respond to commas and similar internal punctuation without turning them into full stops or ignoring them completely.

**Observable behaviour:** The learner makes a shorter internal pause at commas where appropriate, then continues the same sentence without losing place.

**Measurement:** internal_punctuation_compliance = eligible commas/semicolons/colons followed by 80–900 ms pause / eligible internal marks; punctuation-triggered restarts.

**P10 success rule:** At P10: ≥80% internal-punctuation compliance and zero punctuation-triggered full restarts.

| P | Development target |
|---:|---|
| P1 | Baseline with 1–2 simple commas. |
| P2 | ≥45% compliant internal marks. |
| P3 | ≥50%. |
| P4 | ≥55%. |
| P5 | ≥60%. |
| P6 | ≥65%. |
| P7 | ≥70% with ≤1 punctuation-triggered restart. |
| P8 | ≥72%. |
| P9 | ≥76% with zero punctuation-triggered full restart. |
| P10 | ≥80% with zero punctuation-triggered full restart. |

### RS11 — Pace consistency

**Competency:** Maintain a calm, reasonably even oral pace rather than rushing and stalling.

**Observable behaviour:** The learner's speed across the four quarters of the passage stays increasingly stable, after excluding punctuation pauses and unscored audio.

**Measurement:** Compute WPM for four equal assessable-word quartiles. pace_spread = (max quartile WPM - min quartile WPM) / median quartile WPM.

**P10 success rule:** At P10: pace_spread ≤0.25 with no single quartile >35% slower than the learner's passage median. Absolute WPM is not compared with peers.

| P | Development target |
|---:|---|
| P1 | Baseline quartile WPM profile only. |
| P2 | pace_spread ≤0.50 or ≥10% improvement from baseline. |
| P3 | ≤0.45. |
| P4 | ≤0.42. |
| P5 | ≤0.40. |
| P6 | ≤0.36. |
| P7 | ≤0.34. |
| P8 | ≤0.30. |
| P9 | ≤0.28. |
| P10 | ≤0.25 and no quartile >35% below passage median. |

### RS12 — Challenge-word recovery

**Competency:** Handle a deliberately gentle unfamiliar or low-frequency word without losing confidence or abandoning the passage.

**Observable behaviour:** The learner attempts the tagged challenge word, corrects if needed, and reads the following five words without a broad restart.

**Measurement:** challenge_word_final_accuracy; recovery_time; post_challenge_5word_sequence_errors; challenge-triggered restarts.

**P10 success rule:** At P10: exactly 5 tagged challenge-word opportunities must be constructed and all 5 must remain assessable; ≥80% (therefore at least 4/5) must be correct or self-corrected within 4 s, with ≤1 sequence error in the following five words.

| P | Development target |
|---:|---|
| P1 | Baseline with one very gentle challenge word; no threshold. |
| P2 | 1 challenge word; attempt required, no penalty for one coached retry. |
| P3 | 1 target; correct/self-corrected within 7 s. |
| P4 | 1 target; within 6 s. |
| P5 | 1–2 targets; ≥60% recovered within 6 s. |
| P6 | 1–2 targets; ≥65% within 5 s. |
| P7 | 2 targets; ≥70% within 5 s. |
| P8 | 2 targets; ≥75% within 5 s and no broad restart. |
| P9 | 2 targets; ≥80% within 4 s. |
| P10 | Exactly 5 tagged challenge targets; ≥80% (at least 4/5) within 4 s and ≤1 following-word sequence error. |

### RS13 — Mid-passage attention stability

**Competency:** Keep place, accuracy and continuity through the middle of a 100-word passage.

**Observable behaviour:** The learner does not drift, skip a cluster of words or lose accuracy simply because the initial novelty has passed.

**Measurement:** Compare middle-third final_accuracy and WPM with first-third values; record middle-third multiword skips and unexplained silences.

**P10 success rule:** At P10: middle-third accuracy is within 2 percentage points of first-third accuracy, no 2+ word skip, and no unexplained silence >6 s.

| P | Development target |
|---:|---|
| P1 | Baseline first-third vs middle-third profile. |
| P2 | Middle accuracy within 8 pp of first third, or clear improvement from baseline. |
| P3 | Within 7 pp. |
| P4 | Within 6 pp. |
| P5 | Within 5 pp; no 3-word skip. |
| P6 | Within 5 pp. |
| P7 | Within 4 pp; no 2+ word skip. |
| P8 | Within 3 pp. |
| P9 | Within 3 pp and no unexplained silence >7 s. |
| P10 | Within 2 pp, no 2+ word skip, no unexplained silence >6 s. |

### RS14 — Final-third stamina

**Competency:** Finish a 100-word passage with reading quality close to the way it began.

**Observable behaviour:** Accuracy does not collapse and pace does not sharply slow or rush during the final third.

**Measurement:** Compare final-third final_accuracy and WPM with first-third values; record error-rate increase in final third.

**P10 success rule:** At P10: final-third accuracy within 2 percentage points of first third and final-third WPM no more than 15% below first third.

| P | Development target |
|---:|---|
| P1 | Baseline first-third vs final-third profile. |
| P2 | Final accuracy within 10 pp, or clear improvement from baseline. |
| P3 | Within 8 pp. |
| P4 | Within 7 pp. |
| P5 | Within 6 pp. |
| P6 | Within 5 pp. |
| P7 | Within 4 pp; final WPM no more than 25% lower. |
| P8 | Within 3 pp; final WPM no more than 22% lower. |
| P9 | Within 3 pp; final WPM no more than 18% lower. |
| P10 | Within 2 pp; final WPM no more than 15% lower. |

### RS15 — Integrated one-word fluency

**Competency:** Combine core World 1 one-word behaviours across the whole 100-word passage.

**Observable behaviour:** The learner reads accurately, keeps sequence, avoids excessive hesitation/restarts and maintains a stable finish without being pushed to read multiple words at once.

**Measurement:** Integrated bundle: final_accuracy, sequence_errors, long_hesitations_2s, full_restarts and pace_spread. Comprehension remains a separate score.

**P10 success rule:** At P10: final_accuracy ≥95%, sequence_errors ≤2, long hesitations ≤4, full restarts ≤1 and pace_spread ≤0.25. This is 100-word-band integration, not World 1→World 2 graduation.

| P | Development target |
|---:|---|
| P1 | Integrated baseline snapshot only. |
| P2 | Final accuracy ≥90%; sequence errors ≤7; restarts ≤5. |
| P3 | ≥91%; sequence errors ≤6; restarts ≤4. |
| P4 | ≥92%; sequence errors ≤5; long hesitations ≤8. |
| P5 | ≥92%; sequence errors ≤5; restarts ≤3; long hesitations ≤7. |
| P6 | ≥93%; sequence errors ≤4; restarts ≤3; long hesitations ≤6. |
| P7 | ≥94%; sequence errors ≤4; restarts ≤2; long hesitations ≤6. |
| P8 | ≥94%; sequence errors ≤3; restarts ≤2; long hesitations ≤5. |
| P9 | ≥95%; sequence errors ≤3; restarts ≤1; long hesitations ≤5; pace_spread ≤0.30. |
| P10 | ≥95%; sequence errors ≤2; restarts ≤1; long hesitations ≤4; pace_spread ≤0.25. |


## 15 × 10 architecture

| Position inside every reading stage | Comprehension level | Delivered sessions | Quiz count |
|---:|---|---:|---:|
| P1 | Direct recall | 001–015 | 2 |
| P2 | Sequence | 016–030 | 2 |
| P3 | Cause/effect | 031–045 | 3 |
| P4 | Prediction | 046–060 | 3 |
| P5 | Feelings/motivation | 061–075 | 3 |
| P6 | Main idea | 076–090 | 3 |
| P7 | Simple inference | 091–105 | 3 |
| P8 | Vocabulary in context | 106–120 | 3 |
| P9 | Judgment/application | 121–135 | 3 |
| P10 | Mixed mastery | 136–150 | 4 |

## What the learner actually sees

The first 15 sessions are all **P1 / Direct Recall**, one passage from every reading stage. Sessions 16–30 are all **P2 / Sequence**. The same pattern continues until Sessions 136–150, which are all **P10 / Mixed Mastery**.

| Session | Passage ID | RS | P# | Strand | Comprehension | Title |
|---:|---:|---:|---:|---|---|---|
| 001 | 001 | 01 | P1 | Self & Character | Direct recall | The Red Umbrella |
| 002 | 011 | 02 | P1 | Family & Friendship | Direct recall | The Missing Lunch Box |
| 003 | 021 | 03 | P1 | School & Learning | Direct recall | The Blue Pencil |
| 004 | 031 | 04 | P1 | Play, Games & Sports | Direct recall | The Last Ball |
| 005 | 041 | 05 | P1 | Animals & Living World | Direct recall | The Clever Ant |
| 006 | 051 | 06 | P1 | Nature & Environment | Direct recall | The Thirsty Plant |
| 007 | 061 | 07 | P1 | Science & How Things Work | Direct recall | Why the Spoon Felt Cold |
| 008 | 071 | 08 | P1 | Making, Building & Inventing | Direct recall | The Paper Bridge |
| 009 | 081 | 09 | P1 | India Around Us | Direct recall | Morning at the Railway Station |
| 010 | 091 | 10 | P1 | Our World & Journeys | Direct recall | A Postcard from the Sea |
| 011 | 101 | 11 | P1 | Community & Civic Life | Direct recall | The Clean Park Bench |
| 012 | 111 | 12 | P1 | Money, Resources & Choices | Direct recall | Three Coins |
| 013 | 121 | 13 | P1 | Health, Body & Safety | Direct recall | The Water Bottle |
| 014 | 131 | 14 | P1 | Mystery, Logic & Observation | Direct recall | The Footprints Near the Gate |
| 015 | 141 | 15 | P1 | Imagination, Art & Wonder | Direct recall | The Cloud That Looked Like a Whale |
| 016 | 002 | 01 | P2 | Family & Friendship | Sequence | Two Seats on the Bus |
| 017 | 012 | 02 | P2 | School & Learning | Sequence | The Library Stamp |
| 018 | 022 | 03 | P2 | Play, Games & Sports | Sequence | The Friendly Match |
| 019 | 032 | 04 | P2 | Animals & Living World | Sequence | The Puppy and the Slipper |
| 020 | 042 | 05 | P2 | Nature & Environment | Sequence | The First Monsoon Puddle |
| 021 | 052 | 06 | P2 | Science & How Things Work | Sequence | The Dancing Pepper |
| 022 | 062 | 07 | P2 | Making, Building & Inventing | Sequence | The Tallest Paper Tower |
| 023 | 072 | 08 | P2 | India Around Us | Sequence | Mangoes for the Journey |
| 024 | 082 | 09 | P2 | Our World & Journeys | Sequence | The Tiny Map |
| 025 | 092 | 10 | P2 | Community & Civic Life | Sequence | The Lost Key at the Community Hall |
| 026 | 102 | 11 | P2 | Money, Resources & Choices | Sequence | The Ten-Rupee Choice |
| 027 | 112 | 12 | P2 | Health, Body & Safety | Sequence | The Helmet Reminder |
| 028 | 122 | 13 | P2 | Mystery, Logic & Observation | Sequence | The Four Clues |
| 029 | 132 | 14 | P2 | Imagination, Art & Wonder | Sequence | The Drawing That Changed |
| 030 | 142 | 15 | P2 | Self & Character | Sequence | The Doorbell at Six |

## Comprehension progression gate — session based

### Instructional progression
- **P1 / Sessions 001–015:** 2 direct-recall questions. Unlock after 2/2; a miss gets a tiny targeted reread/hint and one fresh replacement item.
- **P2 / Sessions 016–030:** 2 sequence questions, with the same gentle remediation.
- **P3–P9 / Sessions 031–135:** 3 questions. First-attempt mastery = at least 2/3 and the designated primary-skill item correct; remediate only the missed skill.
- **P10 / Sessions 136–150:** 4 questions. First-attempt instructional mastery = at least 3/4 and the designated primary-skill item correct; misses trigger targeted remediation.
- Store **first-attempt comprehension** separately from post-remediation instructional mastery.
- During **Delivery Sessions 1–100**, never use failure language. The child sees what was understood and the tiny next step.

### Critical distinction at P10
Post-remediation success is a **teaching outcome**, not independent readiness evidence.

A P10 quiz may therefore end in:

`INSTRUCTIONALLY_RESOLVED_NOT_CERTIFYING`

after hints, targeted rereading, explanation, or replacement items. This allows learning to continue, but it contributes **zero** evidence to final Band-A comprehension certification.

Independent readiness uses `COMP-P10-1.0` below.

## Confidence timeline — session based
| Delivery sessions | Intended learner belief |
|---:|---|
| 001–020 | **I can read.** |
| 021–040 | **Reading is fun.** |
| 041–060 | **I understand what I read.** |
| 061–080 | **I’m getting better.** |
| 081–100 | **I’m a reader.** |
| 101–150 | **I can sustain this; I’m ready for longer passages.** |

## P10 comprehension coverage — COMP-COVERAGE-1.0 — normative in v0.19

BA-QA-012 exists because the phrase **mixed mastery** does not by itself prove that the final readiness round samples every required comprehension dimension.

v0.19 therefore freezes nine canonical P10 comprehension dimensions:

| ID | Dimension |
|---|---|
| D1 | Direct recall |
| D2 | Sequence |
| D3 | Cause/effect |
| D4 | Prediction |
| D5 | Feelings/motivation |
| D6 | Main idea |
| D7 | Simple inference |
| D8 | Vocabulary-in-context |
| D9 | Judgment/application |

### Five four-item P10 blueprint families

Each P10 passage has **exactly four independently scored items** and four distinct dimension roles.

| Blueprint | Item 1 | Item 2 | Item 3 | Item 4 |
|---|---|---|---|---|
| Q10A | D1 Recall | D7 Inference | D6 Main idea | D4 Prediction |
| Q10B | D2 Sequence | D3 Cause/effect | D5 Feelings/motivation | D9 Judgment/application |
| Q10C | D8 Vocabulary | D1 Recall | D7 Inference | D4 Prediction |
| Q10D | D2 Sequence | D8 Vocabulary | D3 Cause/effect | D9 Judgment/application |
| Q10E | D1 Recall | D6 Main idea | D5 Feelings/motivation | D9 Judgment/application |

This replaces the earlier incomplete three-item descriptions attached to a four-question P10 gate.

### Per-passage mixed-mastery rule

Every P10 passage must contain:

- exactly four scored questions;
- four distinct dimension roles;
- at least one anchor item from `D1 / D2 / D8`;
- at least two reasoning items from `D3 / D4 / D5 / D6 / D7 / D9`;
- one unambiguous defensible answer per item;
- the dimension-specific prose evidence required by the assigned blueprint.

### Final-round balance

Across the 15 canonical PRIMARY P10 passages / 60 first-attempt items:

| Dimension | Required exposures |
|---|---:|
| D1 Direct recall | 9 |
| D2 Sequence | 6 |
| D3 Cause/effect | 6 |
| D4 Prediction | 6 |
| D5 Feelings/motivation | 6 |
| D6 Main idea | 6 |
| D7 Simple inference | 6 |
| D8 Vocabulary-in-context | 6 |
| D9 Judgment/application | 9 |

Total = **60 item slots**.

No required dimension appears fewer than six times.

### Local five-passage coverage

The P10 blueprint sequence repeats all five families every five final sessions.

Therefore each five-passage P10 block must:

- contain Q10A, Q10B, Q10C, Q10D and Q10E exactly once;
- cover all D1–D9;
- expose every dimension at least twice in that five-passage block.

This prevents a dimension from being deferred until only the very end of Band A.

### Confirmation coverage

Under COMP-P10-1.0 and EQUIV-2.1:

- CONFIRMATION uses the **same blueprint ID** as its PRIMARY;
- the four dimension IDs/item roles stay identical;
- passage evidence and question wording must be fresh;
- no answer, clue wording or exact question may be reused.

Thus confirmation verifies the same comprehension demands on an equivalent but independent form.

### Dimension-specific evidence gates

- **D1 Recall:** answer must be explicitly present and central enough not to be trivial metadata.
- **D2 Sequence:** prose contains an unambiguous multi-step chronology.
- **D3 Cause/effect:** prose contains a defensible causal relation, not mere temporal adjacency.
- **D4 Prediction:** at least two textual clues make one continuation clearly best.
- **D5 Feelings/motivation:** behaviour/context support one primary feeling or motive.
- **D6 Main idea:** multiple passage details converge on one best summary.
- **D7 Simple inference:** at least two compatible clues support the inference.
- **D8 Vocabulary-in-context:** target meaning is supported by at least two nearby context cues.
- **D9 Judgment/application:** one safest/fair/reasonable or close-transfer action is best supported by passage facts.

A passage that cannot support every assigned dimension is `INVALID_FORM` before learner exposure.

### Machine-readable matrix

Machine-readable mirror (non-normative):

`SpeedReader_W1_BandA_Comprehension_Coverage_v0.22.csv`

### Scope boundary

This model fixes **coverage sufficiency and explicitness**. It does not change the v0.16 rule that only first-attempt independent PRIMARY + CONFIRMATION performance can become `COMPREHENSION_CONFIRMED`.


## Independent P10 comprehension readiness — COMP-P10-1.0 — normative in v0.16

BA-QA-008 exists because “eventually resolved after remediation” and “independently understood on first attempt” are not the same evidence.

v0.16 therefore creates two separate data streams:

1. **instructional mastery** — may include hints, targeted reread, explanation and fresh replacement items;
2. **independent readiness evidence** — first-attempt performance on fresh unseen matched P10 forms before remediation.

They must never be merged.

### Independent first-attempt rule

First-attempt independent mastery = at least 3/4 correct AND the designated primary-skill item correct, before any hint, targeted reread, answer feedback, narrowing, worked example, or remediation.

The learner receives the standard P10 assessment interface only. Accessibility supports that do not reveal content evidence are allowed. If standard product policy permits ordinary self-initiated passage review, it must be available identically on PRIMARY and CONFIRMATION; the system may not highlight, point to, replay, or target the relevant evidence.

All four first responses must be committed before the system reveals correctness or targeted evidence.

### Two-form comprehension confirmation

Comprehension readiness requires two independent first-attempt passes on fresh matched forms: COMP_PRIMARY_PASS then COMP_CONFIRMATION_PASS. No targeted comprehension coaching, hinting, answer explanation, or missed-item disclosure occurs between a passing PRIMARY and its CONFIRMATION. Both forms use the same P10 blueprint class but fresh passage evidence and fresh question wording.

The existing EQUIV-2.1 form family is reused. The same physical readiness passages may carry both oral and comprehension evidence, but the two evidence streams are scored and stored independently.

A comprehension PRIMARY pass is not yet final readiness.

### If PRIMARY comprehension misses

- record `NOT_YET_COMPREHENSION`;
- instructional remediation may proceed;
- post-remediation success becomes `INSTRUCTIONALLY_RESOLVED_NOT_CERTIFYING`;
- after remediation, begin a **new** comprehension readiness cycle on a fresh unseen matched PRIMARY form;
- do not promote a replacement question on the original passage into certification evidence.

### If CONFIRMATION comprehension misses

- record `DISCORDANT_COMPREHENSION`;
- the earlier PRIMARY pass remains historical evidence but does not certify readiness;
- provide targeted comprehension remediation;
- start a new two-form comprehension cycle using fresh matched forms.

### Technical invalidity

Use `REASSESS_COMPREHENSION_TECHNICAL` for app/audio/display interruption, corrupted question rendering, invalid keyed answer, or an EQUIV-2.1 form failure.

Technical invalidity does not count as learner failure and does not trigger instructional remediation unless a genuine learning need is separately observed.

### Status ontology

`COMP_PRIMARY_PENDING; COMP_PRIMARY_PASS; COMP_CONFIRMATION_PENDING; COMPREHENSION_CONFIRMED; INSTRUCTIONALLY_RESOLVED_NOT_CERTIFYING; NOT_YET_COMPREHENSION; DISCORDANT_COMPREHENSION; REASSESS_COMPREHENSION_TECHNICAL; INVALID_COMPREHENSION_FORM`

Only:

`COMPREHENSION_CONFIRMED`

counts toward the final Band-A comprehension gate.

### Final comprehension readiness condition

Band-A comprehension readiness = all 15 P10 comprehension cycles COMPREHENSION_CONFIRMED. Post-remediation mastery on the same passage/replacement item may unlock continued teaching but cannot satisfy this final readiness condition.

Formally:

`BAND_A_COMPREHENSION_READY = all_15_P10_comprehension_cycles_COMPREHENSION_CONFIRMED`

The existing phrase `BAND_A_COMPREHENSION_READY` is deprecated for readiness because it cannot distinguish coached resolution from independent mastery.

### Evidence storage

For every P10 comprehension attempt store at minimum:

- form-family ID and form role (`PRIMARY` / `CONFIRMATION`);
- blueprint ID/version;
- four first-attempt responses;
- designated primary-skill item;
- first-attempt score;
- whether standard passage review was used;
- whether any hint/remediation/feedback occurred before scoring;
- independent status;
- post-remediation instructional status separately;
- EQUIV-2.1 validation/version;
- timestamp and cycle ID.

### Scope boundary

This correction establishes **valid independent mastery evidence**.

It does not yet prove that the final P10 set samples every comprehension dimension with sufficient frequency and balance. That remains BA-QA-012.


## Oral-reading scoring specification OS-1.0 — normative

The telemetry names are not sufficient on their own. This section defines how a recording becomes scores.

**Determinism rule:** given the same validated passage text, the same validated audio/alignment evidence, the same scoring-version configuration and the same approved lexical-equivalence table, implementations must produce the same event counts and metric values.

### OS1 — Expected text, tokenization and alignment

- Score against the **learner-visible passage words in order**.
- Normalize case and typographic apostrophes for lexical matching.
- Keep punctuation as separate metadata; punctuation is not a lexical token.
- Use word-level sequence alignment between expected words and spoken **lexical** tokens.
- Filled pauses such as “um” and “uh” are not insertions; they contribute to hesitation timing.
- Any approved lexical equivalence/pronunciation normalization must be declared before scoring that passage.
- An unresolved low-confidence ASR mismatch is **not** automatically a child error.

### OS2 — Accuracy

Let:

- `N` = assessable expected words;
- `FP_correct` = expected words correct on the first lexical attempt;
- `FINAL_correct` = expected words correct after accepted self-corrections.

Then:

`first_pass_accuracy = FP_correct / N`

`final_accuracy = FINAL_correct / N`

A word that is initially misread and then accepted-self-corrected:

- remains **incorrect** for `first_pass_accuracy`;
- becomes **correct** for `final_accuracy`;
- remains recorded as one first-pass error;
- is additionally recorded as one self-correction event.

An unresolved ASR token is excluded from both numerator and denominator until resolved.

### OS3 — Error-event definitions

**Substitution:** the first lexical attempt aligned to an expected token is a different word and is not an approved equivalent.

**Omission:** an expected token receives no lexical attempt before the learner progresses beyond that token in the alignment.

**Insertion:** an extra lexical word is spoken that cannot be aligned to an expected token.

**Repetition:** an already-read expected word or phrase is spoken again without textual need.

A repetition used solely to make an accepted self-correction is **not** counted as an unnecessary repetition.

### OS4 — Accepted self-correction

A self-correction is accepted when all are true:

1. the learner first makes a confirmed substitution or omission;
2. no app prompt supplies the correction;
3. the learner produces the intended expected word within **5.0 seconds** of the first erroneous attempt;
4. the learner has not progressed more than **2 expected words beyond** the target.

Record `correction_latency_seconds`.

The general 5-second rule determines whether the correction is accepted for `final_accuracy`. An RS such as RS07 may impose a **stricter** P-level performance requirement, for example correction within 3 seconds.

### OS5 — Long hesitation

A **long hesitation** is a non-punctuation silence of **more than 2.0 seconds** between assessable lexical events while the learner has not intentionally stopped.

Measure from:

`offset(previous spoken lexical token) → onset(next spoken lexical token)`

Exclude:

- valid punctuation pauses;
- app/system narration;
- microphone dropout or invalid audio;
- unresolved ASR-only gaps.

Filled pauses such as “um/uh” extend the hesitation interval but are not insertions.

### OS6 — Full restart

A **full restart** occurs when:

1. the learner has already progressed at least **3 expected words into the current sentence**; and
2. without an app prompt, the learner returns to the **first expected word of that sentence or any earlier sentence**; and
3. the alignment therefore jumps backwards by at least **3 expected tokens**.

Repeating/correcting only 1–2 expected words is a local repetition/self-correction, not a full restart.

### OS7 — Punctuation handling

#### Terminal punctuation

Eligible marks: `. ? !`

A terminal boundary is compliant when:

- pause from final-word offset to next-word onset is **0.150–1.800 seconds**; and
- the next sentence begins without a boundary-linked omitted first word.

`terminal_compliance = compliant eligible terminal marks / eligible terminal marks`

#### Internal punctuation

Eligible marks are primarily comma, colon and semicolon when writer-tagged as natural pause opportunities.

An internal mark is compliant when:

- pause is **0.080–0.900 seconds**; and
- reading continues within the same sentence without a punctuation-triggered full restart.

`internal_compliance = compliant eligible internal marks / eligible internal marks`

Exclude abbreviations, quotation-edge punctuation and any mark pre-tagged by the writer as non-pause-eligible.

### OS8 — Challenge/unfamiliar-word recovery

Compute recovery only for **writer-tagged recovery targets**.

`recovery_time_seconds` begins at onset of the learner's first attempt at the target and ends at offset of the first accepted correct production.

A target counts as recovered when:

1. the word becomes correct or accepted-self-corrected within the assigned RS/P time limit;
2. the following **5 expected words** contain no more than the sequence-error allowance for that RS/P;
3. there is no target-triggered full restart.

If the target is omitted without any attempt, recovery fails.

If ASR remains unresolved on the target, status is **REASSESS**, not FAIL.

### OS9 — Reading time and WPM

Reading time starts at onset of the first assessable passage word and ends at offset of the final assessable expected word reached.

Include genuine:

- hesitations;
- repetitions;
- self-corrections;
- restarts.

Exclude:

- app/system prompts;
- invalid recording gaps.

Primary pace metric:

`text_WPM = expected passage words successfully progressed through / active elapsed reading minutes`

Do **not** use total spoken-token count because repetitions and insertions must not inflate WPM.

### OS10 — ASR and accent safeguard

ASR is evidence, not ground truth.

- Accent variation by itself is never an error.
- A lexical mismatch may be auto-scored as a child error only when the deployed recognizer classifies the mismatch at or above its frozen, calibrated `HIGH_CONFIDENCE` threshold and no approved lexical/pronunciation equivalent applies.
- Lower-confidence mismatches are `UNRESOLVED`.
- `UNRESOLVED` tokens are excluded from scored denominators until a secondary recognition pass or replay resolves them.
- The deployed ASR engine, model version and `HIGH_CONFIDENCE` threshold are part of the scoring-version configuration. Changing any of them creates a new scoring version and requires regression validation.

### OS11 — Sample validity

A metric may be scored only when enough eligible evidence exists.

If microphone dropout, clipping, overlapping speech, system narration or unresolved ASR makes **more than 10% of expected words unassessable**, the sample is `INVALID` for readiness scoring and must be reassessed.

For RS metrics requiring a minimum number of tagged opportunities, insufficient valid opportunities yields **REASSESS**, never PASS or FAIL.

### OS12 — Mandatory scoring pipeline order

Every implementation must use this order:

1. Validate recording/sample.
2. Tokenize/normalize expected text.
3. Align spoken lexical events to expected words.
4. Classify substitution, omission, insertion and repetition events.
5. Identify accepted self-corrections.
6. Compute first-pass and final accuracy.
7. Compute time/WPM, hesitation, restart, punctuation and recovery metrics.
8. Apply the assigned RS/P success rule.
9. Apply ASR uncertainty and `REASSESS` rules before readiness/progress decisions.

### Operational invariance examples

- Misread → correct within 2 seconds: **first-pass wrong, final correct, one self-correction**.
- Misread → correct after 7 seconds: **not an accepted self-correction under OS4**; final accuracy remains wrong unless a later formal reassessment occurs.
- “Um” during a 2.6-second stall: **long hesitation**, not lexical insertion.
- Repeating two words to repair a local misread: **local correction/repetition**, not full restart.
- Returning from word 9 to the start of the sentence after already reading 6 words of that sentence: **full restart**.
- Low-confidence ASR mismatch on a clearly spoken word: **UNRESOLVED/REASSESS path**, not automatic child error.


## Personal baselines and checkpoints — statistically valid self-comparison

### Frozen baseline rule

There is **no single global oral-reading baseline at Session 1**.

Delivery Sessions **001–015** are the baseline-acquisition window:

| Session | RS baseline captured |
|---:|---|
| 001 | RS01-P1 |
| 002 | RS02-P1 |
| 003 | RS03-P1 |
| 004 | RS04-P1 |
| 005 | RS05-P1 |
| 006 | RS06-P1 |
| 007 | RS07-P1 |
| 008 | RS08-P1 |
| 009 | RS09-P1 |
| 010 | RS10-P1 |
| 011 | RS11-P1 |
| 012 | RS12-P1 |
| 013 | RS13-P1 |
| 014 | RS14-P1 |
| 015 | RS15-P1 |

Every later oral-progress statement must compare **like with like**:

`RSx-P1 → RSx-P2 → ... → RSx-P10`

A raw score from RS01 may never be used as the baseline for RS06, RS10, or any other competency.

### Child-facing progress rule

The default progress view is **15 competency timelines**, not one global improvement percentage.

Examples:

- RS01 word-recognition accuracy: **91% → 95%**
- RS06 long hesitations: **7 → 3**
- RS08 unnecessary repeats/restarts: **6 → 2**
- RS11 pace spread: **0.42 → 0.28**

These are all valid self-comparisons because the metric remains inside the same competency track.

### Optional normalized composite

A composite is allowed only at a **complete round boundary**, when all 15 RS tracks have reached the same P level.

For each RS:

1. take that RS's own P1 baseline;
2. measure its current distance from the same RS's P10 target;
3. calculate target-gap closure using only that RS's native metric(s);
4. if the learner already met the target at P1, mark **baseline mastery** rather than manufacturing an improvement percentage;
5. combine required metrics inside that RS;
6. only then combine the 15 normalized RS values.

**Never average raw heterogeneous metrics across RS tracks.**

### Formal checkpoints

| Session/window | Passage encountered | Checkpoint | Valid comparison |
|---:|---:|---|---|
| 001–015 | P1 of RS01–RS15 | **CP0 — 15-competency baseline window** | Capture one independent baseline for every RS; no cross-RS comparison. |
| 030 | 142 | **CP1 — Full-round P2** | RS01-P2→RS01-P1, ..., RS15-P2→RS15-P1. |
| 060 | 144 | **CP2 — Full-round P4** | Each RSx-P4→its own P1 baseline and P3 prior sample. |
| 090 | 146 | **CP3 — Full-round P6** | Each RSx-P6→its own P1 baseline and P5 prior sample. |
| 100 | 097 | **M100 — Confidence milestone** | RS01–RS10 P7→their own P1 baselines only. This is a **partial 10-RS snapshot**, so no 15-RS overall percentage. |
| 120 | 148 | **CP4 — Full-round P8** | Each RSx-P8→its own P1 baseline and P7 prior sample. |
| 150 | 150 | **CP5 — Complete 15-RS Band-A readiness decision** | Sessions 136–150 collectively provide RS01-P10…RS15-P10. Every RS must resolve before advancement. |

The app may update each RS competency card whenever that RS is encountered; formal checkpoints simply create larger learner/parent milestones.

## Oral-reading telemetry and ASR safeguards
Capture expected words, aligned-correct words, substitutions, omissions, insertions, repeated words, self-corrections, long hesitations, full restarts, completion time, WPM, punctuation handling and unfamiliar-word recovery. Interpret a metric only against the **same RS competency's own P1 baseline and previous same-RS sample**. Cross-RS raw comparisons are prohibited.

- Low-confidence ASR tokens do not automatically become child errors.
- Accept expected words when supported by a plausible alternate ASR hypothesis or pronunciation match.
- If three or more consecutive words are ASR-uncertain, mark that segment unscored and retry only the short segment.
- Poor recording quality triggers a clean retry, not a low learner rating.
- Legitimate English accents, including Indian accents, are never pronunciation failures by themselves.
- Prompt self-correction is recorded as self-corrected, not as an uncorrected substitution.

## Passage 150 transition rule
Delivery Session 150 encounters Passage 150 and closes **World 1 Band A (100-word passages)**. Passage 151 begins the 200-word band and still presents **one word at a time**.

Band-A readiness is based on **all 15 RS competency tracks at P10 across Sessions 136–150**, each evaluated against its own RSx-P1 baseline and P10 success rule, plus independently confirmed P10 comprehension readiness. The complete P10 round, Sessions 136–150, is the final readiness evidence set; same-RS histories provide supporting trend evidence. Pace comparisons remain within RS and against the learner’s own history.

## Personal-progress validity regression gate

v0.6 fails QA if any progress report:

1. uses Session 001 as a global baseline for RS02–RS15;
2. compares a raw metric from one RS with a different RS;
3. reports a single overall improvement percentage from heterogeneous raw RS metrics;
4. calls a partial round (for example Session 100, where only RS01–RS10 have reached P7) a complete 15-RS composite;
5. omits the RSx-P1 baseline reference from a later RSx-Pn comparison;
6. treats a learner who already met a P10 target at baseline as needing artificial numerical “improvement.”

The canonical comparison is always **same learner + same RS competency + later P level**.

## Band-A oral-readiness signals — self-contained normative summary

There is no hidden or inherited oral-readiness list outside this file. The final 100-word-band oral decision is the complete set of **RS01-P10 through RS15-P10 success rules** defined above.

For implementation clarity, the P10 thresholds are reproduced here:

| RS | P10 readiness signal |
|---|---|
| RS01 | `final_accuracy ≥97%` and `first_pass_accuracy ≥95%` |
| RS02 | `sequence_errors ≤2` and no skip of 2+ consecutive expected words |
| RS03 | `function_word_accuracy ≥98%` with no repeated omission pattern |
| RS04 | `ending_accuracy ≥95%` across at least 8 tagged inflected words |
| RS05 | ≥90% tagged longer words finally correct; median target hesitation ≤3 s; no target-caused full-sentence restart |
| RS06 | ≤3 non-punctuation hesitations >2 s; no unexplained silence >6 s |
| RS07 | DIRECT_REPAIR: ≥3 eligible natural errors in the recent RS07 window, ≥80% timely repair within 3 s, ≤1 correction-triggered full restart, ≤1 uncorrected eligible error. If <3 errors occur, CLEAN_READING requires ≥3 valid recent RS07 samples including P10, ≥300 assessable words, first-pass accuracy ≥99%, zero uncorrected eligible errors and zero correction-triggered full restarts. |
| RS08 | ≤2 unnecessary repeat events and ≤1 full restart per 100 words |
| RS09 | sentence-boundary compliance ≥85% and zero boundary-linked omitted first words |
| RS10 | internal-punctuation compliance ≥80% and zero punctuation-triggered full restarts |
| RS11 | `pace_spread ≤0.25` and no quartile >35% slower than passage median |
| RS12 | ≥80% challenge words correct/self-corrected within 4 s and ≤1 sequence error in following five words |
| RS13 | middle-third accuracy within 2 percentage points of first-third; no 2+ word skip; no unexplained silence >6 s |
| RS14 | final-third accuracy within 2 percentage points of first-third and final-third WPM no more than 15% below first-third |
| RS15 | `final_accuracy ≥95%`, `sequence_errors ≤2`, long hesitations ≤4, full restarts ≤1 and `pace_spread ≤0.25` |

These thresholds are **all mandatory within their own competencies**. Strong performance in one RS cannot cancel a miss in another RS.


## RS07 evidence-validity rule — historical in v0.15 — non-normative

The previous rule “no eligible error occurred, therefore RS07 succeeds” is prohibited.

RS07 is now **Error monitoring & efficient repair**.

RS07 readiness cannot be assigned from a single no-error P10 passage. Use a recent same-RS evidence window under the same scoring version. Direct self-correction is demonstrated only when ≥3 eligible natural errors support the repair-rate calculation. If fewer opportunities occur, a separate clean-reading readiness pathway requires ≥3 valid recent RS07 samples including P10 and ≥300 assessable words. Do not deliberately induce errors.

### RS07 readiness pathways

**A. `DIRECT_REPAIR`**

Use when the recent RS07 evidence window contains **at least 3 eligible natural errors**.

Requirements under the current provisional P10 rule:

- ≥80% of eligible errors self-corrected within 3 seconds;
- ≤1 correction-triggered full restart;
- ≤1 eligible error remains uncorrected.

Passing state: `READY_REPAIR_DEMONSTRATED`.

This is the only state that may be described as **directly demonstrating self-correction behaviour**.

**B. `CLEAN_READING`**

Use only when the recent evidence window contains **fewer than 3 eligible natural errors**.

Requirements:

- at least 3 valid recent RS07 samples;
- P10 must be one of those samples;
- at least 300 assessable words total;
- all samples scored under the same compatible scoring version;
- recent aggregate first-pass accuracy ≥99%;
- zero uncorrected eligible errors;
- zero correction-triggered full restarts.

Passing state: `READY_CLEAN_READING_EVIDENCE`.

This means the learner has demonstrated practical Band-A error-control reliability over sufficient recent exposure. It **must not** be described as direct evidence that self-correction ability was observed.

### Insufficient or negative evidence

- Too few valid samples / assessable words for either pathway → `REASSESS_RS07_EVIDENCE`.
- Sufficient valid error opportunities but repair criterion missed → `NOT_YET`.
- Any uncorrected eligible error in the CLEAN_READING pathway → `NOT_YET`.
- A single P10 sample with zero errors → **never READY by itself**.

### No manufactured errors

The application, passage writer and assessor must not insert deliberate traps, mispronunciation prompts, confusing text, or induced mistakes merely to create RS07 evidence.


## P10 confirmation and reassessment validity — historical in v0.15 — non-normative

The previous model allowed one valid P10 passage—or the latest reassessment—to become decisive. That permits a readiness decision to be influenced by passage luck, transient performance, or repeated testing until one passing sample appears.

v0.13 replaces that model with **confirmed matched-form evidence**.

### 1. Two-form readiness cycle

Every RS01–RS15 uses a readiness cycle:

`PRIMARY → CONFIRMATION`

Rules:

1. `PRIMARY` is a fresh unseen P10 form for that RS.
2. If `PRIMARY` is technically invalid, replace it with a fresh matched form; technical invalidity does not count as a valid attempt.
3. If `PRIMARY` validly misses any mandatory criterion, the cycle ends as `NOT_YET`; do not administer a confirmation merely to search for a pass.
4. If `PRIMARY` validly passes, administer a fresh matched `CONFIRMATION`.
5. Between a passing PRIMARY and CONFIRMATION, provide only neutral encouragement. Do **not** provide:
   - targeted coaching;
   - hints;
   - item-by-item error disclosure;
   - score/threshold disclosure;
   - extra practice for that RS.
6. If CONFIRMATION also passes, set `readiness_state = CONFIRMED_READY`.
7. If CONFIRMATION validly fails, the cycle becomes `DISCORDANT_NOT_YET`.
8. `CONFIRMED_READY` is the only initial generic readiness state that can close the RS requirement; progress descriptors never close readiness.

This rule applies to both provisional pilot progression and later production-approved thresholds.

### 2. Matched-form equivalence — EQUIV-2.1

Every PRIMARY, CONFIRMATION and REVALIDATION form must satisfy the complete `EQUIV-2.1` contract embedded later in this specification.

A form that fails a hard invariant or RS-specific tolerance is `INVALID_FORM` and contributes no learner readiness evidence.

### 3. Form-family rule

Each RS P10 assessment belongs to a versioned form family:

`W1_BANDA_RSxx_P10_EQUIV_vN`

The family freezes:

- RS and P level;
- OS scoring version;
- P10 threshold version;
- prose mode/genre;
- lexical-difficulty band;
- sentence-length envelope;
- RS-specific tagged opportunity counts;
- punctuation opportunity envelope where relevant;
- target distribution by passage thirds;
- comprehension level;
- safety/accessibility constraints.

A new form may be generated dynamically, but it must pass the family equivalence validator **before** use.

### 4. Attempt and retry policy — ATTEMPT-1.0

ATTEMPT-1.0: A readiness cycle is PRIMARY→CONFIRMATION. A valid failure ends that cycle. A new cycle may begin only after an intervening targeted learning block for that RS. After two consecutive failed/discordant valid cycles, set DIAGNOSTIC_HOLD and require at least two targeted non-readiness practice passages plus a documented diagnostic review before another readiness cycle. There is no unlimited back-to-back retry loop. Genuine later learning may reopen assessment after the required learning block.

A valid readiness cycle is therefore not an arbitrary sequence of attempts. It is a bounded assessment event separated from later cycles by genuine learning.

### 5. No cherry-picking

The readiness engine must retain every valid assessment-cycle outcome.

Forbidden:

- ignoring an earlier valid failure because a later form passed;
- selecting the best two passes from many attempts;
- deleting discordant evidence from the decision history;
- administering repeated confirmation forms until one passes;
- reusing a previously seen readiness form.

The **latest complete valid cycle after the required learning block** controls current readiness.

### 6. Technical invalidity versus learner failure

`REASSESS_TECHNICAL` applies only to evidence failures such as:

- microphone/audio corruption;
- unresolved ASR beyond allowed validity limits;
- insufficient required tagged opportunities because the form itself is defective;
- app interruption;
- equivalence-validator failure.

Technical invalidity does not trigger learner remediation and does not count as a failed readiness cycle.

### 7. RS07 interaction

RS07 retains its v0.12 `DIRECT_REPAIR` / `CLEAN_READING` evidence semantics.

The v0.13 confirmation rule is additional:

- the PRIMARY RS07 evaluation must satisfy one valid RS07 evidence pathway;
- the matched CONFIRMATION must preserve that readiness conclusion under fresh evidence;
- `READY_REPAIR_DEMONSTRATED` and `READY_CLEAN_READING_EVIDENCE` remain semantically distinct;
- a confirmation form may not manufacture an error merely to force the DIRECT_REPAIR pathway.

### 8. Overall Band-A consequence

The 15-element readiness vector now resolves an RS only when:

`RS_status = CONFIRMED_READY`

with RS07 carrying its evidence-path subtype.

Therefore:

`PILOT_BAND_B_TRIAL_ELIGIBLE = all_15_RS_CONFIRMED_READY AND BAND_A_COMPREHENSION_READY`

and, after threshold calibration:

`PRODUCTION_BAND_A_READY = all_15_thresholds_PRODUCTION_APPROVED AND all_15_RS_CONFIRMED_READY AND BAND_A_COMPREHENSION_READY`

A one-form pass is **provisional evidence**, not final RS readiness.


## Historical equivalence-model note — non-normative

Earlier development versions used `MFORM-1.1` and `EQUIV-2.1`. They are preserved only in historical changelogs/audit files.

They are **not normative dependencies** for v0.21 and must not be consulted to implement the current band.

## Minimum evidence sufficiency — EVIDENCE-MIN-1.2 — normative in v0.23

Readiness percentages, rates and comparisons are scoreable only when enough valid evidence exists.

### General sufficiency rule

`EVIDENCE_SUFFICIENT = denominator_minimum_met AND subsection_coverage_met AND sample_validity_met`

If `EVIDENCE_SUFFICIENT = FALSE`:

- do not assign `READY`;
- do not assign `NOT_YET` solely from the underpowered sample;
- use `INSUFFICIENT_EVIDENCE` or `REASSESS_TECHNICAL` depending on cause;
- obtain a fresh valid matched form/sample.

### Form-design shortfall versus runtime shortfall

If a writer-controlled P10 form contains fewer required opportunities than the absolute minimum:

`INVALID_FORM`

before learner exposure.

If the form is structurally valid but ASR/audio uncertainty reduces the assessable denominator below minimum:

`INSUFFICIENT_EVIDENCE / REASSESS_TECHNICAL`

This is not learner failure.

### Complete RS01–RS15 minimum evidence table

| RS | Minimum assessable evidence | Subsection/opportunity requirement |
|---|---|---|
| RS01 | 90 assessable words | N/A |
| RS02 | 90 assessable words | At least 28 assessable words in each of the three passage thirds |
| RS03 | 90 assessable words; 20 tagged function words | At least 5 tagged function words in each passage half |
| RS04 | 90 assessable words; 8 tagged inflected words | At least 2 tagged targets in each passage third where feasible |
| RS05 | 90 assessable words; 10 tagged 2–4 syllable targets | Exactly 10 planned targets; 3/3/4 across passage thirds in any order |
| RS06 | 90 assessable words; Continuous-timing sample | At least 28 assessable words in each passage third |
| RS07 | 90 assessable words; DIRECT: ≥3 eligible natural errors; CLEAN: ≥3 valid samples and ≥300 assessable words | See RS07 evidence pathway |
| RS08 | 90 assessable words; Continuous whole-passage sample | At least 28 assessable words in each of the three passage thirds |
| RS09 | 90 assessable words; 6 eligible terminal boundaries | At least 1 eligible boundary in each passage third |
| RS10 | 90 assessable words; 5 eligible internal punctuation marks | At least 1 eligible internal mark in first and second halves |
| RS11 | 90 assessable words; 4 valid quartiles | At least 22 assessable words per quartile |
| RS12 | 90 assessable words; 5 tagged challenge words | Exactly 5 planned targets; at least 1 per third and no more than 2 per third |
| RS13 | 90 assessable words; First-third + middle-third comparison | At least 28 assessable words in first third and 28 in middle third |
| RS14 | 90 assessable words; First-third + final-third comparison | At least 28 assessable words in first third and 28 in final third |
| RS15 | 90 assessable words; Integrated valid sample | At least 22 assessable words per quartile |

### Deterministic third-coverage rule for RS02 and RS08 — BA-QA-016

For RS02 and RS08, **“coverage across all thirds” means quantitatively**:

- total assessable words: `>= 90`
- first third assessable words: `>= 28`
- middle third assessable words: `>= 28`
- final third assessable words: `>= 28`

Formally:

`THIRDS_SUFFICIENT = first_third >= 28 AND middle_third >= 28 AND final_third >= 28`

`EVIDENCE_SUFFICIENT_RS02_RS08 = total_assessable_words >= 90 AND THIRDS_SUFFICIENT`

A sample with 90+ total assessable words but fewer than 28 assessable words in any one third is not scoreable for RS02/RS08 readiness.

### Why 28 words per third

This uses the same deterministic local-evidence philosophy already applied to sibling position-sensitive RS tracks:

- RS06: ≥28 assessable words in each third;
- RS13: ≥28 in first and middle thirds;
- RS14: ≥28 in first and final thirds.

No new denominator family is introduced.

### Interaction with EQUIV-2.1

Equivalent forms must satisfy both:

1. EQUIV-2.1 relative matching; and
2. the absolute EVIDENCE-MIN-1.2 minimum.

Two equally underpowered forms are not acceptable merely because they match.

### Interaction with PRIMARY / CONFIRMATION / REVALIDATION

Every readiness form is independently scoreable only if its own evidence minimum is met.

A later form cannot rescue an underpowered earlier form by pooling denominators unless a specific RS rule explicitly defines pooling. RS07 is the only current special multi-sample pathway; RS05/RS12 explicitly prohibit cross-form pooling.

### Calibration status

`MINIMUM_EVIDENCE_STATUS = PROVISIONAL_PILOT`

The architecture is normative. Numeric minima may be recalibrated later, but ambiguity such as “some coverage in each third” is prohibited.


## RS10 punctuation-density feasibility — RS10-FEAS-1.0 — normative in v0.24

RS10 currently requires at least five assessable eligible internal-punctuation opportunities in a 100-word P10 passage.

That is **not inherently contradictory** with natural beginner prose, but it is a content-feasibility risk. The evidence denominator must not cause writers or generators to manufacture commas.

### Construction-before-measurement rule

The order is mandatory:

`natural prose draft → PG1–PG12 naturalness QA → punctuation frozen → opportunity count checked → five scoring tags assigned`

The scoring requirement may **not** drive punctuation insertion after the fact.

The P10 construction rule is:

> RS10 INTERNAL PUNCTUATION P10: write natural beginner prose first. Before RS10 scoring tags are assigned, the frozen learner-visible body must already contain at least 5 naturally justified eligible internal punctuation events (comma, semicolon or colon). Do not add punctuation solely to satisfy the denominator. After prose naturalness QA passes, tag exactly 5 eligible events as RS10 scoring opportunities. At least 2 tagged opportunities must occur in each 50-word half; the fifth may occur in either half. Additional natural internal punctuation may remain unscored.

### Eligible internal punctuation

For RS10, an eligible event is a comma, semicolon or colon inside the learner-visible 100-word body that:

1. is acceptable in ordinary edited prose;
2. serves a defensible grammatical/syntactic or natural prosodic function;
3. does not exist solely to create an RS10 measurement opportunity;
4. does not make the sentence materially harder or less natural for a beginner;
5. is not part of a punctuation-heavy construction otherwise rejected by PG3/PG4/PG9.

### Naturalness rejection rule

Each eligible event must serve a defensible grammatical/syntactic or natural prosodic function in ordinary edited beginner prose. Reject comma stuffing, run-on repair by serial commas, artificially fragmented clauses, punctuation inserted only for measurement, or sentences made less natural merely to create another opportunity.

A passage with five punctuation marks is **not automatically valid**. It must first be natural prose.

### Five scored opportunities, not forced five total marks

After prose is frozen and naturalness QA has passed:

- verify the body already contains **at least 5** eligible natural events;
- pre-tag **exactly 5** of those events as RS10 scored opportunities;
- place at least **2 tagged opportunities in each 50-word half**;
- the fifth may be in either half;
- additional naturally required punctuation may remain unscored.

This fixes the readiness denominator at five:

`4/5 = 80%`

without requiring a writer to delete natural punctuation or add artificial punctuation merely to hit an exact total count.

### Form validity

A P10 RS10 form is `INVALID_FORM` before learner exposure if:

- fewer than 5 naturally eligible events exist after prose freeze;
- any scored tag is attached to punctuation judged artificial/manipulative;
- the tagged distribution fails the 2+2 half-coverage rule;
- prose QA identifies comma stuffing or unnatural rhythm.

If a valid form has five pre-tagged opportunities but runtime ASR/audio uncertainty makes fewer than five assessable:

`INSUFFICIENT_EVIDENCE / REASSESS_TECHNICAL`

not learner failure.

### EQUIV-2.1 interaction

PRIMARY, CONFIRMATION and REVALIDATION forms must each contain exactly five **scored** RS10 opportunities.

Equivalent-form matching also considers the passage's total natural internal-punctuation load so one form cannot be materially more punctuation-dense than another.

### Feasibility pilot before production approval

Before RS10 form-family production approval, evaluate at least 20 independently produced P10 candidates. At least 16/20 (80%) must reach the natural ≥5-opportunity requirement on the first complete prose-QA pass without punctuation-only edits, and no BANK_APPROVED form may be accepted with punctuation manipulation. If more than 4/20 (20%) require punctuation-specific repair to reach five, or repeated prose QA identifies comma stuffing, set RS10_MINIMUM_RECALIBRATION_REVIEW before production approval.

The pilot tracks:

- `natural_opportunity_count_before_tagging`;
- `first_pass_natural_feasibility`;
- `punctuation_only_repair_required`;
- `comma_stuffing_reject`;
- `PG9_natural_rhythm_pass`;
- final BANK_APPROVED status.

### Recalibration decision

If the pilot fails the feasibility criterion:

`RS10_MINIMUM_RECALIBRATION_REVIEW`

The planner must reconsider one or more of:

- the five-opportunity minimum;
- the definition of an eligible event;
- the 100-word band design;
- RS10 evidence aggregation.

The team must **not** lower prose quality to preserve the number five.

### Production status

Until the feasibility pilot passes:

`RS10_EVIDENCE_MINIMUM_STATUS = PROVISIONAL_FEASIBILITY_CALIBRATION`

The RS10 family may be used for controlled pilot work but cannot be marked `PRODUCTION_APPROVED`.

Machine-readable mirror:

`SpeedReader_W1_BandA_RS10_Punctuation_Feasibility_v0.24.csv`


## Readiness-form supply architecture — FORM-SUPPLY-1.0 — normative in v0.22

This section defines where **CONFIRMATION, reassessment/new-cycle, REVALIDATION and TECHNICAL_REPLACEMENT** forms come from in production.

### Production source decision

v0.22 uses a **pre-generated, versioned, QA-approved form bank**.

Production readiness forms may be human-authored, offline-AI-assisted, offline-AI-generated, or hybrid-authored, but no generated draft may be delivered directly. All authoring/generation occurs offline before bank release.

**Runtime AI generation is not permitted.**

Runtime AI passage/question generation is PROHIBITED in v0.22. Runtime may only select an immutable BANK_APPROVED, version-compatible, learner-unseen form from the correct RS/P10 form family. If none exists, return FORM_BANK_EXHAUSTED; do not generate live and do not penalize the learner.

This decision is deliberate because runtime generation would materially change:

- safety risk;
- latency;
- reproducibility;
- auditability;
- QA ownership;
- content-version governance;
- cost behaviour;
- form-equivalence reliability.

A future runtime-generation architecture would require a separate canonical contract and must not be inferred from this specification.

### Form family and bank structure

Each RS01–RS15 P10 family has:

- **1 canonical PRIMARY** — the existing P10 passage in the 001–150 registry;
- at least **6 BANK_APPROVED alternate forms** before production release;
- therefore at least **7 approved forms per RS family** at launch.

`BANK_DEPTH_STATUS = PROVISIONAL_LAUNCH_CAPACITY`

The six alternate forms are not permanently typed as confirmation/reassessment/revalidation content. They are equivalent P10 forms in the same family and receive a runtime role only when selected.

Allowed runtime roles:

- `CONFIRMATION`
- `NEW_CYCLE_PRIMARY`
- `NEW_CYCLE_CONFIRMATION`
- `REVALIDATION`
- `TECHNICAL_REPLACEMENT`

A form must be **fresh/unseen for that learner**. The same approved bank form may be used by different learners.

### Offline creation pipeline

Every alternate form must pass this pipeline before becoming selectable:

`DRAFT_CREATED → STATIC_SCHEMA_PASS → PG1_PG12_PASS → FACT_SAFETY_PASS → QUIZ_UNAMBIGUITY_PASS → SPEECH_ASR_FAIRNESS_PASS → EVIDENCE_MIN_PASS → EQUIV_PASS → INDEPENDENT_FORM_QA_PASS → BANK_APPROVED`

The stages mean:

1. **DRAFT_CREATED** — human-authored, AI-assisted, offline-AI-generated, or hybrid draft exists.
2. **STATIC_SCHEMA_PASS** — identity, COUNT-100, tags, required fields and structural constraints are valid.
3. **PG1_PG12_PASS** — every prose-generation acceptance gate PG1–PG12 passes.
4. **FACT_SAFETY_PASS** — mandatory `GENERAL` plus every applicable content-specific factual/safety/cultural flag passes.
5. **QUIZ_UNAMBIGUITY_PASS** — all comprehension items have one defensible answer and satisfy their assigned dimension evidence.
6. **SPEECH_ASR_FAIRNESS_PASS** — no speech trap/accent unfairness and required tagging is valid.
7. **EVIDENCE_MIN_PASS** — the form satisfies EVIDENCE-MIN-1.2 and any exact RS opportunity count.
8. **EQUIV_PASS** — the form satisfies EQUIV-2.1 against the frozen family profile.
9. **INDEPENDENT_FORM_QA_PASS** — independent form QA signs off the complete learner-visible form and metadata.
10. **BANK_APPROVED** — form becomes immutable/selectable at runtime.

No learner may receive a form before `BANK_APPROVED`.

### Explicit mandatory QA gate

Before delivery, every form must satisfy:

> **PG1–PG12 + mandatory GENERAL + every applicable SCIENCE_FACT / CHILD_SAFETY / WILDLIFE_SAFETY / CHILD_MONEY / HEALTH_FACT / INDIA_CONTEXT gate.**

In addition, all of the following must pass:

- exact COUNT-100;
- one-word World 1 delivery compatibility;
- one-defensible-answer quiz validation;
- engagement minimum 5/6 with no zero dimension;
- EQUIV-2.1;
- EVIDENCE-MIN-1.2;
- COMP-COVERAGE-1.0 / assigned P10 blueprint;
- speech/ASR fairness;
- accessibility checks;
- applicable factual/cultural/safety verification.

“All normal gates” is therefore shorthand only; the explicit list above is normative.

### Runtime selection algorithm

When the readiness engine needs a non-canonical form:

1. determine `family_id`, required runtime role and compatible versions;
2. query forms where `status = BANK_APPROVED`;
3. exclude every `form_id` previously delivered to that learner;
4. exclude `SUSPENDED` or `RETIRED` forms;
5. require compatible spec/scoring/threshold/equivalence/evidence/comprehension versions;
6. select one eligible form using the product's deterministic/randomized bank-selection policy;
7. log the assignment before delivery;
8. lock the exact `form_id`, revision and content hash for that attempt.

No content is generated or edited after selection.

### Technical replacement

If a delivery is technically invalid:

- the failed delivery is not learner failure;
- select a **fresh learner-unseen BANK_APPROVED** equivalent form;
- role = `TECHNICAL_REPLACEMENT`;
- keep the invalid attempt in the audit log.

### Bank exhaustion

If no eligible learner-unseen approved form exists:

`FORM_BANK_EXHAUSTED`

Then:

- do not generate a passage live;
- do not reuse a form already seen by the learner;
- do not score the learner as NOT_YET;
- pause that readiness transaction;
- replenish the family offline through the full approval pipeline.

### Immutability and reproducibility

After `BANK_APPROVED`, the following are immutable for that form revision:

- passage body/title;
- quiz and keyed answers;
- RS tags/opportunity tags;
- factual/safety flags;
- scoring/equivalence metadata;
- comprehension blueprint;
- content hash.

Any learner-visible or scoring-relevant edit creates a **new form revision**, a new content hash and a new full approval cycle.

### Required provenance

Every bank form stores at minimum:

- `form_id`
- `form_revision`
- `family_id`
- authoring method (`HUMAN`, `OFFLINE_AI_ASSISTED`, `OFFLINE_AI_GENERATED`, `HYBRID`)
- human author/editor identity/reference
- AI provider/model/version when AI was used
- generation template/prompt version when AI was used
- canonical spec version
- OS/scoring version
- threshold version/status
- EQUIV version
- evidence-minimum version
- comprehension blueprint/version
- all PG/factual/safety gate outcomes
- independent QA reviewer/reference
- approval timestamp
- content hash
- lifecycle state

The final learner-facing form must be reproducible from the immutable approved artifact; reproducing the stochastic generation process itself is not required.

### Audit log

Every runtime assignment records:

- learner reference;
- form ID/revision/hash;
- family ID;
- runtime role;
- readiness cycle ID;
- selection timestamp;
- active spec/scoring/threshold versions;
- delivery/scoring outcome;
- invalidation or exhaustion reason when applicable.

### Bank lifecycle

Form states:

`DRAFT_CREATED; STATIC_SCHEMA_PASS; CONTENT_QA_HOLD; SAFETY_QA_HOLD; EQUIV_HOLD; INDEPENDENT_FORM_QA_HOLD; BANK_APPROVED; SUSPENDED; RETIRED`

A previously approved form becomes `SUSPENDED` when a material scoring/threshold/equivalence/safety change makes compatibility uncertain.

It becomes `RETIRED` when permanently withdrawn.

### Replenishment

Bank replenishment is an **offline content-production event**, not a learner-runtime event.

New forms pass the entire pipeline and are released under a bank revision. Existing learner attempt history continues to point to the exact historical form revision/hash used.

### Operational latency and cost

Learner runtime performs only:

`bank lookup → eligibility filter → form fetch → delivery`

No LLM generation is on the learner-critical path.

If AI is used to author forms, generation/review cost is incurred during offline content production, not per readiness request.

### Machine-readable mirror

`SpeedReader_W1_BandA_Form_Supply_v0.24.csv` is a non-normative machine-readable mirror of this section.


## Equivalent-form model EQUIV-2.1 — normative in v0.21

This section is the **complete normative equivalent-form contract** for World 1 Band A.

No older equivalence document, matrix, creator-validation file, or CSV is required to implement it.

### Governance and precedence

- Current normative model: `EQUIV-2.1` in **this v0.21 specification**.
- `SpeedReader_W1_BandA_Form_Equivalence_v0.22.csv` is a **machine-readable mirror only**.
- v0.14 `MFORM-1.1`, v0.15 `EQUIV-2.1`, and every later pre-v0.22 equivalence artifact are **historical/non-normative**.
- If an older artifact conflicts with v0.21, **v0.21 wins**.
- If the v0.21 CSV mirror conflicts with this Markdown specification, **this Markdown specification wins** and the CSV must be regenerated.
- A new canonical version must embed all still-valid equivalent-form rules again; it may not inherit them only by reference.

### Global hard invariants

Exact 100 COUNT-100 words; World1 one-word display; same RS; P10; same OS/scoring version; same threshold version/status; same comprehension level/blueprint class; all prose/safety/accessibility gates pass; fresh unseen content; no reused sentence; no copied sequence of 6+ consecutive learner-visible words.

### Content independence

Fresh unseen premise and title; same prose mode/genre; background-knowledge dependency tier equal; information-event count ±1; no reused sentence; no 6+ consecutive learner-visible words copied; no same solution/mystery/event sequence with names merely changed.

### Global matching envelope

Sentence count ±1; mean sentence length ±10%; maximum sentence length ±2 words; same lexical-difficulty band; stretch-word count ±1; proper-noun count ±1; dialogue proportion ±10 percentage points; target opportunity distribution by thirds preserved.

### Non-compensation

All HARD and RS_CRITICAL dimensions are non-compensatory. A strong match on one dimension cannot offset failure on another.

A candidate cannot compensate for a failed hard or RS-critical dimension by being stronger on another dimension.

### Candidate states

`PROFILE_PENDING; INVALID_FORM; STRUCTURAL_EQUIV_PASS`

`INVALID_FORM` is a content/form defect and never learner failure.

### Form-family lifecycle

`PROVISIONAL_STRUCTURAL → EMPIRICAL_REVIEW → PRODUCTION_APPROVED; SUSPENDED_RECALIBRATE on material measurement/generation changes.`

Pilot use:

STRUCTURAL_EQUIV_PASS forms may be used for controlled pilot readiness cycles.

Production use:

Production readiness may use this family only when family_status=PRODUCTION_APPROVED and the individual candidate also has STRUCTURAL_EQUIV_PASS.

Empirical validation requirement:

Counterbalanced/randomized matched-form pilot; native RS metric comparison; classification agreement around threshold; order-effect check; subgroup/device/accent review; predeclared acceptance bands before result inspection.

Recalibration triggers:

OS/ASR version change; threshold change; lexical/syntax generator change; tag-schema change; evidence of form-order effect, classification instability or systematic difficulty drift.

### Complete RS-specific equivalence tolerances

#### RS01 — Word-recognition accuracy

- **Form family:** `W1_BANDA_RS01_P10_EQUIV_v1`
- **RS-critical dimension:** Whole-passage accuracy exposure
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Assessable expected words equivalent by exact 100-word body; stretch ±1; 2–4 syllable words ±2; ASR-risk ±1.
- **Local-position equivalence:** Whole passage; no local difficulty spike > global envelope.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable expected words from the 100-word passage.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10E: D1; D6; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS02 — Sequential place-keeping

- **Form family:** `W1_BANDA_RS02_P10_EQUIV_v1`
- **RS-critical dimension:** Sequence/place-keeping opportunity
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Paragraph count exact; clause boundaries ±1; sentence transitions ±1; no list/navigation aid unique to a form.
- **Local-position equivalence:** Sequence transitions distributed across thirds within ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable expected words and valid alignment coverage across beginning, middle and final thirds.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10A: D1; D7; D6; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS03 — Function-word fidelity

- **Form family:** `W1_BANDA_RS03_P10_EQUIV_v1`
- **RS-critical dimension:** Function-word target density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Tagged function words total ±1; each tagged class ±1; function-word density difference ≤2 percentage points.
- **Local-position equivalence:** Per-third tagged function-word counts ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 20 assessable tagged function-word opportunities; passage/form validator must reject forms below target opportunity minimum.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10B: D2; D3; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS04 — Word-ending fidelity

- **Form family:** `W1_BANDA_RS04_P10_EQUIV_v1`
- **RS-critical dimension:** Inflection target density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Tagged inflected words total ±1 and ≥8; each morphological category count ±1.
- **Local-position equivalence:** Per-third inflection targets ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 8 assessable tagged inflected-word opportunities; existing P10 rule retains the 8-target minimum.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10C: D8; D1; D7; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS05 — Longer-word decoding

- **Form family:** `W1_BANDA_RS05_P10_EQUIV_v1`
- **RS-critical dimension:** Longer-word target difficulty
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Exactly 10 tagged longer-word targets in PRIMARY, CONFIRMATION and REVALIDATION; total count may not vary by ±1.
- **Local-position equivalence:** Use a 3/3/4 target distribution across passage thirds in any order; no clustering.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** Exactly 10 planned tagged longer-word targets; runtime readiness requires all 10 assessable.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10D: D2; D8; D3; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Each form independently supplies the complete RS05 denominator; no cross-form pooling.

#### RS06 — Hesitation control

- **Form family:** `W1_BANDA_RS06_P10_EQUIV_v1`
- **RS-critical dimension:** Hesitation-pressure density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Stretch ±1; longer words ±2; terminal marks ±1; internal marks ±1; ASR-risk ±1.
- **Local-position equivalence:** Each third: longer-word count ±1 and punctuation events ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words with valid timing coverage; each passage third must contribute at least 28 assessable words.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10E: D1; D6; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS07 — Error monitoring & efficient repair

- **Form family:** `W1_BANDA_RS07_P10_EQUIV_v1`
- **RS-critical dimension:** Natural-error environment
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** No forced-error targets. Stretch ±1; longer words ±2; clause boundaries ±1; ASR-risk ±1.
- **Local-position equivalence:** Each third within lexical/syntax envelope; errors themselves are not matched features.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** DIRECT_REPAIR denominator is at least 3 eligible natural errors. CLEAN_READING denominator is at least 3 valid recent RS07 samples and 300 assessable words.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10A: D1; D7; D6; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS08 — Repetition and restart control

- **Form family:** `W1_BANDA_RS08_P10_EQUIV_v1`
- **RS-critical dimension:** Repeat/restart pressure
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Clause boundaries ±1; internal punctuation ±1; max sentence length ±2; repeated lexical-pattern count ±1.
- **Local-position equivalence:** No single sentence/third with unique syntactic knot or repetitive phrase trap.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words with valid alignment across all thirds.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10B: D2; D3; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS09 — Sentence-boundary control

- **Form family:** `W1_BANDA_RS09_P10_EQUIV_v1`
- **RS-critical dimension:** Terminal-boundary density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Eligible terminal marks ±1; question marks ±1; exclamation marks ±1; no form below required minimum.
- **Local-position equivalence:** Boundary positions by thirds ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 6 assessable terminal-boundary opportunities; form validator rejects a P10 readiness form below 6.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10C: D8; D1; D7; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS10 — Internal-punctuation control

- **Form family:** `W1_BANDA_RS10_P10_EQUIV_v1`
- **RS-critical dimension:** Internal-punctuation density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Eligible internal marks ±1; commas ±1; colon+semicolon total ±1; no form below required minimum.
- **Local-position equivalence:** Internal marks by thirds ±1.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 5 assessable comma/colon/semicolon opportunities; 5 is the minimum that permits an 80% threshold to be represented without forcing perfection.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10D: D2; D8; D3; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS11 — Pace consistency

- **Form family:** `W1_BANDA_RS11_P10_EQUIV_v1`
- **RS-critical dimension:** Quartile pace load
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Each 25-word quartile: stretch ±1; long words ±1; punctuation ±1; mean token length ±7%.
- **Local-position equivalence:** All four quartiles matched independently; no quartile difficulty spike.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words and at least 22 assessable words in each of four quartiles.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10E: D1; D6; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS12 — Challenge-word recovery

- **Form family:** `W1_BANDA_RS12_P10_EQUIV_v1`
- **RS-critical dimension:** Challenge-word target density
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Exactly 5 tagged challenge-word targets in PRIMARY, CONFIRMATION and REVALIDATION; total count may not vary by ±1.
- **Local-position equivalence:** At least 1 challenge target per passage third, no more than 2 per third, no adjacent targets; match post-target windows.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** Exactly 5 planned tagged challenge-word targets; runtime readiness requires all 5 assessable.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10A: D1; D7; D6; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Each form independently supplies the complete RS12 denominator; no cross-form pooling.

#### RS13 — Mid-passage attention stability

- **Form family:** `W1_BANDA_RS13_P10_EQUIV_v1`
- **RS-critical dimension:** First-vs-middle local load
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** First and middle thirds: stretch ±1, long words ±1, punctuation ±1, mean token length ±7%.
- **Local-position equivalence:** Middle-minus-first difficulty delta differs from primary by no more than 1 tagged lexical event and 1 punctuation event.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words total; first and middle thirds each require at least 28 assessable words.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10B: D2; D3; D5; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS14 — Final-third stamina

- **Form family:** `W1_BANDA_RS14_P10_EQUIV_v1`
- **RS-critical dimension:** First-vs-final local load
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** First and final thirds: stretch ±1, long words ±1, punctuation ±1, mean token length ±7%.
- **Local-position equivalence:** Final-minus-first difficulty delta differs from primary by no more than 1 tagged lexical event and 1 punctuation event.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words total; first and final thirds each require at least 28 assessable words.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10C: D8; D1; D7; D4. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.

#### RS15 — Integrated one-word fluency

- **Form family:** `W1_BANDA_RS15_P10_EQUIV_v1`
- **RS-critical dimension:** Integrated target/load bundle
- **Vocabulary equivalence:** Same project lexical-difficulty band; stretch words ±1; 2–4-syllable words ±2; mean token length ±5%; proper nouns ±1; numerals/symbol tokens ±1; no unique high-risk pronunciation cluster.
- **Syntax equivalence:** Sentence count ±1; mean sentence length ±10%; max sentence length ±2 words; clause-boundary count ±1; subordinate-clause markers ±1; paragraph count equal; dialogue proportion ±10 percentage points.
- **Punctuation equivalence:** Terminal/internal punctuation opportunities must satisfy global ±1 matching and the RS-specific rule; punctuation type/distribution is critical for RS09/RS10 and local-load RS tracks.
- **Target-density equivalence:** Function words ±1; long words ±2; terminal ±1; internal ±1; stretch ±1; clause boundaries ±1; ASR-risk ±1.
- **Local-position equivalence:** Each quartile stretch ±1 and long words ±1; no local compensation.
- **Comprehension equivalence:** Same P10 mixed-mastery blueprint version; same question count; same required comprehension-dimension set; each scored item must have one defensible answer and comparable evidence distance; no form may rely on outside knowledge for the answer.
- **Speech/ASR fairness equivalence:** ASR-risk tagged token count ±1; difficult proper-name count ±1; no tongue-twister/minimal-pair/alliteration trap unique to one form; same audio/scoring configuration and accent-fairness rules.
- **Absolute minimum evidence:** At least 90 assessable words and at least 22 assessable words in each quartile; all component metrics must be scoreable.
- **Confirmation-dimension identity:** PRIMARY and CONFIRMATION both use Q10D: D2; D8; D3; D9. Dimension roles/item purposes remain identical; evidence and wording must be fresh.
- **Single-form evidence rule:** Use the canonical per-RS readiness/evidence rule in this specification.


## Band-A threshold lifecycle — historical in v0.15 — non-normative

The **RS competency architecture and measurement definitions are frozen independently from the numerical P10 cut-offs**.

All current RS01–RS15 P10 numerical cut-offs in this specification carry:

`THRESHOLD_STATUS = PROVISIONAL_PILOT`

A precise number is not automatically a validated production advancement standard.

### Threshold states

| State | Meaning | Permitted use |
|---|---|---|
| `PROVISIONAL_PILOT` | Plausible operational threshold selected for pilot use; not yet empirically validated as a hard production gate. | Coaching, diagnostics, remediation, pilot analysis, and controlled eligibility to **try** Band B. |
| `CALIBRATION_REVIEW` | Pilot evidence is being analysed against a predeclared calibration protocol. | Analysis only; cannot issue production certification. |
| `PRODUCTION_APPROVED` | The threshold has passed the frozen calibration protocol and explicit QA approval for the current scoring version. | May participate in the hard production Band-A gate. |
| `SUSPENDED_RECALIBRATE` | A material scoring/ASR/passage-generation change means prior validation can no longer be assumed equivalent. | Production readiness is suspended for that threshold until recalibrated. |

### Pilot progression versus production readiness

During pilot use:

`PILOT_BAND_B_TRIAL_ELIGIBLE = all_15_provisional_RS_criteria_met AND BAND_A_COMPREHENSION_READY AND BAND_A_EVIDENCE_CURRENT`

Production readiness requires:

`PRODUCTION_BAND_A_READY = all_15_thresholds_PRODUCTION_APPROVED AND all_15_RS_resolved_ready AND BAND_A_COMPREHENSION_READY AND BAND_A_EVIDENCE_CURRENT`

Passing a provisional threshold does **not** validate the threshold itself.

### Calibration requirement before production approval

Before any RS threshold becomes `PRODUCTION_APPROVED`, the calibration protocol must be frozen **before the calibration results are inspected** and must define:

1. scoring/ASR/version lock;
2. calibration sample and inclusion/exclusion plan;
3. at least two independently generated matched P10 forms;
4. equivalent-form decision-consistency analysis;
5. borderline-case expert review;
6. predictive check against early Band-B performance;
7. minimum valid opportunity/denominator requirements;
8. device/ASR/accent fairness review;
9. missing/invalid evidence and `REASSESS` policy;
10. predeclared acceptance tolerances;
11. threshold/version/QA approval record.

A threshold may not become `PRODUCTION_APPROVED` merely because its observed pilot pass rate appears reasonable.

### Recalibration triggers

Move an approved threshold to `SUSPENDED_RECALIBRATE` when a material change affects measurement meaning, including:

- oral-scoring semantics;
- ASR model or confidence handling;
- passage-generation difficulty;
- minimum tagged-opportunity requirements;
- microphone/audio processing;
- equivalent-form instability;
- evidence that threshold-passing learners systematically collapse in early Band B.

### Learner-facing wording during pilot

Use wording such as:

**“Ready to try the next 200-word level.”**

Do not imply a validated certification standard until the relevant thresholds are `PRODUCTION_APPROVED`.


## Band-A final readiness — complete 15-RS gate

### Canonical evidence set

The final 100-word-band readiness decision uses the **entire P10 round**:

**Delivery Sessions 136–150 = RS01-P10, RS02-P10, …, RS15-P10.**

This is the only final evidence set that represents the complete 15-competency reading architecture.

The final five sessions alone (RS11-P10…RS15-P10) are **not** a readiness sample and may never be used as a 3/5 graduation shortcut.

### Progress descriptors vs readiness states — STATE-SEP-1.0

v0.25 uses **three separate namespaces**:

1. `progress_descriptor`
2. `readiness_state`
3. `readiness_evidence_subtype`

They must never be stored in the same field or interpreted as interchangeable.

#### A. Progress descriptors — reporting only

Progress descriptors describe the learner's **trajectory within the same RS**. They never close Band-A readiness.

| Progress descriptor | Meaning |
|---|---|
| `BASELINE_ESTABLISHED` | Valid P1 baseline exists but did not already meet the eventual P10 target. |
| `BASELINE_MASTERY` | Valid P1 evidence already meets the eventual P10 target. This recognizes early strength without inventing an improvement requirement. |
| `IMPROVED_FROM_BASELINE` | Current same-RS metric improved from P1 under the metric's defined direction. |
| `STABLE_FROM_BASELINE` | Current same-RS metric is materially similar to baseline. |
| `REGRESSED_FROM_BASELINE` | Current same-RS metric is materially worse than baseline; this informs coaching but is not by itself a readiness decision. |
| `NO_OPPORTUNITY` | Required natural opportunity did not occur; currently most relevant to RS07. |
| `PROGRESS_EVIDENCE_INVALID` | A valid longitudinal comparison cannot be computed. |

`BASELINE_MASTERY_CONFIRMED` is **deprecated** as a readiness state.

Its only valid v0.25 interpretation is:

`progress_descriptor = BASELINE_MASTERY`

and independently:

`readiness_state = PRIMARY_PENDING`

until the learner completes the normal P10 cycle.

#### B. Readiness-cycle states — certification only

| Readiness state | Meaning |
|---|---|
| `PRIMARY_PENDING` | No valid current-cycle PRIMARY has passed. |
| `PRIMARY_PASS` | Fresh PRIMARY passed; provisional evidence only. |
| `CONFIRMATION_PENDING` | PRIMARY passed and a fresh matched CONFIRMATION is required. |
| `CONFIRMED_READY` | PRIMARY + CONFIRMATION both passed under compatible current rules. **This is the only state that initially closes generic RS readiness.** |
| `NOT_YET` | Valid PRIMARY failed; remediate before another cycle. |
| `DISCORDANT_NOT_YET` | PRIMARY passed but CONFIRMATION failed; remediate before another cycle. |
| `REASSESS_TECHNICAL` | Technical/ASR/scoring invalidity; not learner failure. |
| `INSUFFICIENT_EVIDENCE` | Required evidence denominator/opportunity minimum not met; not learner failure. |
| `INVALID_FORM` | The assessment form itself is invalid; not learner failure. |
| `DIAGNOSTIC_HOLD` | Repeated valid failed/discordant cycles require the defined diagnostic learning block. |
| `REVALIDATION_DUE` | Previously confirmed readiness is stale under RECENCY-1.0. |
| `REVALIDATION_PENDING` | Fresh persistence evidence is required. |
| `CURRENT_REVALIDATED` | Previously confirmed readiness passed recency revalidation and is current again. |
| `NOT_YET_AFTER_REVALIDATION` | Valid revalidation failed; remediate and rebuild a full two-form cycle. |
| `VERSION_INVALIDATED` | Earlier readiness evidence is incompatible with current measurement versions. |

#### C. RS07 evidence subtype — evidence semantics only

RS07's evidence-path distinction is stored separately:

- `REPAIR_DEMONSTRATED`
- `CLEAN_READING_EVIDENCE`

These are **not readiness states**.

Examples:

`readiness_state = CONFIRMED_READY; readiness_evidence_subtype = REPAIR_DEMONSTRATED`

or:

`readiness_state = CONFIRMED_READY; readiness_evidence_subtype = CLEAN_READING_EVIDENCE`

The subtype preserves what was actually observed while keeping one common readiness ontology.

#### Legacy-state mapping

| Legacy value | v0.25 mapping |
|---|---|
| `READY` | `PRIMARY_PASS` then `CONFIRMATION_PENDING`; never final readiness by itself |
| `BASELINE_MASTERY_CONFIRMED` | `progress_descriptor=BASELINE_MASTERY`; `readiness_state=PRIMARY_PENDING` |
| `REASSESS` | `REASSESS_TECHNICAL` or `INSUFFICIENT_EVIDENCE`, depending on cause |
| `NOT_YET` | `NOT_YET` |
| `READY_REPAIR_DEMONSTRATED` | `PRIMARY_PASS` + subtype `REPAIR_DEMONSTRATED`; after confirmation, `CONFIRMED_READY` + subtype |
| `READY_CLEAN_READING_EVIDENCE` | `PRIMARY_PASS` + subtype `CLEAN_READING_EVIDENCE`; after confirmation, `CONFIRMED_READY` + subtype |
| `REASSESS_RS07_EVIDENCE` | `INSUFFICIENT_EVIDENCE` or `REASSESS_TECHNICAL` |

#### Non-bypass invariant

For **every RS01–RS15**:

`BASELINE_MASTERY does not alter the readiness cycle`

and:

`CONFIRMED_READY requires a valid P10 PRIMARY pass + valid fresh matched P10 CONFIRMATION pass`

A learner who already performs at the P10 target during P1 may be reported as:

`progress_descriptor = BASELINE_MASTERY`

but still starts final readiness as:

`readiness_state = PRIMARY_PENDING`

No baseline descriptor, improvement score, target-gap closure value or historical success can substitute for the final confirmation cycle.

### RS07 subtype rule

For RS07, PRIMARY must first satisfy either the DIRECT_REPAIR or CLEAN_READING evidence pathway.

- DIRECT_REPAIR pass → `readiness_evidence_subtype = REPAIR_DEMONSTRATED`
- CLEAN_READING pass → `readiness_evidence_subtype = CLEAN_READING_EVIDENCE`

The fresh matched CONFIRMATION must independently preserve an allowed RS07 readiness conclusion under the canonical RS07 rules. Only then:

`readiness_state = CONFIRMED_READY`

with the evidence subtype stored separately.


### Band-A decision rule

For the learner-level result, all 15 competencies still require complete resolution.

**Pilot Band-B trial eligibility requires:**

1. all **15/15 RS competencies** meet the currently configured provisional P10 criteria;
2. no unresolved `REASSESS`;
3. no unresolved `NOT_YET`;
4. all 15 P10 comprehension cycles are `COMPREHENSION_CONFIRMED`.

**Production Band-A readiness additionally requires all 15 threshold sets to be `PRODUCTION_APPROVED`.**

There is deliberately **no partial-coverage shortcut** such as 3/5, 12/15, or an averaged score that can hide a weak competency.

### Remediation without punishment

Failing one competency does **not** mean repeating Sessions 136–150.

For each unresolved RS:

1. deliver targeted coaching for that RS behaviour;
2. present a fresh unseen **100-word** reassessment passage matched to the same RS measurement;
3. score it against the same RS success rule;
4. update only that RS readiness status.

Already-mastered RS competencies remain closed.

This preserves the Babysteps confidence philosophy while keeping the readiness decision mathematically and pedagogically complete.

### Why the full P10 round is required

The 15 RS tracks deliberately measure different behaviours: accuracy, place-keeping, function-word fidelity, endings, longer-word decoding, hesitations, self-correction, restarts, punctuation, pace stability, challenge-word recovery, attention stability, stamina and integrated fluency.

Therefore a learner cannot be declared ready for the 200-word band merely because the final few competencies happen to be strong. The final gate must represent the same complete competency architecture that the learner has trained throughout the band.

## Prose-generation acceptance gate — complete normative specification

The matrix defines **what** a passage must train. This gate defines whether the finished 100-word prose is acceptable.

A passage may not proceed to quiz/content freeze unless **every applicable gate below passes**.

### PG1 — Row/content fidelity

Preserve the row's:

- core premise;
- knowledge strand and strand goal;
- comprehension target;
- wisdom/trait intent;
- hook, midpoint pull and ending-payoff intent;
- setting/global-accessibility requirement;
- RS/P oral-reading objective;
- applicable factual/safety tags.

Creative realization is encouraged, but prose may not silently replace the learning objective merely to make writing easier.

### PG2 — One defensible answer + unambiguous comprehension path

Every scored quiz item must have **exactly one defensible keyed answer**.

The passage itself must provide the required evidence. The learner must not need outside knowledge, mind-reading, a culturally narrow assumption or a lucky guess.

P-level evidence requirements:

| P | Required evidence architecture |
|---:|---|
| P1 | One unmistakable central event/person/object/outcome stated explicitly; do not quiz a tiny incidental detail. |
| P2 | Clear three-step chronology; no flashback/order ambiguity. |
| P3 | One clear cause leading to one clear effect; avoid competing causes. |
| P4 | Strong textual clues make one next-event prediction clearly best; prediction is not arbitrary guessing. |
| P5 | Behaviour/context supports one primary feeling or motivation; avoid equally valid emotional interpretations. |
| P6 | Multiple details converge on one main idea; a colourful minor detail must not masquerade as the main idea. |
| P7 | At least two compatible textual clues support the inference; a second reasonable inference fails QA. |
| P8 | Target word meaning is recoverable from nearby context with at least two useful context cues. |
| P9 | Scenario constraints make one action/choice clearly safest, fairest or most reasonable under the stated facts; avoid opinion-only scoring. |
| P10 | Mixed mastery contains independently valid direct + reasoning evidence; every item separately meets uniqueness/evidence rules. |

### PG3 — Oral compatibility with the assigned RS/P microtarget

The text must actually permit the assigned oral behaviour to be observed **without artificially manufacturing errors**.

Minimum construction requirements:

| RS | Passage-construction requirement |
|---:|---|
| RS01 | Predominantly familiar, clearly pronounceable words; accuracy must not depend on rare names or orthographic oddities. |
| RS02 | Clean sequential prose; avoid adjacent near-identical phrases that artificially create skip/reorder errors. |
| RS03 | Natural spread of short function words so omissions/substitutions are observable. |
| RS04 | Include the P-level quantity of tagged plural/tense/progressive endings required by the registry; do not turn prose into a grammar drill. |
| RS05 | Include the registry's P-level number of intentional 2–4 syllable target words, context-supported and distributed. |
| RS06 | Normal beginner syntax/sentence length; do not create hesitations with obscure vocabulary or punctuation overload. |
| RS07 | Never plant deliberate traps to force self-correction. Observe genuine repair only after natural misreads; when opportunities are sparse, accumulate valid recent RS07 clean-reading exposure instead of inducing errors. |
| RS08 | Avoid unnecessary lexical/sentence repetition that artificially provokes rereading. |
| RS09 | Several clear sentence endings and clean next-sentence starts; no giant run-on sentence. |
| RS10 | P10: frozen prose must naturally contain at least 5 eligible internal punctuation events before scoring tags are assigned; after prose QA, tag exactly 5 for scoring, with at least 2 in each 50-word half. No comma stuffing or punctuation inserted solely for measurement. |
| RS11 | Difficulty distributed reasonably across all four quartiles; no single quarter receives nearly all hard words/dialogue. |
| RS12 | Include the registry's P-level number of gentle, tagged challenge words with strong context support; do not cluster them. |
| RS13 | Middle third must remain meaningful natural prose, not filler or a sudden vocabulary spike. |
| RS14 | Final-third lexical/syntactic demand remains broadly comparable to the opening; do not manipulate stamina through text difficulty. |
| RS15 | Balanced natural prose capable of sampling accuracy, sequence, hesitation, restart and pace together. |

The row-level CSV contains the exact P-specific construction instruction for the assigned RS/P cell.

### PG4 — Speech and accent fairness

A beginner must be able to read the passage aloud naturally.

Reject:

- tongue-twister construction;
- dense alliteration used as a challenge;
- repeated minimal-pair traps;
- unnatural consonant-cluster sequences;
- clusters of difficult names/proper nouns;
- wording selected mainly because ASR is likely to fail on it.

Accent variation is **not** a reading error and may not be intentionally tested.

### PG5 — Controlled stretch vocabulary

Most vocabulary must remain familiar or reasonably decodable for a beginner.

Stretch vocabulary must be:

- intentional;
- sparse;
- context-supported;
- appropriate to the assigned RS/P target;
- distributed rather than stacked.

Do not put several unfamiliar words in the same sentence. For RS05/RS12, the tagged targets are already the deliberate stretch; writers must not add gratuitous difficult words around them.

### PG6 — Wisdom stays mostly implicit

The registry may explicitly name a wisdom/trait target; the learner-facing passage normally should not.

Wisdom should emerge through:

- decisions;
- consequences;
- observation;
- relationships;
- discovery;
- humour;
- surprise;
- reflection implicit in events.

Avoid repetitive endings such as:

- “X learned that…”
- “X realised that…”
- “X understood that…”

unless explicit explanation is genuinely necessary for the passage concept.

A good passage may simply be delightful, fascinating or moving while the intended wisdom remains latent.

### PG7 — Nearby-duplicate control

Duplicate QA is performed in **actual delivery-session order**, not passage-ID order.

Within the previous/next **15 delivered sessions**:

- reject a near-duplicate core plot/event structure;
- a repeated wisdom trait is acceptable only with materially different conflict, setting and outcome;
- a repeated hook type is acceptable only when the experience/problem is clearly different;
- reject substantial duplication of the combined **plot + insight/lesson + hook/pull pattern**.

The goal is that the learner experiences genuine variety even though the internal curriculum is systematic.

### PG8 — First-100 confidence protection

Delivery Sessions **1–100** are confidence-first.

During those sessions, reject prose/quiz design that introduces:

- trick comprehension;
- humiliation/failure language;
- a sudden difficulty spike;
- dense unfamiliar vocabulary;
- an unnecessarily frightening or emotionally punishing scenario;
- punitive full rereads for a small error.

Beyond the current RS/P requirement, introduce at most **one primary gentle stretch** at a time.

The intended learner feeling remains:

**“I can do this, I understood it, and I want the next passage.”**

Sessions 101–150 may strengthen difficulty modestly, but remain beginner-friendly and gradual.

### PG9 — Exact 100 words without unnatural writing

The final learner-visible passage must be exactly **100 words** under the project word-count convention.

Exact count never permits:

- filler;
- clipped grammar;
- duplicate meaning;
- awkward connectors;
- unnatural dialogue;
- distorted scientific/safety wording;
- unnatural oral rhythm.

If a natural draft is not 100 words, restructure the passage rather than padding it.

### PG10 — Babysteps effortless-learning test

Every finished passage must satisfy all of the following:

1. A beginner can willingly start it.
2. The first few sentences establish a clear, easy-to-follow situation.
3. The passage contains genuine curiosity, emotion, humour, discovery, wonder, purpose or tension.
4. The child gains at least one useful idea, perspective, observation, behaviour or piece of knowledge.
5. Learning is embedded in the experience rather than delivered as a lecture.
6. Vocabulary stretches gently without breaking flow.
7. The quiz feels like demonstrating understanding, not sitting an exam.
8. Difficulty progression is subtle enough that the learner notices improvement more than difficulty.
9. The ending leaves satisfaction or desire to continue.
10. The passage is worth reading even if the reading exercise were removed.

### PG11 — Engagement gate

The existing engagement score remains mandatory:

- Hook 0–2
- Mid-passage curiosity/pull 0–2
- Ending payoff/forward desire 0–2

Minimum **5/6**, with **no zero component**.

### PG12 — Factual/safety/cultural gates

All applicable `GENERAL`, `SCIENCE_FACT`, `CHILD_SAFETY`, `WILDLIFE_SAFETY`, `CHILD_MONEY`, `HEALTH_FACT` and `INDIA_CONTEXT` gates defined below are cumulative with PG1–PG11.

### Prose freeze rule

A passage is `PROSE_READY` only when **PG1–PG12 all pass**.

A failure in any one gate returns the passage for revision. Word count, engagement score, quiz correctness or oral metrics cannot compensate for another failed gate.


## Engagement and factual/safety gates — complete normative definitions

### Engagement gate

Every finished passage is scored:

- **Hook:** 0–2
- **Mid-passage curiosity/pull:** 0–2
- **Ending payoff / satisfying close / forward desire:** 0–2

Passage prose must score **≥5/6** and may not score **0** in any dimension.

### Universal GENERAL gate — applies to all 150 passages

Every factual statement must be internally consistent with the premise and quiz. Every quiz item must have one defensible answer. Remove wording that permits multiple reasonable interpretations. Names, chronology, quantities, cause/effect and stated motivations must not contradict one another.

### `SCIENCE_FACT`

Verify every scientific claim against a reliable science reference before prose freeze. Separate what a child can observe from the explanation of why it happens. Do not turn an approximation into an absolute rule, and do not use a visually familiar but scientifically wrong label. Use age-appropriate language without changing the underlying science. If a claim cannot be stated accurately in beginner language, rewrite the premise.

### `CHILD_SAFETY`

Model conservative, age-appropriate behaviour. A child must not be encouraged to touch dangerous objects, enter traffic/rail areas, climb unsafe structures, handle unknown medicines/chemicals, use heat/electricity/sharp tools unsupervised, approach strangers for risky help, or conduct a hazardous experiment. Where adult judgment is needed, direct the child toward a trusted adult. The exciting outcome may never depend on copying unsafe behaviour.

### `WILDLIFE_SAFETY`

Do not model chasing, cornering, touching, feeding, carrying or treating an unknown, wild, frightened or injured animal. The safe default is distance, observation and trusted-adult/rescuer/veterinary help as appropriate. A child may help indirectly only when the behaviour is plainly safe. Affection must never be presented as making wildlife handling safe.

### `CHILD_MONEY`

Keep the lesson to age-appropriate ideas such as value, needs versus wants, saving, sharing resources, comparing simple choices and returning money that is not yours. Do not provide investment, credit, gambling, speculative, product-purchase or financial-account advice. Do not require a child to carry out risky transactions or interact with strangers unsafely. Check all amounts and arithmetic used in story or quiz.

### `HEALTH_FACT`

Verify nutrition, hygiene, sleep, exercise and body-related claims before prose freeze. Avoid diagnosis, treatment or medicine advice. Do not imply that one food, one habit or one short demonstration proves a broad health claim. Describe balanced habits rather than labelling a single food as universally “healthy.” Unknown medicine must be treated as **do not take/use; tell a trusted adult**.

### `INDIA_CONTEXT`

Keep the setting authentically Indian where intended but understandable to a learner outside India. Verify place, transport, civic, cultural and historical details. Do not present one region, language, religion, festival, food or family practice as universal to all India. Any unfamiliar local word must be understandable from context or briefly clarified without interrupting reading flow.

### Combined QA flags

When a row contains multiple QA flags, **all applicable gates are cumulative**. For example, `SCIENCE_FACT;CHILD_SAFETY` must pass both the science gate and the child-safety gate in addition to the universal GENERAL gate.

### Exact-word-count quality gate

Exactly **100 words** is necessary but never sufficient. A passage fails if word-count pressure creates filler, clipped grammar, unnatural connectors, distorted scientific/safety wording or awkward oral rhythm.

## Canonical self-containment regression gate

A future canonical version fails QA if:

1. any normative sentence requires consulting an earlier version;
2. any supporting CSV contains an implementation requirement that is absent from the canonical Markdown;
3. any supporting CSV is described as a co-equal normative authority;
4. any QA flag appears without its acceptance criteria in the same canonical Markdown;
5. any readiness/progression threshold is referenced but not defined;
6. any equivalent-form tolerance is referenced but not embedded in the same canonical Markdown;
7. any “as before,” “previously defined,” “retain earlier requirements,” or similar phrase carries normative meaning;
8. any of PG1–PG12 is absent or weakened without an explicit replacement;
9. any OS1–OS12 metric/event definition is absent, ambiguous, or redefined inconsistently;
10. the CSV and Markdown disagree on a gate or scoring definition that affects implementation.

Historical version numbers may appear only in explicitly non-normative history/change notes.

**Precedence invariant:** canonical Markdown > current-version mirrors > historical artifacts.

## Registry — 150 passage coordinates

The table is sorted by registry Passage ID. Use `delivery_session` in the CSV for learner order.

| Passage | Session | RS | P# | Title | Strand | Comprehension | Quiz | Checkpoint |
|---:|---:|---:|---:|---|---|---|---|---|
| 001 | 001 | 01 | P1 | The Red Umbrella | Self & Character | Direct recall | Q01A | CP0-RS01 — Competency baseline |
| 002 | 016 | 01 | P2 | Two Seats on the Bus | Family & Friendship | Sequence | Q02B | — |
| 003 | 031 | 01 | P3 | The Question Nobody Asked | School & Learning | Cause/effect | Q03C | — |
| 004 | 046 | 01 | P4 | The Unfinished Race | Play, Games & Sports | Prediction | Q04D | — |
| 005 | 061 | 01 | P5 | The Injured Squirrel | Animals & Living World | Feelings/motivation | Q05E | — |
| 006 | 076 | 01 | P6 | The Tree That Kept the Street Cool | Nature & Environment | Main idea | Q06A | — |
| 007 | 091 | 01 | P7 | The Mist Above the Cup | Science & How Things Work | Simple inference | Q07B | — |
| 008 | 106 | 01 | P8 | The Wobbly Prototype | Making, Building & Inventing | Vocabulary in context | Q08C | — |
| 009 | 121 | 01 | P9 | The Crowded Train Door | India Around Us | Judgment/application | Q09D | — |
| 010 | 136 | 01 | P10 | The Bottle from the Ocean | Our World & Journeys | Mixed mastery | Q10E | — |
| 011 | 002 | 02 | P1 | The Missing Lunch Box | Family & Friendship | Direct recall | Q01B | CP0-RS02 — Competency baseline |
| 012 | 017 | 02 | P2 | The Library Stamp | School & Learning | Sequence | Q02C | — |
| 013 | 032 | 02 | P3 | The Kite That Would Not Rise | Play, Games & Sports | Cause/effect | Q03D | — |
| 014 | 047 | 02 | P4 | The Monkey and the Bottle | Animals & Living World | Prediction | Q04E | — |
| 015 | 062 | 02 | P5 | The Small Tree in the Heat | Nature & Environment | Feelings/motivation | Q05A | — |
| 016 | 077 | 02 | P6 | The Moon Has No Light of Its Own | Science & How Things Work | Main idea | Q06B | — |
| 017 | 092 | 02 | P7 | The Rubber-Band Car | Making, Building & Inventing | Simple inference | Q07C | — |
| 018 | 107 | 02 | P8 | The Crowded Bazaar | India Around Us | Vocabulary in context | Q08D | — |
| 019 | 122 | 02 | P9 | The Souvenir Stone | Our World & Journeys | Judgment/application | Q09E | — |
| 020 | 137 | 02 | P10 | The Community Noticeboard | Community & Civic Life | Mixed mastery | Q10A | — |
| 021 | 003 | 03 | P1 | The Blue Pencil | School & Learning | Direct recall | Q01C | CP0-RS03 — Competency baseline |
| 022 | 018 | 03 | P2 | The Friendly Match | Play, Games & Sports | Sequence | Q02D | — |
| 023 | 033 | 03 | P3 | The Bird at the Window | Animals & Living World | Cause/effect | Q03E | — |
| 024 | 048 | 03 | P4 | The Dark Cloud Over the Field | Nature & Environment | Prediction | Q04A | — |
| 025 | 063 | 03 | P5 | The Failed Torch | Science & How Things Work | Feelings/motivation | Q05B | — |
| 026 | 078 | 03 | P6 | The Cup That Would Not Tip | Making, Building & Inventing | Main idea | Q06C | — |
| 027 | 093 | 03 | P7 | The Old Clock Tower | India Around Us | Simple inference | Q07D | — |
| 028 | 108 | 03 | P8 | The Ancient Bridge | Our World & Journeys | Vocabulary in context | Q08E | — |
| 029 | 123 | 03 | P9 | The Loudspeaker at Night | Community & Civic Life | Judgment/application | Q09A | — |
| 030 | 138 | 03 | P10 | The Two Piggy Banks | Money, Resources & Choices | Mixed mastery | Q10B | — |
| 031 | 004 | 04 | P1 | The Last Ball | Play, Games & Sports | Direct recall | Q01D | CP0-RS04 — Competency baseline |
| 032 | 019 | 04 | P2 | The Puppy and the Slipper | Animals & Living World | Sequence | Q02E | — |
| 033 | 034 | 04 | P3 | The Dry Tap | Nature & Environment | Cause/effect | Q03A | — |
| 034 | 049 | 04 | P4 | The Balloon and the Warm Air | Science & How Things Work | Prediction | Q04B | — |
| 035 | 064 | 04 | P5 | The Crooked Kite Frame | Making, Building & Inventing | Feelings/motivation | Q05C | — |
| 036 | 079 | 04 | P6 | The Morning Delivery Route | India Around Us | Main idea | Q06D | — |
| 037 | 094 | 04 | P7 | The Stranger’s Map | Our World & Journeys | Simple inference | Q07E | — |
| 038 | 109 | 04 | P8 | The Volunteer Badge | Community & Civic Life | Vocabulary in context | Q08A | — |
| 039 | 124 | 04 | P9 | The Toy Sale | Money, Resources & Choices | Judgment/application | Q09B | — |
| 040 | 139 | 04 | P10 | The Bicycle Bell | Health, Body & Safety | Mixed mastery | Q10C | — |
| 041 | 005 | 05 | P1 | The Clever Ant | Animals & Living World | Direct recall | Q01E | CP0-RS05 — Competency baseline |
| 042 | 020 | 05 | P2 | The First Monsoon Puddle | Nature & Environment | Sequence | Q02A | — |
| 043 | 035 | 05 | P3 | The Shadow Race | Science & How Things Work | Cause/effect | Q03B | — |
| 044 | 050 | 05 | P4 | The Wheels on the Toy Cart | Making, Building & Inventing | Prediction | Q04C | — |
| 045 | 065 | 05 | P5 | The Train Platform Goodbye | India Around Us | Feelings/motivation | Q05D | — |
| 046 | 080 | 05 | P6 | The River Between Two Towns | Our World & Journeys | Main idea | Q06E | — |
| 047 | 095 | 05 | P7 | The Shoes Outside the Door | Community & Civic Life | Simple inference | Q07A | — |
| 048 | 110 | 05 | P8 | The Bargain That Wasn’t | Money, Resources & Choices | Vocabulary in context | Q08B | — |
| 049 | 125 | 05 | P9 | The Unknown Medicine | Health, Body & Safety | Judgment/application | Q09C | — |
| 050 | 140 | 05 | P10 | The Mystery of the Warm Bench | Mystery, Logic & Observation | Mixed mastery | Q10D | — |
| 051 | 006 | 06 | P1 | The Thirsty Plant | Nature & Environment | Direct recall | Q01A | CP0-RS06 — Competency baseline |
| 052 | 021 | 06 | P2 | The Dancing Pepper | Science & How Things Work | Sequence | Q02B | — |
| 053 | 036 | 06 | P3 | The Boat Made of Leaves | Making, Building & Inventing | Cause/effect | Q03C | — |
| 054 | 051 | 06 | P4 | The Festival Lights Go Out | India Around Us | Prediction | Q04D | — |
| 055 | 066 | 06 | P5 | The Letter from Another Country | Our World & Journeys | Feelings/motivation | Q05E | — |
| 056 | 081 | 06 | P6 | The Street Library Box | Community & Civic Life | Main idea | Q06A | — |
| 057 | 096 | 06 | P7 | The Price-Tag Mistake | Money, Resources & Choices | Simple inference | Q07B | — |
| 058 | 111 | 06 | P8 | The Nutritious Snack | Health, Body & Safety | Vocabulary in context | Q08C | — |
| 059 | 126 | 06 | P9 | The Easy Answer | Mystery, Logic & Observation | Judgment/application | Q09D | — |
| 060 | 141 | 06 | P10 | The Lantern Parade | Imagination, Art & Wonder | Mixed mastery | Q10E | — |
| 061 | 007 | 07 | P1 | Why the Spoon Felt Cold | Science & How Things Work | Direct recall | Q01B | CP0-RS07 — Competency baseline |
| 062 | 022 | 07 | P2 | The Tallest Paper Tower | Making, Building & Inventing | Sequence | Q02C | — |
| 063 | 037 | 07 | P3 | The Bus Stop in the Rain | India Around Us | Cause/effect | Q03D | — |
| 064 | 052 | 07 | P4 | The Ferry’s Last Seat | Our World & Journeys | Prediction | Q04E | — |
| 065 | 067 | 07 | P5 | The Quiet Street Sweeper | Community & Civic Life | Feelings/motivation | Q05A | — |
| 066 | 082 | 07 | P6 | The Picnic With One Bag | Money, Resources & Choices | Main idea | Q06B | — |
| 067 | 097 | 07 | P7 | The Tired Runner | Health, Body & Safety | Simple inference | Q07C | — |
| 068 | 112 | 07 | P8 | The Hidden Pattern | Mystery, Logic & Observation | Vocabulary in context | Q08D | — |
| 069 | 127 | 07 | P9 | The Broken Paintbrush | Imagination, Art & Wonder | Judgment/application | Q09E | — |
| 070 | 142 | 07 | P10 | The Note in the Pocket | Self & Character | Mixed mastery | Q10A | — |
| 071 | 008 | 08 | P1 | The Paper Bridge | Making, Building & Inventing | Direct recall | Q01C | CP0-RS08 — Competency baseline |
| 072 | 023 | 08 | P2 | Mangoes for the Journey | India Around Us | Sequence | Q02D | — |
| 073 | 038 | 08 | P3 | The Mountain Train | Our World & Journeys | Cause/effect | Q03E | — |
| 074 | 053 | 08 | P4 | The New Crossing Sign | Community & Civic Life | Prediction | Q04A | — |
| 075 | 068 | 08 | P5 | The Jar for a Bicycle | Money, Resources & Choices | Feelings/motivation | Q05B | — |
| 076 | 083 | 08 | P6 | The Handwashing Experiment | Health, Body & Safety | Main idea | Q06C | — |
| 077 | 098 | 08 | P7 | The Light Under the Door | Mystery, Logic & Observation | Simple inference | Q07D | — |
| 078 | 113 | 08 | P8 | The Mural of Many Colours | Imagination, Art & Wonder | Vocabulary in context | Q08E | — |
| 079 | 128 | 08 | P9 | The Shortcut | Self & Character | Judgment/application | Q09A | — |
| 080 | 143 | 08 | P10 | The Birthday Without a Gift | Family & Friendship | Mixed mastery | Q10B | — |
| 081 | 009 | 09 | P1 | Morning at the Railway Station | India Around Us | Direct recall | Q01D | CP0-RS09 — Competency baseline |
| 082 | 024 | 09 | P2 | The Tiny Map | Our World & Journeys | Sequence | Q02E | — |
| 083 | 039 | 09 | P3 | The Queue at the Water Counter | Community & Civic Life | Cause/effect | Q03A | — |
| 084 | 054 | 09 | P4 | The Extra Coins | Money, Resources & Choices | Prediction | Q04B | — |
| 085 | 069 | 09 | P5 | The First Swimming Lesson | Health, Body & Safety | Feelings/motivation | Q05C | — |
| 086 | 084 | 09 | P6 | The Case of the Missing Bell | Mystery, Logic & Observation | Main idea | Q06D | — |
| 087 | 099 | 09 | P7 | The Picture with No Sky | Imagination, Art & Wonder | Simple inference | Q07E | — |
| 088 | 114 | 09 | P8 | The Brave Little “No” | Self & Character | Vocabulary in context | Q08A | — |
| 089 | 129 | 09 | P9 | The Story a Friend Shared | Family & Friendship | Judgment/application | Q09B | — |
| 090 | 144 | 09 | P10 | The Science Fair Question | School & Learning | Mixed mastery | Q10C | — |
| 091 | 010 | 10 | P1 | A Postcard from the Sea | Our World & Journeys | Direct recall | Q01E | CP0-RS10 — Competency baseline |
| 092 | 025 | 10 | P2 | The Lost Key at the Community Hall | Community & Civic Life | Sequence | Q02A | — |
| 093 | 040 | 10 | P3 | The Ice-Cream Budget | Money, Resources & Choices | Cause/effect | Q03B | — |
| 094 | 055 | 10 | P4 | The Wet Floor Sign | Health, Body & Safety | Prediction | Q04C | — |
| 095 | 070 | 10 | P5 | The Puzzle Tara Would Not Leave | Mystery, Logic & Observation | Feelings/motivation | Q05D | — |
| 096 | 085 | 10 | P6 | The Chalk City | Imagination, Art & Wonder | Main idea | Q06E | — |
| 097 | 100 | 10 | P7 | The Unopened Gift | Self & Character | Simple inference | Q07A | M100 — Confidence milestone (partial RS snapshot) |
| 098 | 115 | 10 | P8 | The Word on the Friendship Card | Family & Friendship | Vocabulary in context | Q08B | — |
| 099 | 130 | 10 | P9 | Copying the Homework | School & Learning | Judgment/application | Q09C | — |
| 100 | 145 | 10 | P10 | The Final Over | Play, Games & Sports | Mixed mastery | Q10D | — |
| 101 | 011 | 11 | P1 | The Clean Park Bench | Community & Civic Life | Direct recall | Q01A | CP0-RS11 — Competency baseline |
| 102 | 026 | 11 | P2 | The Ten-Rupee Choice | Money, Resources & Choices | Sequence | Q02B | — |
| 103 | 041 | 11 | P3 | The Sleepy Morning | Health, Body & Safety | Cause/effect | Q03C | — |
| 104 | 056 | 11 | P4 | The Half-Open Window | Mystery, Logic & Observation | Prediction | Q04D | — |
| 105 | 071 | 11 | P5 | The Song Without Words | Imagination, Art & Wonder | Feelings/motivation | Q05E | — |
| 106 | 086 | 11 | P6 | The Small Promise | Self & Character | Main idea | Q06A | — |
| 107 | 101 | 11 | P7 | The Empty Chair at Lunch | Family & Friendship | Simple inference | Q07B | — |
| 108 | 116 | 11 | P8 | The Curious Label | School & Learning | Vocabulary in context | Q08C | — |
| 109 | 131 | 11 | P9 | The Winning Point | Play, Games & Sports | Judgment/application | Q09D | — |
| 110 | 146 | 11 | P10 | The Turtle Crossing | Animals & Living World | Mixed mastery | Q10E | — |
| 111 | 012 | 12 | P1 | Three Coins | Money, Resources & Choices | Direct recall | Q01B | CP0-RS12 — Competency baseline |
| 112 | 027 | 12 | P2 | The Helmet Reminder | Health, Body & Safety | Sequence | Q02C | — |
| 113 | 042 | 12 | P3 | The Bell That Rang Twice | Mystery, Logic & Observation | Cause/effect | Q03D | — |
| 114 | 057 | 12 | P4 | The Paper Moon | Imagination, Art & Wonder | Prediction | Q04E | — |
| 115 | 072 | 12 | P5 | The First Solo Errand | Self & Character | Feelings/motivation | Q05A | — |
| 116 | 087 | 12 | P6 | The Shared Umbrella | Family & Friendship | Main idea | Q06B | — |
| 117 | 102 | 12 | P7 | The Pages with Tiny Stars | School & Learning | Simple inference | Q07C | — |
| 118 | 117 | 12 | P8 | The Sudden Drizzle Match | Play, Games & Sports | Vocabulary in context | Q08D | — |
| 119 | 132 | 12 | P9 | Feeding the Stray Dog | Animals & Living World | Judgment/application | Q09E | — |
| 120 | 147 | 12 | P10 | The Garden After the Storm | Nature & Environment | Mixed mastery | Q10A | — |
| 121 | 013 | 13 | P1 | The Water Bottle | Health, Body & Safety | Direct recall | Q01C | CP0-RS13 — Competency baseline |
| 122 | 028 | 13 | P2 | The Four Clues | Mystery, Logic & Observation | Sequence | Q02D | — |
| 123 | 043 | 13 | P3 | The Story in the Stars | Imagination, Art & Wonder | Cause/effect | Q03E | — |
| 124 | 058 | 13 | P4 | The Box Under the Bed | Self & Character | Prediction | Q04A | — |
| 125 | 073 | 13 | P5 | The Seat Beside the New Student | Family & Friendship | Feelings/motivation | Q05B | — |
| 126 | 088 | 13 | P6 | Ten Minutes of Practice | School & Learning | Main idea | Q06C | — |
| 127 | 103 | 13 | P7 | The Captain Who Passed the Ball | Play, Games & Sports | Simple inference | Q07D | — |
| 128 | 118 | 13 | P8 | The Nocturnal Visitor | Animals & Living World | Vocabulary in context | Q08E | — |
| 129 | 133 | 13 | P9 | The Tap Left Running | Nature & Environment | Judgment/application | Q09A | — |
| 130 | 148 | 13 | P10 | The Compass That Pointed North | Science & How Things Work | Mixed mastery | Q10B | — |
| 131 | 014 | 14 | P1 | The Footprints Near the Gate | Mystery, Logic & Observation | Direct recall | Q01D | CP0-RS14 — Competency baseline |
| 132 | 029 | 14 | P2 | The Drawing That Changed | Imagination, Art & Wonder | Sequence | Q02E | — |
| 133 | 044 | 14 | P3 | The Plant That Bent | Self & Character | Cause/effect | Q03A | — |
| 134 | 059 | 14 | P4 | Grandma’s Secret Seed | Family & Friendship | Prediction | Q04B | — |
| 135 | 074 | 14 | P5 | The Answer Sam Changed | School & Learning | Feelings/motivation | Q05C | — |
| 136 | 089 | 14 | P6 | The Game Without a Referee | Play, Games & Sports | Main idea | Q06D | — |
| 137 | 104 | 14 | P7 | The Crow and the Shiny Wrapper | Animals & Living World | Simple inference | Q07E | — |
| 138 | 119 | 14 | P8 | The Tiny Seedling | Nature & Environment | Vocabulary in context | Q08A | — |
| 139 | 134 | 14 | P9 | The Phone in the Sun | Science & How Things Work | Judgment/application | Q09B | — |
| 140 | 149 | 14 | P10 | The Bridge That Held Ten Books | Making, Building & Inventing | Mixed mastery | Q10C | — |
| 141 | 015 | 15 | P1 | The Cloud That Looked Like a Whale | Imagination, Art & Wonder | Direct recall | Q01E | CP0-RS15 — Competency baseline |
| 142 | 030 | 15 | P2 | The Doorbell at Six | Self & Character | Sequence | Q02A | CP1 — Full-round P2 progress |
| 143 | 045 | 15 | P3 | The Broken Crayon Plan | Family & Friendship | Cause/effect | Q03B | — |
| 144 | 060 | 15 | P4 | The Empty Page | School & Learning | Prediction | Q04C | CP2 — Full-round P4 progress |
| 145 | 075 | 15 | P5 | The Goal Nobody Saw | Play, Games & Sports | Feelings/motivation | Q05D | — |
| 146 | 090 | 15 | P6 | The Bees at Work | Animals & Living World | Main idea | Q06E | CP3 — Full-round P6 progress |
| 147 | 105 | 15 | P7 | The Leaves on One Side | Nature & Environment | Simple inference | Q07A | — |
| 148 | 120 | 15 | P8 | The Transparent Cup | Science & How Things Work | Vocabulary in context | Q08B | CP4 — Full-round P8 progress |
| 149 | 135 | 15 | P9 | The Strongest Tower | Making, Building & Inventing | Judgment/application | Q09C | — |
| 150 | 150 | 15 | P10 | The Last Bus to the Village | India Around Us | Mixed mastery | Q10D | CP5 — Complete 15-RS Band-A readiness decision |

## v0.5 QA invariants
- 150 unique registry passage IDs and 150 unique delivery sessions.
- 15 reading stages × 10 passages each.
- P1→P10 map exactly to the 10 comprehension levels.
- Every 15-session comprehension block contains all 15 knowledge strands exactly once (**hard regression gate; verified across all 10 rounds**).
- Each reading stage contains 10 distinct knowledge strands.
- Sessions 1–100—not passage IDs 1–100—receive confidence-first protection.
- Passage 150 remains a 100→200-word endurance checkpoint, not World 1→World 2 graduation.


## RS executability regression gate

v0.5 fails QA if any RS01–RS15 lacks any one of the following:

1. a distinct reading competency;
2. an observable oral behaviour;
3. a machine-computable measurement;
4. a P10 success rule;
5. ten explicit P1→P10 development targets;
6. exactly one registry row for each P1…P10 inside that RS.

It also fails if an RS definition depends on a comprehension level (for example, “stable reading under inference”) or on being encountered late in the learner journey (for example, “Band-A readiness”), because every RS appears once in the very first 15 delivered sessions.

## v0.6 baseline verification

Automated registry checks confirm:

- Sessions 001–015 contain exactly RS01-P1 through RS15-P1, one each.
- Every RS01–RS15 contains P1 through P10 exactly once.
- Every P2–P10 row references the P1 baseline from the **same RS**.
- Formal composite checkpoints at Sessions 30, 60, 90, 120 and 150 occur only after all 15 RS tracks have completed a common P level.
- Session 100 is explicitly a partial 10-RS confidence snapshot, not a full composite.

## Band-A coverage regression gate

v0.7 fails QA if any future implementation:

1. uses fewer than all 15 P10 RS competencies in the final Band-A decision;
2. treats Sessions 146–150 as a sufficient readiness sample;
3. permits a learner to advance while any RS is `NOT_YET` or `REASSESS`;
4. averages strong RS scores to cancel a weak RS competency;
5. requires the learner to repeat already-mastered RS competencies after a targeted failure;
6. changes the reassessment text but not the underlying RS competency/measurement being reassessed.

The final readiness question is not **“Did the learner pass enough passages?”**  
It is **“Are all 15 required one-word reading competencies resolved at Band-A level?”**


## v0.8 self-containment audit

Automated and manual checks for this revision:

- No normative factual/safety requirement depends on v0.2 or any other earlier version.
- Full acceptance rules for `SCIENCE_FACT`, `CHILD_SAFETY`, `WILDLIFE_SAFETY`, `CHILD_MONEY`, `HEALTH_FACT`, `INDIA_CONTEXT` and universal `GENERAL` review are contained here.
- The complete RS01–RS15 P10 oral-readiness thresholds are reproduced in this file.
- The CSV carries the complete gate text for each row through `qa_gate_definition` / `factual_safety_requirement`.
- `v0.8` explicitly supersedes v0.1–v0.7 for implementation of Passages 001–150.

## v0.9 prose-gate regression audit

v0.9 explicitly restores and freezes the detailed passage-generation requirements that must survive future matrix changes:

- one defensible keyed answer;
- unambiguous comprehension evidence path;
- oral compatibility with the assigned RS/P microtarget;
- no tongue-twister/accent/ASR traps;
- controlled stretch vocabulary;
- no nearby duplicate plot/lesson/hook experience;
- wisdom primarily implicit rather than moralising;
- first-100 confidence protection;
- exact 100-word natural oral rhythm;
- Babysteps effortless-learning quality;
- engagement ≥5/6 with no zero component;
- all applicable factual/safety/cultural gates.

Future canonical versions may refine these rules, but may not silently drop them.

## v0.10 oral-metric operational audit

v0.10 freezes one canonical definition for:

- assessable expected words;
- first-pass accuracy;
- final accuracy;
- substitution;
- omission;
- insertion;
- repetition;
- accepted self-correction and its latency;
- long hesitation (>2.0 s);
- full restart;
- terminal-punctuation compliance;
- internal-punctuation compliance;
- challenge/unfamiliar-word recovery;
- active reading time;
- `text_WPM`;
- ASR uncertainty;
- invalid/reassess samples;
- mandatory scoring-pipeline order.

A future implementation may optimize the recognizer or UI, but it may not change these scoring semantics without incrementing the oral-scoring specification version and rerunning regression QA.


## v0.11 maintenance note

Stable maintenance filenames now use the pattern:

`SpeedReader_W1_BandA_<Artifact>_vX.Y`

Blocker names are retained only as QA issue IDs in `SpeedReader_W1_BandA_QA_Issues_v0.11.csv`.

The current numerical RS P10 thresholds remain `PROVISIONAL_PILOT`; production calibration is pending. Open QA blockers and majors are tracked separately in the QA issue register.


## v0.12 creator implementation note

BA-QA-006 was implemented by removing automatic RS07 success from a no-error sample and introducing separate `DIRECT_REPAIR` and `CLEAN_READING` evidence pathways. Creator-side structural/regression checks are recorded in `SpeedReader_W1_BandA_Creator_Validation_v0.12.md`.

Planner status: `READY_FOR_QA`. Final closure remains the responsibility of independent QA.


## v0.13 creator implementation note

BA-QA-007 was implemented by replacing one-form/latest-pass readiness with a two-form matched confirmation cycle and bounded reassessment policy.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Independent QA determines final closure. BA-QA-010 (full equivalent-form QA) remains a separate major review item even though v0.13 introduces the minimum equivalence contract required for BA-QA-007.


## v0.14 creator implementation note

The minimum matched-form dependency of BA-QA-007 is operationalized as `MFORM-1.1`. BA-QA-010 remains intentionally open.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.


## v0.15 creator implementation note

BA-QA-010 is implemented as `EQUIV-2.1` with explicit matching dimensions/tolerances and a form-family validation lifecycle. Structural tolerances are operational but remain `PROVISIONAL_STRUCTURAL` until empirical family calibration.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.


## v0.16 creator implementation note

BA-QA-008 was implemented by separating `INSTRUCTIONALLY_RESOLVED_NOT_CERTIFYING` from `COMPREHENSION_CONFIRMED`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

BA-QA-012 remains open because independent evidence validity and comprehension-dimension coverage completeness are separate questions.


## v0.17 creator implementation note

BA-QA-009 was implemented through `RECENCY-1.0`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

The current 56-day / 16-subsequent-session / 28-day-inactivity limits are explicitly `PROVISIONAL_PILOT`; independent QA may accept the architecture while calibration of those numbers remains pending.


## v0.18 creator implementation note

BA-QA-011 was implemented through `EVIDENCE-MIN-1.2`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

BA-QA-012 remains open.


## v0.19 creator implementation note

BA-QA-012 was implemented through `COMP-COVERAGE-1.0`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

All previously tracked BLOCKER and MAJOR items are now at least `READY_FOR_QA` or specification-complete/pending empirical calibration. Independent QA may still reopen any issue.


## v0.20 creator implementation note

BA-QA-013 was implemented by aligning RS05 and RS12 single-form construction counts with their readiness evidence denominators.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Independent QA determines closure.

## v0.21 canonical package manifest

The machine-readable package-role mirror is:

`SpeedReader_W1_BandA_Package_Manifest_v0.24.csv`

It does not create normative authority. The hierarchy remains:

`SpeedReader_W1_BandA_Spec_v0.25.md` → sole normative source  
`v0.25 CSVs` → mirrors only  
`QA/validation/changelog` → audit/history only  
`v0.21 and earlier` → historical/non-normative

## v0.21 creator implementation note

BA-QA-014 was implemented by embedding all 15 RS-specific equivalent-form tolerances in this specification, demoting all CSVs to mirrors, and explicitly superseding every pre-v0.22 equivalence artifact.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Independent QA determines closure.


## v0.22 creator implementation note

BA-QA-015 was implemented through `FORM-SUPPLY-1.0`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Production Band-A readiness forms are banked/approved offline; runtime generation is prohibited in this version.


## v0.23 creator implementation note

BA-QA-016 was implemented by defining RS02/RS08 third coverage as **≥28 assessable words in each of first, middle and final thirds**, with ≥90 assessable words total.

While implementing this major, the creator also restored the complete EVIDENCE-MIN-1.2 section into the sole normative Markdown so the v0.21/v0.22 self-containment guarantee remains true.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Independent QA determines closure.


## v0.24 creator implementation note

BA-QA-017 was implemented through `RS10-FEAS-1.0`.

The specification keeps five RS10 scored opportunities as the provisional evidence minimum, but prevents comma stuffing by requiring natural prose to be frozen and QA-approved **before** the five scoring opportunities are tagged.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA_SPEC / EMPIRICAL_FEASIBILITY_PENDING`.

Independent QA determines specification closure; production approval additionally requires the feasibility pilot.


## v0.25 creator implementation note

BA-QA-018 was implemented through `STATE-SEP-1.0`.

`BASELINE_MASTERY` is preserved as a progress descriptor, while `BASELINE_MASTERY_CONFIRMED` is deprecated as a readiness state. Every RS must still complete P10 PRIMARY → fresh matched P10 CONFIRMATION before `CONFIRMED_READY`.

Planner status: `IMPLEMENTED → SELF_VALIDATION_PASS → READY_FOR_QA`.

Independent QA determines closure.
