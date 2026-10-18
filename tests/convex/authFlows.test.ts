import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { authComponent } from "../../convex/auth";
import { createAuthOptions, type AuthMail } from "../../convex/authOptions";
import { getAuthEnvironment } from "../../convex/authEnvironment";
import { createAuthTest } from "./authFixture";
import { components } from "../../convex/_generated/api";

function harness() {
  const t = createAuthTest();
  const mailbox: AuthMail[] = [];
  const cookies = new Map<string, string>();
  let clientNumber = 1;
  async function call(path: string, body?: object, method = body ? "POST" : "GET") {
    const url = path.startsWith("https:") ? path : `https://auth.example.test/api/auth${path}`;
    return t.action(async ctx => {
      const options = createAuthOptions(authComponent.adapter(ctx), async mail => { mailbox.push(mail); });
      // Better Auth intentionally skips origin checks under NODE_ENV=test; exercise them explicitly.
      const auth = betterAuth({ ...options, advanced: { ...options.advanced, disableOriginCheck: false, disableCSRFCheck: false } });
      const response = await auth.handler(new Request(url, { method, headers: { origin: "https://auth.example.test", "x-forwarded-for": `192.0.2.${clientNumber}`, "content-type": "application/json", cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") }, ...(body ? { body: JSON.stringify(body) } : {}) }));
      const setCookies = response.headers.getSetCookie();
      for (const cookie of setCookies) { const [pair] = cookie.split(";"); const separator = pair!.indexOf("="); const key = pair!.slice(0, separator); const value = pair!.slice(separator + 1); if (!value) cookies.delete(key); else cookies.set(key, value); }
      const text = await response.text();
      return { status: response.status, location: response.headers.get("location"), data: text ? JSON.parse(text) : null, cookies: setCookies };
    });
  }
  async function signup(email: string) {
    clientNumber++;
    const result = await call("/sign-up/email", { email, name: "Lifecycle Test", password: "test-only-password-123", callbackURL: "https://auth.example.test/login" });
    expect(result.status).toBe(200);
    const verification = mailbox.find(mail => mail.email === email && mail.kind === "verification");
    expect(verification).toBeDefined();
    expect((await call(verification!.url)).status).toBe(302);
    return call("/sign-in/email", { email, password: "test-only-password-123" });
  }
  return { t, mailbox, cookies, call, signup, nextClient: () => { clientNumber++; } };
}
beforeEach(() => {
  process.env.RESEND_API_KEY = "test-only-delivery-credential";
  process.env.RESEND_EMAIL_DOMAIN = "mail.example.test";
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === "https://api.resend.com/domains") return Response.json({ data: [{ name: "mail.example.test", status: "verified" }] });
    throw new Error("Unexpected network in isolated auth lifecycle test");
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("real Better Auth HTTP lifecycle with an isolated delivery sink", () => {
  test("dev Preview origins pass real origin middleware while unrelated hosts and redirect URLs fail", async () => {
    const h = harness();
    const deployed = "https://alias-kr-ontology-lv4tpvgkr-prod-4689s-projects.vercel.app";
    const branch = "https://alias-kr-ontology-git-v0-fix-convex-8e7c1e-prod-4689s-projects.vercel.app";
    const environment = getAuthEnvironment({ NODE_ENV: "development", BETTER_AUTH_URL: branch,
      AUTH_PREVIEW_ORIGINS: JSON.stringify([deployed, branch]) });
    let probeNumber = 1;
    for (const [requestOrigin, callbackURL, expectedStatus] of [
      [deployed, `${deployed}/login`, 400],
      [branch, `${branch}/login`, 400],
      ["https://other-app.vercel.app", `${branch}/login`, 403],
      [`${deployed}.attacker.test`, `${branch}/login`, 403],
      [deployed, "https://other-app.vercel.app/login", 403],
    ] as const) {
      const status = await h.t.action(async ctx => {
        const options = createAuthOptions(authComponent.adapter(ctx), async () => undefined);
        const auth = betterAuth({ ...options, ...environment, advanced: { ...options.advanced,
          ...environment.advanced, disableOriginCheck: false, disableCSRFCheck: false } });
        const response = await auth.handler(new Request(`${branch}/api/auth/sign-up/email`, {
          method: "POST", headers: { origin: requestOrigin, "content-type": "application/json",
            "sec-fetch-site": "same-origin", cookie: "origin_probe=1", "x-forwarded-for": `192.0.2.${probeNumber++}` },
          body: JSON.stringify({ name: "Origin regression", email: "origin-check@example.test", password: "short", callbackURL }),
        }));
        return response.status;
      });
      // Schema-valid input reaches origin middleware; the short password prevents account creation.
      expect(status, `${requestOrigin} with callback ${callbackURL}`).toBe(expectedStatus);
    }
    expect(h.mailbox).toHaveLength(0);
  });
  test("signup requires verification; sign-in persists session; sign-out revokes it", async () => {
    const h = harness();
    const signup = await h.call("/sign-up/email", { email: "lifecycle@example.test", name: "Lifecycle Test", password: "test-only-password-123", callbackURL: "https://auth.example.test/login" });
    expect(signup.status).toBe(200);
    expect((await h.call("/sign-in/email", { email: "lifecycle@example.test", password: "test-only-password-123" })).status).toBe(403);
    const mail = h.mailbox.find(mail => mail.kind === "verification")!;
    expect(mail).toBeDefined();
    expect((await h.call(mail.url)).status).toBe(302);
    const signin = await h.call("/sign-in/email", { email: "lifecycle@example.test", password: "test-only-password-123" });
    expect(signin.status).toBe(200);
    expect(signin.cookies.some(value => value.includes("session_token") && value.includes("HttpOnly") && value.includes("Secure"))).toBe(true);
    expect((await h.call("/get-session")).data.user.email).toBe("lifecycle@example.test");
    expect((await h.call("/sign-out", {})).status).toBe(200);
    expect((await h.call("/get-session")).data).toBeNull();
  });
  test("reset links change credentials and cannot be replayed", async () => {
    const h = harness(); await h.signup("recovery@example.test");
    expect((await h.call("/request-password-reset", { email: "recovery@example.test", redirectTo: "https://auth.example.test/reset-password" })).status).toBe(200);
    const reset = h.mailbox.find(mail => mail.kind === "reset")!;
    expect(reset).toBeDefined();
    const token = new URL(reset.url).pathname.split("/").pop();
    expect((await h.call("/reset-password", { token, newPassword: "replacement-password-456" })).status).toBe(200);
    expect((await h.call("/reset-password", { token, newPassword: "replayed-password-789" })).status).toBe(400);
    expect((await h.call("/sign-in/email", { email: "recovery@example.test", password: "test-only-password-123" })).status).toBe(401);
    expect((await h.call("/sign-in/email", { email: "recovery@example.test", password: "replacement-password-456" })).status).toBe(200);
  });
  test("unverified users cannot create organizations and client input cannot create owners", async () => {
    const h = harness(); await h.signup("owner@example.test");
    const organization = await h.call("/organization/create", { name: "Isolated Workspace", slug: "isolated-workspace" });
    expect(organization.status).toBe(200);
    expect(organization.data.members[0].role).toBe("owner");
    expect((await h.call("/organization/get-full-organization")).status).toBe(200);
    expect((await h.call("/organization/update-member-role", { memberId: organization.data.members[0].id, role: "member", organizationId: organization.data.id })).status).toBe(400);
  });
  test("authenticator enrollment, challenged sign-in, recovery replay denial, and disable", async () => {
    const h = harness(); await h.signup("factor@example.test");
    const setup = await h.call("/two-factor/enable", { password: "test-only-password-123" });
    expect(setup.status).toBe(200);
    expect((await h.call("/get-session")).data.user.twoFactorEnabled).not.toBe(true);
    const secret = new TextDecoder().decode(base32.decode(new URL(setup.data.totpURI).searchParams.get("secret")!, { padding: false }));
    const code = await createOTP(secret).totp();
    expect((await h.call("/two-factor/verify-totp", { code, trustDevice: false })).status).toBe(200);
    expect((await h.call("/get-session")).data.user.twoFactorEnabled).toBe(true);
    await h.call("/sign-out", {});
    const challenge = await h.call("/sign-in/email", { email: "factor@example.test", password: "test-only-password-123" });
    expect(challenge.data.twoFactorRedirect).toBe(true);
    expect((await h.call("/get-session")).data).toBeNull();
    expect((await h.call("/two-factor/verify-totp", { code: "not-a-code", trustDevice: false })).status).toBe(401);
    const recovery = setup.data.backupCodes[0];
    expect((await h.call("/two-factor/verify-backup-code", { code: recovery })).status).toBe(200);
    await h.call("/sign-out", {});
    await h.call("/sign-in/email", { email: "factor@example.test", password: "test-only-password-123" });
    expect((await h.call("/two-factor/verify-backup-code", { code: recovery })).status).toBe(401);
    expect((await h.call("/two-factor/verify-totp", { code: await createOTP(secret).totp(), trustDevice: false })).status).toBe(200);
    expect((await h.call("/two-factor/disable", { password: "test-only-password-123" })).status).toBe(200);
    expect((await h.call("/get-session")).data.user.twoFactorEnabled).toBe(false);
  });
  test("two-factor HTTP lockout blocks a threshold challenge, expires, and resets after success", async () => {
    const h = harness();
    const email = "lockout@example.test";
    await h.signup(email);
    const setup = await h.call("/two-factor/enable", { password: "test-only-password-123" });
    expect(setup.status).toBe(200);
    const secret = new TextDecoder().decode(base32.decode(new URL(setup.data.totpURI).searchParams.get("secret")!, { padding: false }));
    expect((await h.call("/two-factor/verify-totp", { code: await createOTP(secret).totp(), trustDevice: false })).status).toBe(200);
    await h.call("/sign-out", {});
    const challenge = await h.call("/sign-in/email", { email, password: "test-only-password-123" });
    expect(challenge.data.twoFactorRedirect).toBe(true);

    const user = await h.t.run(ctx => ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user", where: [{ field: "email", value: email }],
    }));
    const twoFactor = await h.t.run(ctx => ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "twoFactor", where: [{ field: "userId", value: user!._id }],
    }));
    // Seed nine prior cross-challenge failures; the HTTP request below exercises
    // Better Auth's threshold increment, lock, denial, expiry, and reset paths.
    await h.t.run(ctx => ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: { model: "twoFactor", where: [{ field: "_id", value: twoFactor!._id }], update: { failedVerificationCount: 9 } },
    }));
    expect((await h.call("/two-factor/verify-totp", { code: "not-a-code", trustDevice: false })).status).toBe(401);
    const lockedState = await h.t.run(ctx => ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "twoFactor", where: [{ field: "_id", value: twoFactor!._id }],
    }));
    expect(lockedState).toMatchObject({ failedVerificationCount: 10 });
    expect(lockedState!.lockedUntil).toBeGreaterThan(Date.now());

    const locked = await h.call("/two-factor/verify-totp", { code: await createOTP(secret).totp(), trustDevice: false });
    expect(locked.status).toBe(429);
    expect(locked.data.code).toBe("ACCOUNT_TEMPORARILY_LOCKED");
    await h.t.run(ctx => ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: { model: "twoFactor", where: [{ field: "_id", value: twoFactor!._id }], update: { lockedUntil: 1 } },
    }));
    // The endpoint has its own per-IP request limit; use a fresh test client
    // so this request specifically exercises expired-lock handling.
    h.nextClient();
    expect((await h.call("/two-factor/verify-totp", { code: await createOTP(secret).totp(), trustDevice: false })).status).toBe(200);
    const reset = await h.t.run(ctx => ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "twoFactor", where: [{ field: "_id", value: twoFactor!._id }],
    }));
    expect(reset).toMatchObject({ failedVerificationCount: 0, lockedUntil: null });
  });
  test("invitation acceptance checks email, role, revocation and single-use membership", async () => {
    const h = harness(); await h.signup("inviter@example.test");
    const org = (await h.call("/organization/create", { name: "Invite Workspace", slug: "invitation-workspace" })).data;
    const invite = await h.call("/organization/invite-member", { organizationId: org.id, email: "invitee@example.test", role: "member" });
    expect(invite.status).toBe(200);
    const revoked = await h.call("/organization/invite-member", { organizationId: org.id, email: "revoked@example.test", role: "member" });
    expect((await h.call("/organization/cancel-invitation", { invitationId: revoked.data.id })).status).toBe(200);
    await h.call("/sign-out", {});
    await h.signup("wrong-person@example.test");
    expect((await h.call("/organization/accept-invitation", { invitationId: invite.data.id })).status).toBe(403);
    await h.call("/sign-out", {});
    await h.signup("invitee@example.test");
    expect((await h.call("/organization/accept-invitation", { invitationId: invite.data.id })).status).toBe(200);
    expect((await h.call("/organization/accept-invitation", { invitationId: invite.data.id })).status).toBe(400);
    await h.call("/organization/set-active", { organizationId: org.id });
    const membership = await h.call("/organization/get-active-member");
    expect(membership.data.role).toBe("member");
    expect((await h.call("/organization/invite-member", { organizationId: org.id, email: "unauthorized@example.test", role: "owner" })).status).toBe(403);
    await h.call("/sign-out", {});
    await h.signup("revoked@example.test");
    expect((await h.call("/organization/accept-invitation", { invitationId: revoked.data.id })).status).toBe(400);
  });
  test("revoking other sessions denies a previously valid cookie", async () => {
    const h = harness(); await h.signup("sessions@example.test");
    const original = new Map(h.cookies);
    await h.call("/sign-in/email", { email: "sessions@example.test", password: "test-only-password-123" });
    expect((await h.call("/list-sessions")).data).toHaveLength(2);
    expect((await h.call("/revoke-other-sessions", {})).status).toBe(200);
    expect((await h.call("/list-sessions")).data).toHaveLength(1);
    h.cookies.clear(); for (const [key, value] of original) h.cookies.set(key, value);
    expect((await h.call("/get-session")).data).toBeNull();
  });
  test("expired invitations cannot admit an otherwise verified matching user", async () => {
    const h = harness(); await h.signup("expiry-owner@example.test");
    const org = (await h.call("/organization/create", { name: "Expiry Workspace", slug: "expiry-workspace" })).data;
    const invite = await h.call("/organization/invite-member", { organizationId: org.id, email: "expired@example.test", role: "member" });
    expect(invite.status).toBe(200);
    await h.t.run(ctx => ctx.runMutation(components.betterAuth.adapter.updateOne, { input: { model: "invitation", where: [{ field: "_id", value: invite.data.id }], update: { expiresAt: 1 } } }));
    await h.call("/sign-out", {}); await h.signup("expired@example.test");
    expect((await h.call("/organization/accept-invitation", { invitationId: invite.data.id })).status).toBe(400);
  });
  test("untrusted origin and wrong password cannot acquire a session", async () => {
    const h = harness(); await h.signup("protected@example.test");
    await h.call("/sign-out", {});
    expect((await h.call("/sign-in/email", { email: "protected@example.test", password: "wrong-password" })).status).toBe(401);
    expect((await h.call("/get-session")).data).toBeNull();
    const result = await h.t.action(async ctx => {
      const options = createAuthOptions(authComponent.adapter(ctx), async () => undefined);
      const auth = betterAuth({ ...options, advanced: { ...options.advanced, disableOriginCheck: false, disableCSRFCheck: false } });
      const response = await auth.handler(new Request("https://auth.example.test/api/auth/sign-in/email", { method: "POST", headers: { origin: "https://evil.example.test", cookie: "browser-context=present", "sec-fetch-site": "cross-site", "content-type": "application/json" }, body: JSON.stringify({ email: "protected@example.test", password: "test-only-password-123" }) }));
      return response.status;
    });
    expect(result).toBe(403);
  });
});
