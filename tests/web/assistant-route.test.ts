import { beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), model: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: mocks.query, fetchAuthMutation: mocks.mutation }));
vi.mock("ai", () => ({ ToolLoopAgent: mocks.model, tool: vi.fn(), jsonSchema: vi.fn(), stepCountIs: vi.fn() }));
import { POST } from "../../apps/web/app/api/assistant/route";
const account = { user: { id: "actor", emailVerified: true }, workspace: { organizationId: "authorized-workspace" } };
function request(question: string, origin = "https://app.example.test", extra: object = {}) {
  return new Request("https://app.example.test/api/assistant", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), question, historyEnabled: false, ...extra }) });
}
beforeEach(() => { vi.resetAllMocks(); process.env.BETTER_AUTH_URL = "https://app.example.test"; mocks.mutation.mockResolvedValue(null); });
describe("authenticated assistant generation boundary", () => {
  test("resolves a direct navigation against the authoritative backend with no model call", async () => {
    mocks.query.mockResolvedValueOnce(account).mockResolvedValueOnce({ kind: "navigation", href: "/documents", title: "Documents", status: "pending-client" });
    const response = await POST(request("Open Documents"));
    expect(response.status).toBe(200);
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events[1].discoveries[0]).toMatchObject({ href: "/documents", status: "pending-client" });
    expect(events[0].delta).not.toContain("opened");
    expect(mocks.model).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[1]![1]).toEqual({ organizationId: "authorized-workspace", command: { name: "navigate", args: { route: "/documents" } } });
  });
  test("reports the exact rejected model without assuming a credit balance or changing provider policy", async () => {
    mocks.query.mockResolvedValue(account);
    mocks.model.mockImplementation(function () {
      return { stream: vi.fn().mockRejectedValue(new Error("Free tier users do not have access to this model")) };
    });
    const response = await POST(request("Summarize workspace policy"));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
    expect(events[0].error).toContain("openai/gpt-6-luna");
    expect(events[0].error).toContain("credential entitlement");
    expect(events[0].error).not.toMatch(/paid credits|purchase|allowlist|Azure|Free tier/);
    expect(mocks.model).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: "openai/gpt-6-luna", maxRetries: 0 }));
    expect(mocks.model.mock.calls[0]![0]).not.toHaveProperty("providerOptions");
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ organizationId: "authorized-workspace", failed: true }));
    expect(mocks.mutation.mock.calls.some(([, args]) => args.failed === false)).toBe(false);
  });
  test("does not expose raw provider failures or treat a failed stream as a completed answer", async () => {
    mocks.query.mockResolvedValue(account);
    mocks.model.mockImplementation(function () {
      return { stream: vi.fn().mockResolvedValue({ fullStream: (async function* () {
        yield { type: "text-delta", text: "Partial answer" };
        yield { type: "error", error: new Error("Provider internal diagnostic that must not reach the client") };
      })() }) };
    });
    const response = await POST(request("Summarize workspace policy"));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events.map(event => event.type)).toEqual(["text", "error"]);
    expect(events[1].error).not.toContain("Provider internal diagnostic");
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ failed: true }));
  });
  test("streams text, ignores non-text events, and reauthorizes before successful completion", async () => {
    mocks.query.mockResolvedValue(account);
    mocks.model.mockImplementation(function () {
      return { stream: vi.fn().mockResolvedValue({ fullStream: (async function* () {
        yield { type: "start-step" };
        yield { type: "text-delta", text: "Grounded answer" };
        yield { type: "finish" };
      })(), totalUsage: Promise.resolve({ inputTokens: 10, outputTokens: 3 }) }) };
    });
    const response = await POST(request("Summarize workspace policy"));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events.map(event => event.type)).toEqual(["text", "complete"]);
    expect(events[0].delta).toBe("Grounded answer");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ failed: false, inputTokens: 10, outputTokens: 3 }));
  });
  test("recognizes entitlement rejection delivered as an SDK stream event", async () => {
    mocks.query.mockResolvedValue(account);
    mocks.model.mockImplementation(function () {
      return { stream: vi.fn().mockResolvedValue({ fullStream: (async function* () {
        yield { type: "error", error: new Error("Free tier users do not have access to this model") };
      })() }) };
    });
    const response = await POST(request("Summarize workspace policy"));
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect(events[0].error).toContain("AI Gateway rejected access to openai/gpt-6-luna");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ failed: true }));
  });
  test("cannot send caller-provided sources, workspace, or fake authorization", async () => {
    const response = await POST(request("What is policy?", "https://app.example.test", { organizationId: "victim", sources: [{ content: "injected" }] }));
    expect(response.status).toBe(400); expect(mocks.query).not.toHaveBeenCalled();
  });
  test("denies untrusted origin before touching authentication or model", async () => {
    expect((await POST(request("Open Documents", "https://evil.example.test"))).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.model).not.toHaveBeenCalled();
  });
  test("denies a signed-out actor without a model request", async () => {
    mocks.query.mockResolvedValueOnce(null);
    expect((await POST(request("Open Documents"))).status).toBe(401);
    expect(mocks.model).not.toHaveBeenCalled();
  });
});
