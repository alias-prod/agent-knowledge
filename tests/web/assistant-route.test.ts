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
