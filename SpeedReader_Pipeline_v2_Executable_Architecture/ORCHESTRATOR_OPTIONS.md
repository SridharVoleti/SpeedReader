# SQLite and API — Decision Note

## SQLite does not require an API

SQLite is a file-based embedded database. The database can live at, for example:

`D:\Sridhar\Projects\SpeedReader\pipeline\state\speedreader.db`

A local Python or Node program opens that file directly. There is no database server and no network/API call.

## Where an LLM API would enter

An API is needed only if you want the local orchestrator itself to automatically launch hosted LLM jobs without a human/session handoff.

### Option A — No LLM API (recommended pilot)

1. Local orchestrator selects next semantic job.
2. It writes `job_packet.json` + rendered prompt.
3. You launch the job in ChatGPT Work/Codex/Claude.
4. The job writes/returns `agent_result.json`.
5. Local orchestrator imports it, verifies schema/hash/state, and advances or routes.

SQLite still provides durable resume, routing and traceability.

### Option B — API later

Keep the same database and job format. Add a runner adapter that reads queued jobs and calls a provider API. No pipeline redesign is needed.

### Option C — Platform automation/Work

If the chosen platform can invoke jobs and persist/read the workspace under your control, it can act as the runner. The SQLite schema still remains the durable pipeline state if local filesystem access is available; otherwise use the platform's durable store through an adapter.

## Recommendation

Use **Option A for the 150-passage pilot**. It avoids API cost and lets us learn the real QA/rework rate. Decide on unattended API execution only after the pilot shows the economics and stability.
