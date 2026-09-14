// Trade the one-time launch code for a bootstrap assertion over a signed, server-to-server
// call to BabySteps. Any failure fails closed - the caller must never fall back to trusting
// anything from the browser.

import { randomUUID } from "crypto";
import { AppLaunchError } from "./errors";
import { mintAppAssertion } from "./app-assertion";
import type { AppLaunchConfig } from "./config";

export interface ExchangeResult {
  /** HS256 JWT - verify before trusting */
  bootstrapAssertion: string;
  bootstrapExpiresAt?: string;
  centralSessionExpiresAt?: string;
  platformApiAccess?: unknown;
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
    platformApiAccess: body.platformApiAccess
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return "";
  }
}
