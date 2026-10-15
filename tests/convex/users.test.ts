import { describe, expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api, components } from "../../convex/_generated/api";
import { createAuthTest, addIdentity } from "./authFixture";

describe("Better Auth profile and tenant integration", () => {
  test("anonymous initialization cannot create profiles or privileges", async () => {
    const t = createAuthTest();
    await expect(t.mutation(api.auth.initializeWorkspace, {})).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
  });
  test("new profiles are linked only to the authenticated user", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "owner", provision: false });
    await actor.client.mutation(api.auth.initializeWorkspace, {});
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1); expect(users[0].betterAuthUserId).toBe(actor.userId);
    expect(await t.run((ctx) => ctx.db.query("memberships").collect())).toEqual([]);
  });
  test("profile initialization is idempotent", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "owner", provision: false });
    await actor.client.mutation(api.auth.initializeWorkspace, {}); await actor.client.mutation(api.auth.initializeWorkspace, {});
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(1);
  });
  test("matching legacy email never links or inherits an old role", async () => {
    const t = createAuthTest();
    const id = await t.run(async (ctx) => { const id = await ctx.db.insert("users", { workosUserId: "legacy", email: "new@example.com", createdAt: 1, updatedAt: 1 }); await ctx.db.insert("memberships", { userId: id, organizationId: "old-org", role: "owner", createdAt: 1, updatedAt: 1 }); return id; });
    const actor = await addIdentity(t, { name: "new", organizationId: "new-org", role: "member", provision: false });
    await actor.client.mutation(api.auth.initializeWorkspace, {});
    expect(await t.run((ctx) => ctx.db.get(id))).not.toHaveProperty("betterAuthUserId");
    await expect(actor.client.query(api.users.getCurrentProfile, { organizationId: "old-org" })).rejects.toThrow("Unauthorized");
  });
  test("unverified users cannot provision profiles or read a workspace", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "owner", verified: false, provision: false });
    await expect(actor.client.mutation(api.auth.initializeWorkspace, {})).rejects.toThrow("Verify");
    await expect(actor.client.query(api.knowledge.listKnowledge, { organizationId: "a" })).rejects.toThrow("Unauthorized");
  });
  test("revoking a session immediately denies a still-issued JWT", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "member" });
    await t.run((ctx) => ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: actor.sessionId }] } }));
    await expect(actor.client.query(api.knowledge.listKnowledge, { organizationId: "a" })).rejects.toThrow("Unauthorized");
  });
  test("expiration immediately denies a still-issued JWT", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "member" });
    await t.run((ctx) => ctx.runMutation(components.betterAuth.adapter.updateOne, { input: { model: "session", where: [{ field: "_id", value: actor.sessionId }], update: { expiresAt: 1 } } }));
    await expect(actor.client.query(api.knowledge.listKnowledge, { organizationId: "a" })).rejects.toThrow("Unauthorized");
  });
  test("removed members lose reads and writes while their session remains valid", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "member" });
    await t.run((ctx) => ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "member", where: [{ field: "_id", value: actor.memberId }] } }));
    await expect(actor.client.query(api.users.getCurrentProfile, { organizationId: "a" })).rejects.toThrow("Unauthorized");
    await expect(actor.client.mutation(api.knowledge.createDocument, { organizationId: "a", title: "Forbidden", documentType: "document" })).rejects.toThrow("Unauthorized");
  });
  test("switching active organization invalidates the old tenant selector", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "new", organizationId: "a", role: "member" });
    await t.run((ctx) => ctx.runMutation(components.betterAuth.adapter.updateOne, { input: { model: "session", where: [{ field: "_id", value: actor.sessionId }], update: { activeOrganizationId: "other" } } }));
    await expect(actor.client.query(api.knowledge.listKnowledge, { organizationId: "a" })).rejects.toThrow("Unauthorized");
  });
  test.each(["upsertCurrentUser", "updateMemberRole", "removeMember", "inviteMember"])("removes legacy writable authority %s", async (name) => {
    const t = createAuthTest();
    await expect(t.mutation(makeFunctionReference<"mutation">(`users:${name}`), {})).rejects.toThrow("no such export");
  });
});
