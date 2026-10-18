import { beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), generateText: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: mocks.query, fetchAuthMutation: mocks.mutation }));
vi.mock("ai", () => ({ generateText: mocks.generateText }));
import { POST } from "../../apps/web/app/api/ask/answer/route";

const account = { user: { id: "actor", emailVerified: true }, workspace: { organizationId: "authorized-workspace" } };
function request() {
  return new Request("https://app.example.test/api/ask/answer", {
    method: "POST",
    headers: { origin: "https://app.example.test", "content-type": "application/json" },
    body: JSON.stringify({ agentId: "agent-a", question: "Summarize the approved policy" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.BETTER_AUTH_URL = "https://app.example.test";
  mocks.mutation.mockResolvedValue(null);
  mocks.query.mockResolvedValueOnce(account).mockResolvedValueOnce([{ _id: "source-a", title: "Approved", content: "Verified policy", updatedAt: 1 }]);
});

describe("ask answer inference failures", () => {
  test("returns the stable blocked-access response and records failed cleanup", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateText.mockRejectedValue({ response: { status: 403, responseBody: { error: { message: "Free tier users do not have access to this model" } } } });
    const response = await POST(request());
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ code: "assistant_inference_access_denied" });
    expect(payload.error).toContain("openai/gpt-6-luna");
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ organizationId: "authorized-workspace", failed: true }));
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ class: "assistant-inference-error", category: "access", status: 403, route: "ask-answer", requestId: expect.any(String) }));
    logger.mockRestore();
  });

  test("never discloses arbitrary provider details in transient responses or logs", async () => {
    const secret = "authorization=secret prompt=private responseBody=private";
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateText.mockRejectedValue({ message: secret, headers: { authorization: secret }, responseBody: secret });
    const response = await POST(request());
    const payload = await response.json();
    expect(response.status).toBe(502);
    expect(payload).toEqual({ error: "The assistant could not complete this request. No changes were automatically saved. Retry, or use workspace search.", code: "assistant_inference_failed" });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    expect(mocks.mutation).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ failed: true }));
    logger.mockRestore();
  });
});
