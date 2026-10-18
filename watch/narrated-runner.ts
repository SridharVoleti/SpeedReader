import { spawn } from "node:child_process";
import { expect, type Locator, type Page } from "@playwright/test";

export type WatchRequirement = {
  id: string;
  title: string;
  expected: string;
  scope: "DOMAIN DEMONSTRATION" | "REAL LEARNER UI";
  chapter?: string;
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const pace = Math.max(100, Number(process.env.WATCH_PACE_MS || 650));

function runSpeechProcess(program: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { windowsHide: true });
    let err = "";
    child.stderr.on("data", (buffer) => { err += buffer.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`Narration failed (exit ${code}): ${err}`)));
  });
}

async function say(message: string): Promise<void> {
  if (process.env.WATCH_NARRATE === "off") return; // Explicit diagnostic mode, never the default.
  if (process.platform === "win32") {
    const quoted = "'" + message.replace(/'/g, "''") + "'";
    const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = -1; $s.Speak(${quoted}); $s.Dispose()`;
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    await runSpeechProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded]);
    return;
  }
  if (process.platform === "darwin") {
    await runSpeechProcess("say", ["-r", "165", message]);
    return;
  }
  // On Linux, install speech-dispatcher or explicitly disable narration for CI diagnostics.
  await runSpeechProcess("spd-say", ["-w", message]);
}

function escapeHtml(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function introduction(page: Page, req: WatchRequirement): Promise<void> {
  await page.goto("about:blank");
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Speed Reader — QA Movie</title>
<style>
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 60% 25%,#1b3661,#08111f 65%);color:#fff;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;height:100vh}
main{width:min(950px,90vw)}.top{font-size:18px;letter-spacing:.2em;color:#9bd8ff;text-transform:uppercase}h1{font-size:66px;margin:22px 0 12px}h2{font-size:33px;margin:0 0 28px;color:#f8cf67}.expected{border-left:8px solid #f8cf67;padding:18px 24px;background:#14263d;font-size:28px;line-height:1.5}footer{margin-top:36px;font-size:20px;color:#abc2dc}
</style></head><body><main><div class="top">Babysteps Speed Reader · ${escapeHtml(req.scope)}</div>
<h1>${escapeHtml(req.id)}${req.chapter ? ` <span style="font-size:24px;color:#a5dfff">${escapeHtml(req.chapter)}</span>` : ""}</h1><h2>${escapeHtml(req.title)}</h2><div class="expected"><b>EXPECTED OUTCOME</b><p>${escapeHtml(req.expected)}</p></div><footer>${process.env.WATCH_NARRATE === "off" ? "Narration manually disabled — diagnostic mode" : "🔊 Narrating the requirement before the test begins"}</footer></main></body></html>`);
  await pause(pace);
  await say(`Requirement ${req.id}. ${req.title}. Expected outcome: ${req.expected}. Now beginning the test.`);
  await pause(pace);
}

async function hud(page: Page, req: WatchRequirement, message: string, status: string): Promise<void> {
  await page.evaluate(({ req, message, status }) => {
    let node = document.getElementById("__sr_watch_hud");
    if (!node) {
      node = document.createElement("section");
      node.id = "__sr_watch_hud";
      node.setAttribute("role", "status");
      node.style.cssText = "position:fixed!important;right:18px!important;top:18px!important;z-index:2147483647!important;width:min(460px,43vw)!important;background:#081a2bf2!important;color:white!important;border:3px solid #ffca52!important;border-radius:18px!important;padding:18px!important;box-shadow:0 12px 30px #0008!important;font:16px/1.4 Segoe UI,Arial,sans-serif!important;pointer-events:none!important;white-space:pre-wrap!important;";
      document.body.appendChild(node);
    }
    node.replaceChildren();
    const line = (label: string, value: string, size: string, color = "white") => {
      const e = document.createElement("div");
      e.style.cssText = `font-size:${size};color:${color};margin-bottom:8px;font-weight:600;`;
      e.textContent = label + value;
      node!.appendChild(e);
    };
    line("", req.id + (req.chapter ? " · " + req.chapter : "") + " · " + req.scope, "18px", "#9bd8ff");
    line("", req.title, "23px");
    line("EXPECT: ", req.expected, "16px", "#ffdf96");
    line("NOW: ", message, "16px");
    line("RESULT: ", status, "22px", status === "PASS" ? "#65e9a5" : status === "FAIL" ? "#ff8282" : "#fff");
  }, { req: { id: req.id, title: req.title, expected: req.expected, scope: req.scope, chapter: req.chapter }, message, status });
}

export async function highlight(page: Page, locator: Locator, message: string, req: WatchRequirement): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => {
    element.style.setProperty("outline", "5px solid #ffbd30", "important");
    element.style.setProperty("outline-offset", "5px", "important");
    element.style.setProperty("background-color", "#ffeb9e", "important");
    element.style.setProperty("color", "#151e2f", "important");
    element.style.setProperty("transition", "all .2s ease", "important");
  });
  await hud(page, req, message, "TESTING");
  await pause(pace * 2);
}

export async function showStep(page: Page, req: WatchRequirement, message: string): Promise<void> {
  await hud(page, req, message, "TESTING");
  await pause(pace);
}

export async function watched(
  page: Page,
  req: WatchRequirement,
  action: () => Promise<void>
): Promise<void> {
  await introduction(page, req); // No application test action occurs before spoken introduction.
  try {
    await action();
    await hud(page, req, "All specified assertions succeeded.", "PASS");
    await say(`${req.id} demonstration complete. All specified assertions passed. This verifies ${req.scope === "DOMAIN DEMONSTRATION" ? "the domain demonstration, not the real learner interface" : "the tested real learner interaction"}.`);
    await pause(pace * 2);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    try { await hud(page, req, message.slice(0, 170), "FAIL"); await say(`${req.id}. Test failed. Check the displayed error and trace report.`); await pause(pace * 4); } catch { /* preserve first error */ }
    throw error;
  }
}
