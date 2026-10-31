import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { mintSessionToken, SESSION_COOKIE } from "../../../../container/launch/session";
import { authorizeLearner } from "../../../../app/api/sr/authorize";

describe("launch cookie round trip", () => {
  it("a cookie set by /launch is accepted by authorizeLearner", async () => {
    process.env.SESSION_SECRET = "s".repeat(48);
    const grant = { grantId: "g", accessToken: "a.b.c".repeat(300), accessTokenExpiresAt: new Date().toISOString(), scopes: ["x"], active: true };
    const { token, expiresAt } = await mintSessionToken({ learnerId: "l", learnerSessionId: "ls", displayName: "Shreshta" }, { grant, centralSessionExpiresAt: new Date(Date.now() + 3600e3).toISOString() });
    const res = NextResponse.redirect("https://speedreader.babystepsindia.com/", 303);
    res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", expires: new Date(expiresAt) });
    const setCookie = res.headers.get("set-cookie")!;
    console.log("SET-COOKIE length", setCookie.length, setCookie.slice(0, 80));
    const pair = setCookie.split(";")[0];
    const r = await authorizeLearner(new Request("https://x/api/v3/bootstrap", { headers: { cookie: pair } }), {});
    expect(r.ok).toBe(true);
  });
});
