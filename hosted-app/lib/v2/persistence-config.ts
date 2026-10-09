// Issue #22 - persistence must fail closed in production.
// Learner records are authoritative data. On a Vercel production deployment the local/ephemeral filesystem must
// never silently become the system of record, so a missing or malformed Supabase configuration is a configuration
// error. File adapters remain for local development, hermetic tests and non-production environments.

import { supabaseConfigFromEnv, type SupabaseConfig } from "./supabase-adapters";

export type PersistenceChoice =
  | { ok: true; kind: "supabase"; config: SupabaseConfig }
  | { ok: true; kind: "file" }
  | { ok: false; error: "CONFIGURATION_ERROR"; component: "persistence"; reason: string };

export class PersistenceConfigError extends Error {
  constructor(readonly reason: string) {
    super(`persistence is not configured for production: ${reason}`);
    this.name = "PersistenceConfigError";
  }
}

const MIN_KEY_LENGTH = 20;

export const isProduction = (env: Record<string, string | undefined>): boolean => env.VERCEL_ENV === "production";

/** Reasons are descriptive but never include a value from the environment. */
function productionProblem(env: Record<string, string | undefined>): string | null {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url && !key) return "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required";
  if (!url) return "SUPABASE_URL is required";
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is required";
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "SUPABASE_URL is not a valid URL"; }
  if (parsed.protocol !== "https:") return "SUPABASE_URL must use https";
  if (key.length < MIN_KEY_LENGTH) return "SUPABASE_SERVICE_ROLE_KEY is too short to be a service-role key";
  return null;
}

export function persistenceFromEnv(env: Record<string, string | undefined> = process.env): PersistenceChoice {
  if (isProduction(env)) {
    const problem = productionProblem(env);
    if (problem) return { ok: false, error: "CONFIGURATION_ERROR", component: "persistence", reason: problem };
  }
  const config = supabaseConfigFromEnv(env);
  return config ? { ok: true, kind: "supabase", config } : { ok: true, kind: "file" };
}
