# Local Orchestrator CLI — Manual Packet Mode

This scaffold makes **zero model API calls**.

```bash
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db init
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db register-unit \
  --unit RS01-P1 --canonical-id SPEEDREADER-W1-BANDA-CANONICAL --canonical-hash <hash>
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db queue \
  --unit RS01-P1 --role 2 --kind CREATOR
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db next
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db export-job \
  --job 1 --out pipeline/jobs/job-000001.json
```

Run that packet manually in the chosen semantic-agent environment. Save the structured response to `pipeline/jobs/results/job-000001-result.json`, then:

```bash
python orchestrator/orchestrator.py --db pipeline/state/speedreader.db import-result \
  --job 1 --file pipeline/jobs/results/job-000001-result.json
```

The production implementation should extend the scaffold with:

- artifact byte persistence/promotion adapter;
- approved-upstream eligibility calculation;
- exact prompt renderer (`COMMON_AGENT_CONTRACT + role contract + job packet`);
- JSON Schema validation of job/result packets;
- canonical package validation;
- deterministic Role 1/7/8 executors;
- full dependency/hash invalidation;
- audit event log.

Do not add an API runner until explicitly approved.
