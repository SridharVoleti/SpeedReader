# Speed Reading App

Babysteps SpeedReader: **read faster, understand deeply, explain clearly.** The product contract is
`../requirements/SpeedReader_Definitive_App_Requirements_Claude_Code_Acceptance_v3.0.md`; per-requirement status,
tests and open items are in `requirements/V3_TRACEABILITY.md`.

## How the learner journey works (v3)

- **Start:** a short adaptive assessment finds the learner's sustainable starting speed (comprehension decides it).
- **Read:** each story appears one word at a time at the learner's earned WPM (max 150 in World 1).
- **Check:** structured questions plus a retelling in the learner's own words (typed, or spoken with an editable
  transcript). Scoring is server-side and internal: the learner never sees scores or pass/fail labels.
- **Level Up = +1 WPM.** Earned speed is never taken away. The first five stories at a speed decide the Level Up
  (4 of 5 good), then three good stories in a row; a weak story just means the speed holds and a familiar story may
  be offered for confidence. Longer stories arrive in 25-word steps and never at the same moment as a speed rise.
- **After every story** the learner can see how a strong reader might tell it (Best Possible Comprehension).
- **Reading aloud (News Reader)** is a separate optional activity: listen to a female reference voice at 145 WPM with a
  read-along highlight, then read aloud twice. It never affects speed or progress.
- Sessions follow the Babysteps envelope (45 minutes, 2 per week, every 6th a review session of familiar stories,
  15-minute accidental-close resume, one device at a time).

## Architecture in one paragraph

`ui/learner/*` is a thin client over `/api/v3/*` (`api/v3.ts`), which delegates to `lib/v2/learner-service.ts`; every
rule lives in a tested `lib/v2/*` domain module. State is durable through ports: file adapters locally, Supabase
adapters when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (schema in `supabase/migrations`, verified in
tests against real Postgres via PGlite). **On a Vercel production deployment (`VERCEL_ENV=production`) Supabase is
required and persistence fails closed**: missing or malformed settings give `/health` 503 `CONFIGURATION_ERROR` and
`/api/v3` 503 `SERVER_CONFIGURATION`, never a file fallback (production variables are listed in `../.env.local.example`).
Content comes only from approved SR packages; with none approved the journey
fails closed with a friendly message. Demo/diagnostic pages (including the old 36-level demo at `/legacy-demo`) are
mounted only when `SR_ENABLE_DIAGNOSTICS=true` and never on a Vercel production deployment.

## BabySteps launch integration

Speed Reading can be opened from inside the BabySteps parent app, with the child already
signed in — the same `/health`, `/launch`, `/return`, `/identity` protocol BabySteps uses for
every embedded app. See `../container/docs/app-launch-integration.md` for the full contract and
`../.env.local.example` for the required `APP_LAUNCH_*` / `SESSION_SECRET` environment variables.
The app works standalone (without any of this configured) exactly as before.

Legacy 36-level demo only (diagnostics route `/legacy-demo`): level data lives in `data/progression.json`, passages in
`data/passages/level-1.json`. The comprehension scorer exists twice by
design — `backend/speed_reading/scoring.py` (source of truth, unit-tested)
and `lib/scoring.ts` (browser port); keep their weights in sync.

## Local file repository: lock policy (dev/test only)
`FileLearnerRepository` serialises writers with an exclusive `<learner>.learner.json.lock` file that records `{pid, host, createdAt}`. A lock left behind by a crash is recovered automatically when its owner process on this host no longer exists, or when it is older than 30 s (`lockStaleMs`; covers pid reuse, foreign hosts and a crash between creating and filling the file). A fresh lock held by a live, foreign or unreadable owner is never removed and the commit returns `LOCKED`. The stale file is renamed aside and verified before it is deleted. This is a single-machine policy; production multi-instance concurrency is handled by the Supabase path (versioned compare-and-swap), not by this adapter.

## Commands

```bash
npm run dev        # start the app (or double-click run.bat on Windows)
npm run test:ui    # Playwright tests (requires a production build first)
npm run test:backend
```

Python tests can be run without installing the frontend dependencies:

```bash
python -m pytest backend/tests
```
