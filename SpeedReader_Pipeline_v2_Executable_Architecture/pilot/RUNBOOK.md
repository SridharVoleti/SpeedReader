# Pilot Runbook

1. Complete and hash-lock the canonical package. Production must fail closed while `canonical_manifest.json` reports missing normative artifacts.
2. Initialize the local SQLite database.
3. Register the Phase-A production units.
4. Run deterministic Role 1 locally.
5. Queue Role 2 creator. Export manual job packet.
6. Execute Role 2 in a fresh semantic session and import structured result.
7. Queue/run independent Role 2 QA in a separate fresh context.
8. On PASS, promote exact candidate; on FAIL, orchestrator routes blocker and schedules owner correction.
9. Repeat Roles 3, 4, 5, 6S with independent QA.
10. Run deterministic scoring completion, Role 7 and Role 8/final validators.
11. Review pilot metrics before moving Phase A -> B -> C.
12. Do not enable an automatic LLM API runner during the pilot unless explicitly approved.
