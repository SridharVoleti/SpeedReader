// HTTP transport for the v3 learner journey (APP-API-001..010). Mounted by app/api/v3/[...path]/route.ts, which
// performs authentication (signed BabySteps session) and passes the verified learner in. This file maps requests to
// LearnerService calls and content-provider lookups. The browser never supplies scores: it sends raw answers and the
// server scores them against keys that never leave the server.

import { join } from "node:path";
import { FileLearnerRepository, type LearnerRepository } from "../lib/v2/learner-repository";
import { FileSessionPersistence } from "../lib/v2/file-session-store";
import { persistenceFromEnv, PersistenceConfigError } from "../lib/v2/persistence-config";
import { SupabaseAssessmentStore, SupabaseLearnerRepository, SupabaseSessionPersistence, type SupabaseConfig } from "../lib/v2/supabase-adapters";
import { FileAssessmentStore } from "../lib/v2/file-assessment-store";
import { SessionRegistry } from "../lib/v2/session-envelope";
import { LearnerService, type Ctx, type PassageCompletionRequest, type ServiceError, type SpeechSubmission } from "../lib/v2/learner-service";
import { ApprovedPackageProvider, ContentError, FixtureContentProvider, learnerView, scoreItems, type ContentProvider } from "../lib/v2/content-provider";
import { evaluateSpokenExpression, SPOKEN_EXPRESSION_CONFIG } from "../lib/v2/spoken-expression";
import { diagnosticsEnabled } from "../lib/diagnostics-gate";
import { createStore } from "../lib/sr/pipeline/storage";
import type { BpcContent } from "../lib/v2/best-comprehension";
import { metricsFromCapture, type ReadCapture } from "../lib/v2/news-reader-metrics";
import { COUNT100_VERSION, count100 } from "../lib/sr/pipeline-v2/count100";
import { classifyClient } from "../lib/v2/client-class";
import { registryCoordinateFor } from "../lib/v2/delivery-order";
import { calibrationAnalytics } from "../lib/v2/calibration-analytics";
import { RETENTION_POLICY_V1, type RetentionPolicy } from "../lib/v2/retention-check";
import type { NewsReaderAttempt } from "../lib/v2/news-reader";

export type Verified = { learnerId: string; sessionId: string; deviceId: string; entitlement?: { active: boolean; scopes: string[] } | null };

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export type Deps = { service: LearnerService; repo: LearnerRepository; content: ContentProvider };
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

/**
 * Wire the service. With Supabase credentials every port (learner state, assessment, sessions) is Supabase-backed and
 * durable on serverless hosting; otherwise the file adapters under `dataDir` are used (local/dev/tests).
 */
export function buildDeps(dataDir: string, content: ContentProvider, supabase: SupabaseConfig | null = null, retentionPolicy: RetentionPolicy = RETENTION_POLICY_V1): Deps {
  const repo: LearnerRepository = supabase ? new SupabaseLearnerRepository(supabase) : new FileLearnerRepository(join(dataDir, "learners"));
  const assessments = supabase ? new SupabaseAssessmentStore(supabase) : new FileAssessmentStore(join(dataDir, "assessments"));
  const sessionStore = supabase ? new SupabaseSessionPersistence(supabase) : new FileSessionPersistence(join(dataDir, "sessions"));
  const bpc = (passageId: string): BpcContent | null => content.byPassageId(passageId)?.bpc ?? null;
  return { repo, content, service: new LearnerService({ repo, assessments, sessions: new SessionRegistry(), sessionStore, retentionPolicy, bpcCatalog: bpc, provenance: (passageId) => content.byPassageId(passageId)?.provenance ?? null }) };
}

/** Throws PersistenceConfigError on a production deployment without valid Supabase settings: no file fallback there. */
export function getDeps(env: Record<string, string | undefined> = process.env): Deps {
  if (!singleton) {
    const persistence = persistenceFromEnv(env);
    if (!persistence.ok) throw new PersistenceConfigError(persistence.reason);
    singleton = buildDeps(env.SR_DATA_DIR ?? join(process.cwd(), ".data"), makeProvider(env), persistence.kind === "supabase" ? persistence.config : null, retentionPolicyFromEnv(env));
  }
  return singleton;
}

/**
 * Production always uses the pilot schedule. Only where diagnostics are enabled (tests/previews) may the first check be
 * brought forward, so the memory-check journey can be exercised without waiting a day.
 */
