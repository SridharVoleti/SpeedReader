// HTTP transport for the v3 learner journey (APP-API-001..010). Mounted by app/api/v3/[...path]/route.ts, which
// performs authentication (signed BabySteps session) and passes the verified learner in. This file only maps
// requests to LearnerService calls and service results to JSON; it holds no product rules.

import { join } from "node:path";
import { FileLearnerRepository } from "../lib/v2/learner-repository";
import { FileAssessmentStore } from "../lib/v2/file-assessment-store";
import { SessionRegistry } from "../lib/v2/session-envelope";
import { LearnerService, type Ctx, type PassageCompletionRequest, type ServiceError } from "../lib/v2/learner-service";

export type Verified = { learnerId: string; sessionId: string; deviceId: string };

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

type Singleton = { service: LearnerService; repo: FileLearnerRepository };
let singleton: Singleton | null = null;

export function getService(env: Record<string, string | undefined> = process.env): Singleton {
  if (!singleton) {
    const dataDir = env.SR_DATA_DIR ?? join(process.cwd(), ".data");
    const repo = new FileLearnerRepository(join(dataDir, "learners"));
    singleton = {
      repo,
      service: new LearnerService({ repo, assessments: new FileAssessmentStore(join(dataDir, "assessments")), sessions: new SessionRegistry(), bpcCatalog: [] })
    };
  }
  return singleton;
}

export function resetServiceForTests(): void { singleton = null; }

const isError = (r: unknown): r is ServiceError => typeof r === "object" && r !== null && (r as ServiceError).ok === false;
const respond = (r: unknown) => (isError(r) ? json({ error: r.error }, r.status) : json(r));

export function internalAuthorized(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const key = env.SR_INTERNAL_API_KEY;
  if (!key || key.length < 16) return false; // no key configured = no internal access
  return req.headers.get("x-sr-internal-key") === key;
}

async function body<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

/** `path` is the segments after /api/v3. */
export async function handleV3(req: Request, path: string[], who: Verified, deps: Singleton = getService()): Promise<Response> {
  const { service, repo } = deps;
  const ctx: Ctx = { learnerId: who.learnerId, sessionId: who.sessionId, deviceId: who.deviceId };
  const route = `${req.method} ${path.join("/")}`;
  const url = new URL(req.url);

  switch (route) {
    case "POST bootstrap": return respond(service.bootstrap(ctx));
    case "POST resume": return respond(service.resume(ctx));
    case "POST assessment/start": return respond(service.startAssessment(ctx));
    case "POST assessment/attempt": {
      const b = await body<{ key: string; wpm: number; comprehensionScore: number; durationSec: number }>(req);
      return b ? respond(service.submitAssessmentAttempt(ctx, b)) : json({ error: "invalid JSON body" }, 400);
    }
    case "POST assessment/finalize": return respond(service.finalizeAssessment(ctx));
    case "GET next": {
      const n = service.nextActivity(ctx);
      return respond("ok" in n && n.ok === false ? n : { ok: true, next: n });
    }
    case "POST passage/complete": {
      const b = await body<PassageCompletionRequest>(req);
      return b ? respond(service.completePassage(ctx, b)) : json({ error: "invalid JSON body" }, 400);
    }
    case "POST practice/complete": {
      const b = await body<{ attemptId: string; passageId: string; displayedWpm: number }>(req);
      return b ? respond(service.completePractice(ctx, b)) : json({ error: "invalid JSON body" }, 400);
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
