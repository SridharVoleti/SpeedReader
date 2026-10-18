import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

const browser = (process.env.WATCH_BROWSER ?? "edge").toLowerCase();
if (!["edge", "chrome", "safari"].includes(browser)) {
  throw new Error("WATCH_BROWSER must be edge, chrome, or safari");
}
const root = resolve(__dirname, "..");
const fixtures = resolve(root, ".sr-e2e");
const output = resolve(root, "watch-results", browser);

export default defineConfig({
  testDir: __dirname,
  testMatch: "**/*.watch.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: resolve(root, "hosted-app/tests/ui/sr-global-setup.ts"),
  outputDir: resolve(output, "artifacts"),
  reporter: [
    ["list"],
    ["html", { outputFolder: resolve(output, "html"), open: "never" }],
    ["json", { outputFile: resolve(output, "results.json") }]
  ],
  use: {
    baseURL: "http://127.0.0.1:3003",
    headless: false,
    viewport: { width: 1450, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on",
    video: "on",
    screenshot: "on"
  },
  webServer: {
    command: "npm run dev",
    cwd: root,
    env: {
      SR_APPROVED_ROOT: resolve(fixtures, "approved"),
      SR_WIP_ROOT: resolve(fixtures, "wip"),
      SR_DATA_DIR: resolve(fixtures, "data")
    },
    url: "http://127.0.0.1:3003",
    timeout: 180_000,
    reuseExistingServer: false
  },
  projects: [{
    name: browser,
    use: browser === "safari"
      ? { browserName: "webkit" }
      : { browserName: "chromium", channel: browser === "edge" ? "msedge" : "chrome" }
  }]
});
