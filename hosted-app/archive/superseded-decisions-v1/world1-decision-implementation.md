# World 1 decision workbook implementation

## Ordered TDD progress

The current ordered TDD pass starts at DEC-004, after prior work on DEC-001–003. DEC-004 through DEC-008 and DEC-010–011 now have red-to-green test cycles; DEC-009 was already covered by the one-passage 20-minute session test added with DEC-007. **8 of 23 rows in this pass have been addressed; 15 remain to review in order.** This counts development passes, not production acceptance: all 26 rows still have at least one unverified or missing end-to-end dependency, and DEC-017 is explicitly OPEN in the approved workbook.

Source: `Requirements/SpeedReader_Decisions_Acceptance_Criteria_Codex.xlsx`. This is a product layer. The frozen Band A knowledge map remains the authority for its own readiness, comprehension, oral-scoring, and content rules. The product owner confirmed that the workbook's new passage-length staircase governs passage 151 onward. `pipeline/wip/World1_Passage_Length_Amendment_v0.26.md` records the narrow supersession of the old 200-word transition. These modules are not yet wired into the learner screen; the screen still runs the older 36-level demo.

## Decision register status

| ID | Status | Implementation / outstanding work |
| --- | --- | --- |
| DEC-001 | Partial | Product rules are isolated in `lib/world1-*`; full canonical KM regression still needs a production implementation and approved forms. |
| DEC-002–003 | Partial | A shared framework defines all 15 RS competencies and 15 knowledge strands. The first-150 delivery coordinates are validated identically for every age band; `age_band` selects separate prose collections for 7–10, 11–14, and 15–18. No approved content collections are present. |
| DEC-004 | Partial | The catalog rejects missing explicit language review, vocabulary overload, age-topic mismatch, unnecessary stretch, and multiple deliberate primary stretch dimensions even if generic approval flags are set. Stage 03 authoring and independent QA instructions now require this review. Actual approved prose still needs human/content-pipeline evidence. |
| DEC-005 | Partial | Sequence integrity, readiness-aware sequential selection, a simulated 1–1500 learner path, and an explicit completion result are tested. An approved 1,500-passage catalog and learner-facing integration are absent. |
| DEC-006 | Partial | World 1 config rejects unknown deadline/quota fields, and the progression engine refuses invalid config. A slow-learner scenario holds passage and speed after years; alternate-day cadence remains a recommendation. Learner-facing flow is not connected. |
| DEC-007 | Partial | A 20-minute time budget can close a session after one completed passage without a passage-count penalty; technical-only evidence remains insufficient, not learner failure. Alternate-day recommendations persist per learner and remain advisory, producing alternating 4/3-session weeks. No 20-minute learner UI is wired yet. |
| DEC-008 | Partial | The normal session recorder requires reading-speed target, passage length, comprehension, and oral-quality evidence in every passage result. It rejects stamina-only mode and missing signals. Speed measurement and learner UI integration remain. |
| DEC-009 | Partial | A completed 20-minute session with one passage returns SUCCESS when learning gates pass. No passage minimum is enforced. Learner UI integration remains. |
| DEC-010 | Partial | Spoken outcomes distinguish relevant, unrelated, and uncertain responses; authored proposition variants support positive paraphrases. Configured semantic confidence below threshold, or missing confidence, routes to review. Broader semantic assessment and browser/UI handoff remain unimplemented. |
| DEC-011 | Partial | Unusable or below-threshold ASR routes to TECHNICAL_RETRY, even if a semantic label appears unrelated. The speed gate preserves its state and the personal baseline ignores this evidence. Actual ASR integration remains. |
| DEC-012–013 | Partial | Personal comparable-evidence median reducer with configurable window/minimum and versioned per-learner profile storage exist. Session integration and server-backed synchronization remain. |
| DEC-014 | Partial | Three distinct valid sessions and independent comprehension/oral gates are tested. Speed increment stays unset until configured; runtime flow remains. |
| DEC-015 | Partial | Two ordered same-passage oral attempts, independent metrics, averages, and deltas exist. Actual audio capture/metric extraction remains. |
| DEC-016–017 | Partial | Improvement audio function allowlists passage linkage and audio bytes; governance/consent defaults deny retention. No production audio store is connected. |
| DEC-018–019 | Partial | Confirmed staircase formula covers 1–1500: passage 151 is 125 words. A versioned amendment supersedes only the old 200-word transition. Catalog validation still needs the canonical word counter and approved passages. |
| DEC-020–021 | Partial | Length boundary holds speed; a longer passage earns no level until a completed, KM-approved passage and configured confirmation count validate it. Simultaneous eligibility tie-break remains configurable. |
| DEC-022–024 | Partial | Typed dimension events, crossing deduplication, generic badges at 5/10/etc., unconfigured band evaluators, and local profile persistence exist. Server-backed concurrency transaction and three open band definitions remain. |
| DEC-025 | Partial | Catalog metadata and configurable repeated theme/form/purpose check exist. Human engagement QA and approved catalog remain. |
| DEC-026 | Partial | World targets are data/config and validation is separate from learner readiness; later-world flow is outside the workbook scope. |

## Open decisions and release gates

OPEN-001 through OPEN-006 stay optional configuration; no guessed speed step, comprehension/fluency/independence band, stamina confirmation count, or tie-break is embedded as a permanent rule. OPEN-007 child-audio governance defaults to disabled. OPEN-008 badge presentation remains generic. OPEN-009 session flow and OPEN-010 reconciliation of spoken continuation with canonical quiz readiness require product design before learner-facing wiring. Age bands beyond 15–18 remain configurable (OPEN-011).

The current demo content is not an approved World 1 catalog. Its first passage declares 79 words and cannot satisfy the first-150 exact-100 contract. The WIP registry is not promoted to approved content. Missing or invalid catalog records produce content errors rather than learner failures.

Unit tests in `tests/unit/world1-product.test.ts` cover staircase boundaries, content errors, safe evidence outcomes, two oral reads, baseline outliers, three-session speed gates, stamina confirmation, single-dimension advancement, replay-safe levels/badges, and audio governance. Production release remains blocked by catalog supply, canonical counter/KM integration, required open decisions, and end-to-end UI and storage work.
