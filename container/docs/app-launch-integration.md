# BabySteps Launch Integration

Speed Reading is one of several apps embedded inside the BabySteps parent app. This is the
same `app-launch` handoff protocol BabySteps uses for every embedded app (ChessMaster
included) - four routes that turn Speed Reading from a standalone site into one a BabySteps
parent can open with a single tap, with the child already signed in.

| Route | Method | Status |
|---|---|---|
| `/launch` | `POST` | **Required for a real BabySteps launch** |
| `/health` | `GET` | Polled by BabySteps' deployment pipeline before it will mark a release live |
| `/return` | `GET` | Reserved - not called by BabySteps yet, minimal stub in place |
| `/identity` | `GET` | Reserved - not called by BabySteps yet, returns 501 |

## How the handoff works

1. Parent taps "Open" inside BabySteps. Their browser is silently POSTed to
   `https://<this app>/launch` with `launchCode` + `launchAttemptId`.
2. `app/launch/route.ts` calls BabySteps' internal exchange endpoint with those two values,
   authenticated as us via a short-lived Ed25519-signed JWT (`lib/app-launch/app-assertion.ts`)
   - not a static API key.
3. BabySteps returns a **bootstrap assertion**: an HS256 JWT carrying the learner's name,
   avatar, age, and locale. We verify it (`lib/app-launch/bootstrap-assertion.ts`) with a
   secret only BabySteps and we hold.
4. We mint our own signed session token (`lib/app-launch/session.ts`) and set it as an
   httpOnly cookie, plus a small non-httpOnly cookie the client reads only to greet the learner
   (display fields, nothing sensitive).

**Learner state is server-authoritative (V3).** The launch itself only mints a signed,
self-contained session cookie. The learner's reading state (WPM, canonical pointer, decision
ledger, attempts, sessions, retention and readiness evidence) is persisted server-side through
the `LearnerRepository` port: Supabase/Postgres in production (service-role access from the
server only, RLS on every table, migrations in `hosted-app/supabase/migrations`) and file-backed
adapters for local development and tests only. A Vercel production deployment (`VERCEL_ENV=production`)
fails closed without valid Supabase configuration (`/health` returns 503 `CONFIGURATION_ERROR`);
it never falls back to local files. Browser storage is never authoritative for learner progress.
Diagnostics routes (including the legacy `/explain` journey) are mounted only when
`SR_ENABLE_DIAGNOSTICS=true` outside production. The pre-V3 localStorage-only model is historical.

## Progress sync (BabySteps "platform API")

Beyond the login handoff, BabySteps exposes an internal API that lets an embedded app persist
a learner's progress centrally, so it survives a lost device or a cleared browser instead of
living only in localStorage. **No app - ChessMaster included - had implemented this before
Speed Reading**, so there was no reference handler to copy; this was reverse-engineered
directly from the BabySteps source (`src/lib/authorization/platform-api-contracts.ts`,
`src/lib/app-authorization/service.ts`, `src/lib/app-progress/service.ts`).

This syncs only a progress summary to the Babysteps platform; it is distinct from SpeedReader's
own server-authoritative learner state above and is best-effort on top of it, never a dependency: a standalone visit (no BabySteps session) or any failure along this path is
silently a no-op - see `lib/app-launch/platform-api.ts` for the extensive "never let this block
a learner reading a passage" framing.

1. **Grant activation.** The `/launch` exchange returns a *provisional* access grant, scoped
   only to confirm the app actually rendered. `handle-app-launch.ts` immediately calls
   `confirmUsableLaunch` (`POST /v1/internal/learner-sessions/{id}/usable-launch`) to activate
   it - this is also what starts the learner's session clock on BabySteps' side, so it has to
   happen right as we're about to show them the app, not speculatively. The resulting grant
   (a rotating ~5-minute access token) rides along in the same signed session cookie, right
   alongside our own `progressVersion`/`checkpointSequence` counters (platform-sync bookkeeping only).
2. **Every call is "dual proof".** A Bearer access token (the grant) plus a *fresh* Ed25519
   app-assertion, same mechanism as the `/launch` exchange but with a different `aud` claim per
   endpoint (`babysteps:platform-api` for progress calls, `babysteps:app-session-grants:renew`
   for token renewal). `lib/app-launch/platform-api.ts` always renews the token immediately
   before use rather than tracking exact expiry - simpler, and renewal accepts an
   already-expired token as long as the underlying learner session hasn't ended.
3. **On each level pass** (`app/api/babysteps-progress/route.ts`, called from `app/page.tsx`):
   `PUT .../learner-app-progress/current` (sets the session's checkpoint to this level) followed
   by `POST .../learner-app-progress/lessons/{levelKey}/complete` (records the completion and
   advances to the next level). Both require an `expectedProgressVersion` that must exactly
   match BabySteps' own counter (optimistic concurrency) - tracked in the session cookie,
   seeded from `GET current` on the first call of a session. A completion is **permanent** per
   level key on BabySteps' side, so this is only ever called for an actual pass, never a retry.
4. **Known gap:** `usable-launch` requires an `expectedSessionVersion` that the `/launch`
   exchange response never actually provides. `1` is correct for a freshly dispatched session
   (nothing else touches it beforehand) but could be wrong for a resumed one - in which case
   confirmation just fails harmlessly and that whole session skips progress sync. Revisit if
   BabySteps' contract ever exposes the real value.

## Environment variables

See `.env.local.example` for the full list. The `APP_LAUNCH_*` names and defaults are a
platform-wide BabySteps convention - the same variables ChessMaster uses - provisioned by
BabySteps at onboarding, never invented locally. `SESSION_SECRET` is the one exception: it
signs *our own* session cookie and must never be shared with BabySteps or reused from
`APP_LAUNCH_BOOTSTRAP_SECRET` (that secret verifies tokens BabySteps signs; sharing it with our
own cookie-signing would let BabySteps - or anyone with that secret - forge our sessions).

## What BabySteps provisions for us

- An **Ed25519 keypair + `client_id`** - we hold the private half, sign the app assertion with
  it; the public half is registered against our app + environment + deployment on BabySteps' side.
- **`APP_LAUNCH_BOOTSTRAP_SECRET`** - a 32+ character HS256 shared secret, server-side only.
- Our **`app_id`, `environment`, and `deployment_id`** - bind our signed tokens to a specific release.
- The exchange endpoint URL (production: `https://www.babystepsindia.com/v1/internal/app-launch/exchange`).

None of the above exists yet for a real production launch - it is provisioned once BabySteps
onboards this app into their app registry, not before.
