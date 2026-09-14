// The short-lived signed token we put in the `x-babysteps-app-assertion` header when calling
// BabySteps' exchange endpoint. It proves the call is really from SpeedReader - BabySteps
// verifies it against the public half of our Ed25519 keypair. We hold only the private half;
// it never reaches the browser.

import { SignJWT, importJWK } from "jose";
import { randomUUID } from "crypto";
import { AppLaunchError } from "./errors";
import type { AppLaunchConfig } from "./config";

const AUDIENCE = "babysteps:app-launch:exchange";
const TTL_SECONDS = 60;

/** Mint one fresh app assertion. Valid for 60 seconds - never cache it. */
export async function mintAppAssertion(cfg: AppLaunchConfig, opts: { now?: () => Date } = {}): Promise<string> {
  const now = (opts.now ?? (() => new Date()))();
  const iat = Math.floor(now.getTime() / 1000);

  let key;
  try {
    key = await importJWK(cfg.signingJwk, "EdDSA");
  } catch {
    throw new AppLaunchError(
      "LAUNCH_MISCONFIGURED",
      "APP_LAUNCH_SIGNING_PRIVATE_KEY could not be imported as an Ed25519 key."
    );
  }

  try {
    return await new SignJWT({
      app_id: cfg.appId,
      environment: cfg.environment,
      deployment_id: cfg.deploymentId
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setIssuer(cfg.clientId)
      .setSubject(cfg.clientId)
      .setAudience(AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt(iat)
      .setExpirationTime(iat + TTL_SECONDS)
      .sign(key);
  } catch (e) {
    throw new AppLaunchError(
      "LAUNCH_MISCONFIGURED",
      `Could not sign the app assertion: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }
}

export const APP_ASSERTION_AUDIENCE = AUDIENCE;
export const APP_ASSERTION_TTL_SECONDS = TTL_SECONDS;
