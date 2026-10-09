// APP-NFR-007 / APP-PRIV-004 - diagnostics protection.
// Demo and diagnostic routes expose internal learner states (GREEN/NOT_GREEN, readiness, raw evidence). They are
// mounted only when SR_ENABLE_DIAGNOSTICS=true, and never on a Vercel production deployment, whatever the flag.
export function diagnosticsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SR_ENABLE_DIAGNOSTICS === "true" && env.VERCEL_ENV !== "production";
}
