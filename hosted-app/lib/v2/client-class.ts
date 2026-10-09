// APP-CAL-003 device/browser effects + APP-PRIV-001 least necessary data.
// Only a COARSE class is ever stored with an attempt (device type + browser family). The raw user-agent string is
// never persisted.

export type ClientClass = {
  device: "mobile" | "tablet" | "desktop" | "unknown";
  browser: "edge" | "chrome" | "safari" | "firefox" | "other" | "unknown";
};

export const UNKNOWN_CLIENT: ClientClass = Object.freeze({ device: "unknown", browser: "unknown" });

export function classifyClient(userAgent: string | null | undefined): ClientClass {
  const ua = (userAgent ?? "").trim();
  if (!ua) return UNKNOWN_CLIENT;
  const device: ClientClass["device"] = /iPad|Tablet|Nexus (7|9|10)|SM-T\d/i.test(ua) ? "tablet" : /Mobi|Android|iPhone|iPod/i.test(ua) ? "mobile" : "desktop";
  // order matters: Edge and Chrome both say "Chrome"; iOS browsers say "Safari" and carry CriOS/FxiOS/EdgiOS
  const browser: ClientClass["browser"] = /Edg(e|A|iOS)?\//.test(ua) ? "edge" : /Firefox\/|FxiOS\//.test(ua) ? "firefox" : /Chrome\/|CriOS\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "other";
  return { device, browser };
}
