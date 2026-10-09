import { expect, test } from "@playwright/test";

// APP-API-001..010 over real HTTP against the production build. The e2e server opts in to anonymous learners
// (SR_ALLOW_ANONYMOUS_LEARNER) and identifies them by test headers; production requires the signed session.
const id = () => `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

test("v3 API: bootstrap, assessment start and next activity over HTTP", async ({ request }) => {
  const learner = id();
  const headers = { "x-sr-test-learner": learner, "x-sr-test-session": `S-${learner}`, "x-sr-device-id": "e2e-device" };
  const boot = await request.post("/api/v3/bootstrap", { headers });
  expect(boot.status()).toBe(200);
  expect(await boot.json()).toMatchObject({ state: "ASSESSMENT_REQUIRED", next: { activity: "INITIAL_ASSESSMENT" }, session: { kind: "LEARNING" } });
  const start = await request.post("/api/v3/assessment/start", { headers });
  expect(await start.json()).toMatchObject({ ok: true, status: "IN_PROGRESS", nextWpm: 60 });
  const next = await request.get("/api/v3/next", { headers });
  expect(await next.json()).toMatchObject({ ok: true, next: { activity: "INITIAL_ASSESSMENT" } });
});

test("v3 API: requests without learner/session/device context are refused", async ({ request }) => {
  const res = await request.post("/api/v3/bootstrap", { headers: { "x-sr-test-learner": id() } });
  expect(res.status()).toBe(400);
});

test("v3 API: internal endpoints fail closed without the internal key", async ({ request }) => {
  const learner = id();
  const headers = { "x-sr-test-learner": learner, "x-sr-test-session": `S-${learner}`, "x-sr-device-id": "e2e-device" };
  await request.post("/api/v3/bootstrap", { headers });
  expect((await request.get("/api/v3/ops/summary", { headers })).status()).toBe(403);
  expect((await request.get("/api/v3/progress/parent", { headers })).status()).toBe(403);
});

test("v3 API: a second device for the same learner is refused (single active device)", async ({ request }) => {
  const learner = id();
  const a = { "x-sr-test-learner": learner, "x-sr-test-session": `S-${learner}`, "x-sr-device-id": "phone" };
  expect((await request.post("/api/v3/bootstrap", { headers: a })).status()).toBe(200);
  const b = { ...a, "x-sr-test-session": `S2-${learner}`, "x-sr-device-id": "laptop" };
  expect((await request.post("/api/v3/bootstrap", { headers: b })).status()).toBe(409);
});