export function retentionPolicyFromEnv(env: Record<string, string | undefined> = process.env): RetentionPolicy {
  const raw = env.SR_RETENTION_FIRST_CHECK_HOURS;
  if (!diagnosticsEnabled(env) || raw === undefined || raw === "") return RETENTION_POLICY_V1;
  const first = Number(raw);
  if (!Number.isFinite(first) || first < 0) return RETENTION_POLICY_V1;
  const [, ...rest] = RETENTION_POLICY_V1.intervalsHours;
  return { ...RETENTION_POLICY_V1, version: `${RETENTION_POLICY_V1.version}+test-first-${first}h`, intervalsHours: [first, ...rest] };
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

/** Passages the learner has genuinely completed (scored new-progression evidence), oldest first, unique. */
function completedPassageIds(learner: { ledger: readonly { attemptType: string; classification: string | null; passageId: string }[] }): string[] {
  const seen: string[] = [];
  for (const r of learner.ledger) if (r.attemptType === "NEW_PROGRESSION" && r.classification !== null && !seen.includes(r.passageId)) seen.push(r.passageId);
  return seen;
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
export async function handleV3(req: Request, path: string[], who: Verified, deps?: Deps): Promise<Response> {
  try {
    return await dispatch(req, path, who, deps ?? getDeps());
  } catch (e) {
    // a configuration failure is reported safely and distinctly from missing content; no detail leaks to the learner
    if (e instanceof PersistenceConfigError) return json({ error: "SERVER_CONFIGURATION", message: "This service is not available right now. Please try again later." }, 503);
    if (e instanceof ContentError) return unavailable(); // bad content is a content problem, not a learner problem
    throw e;
  }
}

async function dispatch(req: Request, path: string[], who: Verified, deps: Deps): Promise<Response> {
  const { service, repo, content } = deps;
  const ctx: Ctx = { learnerId: who.learnerId, sessionId: who.sessionId, deviceId: who.deviceId };
  const route = `${req.method} ${path.join("/")}`;
  const url = new URL(req.url);

  switch (route) {
    case "POST bootstrap": {
      const r = await service.bootstrap(ctx);
      return respond(isError(r) ? r : { ...r, entitlement: who.entitlement ?? null });
    }
    case "POST resume": return respond(await service.resume(ctx));
    case "POST assessment/start": return respond(await service.startAssessment(ctx));

    case "GET assessment/passage": {
      const pending = await service.serveAssessmentPassage(ctx); // also starts the server-side clock for this passage
      if (!pending.ok) return respond(pending);
      const passage = content.assessment(pending.attemptsDone);
      return passage ? json({ ok: true, wpm: pending.nextWpm, attemptNumber: pending.attemptsDone + 1, passage: learnerView(passage) }) : unavailable();
    }
    case "POST assessment/answer": {
      const b = await body<{ key: string; answers: (number | null)[] }>(req);
      if (!b || !Array.isArray(b.answers)) return json({ error: "invalid JSON body" }, 400);
      const pending = await service.assessmentPending(ctx);
      if (!pending.ok) return respond(pending);
      const passage = content.assessment(pending.attemptsDone);
      if (!passage) return unavailable();
      const scores = scoreItems(passage, b.answers);
      const comprehensionScore = scores.reduce((a, x) => a + x.score, 0) / scores.length;
      const r = await service.submitAssessmentAttempt(ctx, { key: b.key, wpm: pending.nextWpm, comprehensionScore });
      return respond(r);
    }
    case "POST assessment/attempt": {
      // direct (already-scored) submission is not exposed over HTTP: scoring is the server's job
      return json({ error: "use assessment/answer" }, 404);
    }
    case "POST assessment/finalize": return respond(await service.finalizeAssessment(ctx));

    case "GET next": {
      const n = await service.nextActivity(ctx);
      return respond(isError(n) ? n : { ok: true, next: n });
    }

    case "GET passage/next": {
      const n = await service.nextActivity(ctx);
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
      const prog = await service.progress(ctx);
      if (!prog.ok) return respond(prog);
      if (passage.sequence !== prog.storiesRead + 1) {
        // a replay of an already-committed attempt is answered from the ledger; anything else off-sequence is refused
        const known = (await repo.load(ctx.learnerId))?.learner.ledger.some((r) => r.attemptId === b.attemptId);
        if (!known) return json({ error: "this is not your current story" }, 409);
      }
      const snap = (await repo.load(ctx.learnerId))!;
      const completion: PassageCompletionRequest = {
        attemptId: b.attemptId,
        passageId: b.passageId,
        displayedWpm: snap.learner.core.wpm,
        items: scoreItems(passage, b.answers),
        speech: speechFor({ passageId: passage.passageId, ideas: passage.ideas }, b.explanation),
        startedAt: sanitizeStartedAt(b.startedAt, Date.now()),
        client: classifyClient(req.headers.get("user-agent")),
        // only approved canonical content carries a registry coordinate; fixtures never pretend to
        registry: passage.source === "APPROVED_PACKAGE" ? registryCoordinateFor(passage.passageId) : null
      };
      return respond(await service.completePassage(ctx, completion));
    }

    case "GET practice/next": {
      const n = await service.nextActivity(ctx);
      if (isError(n)) return respond(n);
      if (n.activity !== "FAMILIAR_PRACTICE") return json({ ok: false, error: "no practice due", next: n }, 409);
      const passage = content.byPassageId(n.passageId);
      return passage ? json({ ok: true, wpm: n.wpm, passage: learnerView(passage) }) : unavailable();
    }
    case "POST practice/submit": {
      const b = await body<{ attemptId: string; passageId: string }>(req);
      if (!b?.attemptId || !b.passageId) return json({ error: "attemptId and passageId are required" }, 400);
      const snap = await repo.load(ctx.learnerId);
      if (!snap) return json({ error: "initial assessment required" }, 409);
      return respond(await service.completePractice(ctx, { attemptId: b.attemptId, passageId: b.passageId, displayedWpm: snap.learner.core.wpm }));
    }

    case "GET retention/next": {
      const r = await service.retentionNext(ctx);
      if (isError(r)) return respond(r);
      if (!r.due) return json({ ok: false, error: "nothing to remember right now" }, 409);
      const passage = content.byPassageId(r.due.passageId);
      if (!passage) return unavailable();
      // the story text is deliberately NOT sent: recall must come from memory, so only the questions are returned
      return json({ ok: true, due: { passageId: r.due.passageId, checkNumber: r.due.checkNumber }, items: learnerView(passage).items });
    }
    case "POST retention/submit": {
      const b = await body<{ attemptId: string; passageId: string; answers: (number | null)[] }>(req);
      if (!b?.attemptId || !b.passageId || !Array.isArray(b.answers)) return json({ error: "attemptId, passageId and answers are required" }, 400);
      const passage = content.byPassageId(b.passageId);
      if (!passage) return unavailable();
      const scores = scoreItems(passage, b.answers);
      const r = await service.completeRetention(ctx, { attemptId: b.attemptId, passageId: b.passageId, correct: scores.filter((x) => x.score === 1).length, total: scores.length });
      // retrieval first, then feedback: the refresher is shown only after the learner has answered from memory
      return isError(r) ? respond(r) : json({ ...r, refresher: passage.bpc.qaApproved ? passage.bpc.text : null });
    }
    case "GET bpc": return respond(await service.bpc(ctx, url.searchParams.get("attemptId") ?? ""));
    case "GET news-reader/passages": {
      const snap = await repo.load(ctx.learnerId);
      if (!snap) return json({ error: "initial assessment required" }, 409);
      return json({ ok: true, passages: completedPassageIds(snap.learner).slice(-10).map((passageId) => ({ passageId })) });
    }
    case "POST news-reader/start": {
      const b = await body<{ passageId: string; platform?: "ios" | "android" | "web" | "desktop" }>(req);
      if (!b?.passageId) return json({ error: "passageId required" }, 400);
      const snap = await repo.load(ctx.learnerId);
      if (!snap) return json({ error: "initial assessment required" }, 409);
      // News Reader may share a canonical passage, but only one the learner has already completed: never a spoiler
      if (!completedPassageIds(snap.learner).includes(b.passageId)) return json({ error: "choose a story you have already read" }, 400);
      const passage = content.byPassageId(b.passageId);
      if (!passage) return unavailable();
      const started = await service.newsReaderStart(ctx, b.passageId, b.platform);
      return isError(started) ? respond(started) : json({ ...started, passage: { passageId: passage.passageId, tokens: learnerView(passage).tokens } });
    }
    case "POST news-reader/read": {
      const b = await body<{ passageId: string; readNumber: 1 | 2; key: string } & ReadCapture>(req);
      if (!b?.passageId || !b.key || (b.readNumber !== 1 && b.readNumber !== 2)) return json({ error: "passageId, readNumber (1 or 2) and key are required" }, 400);
      const snap = await repo.load(ctx.learnerId);
      if (!snap) return json({ error: "initial assessment required" }, 409);
      if (!completedPassageIds(snap.learner).includes(b.passageId)) return json({ error: "choose a story you have already read" }, 400);
      const passage = content.byPassageId(b.passageId);
      if (!passage) return unavailable();
      const m = metricsFromCapture(count100(passage.text).tokens, COUNT100_VERSION, { micState: b.micState, transcript: b.transcript, confidence: b.confidence });
      const attempt: NewsReaderAttempt = {
        attemptId: `nr-${b.passageId}-${b.readNumber}-${b.key}`, passageId: b.passageId, readNumber: b.readNumber,
        metrics: m.metrics, technicalState: m.technicalState, recordedAt: new Date().toISOString()
      };
      const r = await service.newsReaderSubmit(ctx, attempt);
      return isError(r) ? respond(r) : json({ ok: true, technicalState: m.technicalState, coaching: r.coaching });
    }
    case "POST news-reader/submit": return json({ error: "use news-reader/read" }, 404);
    case "GET progress": return respond(await service.progress(ctx));
    case "GET progress/parent": return respond(await service.parentProgress(who.learnerId, internalAuthorized(req)));
    case "GET ops/calibration": {
      if (!internalAuthorized(req)) return json({ error: "internal authorization required" }, 403);
      const snaps = await repo.list();
      return json({ ok: true, report: calibrationAnalytics({ learners: snaps.map((x) => x.learner) }) });
    }
    case "GET ops/summary": return respond(await service.opsSummary(await repo.list(), internalAuthorized(req)));
    default: return json({ error: "not found" }, 404);
  }
}
