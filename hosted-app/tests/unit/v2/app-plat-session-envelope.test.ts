import { describe, expect, it } from "vitest";
import { SESSION_POLICY_V1, SessionRegistry, attemptRulesForSession, sessionKind, shouldApplyEvent, weekKey } from "../../../lib/v2/session-envelope";

const T0 = "2026-10-05T09:00:00Z"; // a Monday
const at = (min: number, from = T0) => new Date(Date.parse(from) + min * 60_000).toISOString();
const start = (r: SessionRegistry, id: string, now: string, device = "phone", learner = "kid") => r.start({ learnerId: learner, deviceId: device, sessionId: id, now });

describe("APP-PLAT-007 platform session envelope", () => {
  it("configuration: 45 minutes, 2 per week, every 6th is review, 15-minute resume", () => {
    expect(SESSION_POLICY_V1).toMatchObject({ sessionMinutes: 45, maxSessionsPerWeek: 2, reviewEvery: 6, resumeWindowMinutes: 15 });
  });

  it("a session ends 45 minutes after it starts and then frees the learner", () => {
    const r = new SessionRegistry();
    const s = start(r, "s1", T0);
    expect(s.ok && s.session.endsAt).toBe(at(45));
    expect(r.active("kid", at(44))).not.toBeNull();
    expect(r.active("kid", at(45))).toBeNull();
  });

  it("at most 2 sessions per week; the next week starts fresh", () => {
    const r = new SessionRegistry();
    expect(start(r, "s1", T0).ok).toBe(true);
    r.close("kid", "s1", at(10), "NORMAL");
    expect(start(r, "s2", at(60 * 24)).ok).toBe(true);
    r.close("kid", "s2", at(60 * 24 + 10), "NORMAL");
    expect(start(r, "s3", at(60 * 48))).toEqual({ ok: false, reason: "WEEKLY_LIMIT_REACHED" });
    expect(start(r, "s3", at(60 * 24 * 7)).ok).toBe(true); // following Monday
  });

  it("week key is Monday-based", () => {
    expect(weekKey("2026-10-11T23:59:00Z")).toBe("2026-10-05");
    expect(weekKey("2026-10-12T00:00:00Z")).toBe("2026-10-12");
  });

  it("every 6th platform session is a review session", () => {
    expect([1, 2, 5, 6, 7, 12].map((n) => sessionKind(n))).toEqual(["LEARNING", "LEARNING", "LEARNING", "REVIEW", "LEARNING", "REVIEW"]);
    expect(() => sessionKind(0)).toThrow(RangeError);
    const r = new SessionRegistry();
    let week = T0;
    const kinds: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const s = start(r, `s${i}`, week);
      if (s.ok) kinds.push(s.session.kind);
      r.close("kid", `s${i}`, at(5, week), "NORMAL");
      week = at(60 * 24 * 7 * i, T0);
    }
    expect(kinds[5]).toBe("REVIEW");
    expect(kinds.slice(0, 5).every((k) => k === "LEARNING")).toBe(true);
  });
});

describe("APP-PLAT-008 review-session integration", () => {
  it("review practice is FAMILIAR_PRACTICE: no pointer advance, no Level-Up evidence, no rewrite", () => {
    expect(attemptRulesForSession("REVIEW")).toEqual({ attemptType: "FAMILIAR_PRACTICE", advancesCanonicalPointer: false, createsLevelUpEvidence: false, rewritesOriginalEvidence: false });
  });
  it("an explicitly scheduled approved revalidation form is the only other review attempt, and still never advances the pointer", () => {
    const rules = attemptRulesForSession("REVIEW", true);
    expect(rules.attemptType).toBe("REVALIDATION");
    expect(rules.advancesCanonicalPointer).toBe(false);
    expect(rules.createsLevelUpEvidence).toBe(false);
  });
  it("a normal learning session may advance the pointer", () => {
    expect(attemptRulesForSession("LEARNING")).toMatchObject({ attemptType: "NEW_PROGRESSION", advancesCanonicalPointer: true });
  });
});

