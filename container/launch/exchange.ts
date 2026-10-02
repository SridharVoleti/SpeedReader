// Trade the one-time launch code for a bootstrap assertion over a signed, server-to-server
// call to BabySteps. Any failure fails closed - the caller must never fall back to trusting
// anything from the browser.

import { randomUUID } from "crypto";
import { AppLaunchError } from "./errors";
import { mintAppAssertion } from "./app-assertion";
import type { AppLaunchConfig } from "./config";

/** The provisional app-session grant returned alongside the bootstrap assertion - only
 *  `session.usable_launch` scoped until confirmUsableLaunch() activates it (see
 *  lib/app-launch/platform-api.ts). Lets us call BabySteps' progress-write API as this
 *  specific learner session, without ever holding a learner credential ourselves. */
export interface PlatformApiAccess {
  grantId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  scopes: string[];
  apiContractVersion?: string;
}

export interface ExchangeResult {
  /** HS256 JWT - verify before trusting */
  bootstrapAssertion: string;
  bootstrapExpiresAt?: string;
  centralSessionExpiresAt?: string;
  platformApiAccess?: PlatformApiAccess;
}

export async function exchangeLaunchCode(params: {
  cfg: AppLaunchConfig;
  launchCode: string;
  launchAttemptId: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<ExchangeResult> {
  const { cfg, launchCode, launchAttemptId, fetchImpl = fetch, now } = params;

  if (!launchCode || !launchAttemptId) {
    throw new AppLaunchError("BAD_LAUNCH_REQUEST", "launchCode and launchAttemptId are both required.");
  }

  const assertion = await mintAppAssertion(cfg, { now });

  let res: Response;
  try {
    res = await fetchImpl(cfg.exchangeUrl, {
      method: "POST",
      headers: {
        "x-babysteps-app-assertion": assertion,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        launchCode,
        launchAttemptId,
        exchangeIdempotencyKey: randomUUID()
      }),
      cache: "no-store"
    });
  } catch (e) {
    throw new AppLaunchError("EXCHANGE_FAILED", `Exchange request failed: ${e instanceof Error ? e.message : "network error"}`);
  }

  if (!res.ok) {
    const detail = await safeText(res);
    throw new AppLaunchError("EXCHANGE_FAILED", `Exchange endpoint returned ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new AppLaunchError("EXCHANGE_FAILED", "Exchange endpoint returned a non-JSON body.");
  }

  if (typeof body.bootstrapAssertion !== "string" || body.bootstrapAssertion === "") {
    throw new AppLaunchError("EXCHANGE_FAILED", "Exchange response did not include a bootstrapAssertion.");
  }

  return {
    bootstrapAssertion: body.bootstrapAssertion,
    bootstrapExpiresAt: typeof body.bootstrapExpiresAt === "string" ? body.bootstrapExpiresAt : undefined,
    centralSessionExpiresAt: typeof body.centralSessionExpiresAt === "string" ? body.centralSessionExpiresAt : undefined,
    platformApiAccess: parsePlatformApiAccess(body.platformApiAccess)
  };
}

function parsePlatformApiAccess(value: unknown): PlatformApiAccess | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (
    typeof v.grantId !== "string" ||
    typeof v.accessToken !== "string" ||
    typeof v.accessTokenExpiresAt !== "string" ||
    !Array.isArray(v.scopes) ||
    !v.scopes.every((s) => typeof s === "string")
  ) {
    return undefined;
  }
  return {
    grantId: v.grantId,
    accessToken: v.accessToken,
    accessTokenExpiresAt: v.accessTokenExpiresAt,
    scopes: v.scopes as string[],
    apiContractVersion: typeof v.apiContractVersion === "string" ? v.apiContractVersion : undefined
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}
