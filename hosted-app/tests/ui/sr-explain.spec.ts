import { expect, test, type Page } from "@playwright/test";

// Issue #14 - the learner journey against a REAL approved package (seeded through the real pipeline by sr-global-setup).
const PKG = "PKG-W1-0001";
const GOOD = ["Ravi bought a pencil, a notebook, and a packet of biscuits", "Ravi returned the extra coins"];

type AsrMode = { kind: "ok"; transcript: string; confidence: number } | { kind: "error" } | { kind: "none" };

async function installSpeech(page: Page, mode: AsrMode) {
  await page.addInitScript((m) => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    w.__spoken = spoken;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak: (u: { text: string; onend?: () => void }) => { spoken.push(u.text); setTimeout(() => u.onend?.(), 10); }, cancel() {}, pause() {}, resume() {}, getVoices: () => [{ name: "Microsoft Neerja Online (Natural)", lang: "en-IN", localService: false }], addEventListener() {}, removeEventListener() {} } });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class { text: string; constructor(t: string) { this.text = t; } } });
    // modern Chromium exposes both the prefixed and the unprefixed API, so both are replaced (or removed)
    const define = (name: string, value: unknown) => Object.defineProperty(window, name, { value, configurable: true, writable: true });
    if (m.kind === "none") { define("SpeechRecognition", undefined); define("webkitSpeechRecognition", undefined); return; }
    const Fake = class {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null; onerror: (() => void) | null = null; onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          if (m.kind === "ok") this.onresult?.({ results: [[{ transcript: m.transcript, confidence: m.confidence }]] });
          else this.onerror?.();
          this.onend?.();
        }, 20);
      }
      stop() {}
    };
    define("SpeechRecognition", Fake);
    define("webkitSpeechRecognition", Fake);
  }, mode);
}

async function answerAll(page: Page, picks: number[]) {
  for (const [n, id] of ["I1", "I2", "I3", "I4"].entries()) {
    await page.getByTestId(`sr-item-${id}`).locator('input[type="radio"]').nth(picks[n]).check();
  }
}

test.describe("approved package learner journey", () => {
  test("unsupported browser: typed fallback, first-attempt evidence, feedback and separate readiness", async ({ page }) => {
    await installSpeech(page, { kind: "none" });
    await page.goto(`/explain?pkg=${PKG}`);
    await expect(page.getByTestId("sr-passage")).toContainText("Ravi visited a small shop");
    await expect(page.getByTestId("sr-speak")).toHaveCount(0);
    await expect(page.getByTestId("sr-typed-note")).toContainText("type your answer");
    await expect(page.getByTestId("sr-submit")).toBeDisabled();
    await answerAll(page, [0, 0, 0, 0]);
    await page.getByTestId("sr-transcript").fill(GOOD.join(". "));
    const req = page.waitForRequest((r) => r.url().includes("/api/sr/attempt"));
    await page.getByTestId("sr-submit").click();
    const body = (await req).postDataJSON();
    expect(body.explanation).toMatchObject({ corrected: GOOD.join(". "), asrFailed: false, asrConfidence: 1 });
    await expect(page.getByTestId("sr-feedback")).toBeVisible();
    await expect(page.getByTestId("sr-comprehension")).toContainText("4 of 4");
    await expect(page.getByTestId("sr-comprehension")).toContainText("first try");
    await expect(page.getByTestId("sr-explained")).toContainText("2 of 4");
    await expect(page.getByTestId("sr-readiness")).toContainText("Comprehension readiness: pass");
    await expect(page.getByTestId("sr-readiness")).toContainText("Oral reading readiness: not assessed");
    await expect(page.getByTestId("sr-continue")).toBeVisible();
  });

  test("speech path: transcript is editable and raw ASR is stored separately from the correction", async ({ page }) => {
    await installSpeech(page, { kind: "ok", transcript: "ravi return the extra coin", confidence: 0.82 });
    await page.goto(`/explain?pkg=${PKG}`);
    await page.getByTestId("sr-speak").click();
    await expect(page.getByTestId("sr-transcript")).toHaveValue("ravi return the extra coin");
    await page.getByTestId("sr-transcript").fill("Ravi returned the extra coins");
    await answerAll(page, [0, 0, 0, 0]);
    const req = page.waitForRequest((r) => r.url().includes("/api/sr/attempt"));
    await page.getByTestId("sr-submit").click();
    expect((await req).postDataJSON().explanation).toMatchObject({ raw: "ravi return the extra coin", corrected: "Ravi returned the extra coins", asrFailed: false, asrConfidence: 1 });
    await expect(page.getByTestId("sr-explained")).toContainText("1 of 4");
  });

  test("ASR failure never blocks: learner is moved to typing and can finish", async ({ page }) => {
    await installSpeech(page, { kind: "error" });
    await page.goto(`/explain?pkg=${PKG}`);
    await page.getByTestId("sr-speak").click();
    await expect(page.getByTestId("sr-typed-note")).toContainText("couldn't hear");
    await answerAll(page, [0, 0, 0, 0]);
    await page.getByTestId("sr-transcript").fill("He gave the money back");
    const req = page.waitForRequest((r) => r.url().includes("/api/sr/attempt"));
    await page.getByTestId("sr-submit").click();
    expect((await req).postDataJSON().explanation.asrFailed).toBe(true);
    await expect(page.getByTestId("sr-feedback")).toBeVisible();
  });

  test("weak first attempt: replay + optional retry offered, revisit listed, progress never blocked; retry is not first-attempt evidence", async ({ page }) => {
    await installSpeech(page, { kind: "none" });
    await page.goto(`/explain?pkg=${PKG}`);
    await answerAll(page, [1, 1, 1, 1]);
    await page.getByTestId("sr-transcript").fill("something happened at a place");
    await page.getByTestId("sr-submit").click();
    await expect(page.getByTestId("sr-readiness")).toContainText("Comprehension readiness: not yet");
    await expect(page.getByTestId("sr-hints")).toContainText("Remember:");
    await expect(page.getByTestId("sr-revisit")).toContainText(PKG);
    await expect(page.getByTestId("sr-continue")).toBeVisible();
    await page.getByTestId("sr-replay").click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(" "))).toContain("Ravi bought some things");
    await page.getByTestId("sr-retry").click();
    await answerAll(page, [0, 0, 0, 0]);
    await page.getByTestId("sr-transcript").fill(GOOD.join(". "));
    await page.getByTestId("sr-submit").click();
    await expect(page.getByTestId("sr-comprehension")).toContainText("practice try");
    await expect(page.getByTestId("sr-readiness")).toContainText("not first attempt evidence");
  });

  test("an unknown package shows a clear error instead of content", async ({ page }) => {
    await installSpeech(page, { kind: "none" });
    await page.goto("/explain?pkg=PKG-W1-9999");
    await expect(page.getByTestId("sr-error")).toContainText("unavailable");
  });
});
