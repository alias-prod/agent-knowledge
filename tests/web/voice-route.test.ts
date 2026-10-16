import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: mocks.query }));
import { GET, POST } from "../../apps/web/app/api/assistant/voice/route";
const account = { user: { emailVerified: true }, workspace: { organizationId: "authorized" } };
beforeEach(() => { mocks.query.mockResolvedValue(account); vi.stubEnv("BETTER_AUTH_URL", "https://app.example.test"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
test("does not access Gateway for unauthenticated or unverified accounts", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const account of [null, { user: { emailVerified: false }, workspace: {} }]) {
    mocks.query.mockResolvedValue(account);
    expect((await GET()).status).toBe(401);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
test("other Live models cannot satisfy the exact-model gate", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "openai/gpt-live-1" }] })));
  const response = await GET(); const body = await response.json();
  expect(body).toMatchObject({ available: false, model: "openai/gpt-live-1.1", gate: "exact-model-unavailable" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("catalog listing alone does not mint tokens or enable microphone access", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ id: "openai/gpt-live-1.1" }] })); vi.stubGlobal("fetch", fetcher);
  const response = await POST(new Request("https://app.example.test/api/assistant/voice", { method: "POST", headers: { origin: "https://app.example.test" } }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ available: false, gate: "native-live-credentials" });
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("https://ai-gateway.vercel.sh/v1/models", expect.anything());
});
test("denies token requests from untrusted origins before authentication", async () => {
  expect((await POST(new Request("https://app.example.test/api/assistant/voice", { method: "POST", headers: { origin: "https://attacker.test" } }))).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
test("invalid or failed catalog responses fail closed", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ invalid: true })));
  const response = await GET(); expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ available: false, gate: "availability-check-failed" });
});
