import { afterEach, describe, expect, it, vi } from "vitest";
import { assertAuthMailReady, createAuthMailSender, getAuthMailConfiguration } from "../../convex/authMail";
import type { AuthMail } from "../../convex/authOptions";
import type { Resend } from "resend";

const env = {
  RESEND_API_KEY: "re_test_not_a_real_key",
  RESEND_EMAIL_DOMAIN: "agentworks.app",
  BETTER_AUTH_URL: "https://workspace.example.com",
  NODE_ENV: "production",
};
const message: AuthMail = {
  kind: "verification", email: "delivered@resend.dev",
  url: "https://workspace.example.com/api/auth/verify-email?token=secret&callbackURL=%2F",
};
function setup(response: unknown = { data: { id: "email-id" }, error: null }) {
  const send = vi.fn().mockResolvedValue(response);
  const sender = createAuthMailSender(env, { emails: { send } } as unknown as Pick<Resend, "emails">);
  return { send, sender };
}

describe("Resend authentication delivery", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("verifies an exact domain with an inspection-capable key", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ name: "mail.aliaslabs.ai", status: "verified" }] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(assertAuthMailReady({ ...env, RESEND_EMAIL_DOMAIN: "mail.aliaslabs.ai" })).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a key from a different workspace even when that workspace has a verified domain", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [{ name: "agentworks.app", status: "verified" }] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(assertAuthMailReady({ ...env, RESEND_EMAIL_DOMAIN: "mail.aliaslabs.ai" })).rejects.toThrow("verified sender domain");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("checks sending-only credentials through the delivery simulator with bounded deduplication", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ name: "restricted_api_key" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ id: "probe-id" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(assertAuthMailReady({ ...env, RESEND_EMAIL_DOMAIN: "mail.aliaslabs.ai" })).resolves.toBeUndefined();
    const [url, options] = fetcher.mock.calls[1];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers["Idempotency-Key"]).toBe(`auth-readiness/mail.aliaslabs.ai/${Math.floor(Date.now() / 300000)}`);
    expect(JSON.parse(options.body)).toMatchObject({ from: "ALIAS <security@mail.aliaslabs.ai>", to: ["delivered@resend.dev"] });
    expect(options.body).not.toContain("token");
  });

  it.each([401, 403, 429, 500])("fails closed when the sending-only delivery check returns %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ name: "restricted_api_key" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ message: "private billing or domain details" }, { status })));
    await expect(assertAuthMailReady(env)).rejects.toThrow("Authentication email service is unavailable");
  });

  it("does not treat unrelated authentication errors as sending-only permission", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ name: "invalid_api_key" }, { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(assertAuthMailReady(env)).rejects.toThrow("Authentication email service is unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not accept a probe without a delivery id", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ name: "restricted_api_key" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({})));
    await expect(assertAuthMailReady(env)).rejects.toThrow("Authentication email service is unavailable");
  });

  it.each(["verification", "reset", "invitation"] as const)("sends %s with plain text and escaped HTML", async (kind) => {
    const { send, sender } = setup();
    await sender({ ...message, kind });
    const [payload, options] = send.mock.calls[0];
    expect(payload.from).toBe("ALIAS <security@agentworks.app>");
    expect(payload.to).toEqual(["delivered@resend.dev"]);
    expect(payload.text).toContain(message.url);
    expect(payload.html).toContain("&amp;callbackURL=");
    expect(payload.html).not.toContain("&callbackURL=");
    expect(options.idempotencyKey).toMatch(new RegExp(`^auth-${kind}/[a-f0-9]{64}$`));
    expect(options.idempotencyKey).not.toContain("secret");
    expect(options.idempotencyKey).not.toContain(message.email);
  });

  it("deduplicates retries but not new reset tokens", async () => {
    const { send, sender } = setup();
    await sender(message);
    await sender(message);
    await sender({ ...message, url: message.url.replace("secret", "new-token") });
    expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
    expect(send.mock.calls[0][1]).not.toEqual(send.mock.calls[2][1]);
  });

  it("allows deliberate invitation resends while deduplicating retries of one delivery", async () => {
    const { send, sender } = setup();
    const invitation: AuthMail = { ...message, kind: "invitation", deliveryId: "first-send" };
    await sender(invitation);
    await sender(invitation);
    await sender({ ...invitation, deliveryId: "requested-resend" });
    expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
    expect(send.mock.calls[0][1]).not.toEqual(send.mock.calls[2][1]);
  });

  it.each([
    "https://attacker.example.com/verify?token=secret",
    "javascript:alert(1)",
    "http://workspace.example.com/verify",
    "https://user:password@workspace.example.com/verify",
    "https://workspace.example.com/verify#secret",
  ])("rejects unsafe action URL %s before sending", async (url) => {
    const { send, sender } = setup();
    await expect(sender({ ...message, url })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it("escapes quotes and tags in action URLs", async () => {
    const { send, sender } = setup();
    await sender({ ...message, url: 'https://workspace.example.com/verify?token="<script>' });
    expect(send.mock.calls[0][0].html).toContain("&quot;&lt;script&gt;");
  });

  it("rejects recipient header injection", async () => {
    const { send, sender } = setup();
    await expect(sender({ ...message, email: "victim@example.com\r\nBcc: other@example.com" })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["", "https://agentworks.app", "resend.dev", "agentworks.app>\r\nBcc: victim@example.com"])("rejects invalid sender configuration %s", (domain) => {
    expect(() => getAuthMailConfiguration({ ...env, RESEND_EMAIL_DOMAIN: domain })).toThrow();
  });

  it("requires the existing API key and canonical site configuration", () => {
    expect(() => getAuthMailConfiguration({ ...env, RESEND_API_KEY: undefined })).toThrow();
    expect(() => getAuthMailConfiguration({ ...env, BETTER_AUTH_URL: undefined })).toThrow();
  });

  it("propagates API errors without leaking tokens or provider messages", async () => {
    const { sender } = setup({ data: null, error: { message: "secret and recipient details", name: "validation_error" } });
    await expect(sender(message)).rejects.toThrow("Authentication email could not be delivered");
    await expect(sender(message)).rejects.not.toThrow("secret");
  });

  it("does not fake success when Resend returns no email id", async () => {
    const { sender } = setup({ data: {}, error: null });
    await expect(sender(message)).rejects.toThrow("Authentication email could not be delivered");
  });
});
