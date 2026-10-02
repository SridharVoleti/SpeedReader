import { NextResponse } from "next/server";
import { SESSION_COOKIE, LEARNER_COOKIE } from "../launch/session";

const DEFAULT_RETURN_URL = "https://www.babystepsindia.com";

// GET /return - declared in the deployment manifest; no BabySteps caller wired to it yet
// (container/docs/app-launch-integration.md). Minimal build: end the local session (there is no
// server-side session store to clean up - just drop the cookies) and send the learner back
// to BabySteps. Revisit once BabySteps confirms the real contract.
export async function GET(): Promise<Response> {
  const target = process.env.APP_LAUNCH_RETURN_URL?.trim() || DEFAULT_RETURN_URL;
  const res = NextResponse.redirect(target, 303);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(LEARNER_COOKIE, "", { httpOnly: false, path: "/", maxAge: 0 });
  return res;
}
