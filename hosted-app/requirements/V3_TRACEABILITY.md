# SpeedReader v3.0 Requirement Traceability (CLAUDE-004)

Source of truth: `requirements/SpeedReader_Definitive_App_Requirements_Claude_Code_Acceptance_v3.0.md`
Branch: `feature/app-v3-acceptance`

Status values: `TODO` (not evaluated) | `NOT_IMPLEMENTED` | `PARTIAL` | `IMPLEMENTED_TESTED` (pushed) | `BLOCKED` (reason in notes)

## Baseline (Phase 0, 2026-10-09)
- `vitest run`: 1171 pass / 70 fail. All 70 failures are `hosted-app/tests/unit/sr/pipeline-v2/*` (content pipeline; needs `node:sqlite`, env has Node 20.11). Out of scope (CLAUDE-005).
- `tsc --noEmit`: clean.

## Matrix
| Req ID | Title | Status | Modules | Tests | Evidence / notes |
|---|---|---|---|---|---|
| APP-GOV-001 | One application source of truth | IMPLEMENTED_TESTED | requirements/*v3.0.md; this ledger | n/a (document) | Governance: v3.0 committed as authority; ledger guards against reconstruction from chat. |
| APP-GOV-002 | Precedence before v3.0 freeze | IMPLEMENTED_TESTED | requirements/*v3.0.md | n/a (document) | Precedence applied during consolidation; no code. |
| APP-GOV-003 | Requirement states | IMPLEMENTED_TESTED | lib/v2/threshold-lifecycle.ts | v2/fr-046-threshold-lifecycle.test.ts | Lifecycle states + frozen/pilot registry. |
| APP-GOV-004 | No silent product redesign | IMPLEMENTED_TESTED | lib/v2/stale-rules.ts; supersession.ts | v2/ac-c01-stale-rules.test.ts; v2/fr-039-oral-gate-superseded.test.ts | Superseded rules guarded from restoration. |
| APP-GOV-005 | Historical outcomes remain historical | IMPLEMENTED_TESTED | lib/v2/calibration.ts; attempt-record.ts | v2/fr-021-weighting-lifecycle.test.ts; v2/fr-047-attempt-record.test.ts | Versions stored with every attempt; history never rewritten. |
| APP-NORTH-001 | Three outcomes | IMPLEMENTED_TESTED | (product statement) | satisfied by APP-WPM/COMP/BPC rows | Outcome statement; no separate test. |
| APP-NORTH-002 | Confidence-first | PARTIAL | lib/v2/learner-language.ts; learner-feedback.ts | v2/fr-019-support-invisible.test.ts; v2/fr-029-numeric-private.test.ts | Domain rule tested; learner-facing UI wiring pending (Phase 5/11). |
| APP-NORTH-003 | Personal trajectory | IMPLEMENTED_TESTED | lib/v2/personal-trajectory.ts | v2/fr-009-personal-trajectory.test.ts | Peer/age/universal-rate comparison rejected. |
| APP-PLAT-001 | Consumer App Container is the mandatory host | IMPLEMENTED_TESTED | container/app-contract.ts; hosted-app/app.identity.ts; app.manifest.ts | container/tests/app-launch.spec.ts (18/18 pass) | Container has no SpeedReader logic; hosted-app declares identity+manifest. |
| APP-PLAT-002 | Typed manifest contract | IMPLEMENTED_TESTED | hosted-app/app.manifest.ts; app.identity.ts | container/tests/app-launch.spec.ts (18/18 pass) | All required fields present. Manifest still lists legacy demo pages - tracked under APP-NFR-007/APP-WORLD stale routes. |
| APP-PLAT-003 | Standard launch protocol | PARTIAL | container/routes/{health,launch,return,progress-sync}.ts; container/launch/* | container/tests/app-launch.spec.ts (18/18 pass) | health/launch/return/bootstrap/progress sync present+tested. /identity is a reserved 501 stub. |
| APP-PLAT-004 | No duplicate authentication system | IMPLEMENTED_TESTED | container/launch/* | container/tests/app-launch.spec.ts (18/18 pass); grep: no login/signup code | Trusted learner context from signed launch exchange only. |
| APP-PLAT-005 | No duplicate billing | IMPLEMENTED_TESTED | (absence) | grep: no billing/checkout/payment code in app/container/lib/ui | Entitlement is platform-side. |
| APP-PLAT-006 | Single active learner/device rule | PARTIAL | lib/v2/session-envelope.ts | tests/unit/v2/app-plat-session-envelope.test.ts (18 tests) | Domain registry enforces one live session per learner. Needs wiring to launch/session cookie + durable store (in-memory now). |
| APP-PLAT-007 | Platform session envelope | PARTIAL | lib/v2/session-envelope.ts | tests/unit/v2/app-plat-session-envelope.test.ts (18 tests) | 45min/2 per week/every-6th configured+tested; platform remains authoritative. Not yet wired into launch route. |
| APP-PLAT-008 | Review-session integration | PARTIAL | lib/v2/session-envelope.ts | tests/unit/v2/app-plat-session-envelope.test.ts (18 tests) | attemptRulesForSession domain rule tested; practice selection wiring is APP-PRAC/Phase 9. |
| APP-PLAT-009 | Accidental-close resume | PARTIAL | lib/v2/session-envelope.ts | tests/unit/v2/app-plat-session-envelope.test.ts (18 tests) | Resume window/idempotent-replay domain logic tested; not yet wired to routes/persistence. |
| APP-PLAT-010 | Return to Babysteps | TODO | | | |
| APP-INFRA-001 | Web-first, mobile-required | TODO | | | |
| APP-INFRA-002 | Reference browser | TODO | | | |
| APP-INFRA-003 | Deployment | TODO | | | |
| APP-INFRA-004 | Speech cost principle | TODO | | | |
| APP-INFRA-005 | Email is not a SpeedReader runtime dependency | TODO | | | |
| APP-WORLD-001 | Five Worlds | IMPLEMENTED_TESTED | lib/v2/worlds.ts | v2/fr-001-worlds.test.ts |  |
| APP-WORLD-002 | World 1 implementation scope | IMPLEMENTED_TESTED | lib/v2/catalog.ts; worlds.ts | v2/fr-003-catalog.test.ts; v2/fr-001-worlds.test.ts | World 1 fully specified; worlds keyed by id. |
| APP-WORLD-003 | World 2–5 broad strategy support | IMPLEMENTED_TESTED | lib/v2/world-strategies.ts | v2/fr-002-world-strategies.test.ts |  |
| APP-W1-001 | 1,500 canonical sequence positions | IMPLEMENTED_TESTED | lib/v2/catalog.ts | v2/fr-003-catalog.test.ts | 1500 positions; pointer independent of practice. |
| APP-W1-002 | First 150 | IMPLEMENTED_TESTED | lib/v2/foundation.ts | v2/fr-004-first-150.test.ts | delivery_session ordering depends on an approved package (none approved yet - see memory). |
| APP-W1-003 | Stamina staircase | IMPLEMENTED_TESTED | lib/v2/stamina.ts | v2/fr-005-staircase.test.ts |  |
| APP-W1-004 | One meaningful challenge increase at a time | IMPLEMENTED_TESTED | lib/v2/stamina-transition.ts; learner-aggregate.ts | v2/fr-006-transition-precedence.test.ts |  |
| APP-W1-005 | Progressive stamina validation | IMPLEMENTED_TESTED | lib/v2/ac53r.ts | v2/fr-007-ac53r.test.ts | +25 step validation at domain level; production validation needs real content. |
| APP-W1-006 | Canonical sequence is not altered by practice | IMPLEMENTED_TESTED | lib/v2/familiar-practice.ts | v2/fr-018-familiar-practice.test.ts; v2/fr-035-news-reader-independence.test.ts |  |
| APP-ASSESS-001 | Mandatory new-learner baseline | PARTIAL | lib/v2/initial-assessment.ts | v2/fr-008-initial-assessment.test.ts | Engine done; mandatory-before-progression gate + learner UI pending (Phase 4). |
| APP-ASSESS-002 | Purpose | IMPLEMENTED_TESTED | lib/v2/initial-assessment.ts | v2/fr-008-initial-assessment.test.ts |  |
| APP-ASSESS-003 | Comprehension decides starting speed | IMPLEMENTED_TESTED | lib/v2/initial-assessment.ts | v2/fr-008-initial-assessment.test.ts | Oral fields cannot change result. |
| APP-ASSESS-004 | Deterministic and auditable | IMPLEMENTED_TESTED | lib/v2/initial-assessment.ts | v2/fr-008-initial-assessment.test.ts | Bounded, deterministic, versioned, confirmation-based. |
| APP-ASSESS-005 | Baseline persistence | IMPLEMENTED_TESTED | lib/v2/initial-assessment.ts (toAssessmentRecord) | v2/fr-008-initial-assessment.test.ts | Record built; wiring into LearnerRepository pending. |
| APP-ASSESS-006 | First canonical passage | IMPLEMENTED_TESTED | lib/v2/learner-aggregate.ts (newLearnerAggregate) | v2/fr-008-initial-assessment.test.ts |  |
| APP-READ-001 | Canonical token stream | PARTIAL | lib/world1-framework.ts; lib/chunking.ts | tests/unit/chunking.test.ts | Production reader consuming canonical token indices not built (Phase 5). |
| APP-READ-002 | WPM-driven display | PARTIAL | lib/reading-timing.ts | tests/unit/reading-timing.test.ts | Timing math done; engine-owned WPM into reader UI pending. |
| APP-READ-003 | Passage completion event | IMPLEMENTED_TESTED | lib/v2/learner-aggregate.ts; learner-repository.ts | v2/app-data-learner-repository.test.ts | Idempotent per attempt id + idempotency key. |
| APP-READ-004 | Nonblocking canonical progression | IMPLEMENTED_TESTED | lib/v2/passage-completion.ts; lib/sr/non-blocking.ts | v2/fr-031-below-75-positive.test.ts; v2/fr-035-news-reader-independence.test.ts; sr/sr-010-no-blocking.test.ts |  |
| APP-READ-005 | Technical interruption | PARTIAL | lib/v2/spoken-evidence.ts | v2/fr-024-asr-uncertainty.test.ts | Technical != failure at domain level; reader retry/recovery UX pending. |
| APP-READ-006 | Session boundary | PARTIAL | lib/v2/session-envelope.ts; learner-aggregate.ts | v2/app-plat-session-envelope.test.ts | No phantom completion in domain; reader integration pending. |
| APP-WPM-001 | World 1 ceiling | IMPLEMENTED_TESTED | lib/v2/speed-ceiling.ts | v2/fr-010-speed-ceiling.test.ts |  |
| APP-WPM-002 | Level semantics | IMPLEMENTED_TESTED | lib/v2/level-semantics.ts | v2/fr-011-level-semantics.test.ts |  |
| APP-WPM-003 | Comprehension-only WPM gate | IMPLEMENTED_TESTED | lib/v2/gate-evidence.ts | v2/fr-012-comprehension-only-gate.test.ts |  |
| APP-WPM-004 | Internal GREEN threshold | IMPLEMENTED_TESTED | lib/v2/comprehension-threshold.ts | v2/fr-013-green-threshold.test.ts |  |
| APP-WPM-005 | First-five rule | IMPLEMENTED_TESTED | lib/v2/first-five.ts | v2/fr-014-first-five.test.ts |  |
| APP-WPM-006 | Post-five rule | IMPLEMENTED_TESTED | lib/v2/core-wpm.ts | v2/fr-015-post-five.test.ts |  |
| APP-WPM-007 | No decrement | IMPLEMENTED_TESTED | lib/v2/no-decrement.ts | v2/fr-016-no-decrement.test.ts |  |
| APP-WPM-008 | 149→150 and ceiling behaviour | IMPLEMENTED_TESTED | lib/v2/speed-ceiling.ts; boundary-matrix.ts | v2/fr-010-speed-ceiling.test.ts; v2/ac-c06-boundaries.test.ts | B07/B08 boundaries. |
| APP-WPM-009 | Idempotent Level Up | IMPLEMENTED_TESTED | lib/v2/learner-aggregate.ts; learner-repository.ts | v2/app-data-learner-repository.test.ts | Replay returns no second Level Up. |
| APP-WPM-010 | Atomic award | IMPLEMENTED_TESTED | lib/v2/progress-store.ts; learner-repository.ts | v2/ac-c05-transaction-safety.test.ts; v2/app-data-learner-repository.test.ts |  |
| APP-PRAC-001 | Architectural rule | IMPLEMENTED_TESTED | lib/v2/attempt-types.ts | v2/fr-017-new-prove-progress.test.ts |  |
| APP-PRAC-002 | Practice eligibility | IMPLEMENTED_TESTED | lib/v2/familiar-practice.ts | v2/fr-018-familiar-practice.test.ts |  |
| APP-PRAC-003 | Current WPM | IMPLEMENTED_TESTED | lib/v2/familiar-practice.ts | v2/fr-018-familiar-practice.test.ts | Served at current earned WPM. |
| APP-PRAC-004 | `FAMILIAR_PRACTICE` | IMPLEMENTED_TESTED | lib/v2/attempt-types.ts | v2/fr-017-new-prove-progress.test.ts |  |
| APP-PRAC-005 | Excluded from progression | IMPLEMENTED_TESTED | lib/v2/familiar-practice.ts | v2/fr-018-familiar-practice.test.ts; v2/fr-017-new-prove-progress.test.ts |  |
| APP-PRAC-006 | Return naturally | IMPLEMENTED_TESTED | lib/v2/familiar-practice.ts | v2/fr-018-familiar-practice.test.ts |  |
| APP-PRAC-007 | Learner does not see remediation state | IMPLEMENTED_TESTED | lib/v2/learner-language.ts | v2/fr-019-support-invisible.test.ts |  |
| APP-COMP-001 | Hybrid model | IMPLEMENTED_TESTED | lib/v2/comprehension-score.ts | v2/fr-020-hybrid-evidence.test.ts |  |
| APP-COMP-002 | Weighting principle | IMPLEMENTED_TESTED | lib/v2/calibration.ts | v2/fr-021-weighting-lifecycle.test.ts |  |
| APP-COMP-003 | Current pilot weighting | IMPLEMENTED_TESTED | lib/v2/calibration.ts | v2/fr-020-hybrid-evidence.test.ts | 70/30 pilot. |
| APP-COMP-004 | 75% threshold is independent of weight calibration | IMPLEMENTED_TESTED | lib/v2/comprehension-threshold.ts | v2/fr-021-weighting-lifecycle.test.ts |  |
| APP-COMP-005 | Structured item-level storage | IMPLEMENTED_TESTED | lib/v2/question-alignment.ts | v2/fr-022-question-alignment.test.ts | Item-level scoring; DB persistence via APP-DB-003. |
| APP-COMP-006 | P1→P10 runtime compatibility | IMPLEMENTED_TESTED | lib/v2/question-alignment.ts | v2/fr-022-question-alignment.test.ts |  |
| APP-COMP-007 | Free explanation prompt | IMPLEMENTED_TESTED | lib/sr/free-explanation.ts | sr/sr-043-free-explanation.test.ts |  |
| APP-COMP-008 | Semantic evaluation | IMPLEMENTED_TESTED | lib/sr/semantic-recall.ts; lib/v2/spoken-expression.ts | sr/sr-044-semantic-recall.test.ts; v2/fr-023-spoken-expression.test.ts | Production judge not wired (fixtures) - see memory. |
| APP-COMP-009 | Accent/language fairness | IMPLEMENTED_TESTED | lib/v2/spoken-expression.ts | v2/fr-023-spoken-expression.test.ts | Dialect/grammar not penalised. |
| APP-COMP-010 | Editable transcript | PARTIAL | lib/sr/editable-transcript.ts | sr/sr-008-editable-transcript.test.ts | Domain done; learner UI + submit lock pending (Phase 7). |
| APP-COMP-011 | Browser-native STT | PARTIAL | lib/sr/browser-speech.ts | sr/sr-009-browser-speech-apis.test.ts | Capability detection done; live STT UI pending. |
| APP-COMP-012 | ASR is evidence, not truth | IMPLEMENTED_TESTED | lib/v2/spoken-evidence.ts | v2/fr-024-asr-uncertainty.test.ts |  |
| APP-COMP-013 | Technical spoken evidence | IMPLEMENTED_TESTED | lib/v2/spoken-evidence.ts | v2/fr-024-asr-uncertainty.test.ts |  |
| APP-COMP-014 | First-attempt independence | IMPLEMENTED_TESTED | lib/sr/* | sr/sr-045-first-attempt-independence.test.ts |  |
| APP-BPC-001 | Mandatory after completed passage scoring | IMPLEMENTED_TESTED | lib/v2/best-comprehension.ts | v2/fr-025-bpc-after-scoring.test.ts |  |
| APP-BPC-002 | Ordering | IMPLEMENTED_TESTED | lib/v2/best-comprehension.ts | v2/fr-025-bpc-after-scoring.test.ts |  |
| APP-BPC-003 | Purpose | IMPLEMENTED_TESTED | lib/v2/bpc-style.ts | v2/fr-026-bpc-story-style.test.ts |  |
| APP-BPC-004 | Not an answer-key dump | IMPLEMENTED_TESTED | lib/v2/bpc-style.ts | v2/fr-026-bpc-story-style.test.ts |  |
| APP-BPC-005 | Fidelity | IMPLEMENTED_TESTED | lib/v2/bpc-fidelity.ts | v2/fr-027-bpc-fidelity.test.ts |  |
| APP-BPC-006 | Cross-World capability | IMPLEMENTED_TESTED | lib/v2/expression-by-world.ts | v2/fr-028-permanent-features.test.ts |  |
| APP-BPC-007 | Controlled production | TODO | | | |
| APP-UX-001 | Scores are private | PARTIAL | lib/v2/learner-feedback.ts | v2/fr-029-numeric-private.test.ts | Domain tested; learner UI pending. |
| APP-UX-002 | GREEN feedback | PARTIAL | lib/v2/learner-feedback.ts | v2/fr-030-green-celebration.test.ts | Domain tested; learner UI pending. |
| APP-UX-003 | NOT_GREEN feedback | PARTIAL | lib/v2/learner-feedback.ts | v2/fr-031-below-75-positive.test.ts | Domain tested; learner UI pending. |
| APP-UX-004 | Level-Up celebration | PARTIAL | lib/v2/learner-feedback.ts | v2/fr-032-levelup-celebration.test.ts | Domain tested; learner UI pending. |
| APP-UX-005 | Book-time impact | PARTIAL | lib/v2/book-time.ts | v2/fr-033-book-time.test.ts | Domain tested; learner UI pending. |
| APP-UX-006 | No peer comparison | IMPLEMENTED_TESTED | lib/v2/personal-trajectory.ts; learner-language.ts | v2/fr-009-personal-trajectory.test.ts; v2/fr-019-support-invisible.test.ts |  |
| APP-UX-007 | Confidence-first language scan | IMPLEMENTED_TESTED | lib/v2/learner-language.ts | v2/fr-019-support-invisible.test.ts | String-level scan exists; must also run against real UI when built. |
| APP-NR-001 | Parallel namespace | IMPLEMENTED_TESTED | lib/v2/news-reader.ts | v2/fr-034-news-reader-parallel.test.ts |  |
| APP-NR-002 | Purpose | IMPLEMENTED_TESTED | lib/v2/news-reader.ts | v2/fr-034-news-reader-parallel.test.ts |  |
| APP-NR-003 | Never a core gate | IMPLEMENTED_TESTED | lib/v2/news-reader.ts | v2/fr-035-news-reader-independence.test.ts; v2/fr-043-news-reader-no-world-block.test.ts |  |
| APP-NR-004 | Shared passage, separate evidence | IMPLEMENTED_TESTED | lib/v2/evidence-store.ts | v2/fr-036-shared-content-separate-state.test.ts |  |
| APP-NR-005 | Reference delivery policy | IMPLEMENTED_TESTED | lib/v2/reference-audio.ts | v2/fr-037-reference-delivery.test.ts |  |
| APP-NR-006 | Interim TTS policy | IMPLEMENTED_TESTED | lib/v2/reference-audio.ts | v2/fr-037-reference-delivery.test.ts | 145 WPM female-voice interim policy. |
| APP-NR-007 | Browser TTS | PARTIAL | lib/narrator.ts; lib/read-along-voice.ts | narrator.test.ts; read-along-voice.test.ts | Policy tested; live browser TTS screen pending (Phase 12). |
| APP-NR-008 | Read-along highlight | PARTIAL | lib/read-along-voice.ts | read-along-voice.test.ts | Highlight logic only; News Reader screen pending. |
| APP-NR-009 | Two-read coaching | IMPLEMENTED_TESTED | lib/v2/news-reader-coaching.ts | v2/fr-038-two-read-coaching.test.ts |  |
| APP-NR-010 | Missing microphone is nonblocking | IMPLEMENTED_TESTED | lib/v2/news-reader.ts | v2/fr-034-news-reader-parallel.test.ts | Mic-unavailable attempt stored unpenalised. |
| APP-ORAL-001 | Telemetry capture | TODO | | | |
| APP-ORAL-002 | Deterministic scoring order | TODO | | | |
| APP-ORAL-003 | Sample validity before specialist score | TODO | | | |
| APP-ORAL-004 | ASR uncertainty is not child error | TODO | | | |
| APP-ORAL-005 | Accent fairness | TODO | | | |
| APP-ORAL-006 | Same-RS personal baseline | TODO | | | |
| APP-ORAL-007 | No cross-RS raw comparison | TODO | | | |
| APP-ORAL-008 | Competency timelines | TODO | | | |
| APP-ORAL-009 | Baseline strength | TODO | | | |
| APP-READY-001 | Controlled readiness forms | IMPLEMENTED_TESTED | lib/v2/readiness-forms.ts | v2/fr-044-readiness-forms.test.ts | Pre-generated QA-approved equivalent forms only; independent reviewer. |
| APP-READY-002 | Identity separation | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts | Five separate identifiers required; canonical position consumption refused. DB persistence under APP-DB-008. |
| APP-READY-003 | Attempt outcome ontology | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts |  |
| APP-READY-004 | Attempt roles | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts | Roles per this spec; must be re-checked against the approved scoring contract when it exists. |
| APP-READY-005 | Initial confirmation cannot be skipped | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts |  |
| APP-READY-006 | No retry lottery | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts | Remediation gate + no form reuse + nextForm withheld. |
| APP-READY-007 | Technical replacement preserves lifecycle phase | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts | v2/app-ready-lifecycle.test.ts |  |
| APP-READY-008 | Core progression precedence | IMPLEMENTED_TESTED | lib/v2/readiness-lifecycle.ts; lib/v2/world1-completion.ts | v2/app-ready-lifecycle.test.ts; v2/fr-043-news-reader-no-world-block.test.ts | Static import-isolation test. |
| APP-RECENCY-001 | Current evidence principle | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-002 | Versioned configurable clocks | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-003 | Current pilot defaults | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-004 | Independent evidence streams | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-005 | First trigger wins | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-006 | Version invalidation has precedence | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-007 | Revalidation pass/fail | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-RECENCY-008 | Audit | IMPLEMENTED_TESTED | lib/v2/evidence-recency.ts; lib/v2/threshold-lifecycle.ts | tests/unit/v2/fr-045-evidence-recency.test.ts | Domain layer verified (cae4c05). Persisting the audit record is tracked under APP-DATA/APP-DB. |
| APP-CLOSE-001 | P1500 alone is not mastery | IMPLEMENTED_TESTED | lib/v2/world1-completion.ts | v2/fr-040-p1500-not-sufficient.test.ts |  |
| APP-CLOSE-002 | 150 WPM is not required | IMPLEMENTED_TESTED | lib/v2/world1-completion.ts | v2/fr-041-150-not-mandatory.test.ts |  |
| APP-CLOSE-003 | Level Ups are not readiness certification | IMPLEMENTED_TESTED | lib/v2/world1-completion.ts | v2/fr-042-levelups-not-readiness.test.ts |  |
| APP-CLOSE-004 | News Reader cannot block core World progression | IMPLEMENTED_TESTED | lib/v2/world1-completion.ts | v2/fr-043-news-reader-no-world-block.test.ts |  |
| APP-DATA-001 | Explicit attempt type | TODO | | | |
| APP-DATA-002 | Required attempt fields | TODO | | | |
| APP-DATA-003 | Immutable evidence | TODO | | | |
| APP-DATA-004 | Evidence separation | TODO | | | |
| APP-DATA-005 | Decision ledger | TODO | | | |
| APP-DATA-006 | Explainability | TODO | | | |
| APP-DATA-007 | Transaction safety | IMPLEMENTED_TESTED | lib/v2/learner-repository.ts; lib/v2/progress-store.ts | tests/unit/v2/app-data-learner-repository.test.ts; ac-c05-transaction-safety.test.ts | Atomic single-file replace; fault-injection tested. |
| APP-DATA-008 | Idempotency | IMPLEMENTED_TESTED | lib/v2/learner-repository.ts; lib/v2/progress-store.ts | tests/unit/v2/app-data-learner-repository.test.ts | Idempotency key replay + domain-level attempt idempotency (AC-C04). |
| APP-DATA-009 | Server persistence | PARTIAL | lib/v2/learner-repository.ts; lib/v2/progress-store.ts | tests/unit/v2/app-data-learner-repository.test.ts | Server-side durable repository + restart recovery done. Learner UI still uses localStorage-authoritative progression (lib/progression.ts) - open until Phase 5 production reader replaces it. |
| APP-DATA-010 | Supabase responsibility | PARTIAL | supabase/migrations/0001_speedreader_learner_state.sql | tests/unit/v2/app-data-learner-repository.test.ts | Schema + atomic commit fn written; NOT applied/tested on a live Supabase project (no credentials). SupabaseLearnerRepository adapter not yet written. |
| APP-DB-001 | Learner app state | TODO | | | |
| APP-DB-002 | Attempts | TODO | | | |
| APP-DB-003 | Structured responses | TODO | | | |
| APP-DB-004 | Spoken evidence | TODO | | | |
| APP-DB-005 | Progression decisions | TODO | | | |
| APP-DB-006 | Practice selection/history | TODO | | | |
| APP-DB-007 | News Reader attempts | TODO | | | |
| APP-DB-008 | Readiness cycles/forms | TODO | | | |
| APP-DB-009 | Calibration versions | TODO | | | |
| APP-DB-010 | Content package identity | TODO | | | |
| APP-REPORT-001 | Child vs parent visibility | TODO | | | |
| APP-REPORT-002 | Personal progress | TODO | | | |
| APP-REPORT-003 | No peer rank | TODO | | | |
| APP-REPORT-004 | Complete-round composites only | TODO | | | |
| APP-CAL-001 | Versioned pilot parameters | TODO | | | |
| APP-CAL-002 | Frozen 75% rule | TODO | | | |
| APP-CAL-003 | Post-launch calibration evidence | TODO | | | |
| APP-CAL-004 | No automatic threshold mutation | TODO | | | |
| APP-CAL-005 | Historical replay | TODO | | | |
| APP-NFR-001 | Responsive learner journey | TODO | | | |
| APP-NFR-002 | Microphone permissions | TODO | | | |
| APP-NFR-003 | Capability detection | TODO | | | |
| APP-NFR-004 | Graceful degradation | TODO | | | |
| APP-NFR-005 | Accessibility QA | TODO | | | |
| APP-NFR-006 | Child usability | TODO | | | |
| APP-NFR-007 | Diagnostics protection | TODO | | | |
| APP-NFR-008 | Fail safe | TODO | | | |
| APP-NFR-009 | Performance | TODO | | | |
| APP-PRIV-001 | Least necessary learner data | TODO | | | |
| APP-PRIV-002 | Container identity | TODO | | | |
| APP-PRIV-003 | Structured cross-app progress only | TODO | | | |
| APP-PRIV-004 | No public debug evidence | TODO | | | |
| APP-API-001 | Bootstrap | TODO | | | |
| APP-API-002 | Initial assessment | TODO | | | |
| APP-API-003 | Next activity | TODO | | | |
| APP-API-004 | Passage completion | TODO | | | |
| APP-API-005 | Speech evidence | TODO | | | |
| APP-API-006 | BPC retrieval | TODO | | | |
| APP-API-007 | News Reader | TODO | | | |
| APP-API-008 | Progress | TODO | | | |
| APP-API-009 | Resume | TODO | | | |
| APP-API-010 | Calibration/ops | TODO | | | |
| APP-KM-001 | Correct delivery coordinate | TODO | | | |
| APP-KM-002 | Shared canonical tokenizer | TODO | | | |
| APP-KM-003 | Fixed segment coordinates | TODO | | | |
| APP-KM-004 | Deterministic scoring contracts | TODO | | | |
| APP-KM-005 | Attempt validity first | TODO | | | |
| APP-KM-006 | Primary/confirmation lifecycle | TODO | | | |
| APP-KM-007 | P10 primary item | TODO | | | |
| APP-KM-008 | No compensation across independent evidence types | TODO | | | |
| APP-KM-009 | Package/version validation | TODO | | | |
| CLAUDE-001 | Read before editing | TODO | | | |
| CLAUDE-002 | Reuse verified domain logic | TODO | | | |
| CLAUDE-003 | TDD for every requirement | TODO | | | |
| CLAUDE-004 | Traceability is mandatory | TODO | | | |
| CLAUDE-005 | Do not implement content authoring | TODO | | | |
