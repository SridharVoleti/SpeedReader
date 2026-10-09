// Browser client for /api/v3. The learner and session identity come from the signed BabySteps session cookie
// (sent automatically); the only thing the browser adds is a device id for the single-active-device rule.
// The two `sr_test_*` keys exist for non-production e2e runs where the server explicitly allows anonymous learners.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; message?: string };

function safeStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function deviceId(): string {
  const ls = safeStorage();
  try {
    let v = ls?.getItem("sr_device_id");
    if (!v) { v = `D-${Math.random().toString(36).slice(2, 12)}`; ls?.setItem("sr_device_id", v); }
    return v;
  } catch { return "D-ephemeral"; }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", "x-sr-device-id": deviceId() };
  const ls = safeStorage();
  const learner = ls?.getItem("sr_test_learner");
  const session = ls?.getItem("sr_test_session");
  if (learner && session) { h["x-sr-test-learner"] = learner; h["x-sr-test-session"] = session; }
  return h;
}

export async function api<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/v3/${path}`, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, status: res.status, error: String(data.error ?? "ERROR"), message: typeof data.message === "string" ? data.message : undefined };
  } catch {
    return { ok: false, status: 0, error: "NETWORK" };
  }
}

export type Token = { index: number; text: string };
export type StoryItem = { itemId: string; stem: string; options: string[] };
export type StoryView = { passageId: string; tokens: Token[]; items: StoryItem[] };

export type Feedback = {
  message: string;
  celebration: "NONE" | "SMALL" | "LARGE";
  showBestPossibleComprehension: boolean;
  newWpm?: number;
  retry?: boolean;
  bookTime?: { message: string };
};

/** Child-safe wording for every way the server can say "not now". Never an error code, never blame. */
export function friendlyProblem(r: { status: number; error: string; message?: string }): string {
  if (r.error === "CONTENT_UNAVAILABLE") return r.message ?? "Your next story is being prepared. Please come back soon.";
  if (r.status === 429) return "You have finished your reading sessions for this week. See you next time!";
  if (r.status === 409 && /another device/i.test(r.error)) return "SpeedReader is already open on another device. Close it there to read here.";
  if (r.status === 401) return "Please open SpeedReader again from your Babysteps page.";
  if (r.status === 0) return "We could not connect. Please check your internet and try again.";
  return "Something did not work this time. Please try again.";
}
