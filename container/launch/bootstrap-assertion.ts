// Verify the bootstrap assertion BabySteps hands back from the exchange, then - and only
// then - we know who is reading. HS256, signed with the shared secret only BabySteps and we
// hold. Fails closed: any problem yields AppLaunchError('BOOTSTRAP_INVALID'), never a
// partially-trusted learner.

import { jwtVerify } from "jose";
import { AppLaunchError } from "./errors";
import type { AppLaunchConfig } from "./config";

export interface LearnerBootstrap {
  /** key this browser session off this */
  learnerSessionId: string;
  /** stable id for the child across sessions */
  learnerId: string;
  displayName: string;
  avatarId?: string;
  ageYears?: number;
  ageMonths?: number;
  locale?: string;
  learnerTimezone?: string;
  deploymentId?: string;
  releaseId?: string;
}

export async function verifyBootstrapAssertion(params: {
  cfg: AppLaunchConfig;
  /** the bootstrapAssertion string from the exchange */
  token: string;
  now?: () => Date;
}): Promise<LearnerBootstrap> {
  const { cfg, token, now } = params;

  if (typeof token !== "string" || token === "") {
    throw new AppLaunchError("BOOTSTRAP_INVALID", "Missing bootstrap assertion.");
  }

  const secret = new TextEncoder().encode(cfg.bootstrapSecret);

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: cfg.bootstrapIssuer,
      audience: cfg.clientId,
      currentDate: now ? now() : undefined,
      clockTolerance: 5
    }));
  } catch (e) {
    throw new AppLaunchError("BOOTSTRAP_INVALID", `Bootstrap assertion did not verify: ${e instanceof Error ? e.message : "unknown error"}`);
  }

  // app_id must match what we were given at onboarding - this is the hard binding.
  if (str(payload.app_id) !== cfg.appId) {
    throw new AppLaunchError("BOOTSTRAP_INVALID", "Bootstrap assertion app_id does not match this deployment.");
  }
  // app_key is the human-readable app_registry key (e.g. "speed-reader"), NOT the
  // service-principal client_id. Only enforced when APP_LAUNCH_APP_KEY is set.
  if (cfg.appKey && payload.app_key !== undefined && str(payload.app_key) !== cfg.appKey) {
    throw new AppLaunchError("BOOTSTRAP_INVALID", "Bootstrap assertion app_key does not match this app.");
  }

  const learnerId = str(payload.learner_id);
  const learnerSessionId = str(payload.learner_session_id);
  const displayName = str(payload.display_name);
  if (!learnerId || !learnerSessionId || !displayName) {
    throw new AppLaunchError(
      "BOOTSTRAP_INVALID",
      "Bootstrap assertion is missing learner_id, learner_session_id or display_name."
    );
  }

  return {
    learnerId,
    learnerSessionId,
    displayName,
    avatarId: str(payload.avatar_id) || undefined,
    ageYears: num(payload.age_years),
    ageMonths: num(payload.age_months),
    locale: str(payload.locale) || undefined,
    learnerTimezone: str(payload.learner_timezone) || undefined,
    deploymentId: str(payload.deployment_id) || undefined,
    releaseId: str(payload.release_id) || undefined
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
