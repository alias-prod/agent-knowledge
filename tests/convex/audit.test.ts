import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createAuthTest, addIdentity } from "./authFixture";
const args = { name: "Support Agent", description: "Handles support", role: "support", status: "active" as const, organizationId: "org_test", actorEmail: "forged@example.com", workosUserId: "forged-id" };
describe("audit log actor identity", () => {
  test("records the authenticated actor ID, never a browser-supplied identity", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "admin", organizationId: "org_test", role: "admin" });
    await actor.client.mutation(api.agents.createAgent, args);
    const log = await t.run((ctx) => ctx.db.query("auditLogs").first());
    expect(log).toMatchObject({ action: "agent.created", actorId: actor.userId, actorUserId: actor.userId, actorEmail: "admin@example.com" });
  });
  test("creates a draft document and its authenticated audit event together", async () => {
    const t = createAuthTest();
    const actor = await addIdentity(t, { name: "owner", organizationId: "org_test", role: "owner" });
    const id = await actor.client.mutation(api.knowledge.createDocument, {
      organizationId: "org_test", title: "Migration QA Policy", documentType: "policy",
    });
    const { document, log } = await t.run(async (ctx) => ({
      document: await ctx.db.get(id),
      log: await ctx.db.query("auditLogs").first(),
    }));
    expect(document).toMatchObject({ status: "draft", canUseToAnswer: false, canUseToAct: false });
    expect(log).toMatchObject({
      action: "created", knowledgeId: id, organizationId: "org_test",
      actorId: actor.userId, actorUserId: actor.userId, actorEmail: "owner@example.com",
    });
  });
  test("refuses to create an audit event for an unauthenticated mutation", async () => {
    const t = createAuthTest();
    await expect(t.mutation(api.agents.createAgent, args)).rejects.toThrow("Unauthorized");
    expect(await t.run((ctx) => ctx.db.query("auditLogs").first())).toBeNull();
  });
  test("denies a stale provider identity even when legacy memberships remain", async () => {
    const t = createAuthTest();
    await t.run(async (ctx) => { const id = await ctx.db.insert("users", { workosUserId: "legacy", email: "legacy@example.com", createdAt: 1, updatedAt: 1 }); await ctx.db.insert("memberships", { userId: id, organizationId: "org_test", role: "owner", createdAt: 1, updatedAt: 1 }); });
    await expect(t.withIdentity({ subject: "legacy" }).mutation(api.agents.createAgent, args)).rejects.toThrow("Unauthorized");
  });
});
