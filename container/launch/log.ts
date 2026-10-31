// Verbose, single-line, structured logging for the BabySteps launch/session path, so one
// `vercel logs` query reconstructs exactly what happened (launch -> exchange -> usable-launch
// -> session cookie -> first API call). Every line is `[sr-launch] <event> {json}`.
//
// Secrets never reach the log: any key that looks like a credential is replaced by its length,
// which is enough to tell "present and plausible" from "missing" without exposing the value.

const SECRET_KEY = /token|secret|assertion|launchcode|password|authorization|signature|privatekey|cookievalue/i;

export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEY.test(k)) out[k] = typeof v === "string" ? `<redacted len=${v.length}>` : v == null ? v : "<redacted>";
    else out[k] = v instanceof Error ? { name: v.name, message: v.message } : v;
  }
  return out;
}

export function logLaunch(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): void {
  const line = `[sr-launch] ${event} ${JSON.stringify({ at: new Date().toISOString(), ...redact(fields) })}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Response headers worth keeping when BabySteps (also on Vercel) answers: lets us match our
 *  failed call to a request in BabySteps' own logs. */
export function responseTrace(res: Response): Record<string, string | null> {
  return {
    status: String(res.status),
    vercelId: res.headers.get("x-vercel-id"),
    requestId: res.headers.get("x-request-id"),
    contentType: res.headers.get("content-type"),
    retryAfter: res.headers.get("retry-after")
  };
}
