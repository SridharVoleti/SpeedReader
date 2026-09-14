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
   httpOnly cookie, plus a small non-httpOnly cookie the client reads to greet the learner and
   namespace their `localStorage` progress by `learnerId` (see `lib/progression.ts`).

**No database is involved.** Speed Reading has no backend store - progress lives entirely in
the browser's localStorage (see the main README). So unlike a database-backed app, "starting a
session" here just means minting a signed, self-contained cookie; there is nothing to persist
server-side and nothing to look up on the next request.

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
