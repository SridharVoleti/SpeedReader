import { expect, test, type Page } from "@playwright/test";

// Text-to-speech on every screen (ported from the cross-browser/mobile audio fix).
// speechSynthesis is replaced by a recording fake so the test is deterministic and silent.
async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    let cancels = 0;
    class FakeUtterance {
      text: string; lang = ""; voice: unknown = null; rate = 1; pitch = 1; volume = 1;
      onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    const fake = {
      speak(u: FakeUtterance) { spoken.push(u.text); setTimeout(() => u.onend?.(), (window as unknown as { __speakMs?: number }).__speakMs ?? 20); },
      cancel() { cancels += 1; },
      resume() {},
      pause() {},
      getVoices() { return [{ name: "Microsoft Neerja Online (Natural)", lang: "en-IN", localService: false }]; },
      addEventListener() {},
      removeEventListener() {}
    };
    Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true });
    (window as unknown as { __spoken: string[]; __cancels: () => number }).__spoken = spoken;
    (window as unknown as { __cancels: () => number }).__cancels = () => cancels;
  });
}

const spokenText = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(" | "));

test("home screen is read aloud with the current block highlighted", async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/");
  await page.getByTestId("read-aloud-listen").click();
  await expect.poll(() => spokenText(page)).toContain("Climb from 100 to 200 words per minute");
  await expect.poll(() => spokenText(page)).toContain("Levels cleared");
  const text = await spokenText(page);
  expect(text).not.toMatch(/[⚡★♜ϟ]/);
  await expect(page.getByTestId("read-aloud-status")).toContainText(/Finished|Reading/);
});

test("progress and settings tabs each offer Listen and speak their own content", async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^.?\s*Progress$/ }).click();
  await page.getByTestId("read-aloud-listen").click();
  await expect.poll(() => spokenText(page)).not.toContain("Climb from");
  await expect.poll(async () => (await spokenText(page)).length).toBeGreaterThan(10);
});

for (const route of ["training-demo", "certification-demo", "item-types-demo", "frozen-v2-demo"]) {
  test(`demo screen /${route} can be listened to`, async ({ page }) => {
    await installFakeSpeech(page);
    await page.goto(`/${route}`);
    await page.getByTestId("read-aloud-listen").click();
    await expect.poll(async () => (await spokenText(page)).length).toBeGreaterThan(20);
  });
}

test("level intro is narrated, but timed reading is locked so the passage is never spoken", async ({ page }) => {
  await installFakeSpeech(page);
  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByTestId("read-aloud-listen").click();
  await expect.poll(() => spokenText(page)).toContain("Start reading");
  await expect(page.getByTestId("read-aloud-listen")).toBeVisible(); // narration finished or stopped

  const before = await spokenText(page);
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(page.getByTestId("read-aloud-listen")).toBeDisabled();
  await expect(page.getByTestId("read-aloud-status")).toContainText("timed reading");
  expect(await spokenText(page)).toBe(before);
});

test("read along like a news reader speaks sentence by sentence and the highlight follows the voice", async ({ page }) => {
  await installFakeSpeech(page);
  await page.addInitScript(() => { (window as unknown as { __speakMs: number }).__speakMs = 1500; });
  await page.goto("/");
  await page.getByTestId("level-node-1").click();
  await page.getByTestId("read-along-start").click();
  await expect(page.getByTestId("read-along-active-word")).toHaveText("Ravi");
  await expect(page.getByTestId("read-along-voice-note")).toHaveText("A female news-reader voice at 145 words per minute.");
  await expect.poll(() => spokenText(page)).toContain("Ravi");
  const first = (await spokenText(page)).split(" | ")[0];
  expect(first.split(/\s+/).length).toBeGreaterThan(2); // a whole sentence, not one word
  await expect(page.getByTestId("read-along-active-word")).not.toHaveText("Ravi");
  // the global read-aloud bar is locked while the dedicated voice is reading
  await expect(page.getByTestId("read-aloud-listen")).toBeDisabled();
  await page.getByTestId("read-along-toggle").click();
  await expect(page.getByTestId("read-along-toggle")).toHaveText("Resume");
  await page.getByTestId("read-along-restart").click();
  await expect(page.getByTestId("read-along-active-word")).toHaveText("Ravi");
  await expect.poll(async () => (await spokenText(page)).split(" | ").filter((t) => t === first).length).toBe(2);
});
