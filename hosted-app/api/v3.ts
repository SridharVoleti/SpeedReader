// HTTP transport for the v3 learner journey (APP-API-001..010). Mounted by app/api/v3/[...path]/route.ts, which
// performs authentication (signed BabySteps session) and passes the verified learner in. This file maps requests to
// LearnerService calls and content-provider lookups. The browser never supplies scores: it sends raw answers and the
// server scores them against keys that never leave the server.

import { join } from "node:path";
import { FileLearnerRepository } from "../lib/v2/learner-repository";
import { FileAssessmentStore } from "../lib/v2/file-assessment-store";
import { SessionRegistry } from "../lib/v2/session-envelope";
import { LearnerService, type Ctx, type PassageCompletionRequest, type ServiceError, type SpeechSubmission } from "../lib/v2/learner-service";
import { ApprovedPackageProvider, FixtureContentProvider, learnerView, scoreItems, type ContentProvider } from "../lib/v2/content-provider";
import { evaluateSpokenExpression, SPOKEN_EXPRESSION_CONFIG } from "../lib/v2/spoken-expression";
import { diagnosticsEnabled } from "../lib/diagnostics-gate";
import { createStore } from "../lib/sr/pipeline/storage";
import type { BpcContent } from "../lib/v2/best-comprehension";

export type Verified = { learnerId: string; sessionId: string; deviceId: string };

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type Deps = { service: LearnerService; repo: FileLearnerRepository; content: ContentProvider };
let singleton: Deps | null = null;

export function makeProvider(env: Record<string, string | undefined> = process.env): ContentProvider {
  // Fixtures exist only where diagnostics are enabled (tests/previews); production reads approved packages only.
  if (diagnosticsEnabled(env) && env.SR_CONTENT === "fixture") return new FixtureContentProvider();
  const cwd = process.cwd();
  const store = createStore({
    wipRoot: env.SR_WIP_ROOT ?? join(cwd, "hosted-app", "pipeline", "wip"),
    approvedRoot: env.SR_APPROVED_ROOT ?? join(cwd, "hosted-app", "pipeline", "approved"),
    qaActors: []
  });
  return new ApprovedPackageProvider(store);
}

export function buildDeps(dataDir: string, content: ContentProvider): Deps {
  const repo = new FileLearnerRepository(join(dataDir, "learners"));
  const bpc = (passageId: string): BpcContent | null => content.byPassageId(passageId)?.bpc ?? null;
  return { repo, content, service: new LearnerService({ repo, assessments: new FileAssessmentStore(join(dataDir, "assessments")), sessions: new SessionRegistry(), bpcCatalog: bpc }) };
}

export function getDeps(env: Record<string, string | undefined> = process.env): Deps {
  if (!singleton) singleton = buildDeps(env.SR_DATA_DIR ?? join(process.cwd(), ".data"), makeProvider(env));
  return singleton;
}

export function resetServiceForTests(): void { singleton = null; }

const isError = (r: unknown): r is ServiceError => typeof r === "object" && r !== null && (r as ServiceError).ok === false;
const respond = (r: unknown) => (isError(r) ? json({ error: r.error }, r.status) : json(r));
const unavailable = () => json({ error: "CONTENT_UNAVAILABLE", message: "Your next story is being prepared. Please come back soon." }, 503);

export function internalAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const key = env.SR_INTERNAL_API_KEY;
  if (!key || key.length < 16) return false; // no key configured = no internal access
  return req.headers.get("x-sr-internal-key") === key;
}

async function body<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

/**
 * Client clocks are not trusted (skew, wrong date, tampering): a start time is accepted only when it is valid, not in
 * the future and within the session window; otherwise the server's own time is used.
 */
export function sanitizeStartedAt(clientIso: string | undefined, serverNowMs: number, windowMs = 45 * 60_000): string {
  const t = clientIso ? Date.parse(clientIso) : NaN;
  const ok = Number.isFinite(t) && t <= serverNowMs && serverNowMs - t <= windowMs;
  return new Date(ok ? t : serverNowMs).toISOString();
}

type ExplanationInput = { text?: string; mode?: "typed" | "spoken"; raw?: string; asrConfidence?: number; asrFailed?: boolean };

/** Turn the learner's explanation into the speech-evidence contract; the semantic score is computed server-side. */
export function speechFor(passageIdeas: Parameters<typeof evaluateSpokenExpression>[1], explanation: ExplanationInput | undefined): SpeechSubmission {
  const e = explanation ?? {};
  const confirmed = (e.text ?? "").trim();
  if (e.asrFailed) {
    return { rawTranscript: e.raw ?? null, confirmedTranscript: null, asr: { usable: false, speechDetected: false, confidence: null }, evaluator: null };
  }
  const spoken = e.mode === "spoken";
  const raw = confirmed ? (spoken ? (e.raw ?? confirmed) : confirmed) : null; // typed input keeps its original text as the raw record
  const confidence = spoken ? (typeof e.asrConfidence === "number" ? e.asrConfidence : null) : 1; // typed text has no recognition uncertainty
  const evaluator = confirmed ? { score: evaluateSpokenExpression(confirmed, passageIdeas).score, version: SPOKEN_EXPRESSION_CONFIG.version } : null;
  return { rawTranscript: raw, confirmedTranscript: confirmed || null, asr: { usable: true, speechDetected: confirmed !== "", confidence }, evaluator };
}

