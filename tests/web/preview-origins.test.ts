import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), generate: vi.fn(), agent: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: mocks.query, fetchAuthMutation: mocks.mutation }));
vi.mock("ai", () => ({ generateText: mocks.generate, ToolLoopAgent: mocks.agent, tool: vi.fn(), jsonSchema: vi.fn(), stepCountIs: vi.fn() }));
import { POST as assistant } from "../../apps/web/app/api/assistant/route";
import { POST as answer } from "../../apps/web/app/api/ask/answer/route";
import { POST as voice } from "../../apps/web/app/api/assistant/voice/route";
import { isTrustedRequestOrigin } from "../../apps/web/lib/trusted-request-origin";

const branch = "https://alias-kr-ontology-git-v0-fix-convex-8e7c1e-prod-4689s-projects.vercel.app";
const immutable = "https://alias-kr-ontology-89kg3wio7-prod-4689s-projects.vercel.app";
const production = "https://alias-kr-ontology.vercel.app";
const env = { NODE_ENV: "production", VERCEL_ENV: "preview", BETTER_AUTH_URL: production,
  VERCEL_PROJECT_PRODUCTION_URL: production.slice(8), VERCEL_URL: immutable.slice(8), VERCEL_BRANCH_URL: branch.slice(8) };
const account = { user: { emailVerified: true }, workspace: { organizationId: "authorized" } };
function request(origin: string | undefined, path = "/api/assistant", body: object = {}) {
  return new Request(`${immutable}${path}`, { method: "POST", headers: {
    ...(origin === undefined ? {} : { origin }), "content-type": "application/json",
    host: branch.slice(8), "x-forwarded-host": branch.slice(8), "x-forwarded-proto": "https",
  }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  mocks.mutation.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

for (const origin of [branch, immutable]) {
  test(`model-free Open Documents accepts exact Preview ${origin}`, async () => {
    mocks.query.mockResolvedValueOnce(account).mockResolvedValueOnce({ kind: "navigation", href: "/documents", title: "Documents", status: "pending-client" });
    const response = await assistant(request(origin, "/api/assistant", { question: "Open Documents", requestId: crypto.randomUUID(), historyEnabled: false }));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"href":"/documents"');
    expect(mocks.query.mock.calls[1]![1]).toMatchObject({ organizationId: "authorized" });
    expect(mocks.agent).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  test(`Ask answer accepts exact Preview ${origin} and preserves source authorization and model`, async () => {
    mocks.query.mockResolvedValueOnce(account).mockResolvedValueOnce([{ _id: "source", title: "Policy", content: "Verified policy", updatedAt: 1 }]).mockResolvedValueOnce(true);
    mocks.generate.mockResolvedValue({ text: "Verified policy [1]", usage: { inputTokens: 2, outputTokens: 3 } });
    const response = await answer(request(origin, "/api/ask/answer", { question: "Production access?", agentId: "agent" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ answer: "Verified policy [1]", sources: [{ href: "/documents?doc=source" }] });
    expect(mocks.query.mock.calls[1]![1]).toEqual({ organizationId: "authorized", agentId: "agent", question: "Production access?" });
    expect(mocks.query.mock.calls[2]![1]).toMatchObject({ organizationId: "authorized", sources: [{ id: "source", updatedAt: 1 }] });
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: "openai/gpt-6-luna", maxRetries: 0 }));
  });
  test(`voice exact Preview ${origin} still fails closed without the exact model`, async () => {
    mocks.query.mockResolvedValue(account);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id: "openai/gpt-live-1" }] })));
    const response = await voice(request(origin, "/api/assistant/voice"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ available: false, model: "openai/gpt-live-1.1", gate: "exact-model-unavailable" });
  });
  test.each([["assistant", assistant], ["answer", answer], ["voice", voice]] as const)(`exact Preview ${origin} still requires authentication for %s`, async (_name, route) => {
    mocks.query.mockResolvedValue(null);
    const response = await route(request(origin, "/api/assistant", { question: "Open Documents", requestId: crypto.randomUUID() }));
    expect(response.status).toBe(401);
    expect(mocks.mutation).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.agent).not.toHaveBeenCalled();
  });
}

describe.each([["assistant", assistant], ["answer", answer], ["voice", voice]] as const)("%s rejects untrusted origins before auth", (_name, route) => {
  test.each([
    undefined, "null", "", "https://attacker.test", "https://unrelated-project.vercel.app",
    `${branch}.attacker.test`, branch.replace("alias-kr-ontology", "alias-kr-ontologv"),
    branch.replace("8e7c1e", "8e7c1f"), immutable.replace("89kg3wio7", "aaaaaaaaa"),
    branch.replace("https:", "http:"), `${branch}:444`, `${branch}/`, `${branch}/path`,
    `${branch}?redirect=evil`, `${branch}#fragment`, `https://user:pass@${branch.slice(8)}`,
    `${branch}, https://attacker.test`,
  ])("denies %s even with forged trusted Host/forwarded headers", async origin => {
    const response = await route(request(origin, "/api/assistant", { question: "Open Documents", requestId: crypto.randomUUID() }));
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.agent).not.toHaveBeenCalled();
  });
});

test.each(["production", "development", undefined])("does not add a branch origin outside Preview: %s", VERCEL_ENV => {
  expect(isTrustedRequestOrigin(request(branch), { ...env, VERCEL_ENV })).toBe(false);
  expect(isTrustedRequestOrigin(request(production), { ...env, VERCEL_ENV })).toBe(true);
  expect(isTrustedRequestOrigin(request(immutable), { ...env, VERCEL_ENV })).toBe(true);
});
test.each([undefined, "*.vercel.app", `${branch.slice(8)}.attacker.test`, branch, `${branch.slice(8)}/path`, `user@${branch.slice(8)}`, `${branch.slice(8)}:444`])("fails closed for malformed server branch hostname: %s", VERCEL_BRANCH_URL => {
  expect(isTrustedRequestOrigin(request(branch), { ...env, VERCEL_BRANCH_URL })).toBe(false);
});
