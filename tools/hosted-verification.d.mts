export const EXPECTED_TABLES: string[];
export const EXPECTED_RPCS: string[];
export type HostedConfig = {
  baseUrl: string; projectRef: string; serviceKey: string; anonKey: string; expectedRegion: string; accessToken: string | null;
};
export type CheckResult = { name: string; status: "PASS" | "FAIL" | "NOT_VERIFIED"; detail: string };
export type HostedConfigResult = { ok: true; config: HostedConfig } | { ok: false; missing: string[]; problems: string[] };
export function loadHostedConfig(env: Record<string, string | undefined>): HostedConfigResult;
export function runHostedChecks(config: HostedConfig, fetchImpl?: typeof fetch): Promise<CheckResult[]>;
export function overallStatus(results: CheckResult[]): "PASS" | "FAIL" | "INCOMPLETE";
export function buildReport(input: { commitSha: string; results: CheckResult[]; config: HostedConfig; now: Date }): {
  schema: string; commitSha: string; projectRef: string; expectedRegion: string; generatedAt: string;
  overall: "PASS" | "FAIL" | "INCOMPLETE"; checks: CheckResult[]; certification: "NOT_CERTIFIED";
};
