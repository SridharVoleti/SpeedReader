// APP_LAUNCH_* environment configuration for the BabySteps -> SpeedReader browser handoff.
// Read + validated in one place so every consumer fails closed identically on a missing
// secret: no valid launch can be processed without full, correct configuration.
//
// Same env var names and defaults BabySteps uses for every embedded app (ChessMaster
// included) - this is a platform-wide contract, not something SpeedReader invents.

import type { JWK } from "jose";
import { AppLaunchError } from "./errors";

const DEFAULT_EXCHANGE_URL = "https://www.babystepsindia.com/v1/internal/app-launch/exchange";
const DEFAULT_BOOTSTRAP_ISSUER = "https://babysteps.in";
const DEFAULT_RETURN_URL = "https://www.babystepsindia.com";
const DEFAULT_LANDING_PATH = "/";

export interface AppLaunchConfig {
  /** our client_id, registered with BabySteps */
  clientId: string;
  /** Ed25519 private JWK - signs the app assertion */
  signingJwk: JWK;
  /** shared HS256 secret - verifies the bootstrap assertion */
  bootstrapSecret: string;
  /** our app_id from onboarding */
  appId: string;
  /**
   * our app_registry key from onboarding (e.g. "speed-reader"). Distinct from
   * clientId (the service-principal id). Optional - when set, the bootstrap
   * assertion's `app_key` claim is checked against it; when unset, only `app_id`
   * is enforced.
   */
  appKey?: string;
  /** our environment from onboarding */
  environment: string;
  /** our deployment_id from onboarding */
  deploymentId: string;
  /** BabySteps' internal exchange endpoint */
  exchangeUrl: string;
  /** expected `iss` on the bootstrap assertion */
  bootstrapIssuer: string;
  /** where GET /return sends the learner */
  returnUrl: string;
  /** in-app path a successful launch redirects to */
  landingPath: string;
}

/**
 * Build the config from environment variables. Throws AppLaunchError('LAUNCH_MISCONFIGURED')
 * if any required value is absent or malformed.
 */
export function appLaunchConfig(env: Record<string, string | undefined> = process.env): AppLaunchConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new AppLaunchError("LAUNCH_MISCONFIGURED", `${name} is required to process an app launch.`);
    }
    return value.trim();
  };

  const clientId = required("APP_LAUNCH_CLIENT_ID");

  let signingJwk: JWK;
  try {
    signingJwk = JSON.parse(required("APP_LAUNCH_SIGNING_PRIVATE_KEY"));
  } catch {
    throw new AppLaunchError(
      "LAUNCH_MISCONFIGURED",
      "APP_LAUNCH_SIGNING_PRIVATE_KEY must be an Ed25519 private key JWK (JSON)."
    );
  }
  if (signingJwk.kty !== "OKP" || signingJwk.crv !== "Ed25519" || typeof signingJwk.d !== "string") {
    throw new AppLaunchError(
      "LAUNCH_MISCONFIGURED",
      "APP_LAUNCH_SIGNING_PRIVATE_KEY must be an Ed25519 (OKP/Ed25519) private JWK."
    );
  }

  const bootstrapSecret = required("APP_LAUNCH_BOOTSTRAP_SECRET");
  if (bootstrapSecret.length < 32) {
    throw new AppLaunchError("LAUNCH_MISCONFIGURED", "APP_LAUNCH_BOOTSTRAP_SECRET must be at least 32 characters.");
  }

  return {
    clientId,
    signingJwk,
    bootstrapSecret,
    appId: required("APP_LAUNCH_APP_ID"),
    appKey: env.APP_LAUNCH_APP_KEY?.trim() || undefined,
    environment: required("APP_LAUNCH_ENVIRONMENT"),
    deploymentId: required("APP_LAUNCH_DEPLOYMENT_ID"),
    exchangeUrl: env.APP_LAUNCH_EXCHANGE_URL?.trim() || DEFAULT_EXCHANGE_URL,
    bootstrapIssuer: env.APP_LAUNCH_BOOTSTRAP_ISSUER?.trim() || DEFAULT_BOOTSTRAP_ISSUER,
    returnUrl: env.APP_LAUNCH_RETURN_URL?.trim() || DEFAULT_RETURN_URL,
    landingPath: env.APP_LAUNCH_LANDING_PATH?.trim() || DEFAULT_LANDING_PATH
  };
}

/** True when enough APP_LAUNCH_* config is present to even attempt a launch. */
export function isAppLaunchConfigured(env: Record<string, string | undefined> = process.env): boolean {
  try {
    appLaunchConfig(env);
    return true;
  } catch {
    return false;
  }
}
