import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

// Real approved SR package set, seeded by hosted-app/tests/ui/sr-global-setup.ts through the real pipeline.
const SR_E2E = resolve(__dirname, ".sr-e2e");

export default defineConfig({
  testDir: ".",
  testMatch: ["container/tests/**/*.spec.ts", "hosted-app/tests/ui/**/*.spec.ts"],
  fullyParallel: true,
  globalSetup: "./hosted-app/tests/ui/sr-global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run start -- -p 3001",
    env: {
      // Hermetic: a developer's .env.local must never leak real BabySteps launch config into the tests.
      APP_LAUNCH_CLIENT_ID: "", APP_LAUNCH_APP_ID: "", APP_LAUNCH_ENVIRONMENT: "", APP_LAUNCH_DEPLOYMENT_ID: "",
      APP_LAUNCH_APP_KEY: "", APP_LAUNCH_EXCHANGE_URL: "", APP_LAUNCH_RETURN_URL: "",
      APP_LAUNCH_SIGNING_PRIVATE_KEY: "", APP_LAUNCH_BOOTSTRAP_SECRET: "",
      SR_APPROVED_ROOT: resolve(SR_E2E, "approved"),
      SR_WIP_ROOT: resolve(SR_E2E, "wip"),
      SR_DATA_DIR: resolve(SR_E2E, "data")
    },
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "desktop",
      use: { viewport: { width: 1280, height: 800 } }
    },
    {
      name: "thirty-percent-browser",
      use: { viewport: { width: 430, height: 900 } }
    }
  ]
});
