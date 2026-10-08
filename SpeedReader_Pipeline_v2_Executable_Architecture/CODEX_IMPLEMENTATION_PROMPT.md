# Codex Implementation Prompt — SpeedReader Pipeline v2

Implement this package in the `SridharVoleti/SpeedReader` repository without introducing an LLM API runner.

## Goal

Build the local, resumable pipeline described here for the 150-passage World 1 Band A pilot.

## Constraints

- SQLite is local state only; no hosted DB and no model API.
- Default execution mode is MANUAL_PACKET.
- Preserve current app/tests unless an approved v2 requirement supersedes them.
- TDD: failing regression/integration test first, then implementation, then green run.
- Do not invent canonical rules that are missing from the package.
- Missing canonical artifacts must fail closed.

## Work

1. Add canonical package validation and exact SHA-256 locking.
2. Implement SQLite schema/migrations and repository-local configurable paths.
3. Implement queue eligibility from approved upstream hashes.
4. Implement manual packet prompt renderer: common contract + role contract + exact canonical excerpts + approved upstream artifacts + machine evidence.
5. Implement creator result import and independent QA job creation.
6. Implement immutable candidate hashing and QA certificate binding.
7. Implement persistent defect routing to the true owner.
8. Implement retry limit (3) and early escalation on same blocker twice.
9. Implement dependency-aware invalidation/revalidation.
10. Implement deterministic Role 1, Role 7 and Role 8 interfaces; fail closed wherever canonical data is not yet supplied.
11. Integrate the single canonical COUNT-100 implementation only after its approved spec exists.
12. Implement atomic WIP→approved promotion on the real filesystem.
13. Add audit events and restart/resume tests.
14. Add Phase-A pilot commands for 3–5 units.

## Required tests

- restart retains queue/approval/defect state;
- QA cannot approve changed candidate bytes;
- downstream cannot consume WIP;
- changed upstream hash invalidates only true descendants;
- Role 6S can route a Role 4 defect directly to Role 4;
- Role 8 validation can route a Role 2 source defect without Role 8 editing it;
- three creator failures escalate;
- repeated identical blocker twice escalates early;
- upstream-caused rerun does not consume downstream retry quota;
- missing canonical artifact fails closed;
- no code path imports/calls an LLM API in MANUAL_PACKET mode.

## Stop condition

Finish with code/tests/typecheck/build green and a report of any canonical inputs still missing. Do not claim independent QA PASS.
