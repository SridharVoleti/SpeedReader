import { NextRequest, NextResponse } from "next/server";
import { appLaunchConfig } from "@/lib/app-launch/config";
import { handleAppLaunch } from "@/lib/app-launch/handle-app-launch";
import { SESSION_COOKIE, LEARNER_COOKIE, learnerCookieValue } from "@/lib/app-launch/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /launch - the BabySteps browser handoff (docs/app-launch-integration.md).
// An auto-submitting form arrives with `launchCode` + `launchAttemptId`; we exchange them
// server-to-server, verify the bootstrap assertion, start the child's session, and redirect
// into the app with the session cookies set. Every failure fails closed with a safe page.
export async function POST(req: NextRequest): Promise<Response> {
  let cfg;
  try {
    cfg = appLaunchConfig();
  } catch (e) {
    console.error("[launch] misconfigured:", e instanceof Error ? e.message : e);
    return errorPage(500, "Speed Reading is not configured to accept launches yet.");
  }

  const rawBody = await req.text();
  const result = await handleAppLaunch({ rawBody, cfg, fetchImpl: fetch });

  if (!result.ok) {
    return errorPage(result.status, result.message);
  }

  // 303 so the parent's browser re-issues the follow-up as GET (it POSTed to get here).
  const res = NextResponse.redirect(new URL(result.redirectTo, req.nextUrl.origin), 303);
  const expires = new Date(result.sessionExpiresAt);
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires
  });
  res.cookies.set(LEARNER_COOKIE, learnerCookieValue(result.learner), {
    httpOnly: false,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires
  });

  return res;
}

// A stray GET (e.g. someone opening the URL directly) is not a launch.
export async function GET(): Promise<Response> {
  return errorPage(405, "Open Speed Reading from inside BabySteps.");
}

function errorPage(status: number, message: string): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Speed Reading</title></head>
<body style="font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f8fafc;color:#0f172a">
<main style="max-width:28rem;padding:2rem;text-align:center">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">Couldn't open Speed Reading</h1>
<p style="color:#475569;margin:0">${escapeHtml(message)}</p>
</main></body></html>`;
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
