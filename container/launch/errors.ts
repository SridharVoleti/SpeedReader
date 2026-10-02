// Error type + HTTP status mapping for the BabySteps -> hosted-app browser handoff
// (see container/docs/app-launch-integration.md). Every failure in this module is an AppLaunchError
// so the /launch route can fail closed with a safe, non-leaking response.

import identity from "../../hosted-app/app.identity";

export type AppLaunchErrorCode =
  | "LAUNCH_MISCONFIGURED"
  | "BAD_LAUNCH_REQUEST"
  | "EXCHANGE_FAILED"
  | "BOOTSTRAP_INVALID"
  | "PROVISION_FAILED";

export class AppLaunchError extends Error {
  constructor(
    public readonly code: AppLaunchErrorCode,
    // developer-facing; never rendered to the browser verbatim
    message: string
  ) {
    super(message);
    this.name = "AppLaunchError";
  }
}

export const ERROR_STATUS: Record<AppLaunchErrorCode, number> = {
  LAUNCH_MISCONFIGURED: 500,
  BAD_LAUNCH_REQUEST: 400,
  EXCHANGE_FAILED: 502,
  BOOTSTRAP_INVALID: 502,
  PROVISION_FAILED: 500
};

/** Short, safe sentence shown to the parent's browser for each failure class. */
export const ERROR_MESSAGE: Record<AppLaunchErrorCode, string> = {
  LAUNCH_MISCONFIGURED: `${identity.displayName} is not configured to accept launches yet.`,
  BAD_LAUNCH_REQUEST: "This launch link is missing information and cannot be opened.",
  EXCHANGE_FAILED: `${identity.displayName} could not confirm this launch with BabySteps. Please try again.`,
  BOOTSTRAP_INVALID: `${identity.displayName} could not verify who is launching. Please try again.`,
  PROVISION_FAILED: `${identity.displayName} could not start a session. Please try again.`
};