/** `path` is the segments after /api/v3. */
export async function handleV3(req: Request, path: string[], who: Verified, deps: Deps = getDeps()): Promise<Response> {
  const { service, repo, content } = deps;
  const ctx: Ctx = { learnerId: who.learnerId, sessionId: who.sessionId, deviceId: who.deviceId };
  const route = `${req.method} ${path.join("/")}`;
  const url = new URL(req.url);

  switch (route) {
    case "POST bootstrap": return respond(service.bootstrap(ctx));
    case "POST resume": return respond(service.resume(ctx));
    case "POST assessment/start": return respond(service.startAssessment(ctx));

    case "GET assessment/passage": {
      const pending = service.assessmentPending(ctx);
      if (!pending.ok) return respond(pending);
      const passage = content.assessment(pending.attemptsDone);
      return passage ? json({ ok: true, wpm: pending.nextWpm, attemptNumber: pending.attemptsDone + 1, passage: learnerView(passage) }) : unavailable();
    }
    case "POST assessment/answer": {
      const b = await body<{ key: string; answers: (number | null)[] }>(req);
      if (!b || !Array.isArray(b.answers)) return json({ error: "invalid JSON body" }, 400);
      const pending = service.assessmentPending(ctx);
      if (!pending.ok) return respond(pending);
      const passage = content.assessment(pending.attemptsDone);
      if (!passage) return unavailable();
      const scores = scoreItems(passage, b.answers);
      const comprehensionScore = scores.reduce((a, x) => a + x.score, 0) / scores.length;
      const words = passage.text.trim().split(/\s+/).length;
      const durationSec = Math.round((words / pending.nextWpm) * 60 + 20); // deterministic reading + answering estimate
      const r = service.submitAssessmentAttempt(ctx, { key: b.key, wpm: pending.nextWpm, comprehensionScore, durationSec });
      return respond(r);
    }
    case "POST assessment/attempt": {
      // direct (already-scored) submission is not exposed over HTTP: scoring is the server's job
      return json({ error: "use assessment/answer" }, 404);
    }
    case "POST assessment/finalize": return respond(service.finalizeAssessment(ctx));

    case "GET next": {
      const n = service.nextActivity(ctx);
      return respond(isError(n) ? n : { ok: true, next: n });
    }

    case "GET passage/next": {
      const n = service.nextActivity(ctx);
      if (isError(n)) return respond(n);
      if (n.activity !== "NEW_PROGRESSION") return json({ ok: false, error: "not a new-progression moment", next: n }, 409);
      const passage = content.bySequence(n.sequence);
      return passage ? json({ ok: true, wpm: n.wpm, sequence: n.sequence, passage: learnerView(passage) }) : unavailable();
    }
    case "POST passage/submit": {
      const b = await body<{ attemptId: string; passageId: string; answers: (number | null)[]; explanation?: ExplanationInput; startedAt?: string }>(req);
      if (!b || !b.attemptId || !b.passageId || !Array.isArray(b.answers)) return json({ error: "attemptId, passageId and answers are required" }, 400);
      const passage = content.byPassageId(b.passageId);
      if (!passage) return unavailable();
      const prog = service.progress(ctx);
      if (!prog.ok) return respond(prog);
      if (passage.sequence !== prog.storiesRead + 1) {
        // a replay of an already-committed attempt is answered from the ledger; anything else off-sequence is refused
        const known = repo.load(ctx.learnerId)?.learner.ledger.some((r) => r.attemptId === b.attemptId);
        if (!known) return json({ error: "this is not your current story" }, 409);
      }
      const snap = repo.load(ctx.learnerId)!;
      const completion: PassageCompletionRequest = {
        attemptId: b.attemptId,
        passageId: b.passageId,
        displayedWpm: snap.learner.core.wpm,
        items: scoreItems(passage, b.answers),
        speech: speechFor({ passageId: passage.passageId, ideas: passage.ideas }, b.explanation),
        startedAt: sanitizeStartedAt(b.startedAt, Date.now())
      };
      return respond(service.completePassage(ctx, completion));
    }

    case "GET practice/next": {
      const n = service.nextActivity(ctx);
      if (isError(n)) return respond(n);
      if (n.activity !== "FAMILIAR_PRACTICE") return json({ ok: false, error: "no practice due", next: n }, 409);
      const passage = content.byPassageId(n.passageId);
      return passage ? json({ ok: true, wpm: n.wpm, passage: learnerView(passage) }) : unavailable();
    }
    case "POST practice/submit": {
      const b = await body<{ attemptId: string; passageId: string }>(req);
      if (!b?.attemptId || !b.passageId) return json({ error: "attemptId and passageId are required" }, 400);
      const snap = repo.load(ctx.learnerId);
      if (!snap) return json({ error: "initial assessment required" }, 409);
      return respond(service.completePractice(ctx, { attemptId: b.attemptId, passageId: b.passageId, displayedWpm: snap.learner.core.wpm }));
    }

    case "GET bpc": return respond(service.bpc(ctx, url.searchParams.get("attemptId") ?? ""));
    case "POST news-reader/start": {
      const b = await body<{ passageId: string; platform?: "ios" | "android" | "web" | "desktop" }>(req);
      return b?.passageId ? respond(service.newsReaderStart(ctx, b.passageId, b.platform)) : json({ error: "passageId required" }, 400);
    }
    case "POST news-reader/submit": {
      const b = await body<Parameters<LearnerService["newsReaderSubmit"]>[1]>(req);
      return b ? respond(service.newsReaderSubmit(ctx, b)) : json({ error: "invalid JSON body" }, 400);
    }
    case "GET progress": return respond(service.progress(ctx));
    case "GET progress/parent": return respond(service.parentProgress(who.learnerId, internalAuthorized(req)));
    case "GET ops/summary": return respond(service.opsSummary(repo.list(), internalAuthorized(req)));
    default: return json({ error: "not found" }, 404);
  }
}
