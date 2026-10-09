import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Issue #32: production-path docs/comments must describe the V3 architecture (server-authoritative learner state), not the
// superseded localStorage-only model, and .env.local.example must document the V3 production runtime.
const root = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const PRODUCTION_PATH_FILES = [
  "container/docs/app-launch-integration.md",
  "container/launch/session.ts",
  "container/launch/platform-api.ts",
  "container/routes/health.ts",
  "container/routes/progress-sync.ts",
  "hosted-app/lib/v2/learner-repository.ts",
  "hosted-app/README.md",
];

const SUPERSEDED = [
  /no backend (database|store)/i,
  /has no (backend )?database/i,
  /no database (is involved|to keep)/i,
  /progress lives (entirely )?in the browser/i,
  /localStorage (remains|is) (still )?(the )?(source of truth|authoritative)/i,
  /localStorage remains authoritative/i,
  /still no database/i,
  /nothing to persist\s+server-side/i,
];

describe("V3 architecture language in production-path docs and comments (#32)", () => {
  for (const file of PRODUCTION_PATH_FILES) {
    it(`${file} contains no superseded localStorage-era statement`, () => {
      const text = read(file);
      for (const re of SUPERSEDED) expect(text, `${file} matches ${re}`).not.toMatch(re);
    });
  }

  it("the launch integration doc states the V3 source of truth and distinguishes the Babysteps progress summary sync", () => {
    const doc = read("container/docs/app-launch-integration.md");
    expect(doc).toMatch(/server-authoritative/i);
    expect(doc).toMatch(/Supabase/);
    expect(doc).toMatch(/progress summary/i);
    expect(doc).toMatch(/fail[s]? closed/i);
    expect(doc).toMatch(/diagnostics/i);
  });

  it("legacy localStorage code is labelled historical", () => {
    expect(read("hosted-app/ui/legacy-demo/page.tsx")).toMatch(/LEGACY|historical|pre-V3/i);
  });

  it(".env.local.example documents every V3 production variable (no real secrets)", () => {
    const env = read(".env.local.example");
    for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET", "SR_APPROVED_ROOT", "SR_WIP_ROOT", "SR_INTERNAL_API_KEY",
      "SR_DATA_DIR", "SR_ENABLE_DIAGNOSTICS", "SR_ALLOW_ANONYMOUS_LEARNER", "SR_CANONICAL_DIR", "APP_LAUNCH_CLIENT_ID", "APP_LAUNCH_SIGNING_PRIVATE_KEY"]) {
      expect(env, name).toMatch(new RegExp("^#?\\s*" + name + "=", "m"));
    }
    expect(env).toMatch(/VERCEL_ENV=production/);
    expect(env).toMatch(/fails? closed/i);
    expect(env).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);                                  // no JWT-looking secrets
    for (const line of env.split("\n").filter((l) => /^(SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET|SR_INTERNAL_API_KEY)=/.test(l))) {
      expect(line.split("=")[1].split("#")[0].trim(), line).toBe("");
    }
  });
});
