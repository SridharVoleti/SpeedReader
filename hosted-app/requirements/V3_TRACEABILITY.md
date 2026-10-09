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
| APP-GOV-001 | One application source of truth | TODO | | | |
| APP-GOV-002 | Precedence before v3.0 freeze | TODO | | | |
| APP-GOV-003 | Requirement states | TODO | | | |
| APP-GOV-004 | No silent product redesign | TODO | | | |
| APP-GOV-005 | Historical outcomes remain historical | TODO | | | |
| APP-NORTH-001 | Three outcomes | TODO | | | |
| APP-NORTH-002 | Confidence-first | TODO | | | |
| APP-NORTH-003 | Personal trajectory | TODO | | | |
| APP-PLAT-001 | Consumer App Container is the mandatory host | TODO | | | |
| APP-PLAT-002 | Typed manifest contract | TODO | | | |
| APP-PLAT-003 | Standard launch protocol | TODO | | | |
| APP-PLAT-004 | No duplicate authentication system | TODO | | | |
| APP-PLAT-005 | No duplicate billing | TODO | | | |
| APP-PLAT-006 | Single active learner/device rule | TODO | | | |
| APP-PLAT-007 | Platform session envelope | TODO | | | |
| APP-PLAT-008 | Review-session integration | TODO | | | |
| APP-PLAT-009 | Accidental-close resume | TODO | | | |
| APP-PLAT-010 | Return to Babysteps | TODO | | | |
| APP-INFRA-001 | Web-first, mobile-required | TODO | | | |
| APP-INFRA-002 | Reference browser | TODO | | | |
| APP-INFRA-003 | Deployment | TODO | | | |
| APP-INFRA-004 | Speech cost principle | TODO | | | |
| APP-INFRA-005 | Email is not a SpeedReader runtime dependency | TODO | | | |
| APP-WORLD-001 | Five Worlds | TODO | | | |
| APP-WORLD-002 | World 1 implementation scope | TODO | | | |
| APP-WORLD-003 | World 2–5 broad strategy support | TODO | | | |
| APP-W1-001 | 1,500 canonical sequence positions | TODO | | | |
| APP-W1-002 | First 150 | TODO | | | |
| APP-W1-003 | Stamina staircase | TODO | | | |
| APP-W1-004 | One meaningful challenge increase at a time | TODO | | | |
| APP-W1-005 | Progressive stamina validation | TODO | | | |
| APP-W1-006 | Canonical sequence is not altered by practice | TODO | | | |
| APP-ASSESS-001 | Mandatory new-learner baseline | TODO | | | |
| APP-ASSESS-002 | Purpose | TODO | | | |
| APP-ASSESS-003 | Comprehension decides starting speed | TODO | | | |
| APP-ASSESS-004 | Deterministic and auditable | TODO | | | |
| APP-ASSESS-005 | Baseline persistence | TODO | | | |
| APP-ASSESS-006 | First canonical passage | TODO | | | |
| APP-READ-001 | Canonical token stream | TODO | | | |
| APP-READ-002 | WPM-driven display | TODO | | | |
| APP-READ-003 | Passage completion event | TODO | | | |
| APP-READ-004 | Nonblocking canonical progression | TODO | | | |
| APP-READ-005 | Technical interruption | TODO | | | |
| APP-READ-006 | Session boundary | TODO | | | |
| APP-WPM-001 | World 1 ceiling | TODO | | | |
| APP-WPM-002 | Level semantics | TODO | | | |
| APP-WPM-003 | Comprehension-only WPM gate | TODO | | | |
| APP-WPM-004 | Internal GREEN threshold | TODO | | | |
| APP-WPM-005 | First-five rule | TODO | | | |
| APP-WPM-006 | Post-five rule | TODO | | | |
| APP-WPM-007 | No decrement | TODO | | | |
| APP-WPM-008 | 149→150 and ceiling behaviour | TODO | | | |
| APP-WPM-009 | Idempotent Level Up | TODO | | | |
| APP-WPM-010 | Atomic award | TODO | | | |
| APP-PRAC-001 | Architectural rule | TODO | | | |
| APP-PRAC-002 | Practice eligibility | TODO | | | |
| APP-PRAC-003 | Current WPM | TODO | | | |
| APP-PRAC-004 | `FAMILIAR_PRACTICE` | TODO | | | |
| APP-PRAC-005 | Excluded from progression | TODO | | | |
| APP-PRAC-006 | Return naturally | TODO | | | |
| APP-PRAC-007 | Learner does not see remediation state | TODO | | | |
| APP-COMP-001 | Hybrid model | TODO | | | |
| APP-COMP-002 | Weighting principle | TODO | | | |
| APP-COMP-003 | Current pilot weighting | TODO | | | |
| APP-COMP-004 | 75% threshold is independent of weight calibration | TODO | | | |
| APP-COMP-005 | Structured item-level storage | TODO | | | |
| APP-COMP-006 | P1→P10 runtime compatibility | TODO | | | |
| APP-COMP-007 | Free explanation prompt | TODO | | | |
| APP-COMP-008 | Semantic evaluation | TODO | | | |
| APP-COMP-009 | Accent/language fairness | TODO | | | |
| APP-COMP-010 | Editable transcript | TODO | | | |
| APP-COMP-011 | Browser-native STT | TODO | | | |
| APP-COMP-012 | ASR is evidence, not truth | TODO | | | |
| APP-COMP-013 | Technical spoken evidence | TODO | | | |
| APP-COMP-014 | First-attempt independence | TODO | | | |
| APP-BPC-001 | Mandatory after completed passage scoring | TODO | | | |
| APP-BPC-002 | Ordering | TODO | | | |
| APP-BPC-003 | Purpose | TODO | | | |
| APP-BPC-004 | Not an answer-key dump | TODO | | | |
| APP-BPC-005 | Fidelity | TODO | | | |
| APP-BPC-006 | Cross-World capability | TODO | | | |
| APP-BPC-007 | Controlled production | TODO | | | |
| APP-UX-001 | Scores are private | TODO | | | |
| APP-UX-002 | GREEN feedback | TODO | | | |
| APP-UX-003 | NOT_GREEN feedback | TODO | | | |
| APP-UX-004 | Level-Up celebration | TODO | | | |
| APP-UX-005 | Book-time impact | TODO | | | |
| APP-UX-006 | No peer comparison | TODO | | | |
| APP-UX-007 | Confidence-first language scan | TODO | | | |
| APP-NR-001 | Parallel namespace | TODO | | | |
| APP-NR-002 | Purpose | TODO | | | |
| APP-NR-003 | Never a core gate | TODO | | | |
| APP-NR-004 | Shared passage, separate evidence | TODO | | | |
| APP-NR-005 | Reference delivery policy | TODO | | | |
| APP-NR-006 | Interim TTS policy | TODO | | | |
| APP-NR-007 | Browser TTS | TODO | | | |
| APP-NR-008 | Read-along highlight | TODO | | | |
| APP-NR-009 | Two-read coaching | TODO | | | |
| APP-NR-010 | Missing microphone is nonblocking | TODO | | | |
| APP-ORAL-001 | Telemetry capture | TODO | | | |
| APP-ORAL-002 | Deterministic scoring order | TODO | | | |
| APP-ORAL-003 | Sample validity before specialist score | TODO | | | |
| APP-ORAL-004 | ASR uncertainty is not child error | TODO | | | |
| APP-ORAL-005 | Accent fairness | TODO | | | |
| APP-ORAL-006 | Same-RS personal baseline | TODO | | | |
| APP-ORAL-007 | No cross-RS raw comparison | TODO | | | |
| APP-ORAL-008 | Competency timelines | TODO | | | |
| APP-ORAL-009 | Baseline strength | TODO | | | |
| APP-READY-001 | Controlled readiness forms | TODO | | | |
| APP-READY-002 | Identity separation | TODO | | | |
| APP-READY-003 | Attempt outcome ontology | TODO | | | |
| APP-READY-004 | Attempt roles | TODO | | | |
| APP-READY-005 | Initial confirmation cannot be skipped | TODO | | | |
| APP-READY-006 | No retry lottery | TODO | | | |
| APP-READY-007 | Technical replacement preserves lifecycle phase | TODO | | | |
| APP-READY-008 | Core progression precedence | TODO | | | |
| APP-RECENCY-001 | Current evidence principle | TODO | | | |
| APP-RECENCY-002 | Versioned configurable clocks | TODO | | | |
| APP-RECENCY-003 | Current pilot defaults | TODO | | | |
| APP-RECENCY-004 | Independent evidence streams | TODO | | | |
| APP-RECENCY-005 | First trigger wins | TODO | | | |
| APP-RECENCY-006 | Version invalidation has precedence | TODO | | | |
| APP-RECENCY-007 | Revalidation pass/fail | TODO | | | |
| APP-RECENCY-008 | Audit | TODO | | | |
| APP-CLOSE-001 | P1500 alone is not mastery | TODO | | | |
| APP-CLOSE-002 | 150 WPM is not required | TODO | | | |
| APP-CLOSE-003 | Level Ups are not readiness certification | TODO | | | |
| APP-CLOSE-004 | News Reader cannot block core World progression | TODO | | | |
| APP-DATA-001 | Explicit attempt type | TODO | | | |
| APP-DATA-002 | Required attempt fields | TODO | | | |
| APP-DATA-003 | Immutable evidence | TODO | | | |
| APP-DATA-004 | Evidence separation | TODO | | | |
| APP-DATA-005 | Decision ledger | TODO | | | |
| APP-DATA-006 | Explainability | TODO | | | |
| APP-DATA-007 | Transaction safety | TODO | | | |
| APP-DATA-008 | Idempotency | TODO | | | |
| APP-DATA-009 | Server persistence | TODO | | | |
| APP-DATA-010 | Supabase responsibility | TODO | | | |
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
