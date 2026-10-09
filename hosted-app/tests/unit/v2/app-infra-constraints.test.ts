import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const playwright = readFileSync("playwright.config.ts", "utf8");

describe("APP-INFRA-001/002 web-first, mobile-required, Chromium/Edge reference", () => {
  it("the e2e matrix covers a phone, a desktop and a constrained browser, all on Chromium", () => {
    expect(playwright).toMatch(/name: "mobile"[\s\S]*isMobile: true[\s\S]*hasTouch: true/);
    expect(playwright).toMatch(/name: "desktop"/);
    expect(playwright).toMatch(/name: "thirty-percent-browser"/);
    expect([...playwright.matchAll(/browserName: "(\w+)"/g)].every((m) => m[1] === "chromium")).toBe(true);
  });
  it("speech capability is detected, not assumed (capability list is part of bootstrap)", () => {
    const svc = readFileSync("hosted-app/lib/v2/learner-service.ts", "utf8");
    expect(svc).toMatch(/optional: \["microphone", "speech-recognition", "speech-synthesis", "voices"\]/);
    expect(readFileSync("hosted-app/lib/sr/browser-speech.ts", "utf8")).toMatch(/SpeechRecognition/);
  });
});

describe("APP-INFRA-003 deployment", () => {
  it("pins the Vercel functions region to Singapore (sin1)", () => {
    expect(JSON.parse(readFileSync("vercel.json", "utf8"))).toEqual({ regions: ["sin1"] });
  });
  it("targets Supabase for data (schema authored) and keeps it lean: no heavyweight data/infra dependencies", () => {
    expect(readFileSync("hosted-app/supabase/migrations/0001_speedreader_learner_state.sql", "utf8")).toMatch(/Singapore/);
    expect(deps.filter((d) => /prisma|typeorm|mongoose|redis|kafka|aws-sdk/.test(d))).toEqual([]);
  });
});

describe("APP-INFRA-004 speech cost principle", () => {
  it("no paid STT/TTS dependency is introduced", () => {
    const paid = /deepgram|assemblyai|elevenlabs|speechmatics|azure.*speech|cognitiveservices|aws-sdk|@aws|polly|@google-cloud\/(speech|text-to-speech)|openai|whisper/i;
    expect(deps.filter((d) => paid.test(d))).toEqual([]);
  });
  it("runtime speech uses only the browser/on-device APIs", () => {
    for (const f of ["hosted-app/lib/sr/browser-speech.ts", "hosted-app/lib/narrator.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/https?:\/\/[^"'\s]*(speech|tts|stt|voice)/i);
    }
  });
});

describe("APP-INFRA-005 email is not a runtime dependency", () => {
  it("no email provider dependency or call in the app, container or APIs", () => {
    expect(deps.filter((d) => /resend|sendgrid|nodemailer|postmark|mailgun|@react-email/i.test(d))).toEqual([]);
    for (const f of ["hosted-app/api/v3.ts", "hosted-app/api/sr-explain.ts", "hosted-app/lib/v2/learner-service.ts", "container/routes/launch.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/resend|sendgrid|nodemailer|smtp/i);
    }
  });
});
