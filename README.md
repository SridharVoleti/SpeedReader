# BabySteps app container

A reusable Next.js shell that hosts one learning app and speaks the BabySteps embedded-app
protocol (`/health`, `/launch`, `/return`, `/identity`, progress sync).

```
container/    BabySteps container - app-agnostic, never edit per app
  app-contract.ts   the interface a hosted app must satisfy (AppIdentity, AppManifest)
  launch/           launch-code exchange, assertions, session cookies, platform API
  routes/           route handlers (health, identity, launch, return, progress-sync)
  docs/             BabySteps integration contract
  tests/            container Playwright specs
app/          Next.js router shims (container-owned): re-export container routes and
              resolve pages from the hosted app's manifest
hosted-app/   EVERYTHING app-specific (currently SpeedReader): UI, lib, data, backend,
              tests, docs, content, requirements
```

## Hosting a different app

Replace the `hosted-app/` folder with the new app's folder. It must provide:

- `hosted-app/app.identity.ts` - default export `AppIdentity` (display name, cookie prefix, journey)
- `hosted-app/app.manifest.ts` - default export `AppManifest` (layout, metadata, `Home`, `pages` table)
- tests under `hosted-app/tests/unit/**/*.test.ts` and `hosted-app/tests/ui/**/*.spec.ts`

Nothing in `container/` or `app/` changes. Shared tooling (`package.json`, `tsconfig.json`,
`vitest.config.ts`, `playwright.config.ts`) is container-level; add any extra npm
dependencies the new app needs to `package.json`.

SpeedReader's own docs are in `hosted-app/README.md`.
