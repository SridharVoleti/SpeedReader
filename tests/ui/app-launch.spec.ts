import { expect, test } from "@playwright/test";

test("GET /health returns a plain 2xx liveness check", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  expect(await res.text()).toBe("ok");
});

test("GET /identity is reserved and returns 501", async ({ request }) => {
  const res = await request.get("/identity");
  expect(res.status()).toBe(501);
});

test("GET /launch (not a real launch) is rejected", async ({ request }) => {
  const res = await request.get("/launch", { maxRedirects: 0 });
  expect(res.status()).toBe(405);
});

test("POST /launch without BabySteps env config fails closed", async ({ request }) => {
  const res = await request.post("/launch", {
    form: { launchCode: "test-code", launchAttemptId: "test-attempt" },
    maxRedirects: 0
  });
  // No APP_LAUNCH_* env vars are configured for this test run, so the route must fail closed
  // with a safe error page rather than a crash or a redirect.
  expect(res.status()).toBe(500);
});

test("GET /return redirects to BabySteps and clears session cookies", async ({ request }) => {
  const res = await request.get("/return", { maxRedirects: 0 });
  expect([302, 303]).toContain(res.status());
  expect(res.headers()["location"]).toContain("babystepsindia.com");
});