describe("APP-PLAT-006 single active learner/device", () => {
  it("refuses a second device while a session is live, and reports the live session", () => {
    const r = new SessionRegistry();
    start(r, "s1", T0, "phone");
    const second = start(r, "s2", at(5), "laptop");
    expect(second).toMatchObject({ ok: false, reason: "ACTIVE_ON_ANOTHER_DEVICE" });
    expect(r.list("kid")).toHaveLength(1);
  });
  it("allows another device once the session is closed or has expired", () => {
    const r = new SessionRegistry();
    start(r, "s1", T0, "phone");
    r.close("kid", "s1", at(5), "NORMAL");
    expect(start(r, "s2", at(6), "laptop").ok).toBe(true);
  });
  it("different learners are independent", () => {
    const r = new SessionRegistry();
    expect(start(r, "a", T0, "phone", "kid-a").ok).toBe(true);
    expect(start(r, "b", T0, "phone", "kid-b").ok).toBe(true);
  });
  it("rejects malformed requests", () => {
    expect(new SessionRegistry().start({ learnerId: "", deviceId: "d", sessionId: "s", now: T0 })).toMatchObject({ ok: false, reason: "INVALID_REQUEST" });
    expect(new SessionRegistry().start({ learnerId: "k", deviceId: "d", sessionId: "s", now: "nope" })).toMatchObject({ ok: false, reason: "INVALID_REQUEST" });
  });
});

describe("APP-PLAT-009 accidental-close resume", () => {
  const setup = () => {
    const r = new SessionRegistry();
    start(r, "s1", T0);
    r.checkpoint("kid", "s1", at(10), { activity: "PASSAGE_7_QUESTIONS", position: 3, committedEventKeys: ["a1", "a2"] });
    r.close("kid", "s1", at(12), "ACCIDENTAL");
    return r;
  };
  const resume = (r: SessionRegistry, now: string, device = "phone") => r.resume({ learnerId: "kid", sessionId: "s1", deviceId: device, now });

  it("resumes within 15 minutes at the safe position, keeping the same session end", () => {
    const r = setup();
    const res = resume(r, at(27));
    expect(res).toMatchObject({ ok: true, resumeFrom: { activity: "PASSAGE_7_QUESTIONS", position: 3, committedEventKeys: ["a1", "a2"] } });
    expect(r.active("kid", at(28))?.endsAt).toBe(at(45));
  });
  it("is refused after the 15-minute window, with the boundary exact", () => {
    expect(resume(setup(), at(27)).ok).toBe(true);
    expect(resume(setup(), at(27.01))).toMatchObject({ ok: false, reason: "RESUME_WINDOW_EXPIRED" });
  });
  it("cannot extend a session past its 45-minute end", () => {
    const r = new SessionRegistry();
    start(r, "s1", T0);
    r.close("kid", "s1", at(40), "ACCIDENTAL");
    expect(resume(r, at(46))).toMatchObject({ ok: false, reason: "SESSION_EXPIRED" });
  });
  it("a normally closed session cannot be resumed, nor from another device", () => {
    const r = new SessionRegistry();
    start(r, "s1", T0);
    r.close("kid", "s1", at(5), "NORMAL");
    expect(resume(r, at(6))).toMatchObject({ ok: false, reason: "NOT_ACCIDENTALLY_CLOSED" });
    expect(resume(setup(), at(14), "laptop")).toMatchObject({ ok: false, reason: "WRONG_DEVICE" });
    expect(r.resume({ learnerId: "kid", sessionId: "missing", deviceId: "phone", now: at(6) })).toMatchObject({ ok: false, reason: "NO_SESSION" });
  });
  it("committed evidence/awards are never duplicated after resume", () => {
    const r = setup();
    const res = resume(r, at(14));
    if (!res.ok) throw new Error("expected resume");
    expect(shouldApplyEvent(res.session, "a1")).toBe(false);
    expect(shouldApplyEvent(res.session, "a3")).toBe(true);
  });
  it("a resume does not bypass the single-active rule", () => {
    const r = setup();
    start(r, "s2", at(13), "laptop"); // a fresh session after the accidental close
    expect(resume(r, at(14))).toMatchObject({ ok: false, reason: "ACTIVE_ON_ANOTHER_DEVICE" });
  });
});
