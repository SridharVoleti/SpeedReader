import identity from "../../hosted-app/app.identity";
import { NextRequest, NextResponse } from "next/server";
import { appLaunchConfig } from "../launch/config";
import { SESSION_COOKIE, verifySessionToken, signSessionToken, type LearnerSession } from "../launch/session";
import {
  renewGrant,
  getCurrentProgress,
  saveCheckpoint,
  completeLesson,
  type ProgressSummary
} from "../launch/platform-api";

type SyncRequest = {
  levelKey: string;
  nextLevelKey: string;
  progressSummary?: ProgressSummary;
};

// POST /api/babysteps-progress - called (best-effort, non-blocking) after a level is passed
// while the hosted app is open inside BabySteps, so progress survives a lost device or a
// cleared browser instead of living only in localStorage. localStorage remains the source of
// truth for gameplay regardless of what this endpoint does - a standalone visit (no BabySteps
// session) or any failure here just means "nothing synced this time", never a broken level.
export async function POST(req: NextRequest): Promise<Response> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = cookie ? await verifySessionToken(cookie) : null;

  if (!session || !session.grant || !session.grant.active) {
    return NextResponse.json({ synced: false, reason: "not_launched_from_babysteps" }, { headers: { "cache-control": "no-store" } });
  }

  let body: SyncRequest;
  try {
    const raw = await req.json();
    if (typeof raw?.levelKey !== "string" || typeof raw?.nextLevelKey !== "string") throw new Error("invalid body");
    body = { levelKey: raw.levelKey, nextLevelKey: raw.nextLevelKey, progressSummary: raw.progressSummary };
  } catch {
    return NextResponse.json({ synced: false, reason: "invalid_request" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  let cfg;
  try {
    cfg = appLaunchConfig();
  } catch {
    return NextResponse.json({ synced: false, reason: "not_configured" }, { headers: { "cache-control": "no-store" } });
  }

  const working: LearnerSession = { ...session };

  try {
    working.grant = await renewGrant({ cfg, grant: working.grant! });

    if (working.progressVersion === undefined) {
      const current = await getCurrentProgress({ cfg, grant: working.grant });
      working.progressVersion = current.progressVersion;
    }
    let sequence = (working.checkpointSequence ?? 0) + 1;

    const checkpoint = await saveCheckpoint({
      cfg,
      grant: working.grant,
      expectedProgressVersion: working.progressVersion,
      checkpointSequence: sequence,
      levelKey: body.levelKey,
      progressSummary: body.progressSummary
    });
    working.progressVersion = checkpoint.progressVersion;
    working.checkpointSequence = sequence;
    sequence += 1;

    const completion = await completeLesson({
      cfg,
      grant: working.grant,
      expectedProgressVersion: working.progressVersion,
      checkpointSequence: sequence,
      levelKey: body.levelKey,
      nextLevelKey: body.nextLevelKey,
      progressSummary: body.progressSummary,
      journeyTitle: identity.journey.title,
      journeyShortDescription: identity.journey.shortDescription
    });
    working.progressVersion = completion.progressVersion;
    working.checkpointSequence = sequence;

    const res = NextResponse.json(
      { synced: true, alreadyCompleted: completion.alreadyCompleted },
      { headers: { "cache-control": "no-store" } }
    );
    res.cookies.set(SESSION_COOKIE, await signSessionToken(working, new Date(session.expiresAt)), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt)
    });
    return res;
  } catch (e) {
    console.error("[babysteps-progress] sync failed, localStorage remains authoritative:", e instanceof Error ? e.message : e);
    // Still persist whatever grant/version state we did manage to update (e.g. a successful
    // renewal even if the write after it failed) so the next attempt starts from there.
    const res = NextResponse.json({ synced: false, reason: "sync_failed" }, { headers: { "cache-control": "no-store" } });
    try {
      res.cookies.set(SESSION_COOKIE, await signSessionToken(working, new Date(session.expiresAt)), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: new Date(session.expiresAt)
      });
    } catch {
      // if even re-signing fails, the existing cookie just stays as it was
    }
    return res;
  }
}
