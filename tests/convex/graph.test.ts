import { createAuthTest, addIdentity } from "./authFixture";
import { describe, expect, test } from "vitest";
import { GRAPH_LIMITS } from "@agent-knowledge/shared";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.*s");

async function fixture() {
  const t = createAuthTest();
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = await ctx.db.insert("users", { workosUserId: "user-a", email: "a@example.com", createdAt: now, updatedAt: now });
    await ctx.db.insert("memberships", { userId: user, organizationId: "org-a", role: "member", createdAt: now, updatedAt: now });
    const agent = await ctx.db.insert("agents", { name: "Our agent", description: "Our description", status: "active", organizationId: "org-a", createdAt: now, updatedAt: now });
    const foreignAgent = await ctx.db.insert("agents", { name: "Foreign agent", description: "Foreign secret", status: "active", organizationId: "org-b", createdAt: now, updatedAt: now });
    const knowledge = await ctx.db.insert("knowledge", { title: "Our knowledge", content: "x".repeat(1000), category: "Policy", status: "verified", organizationId: "org-a", allowedAgentIds: [agent, foreignAgent, agent], ownerEmail: "private-owner@example.com", createdAt: now, updatedAt: now });
    await ctx.db.insert("knowledge", { title: "Foreign knowledge", content: "Foreign secret", category: "Policy", status: "draft", organizationId: "org-b", createdAt: now, updatedAt: now });
    await ctx.db.insert("knowledge", { title: "Legacy unscoped knowledge", content: "Unscoped secret", category: "Policy", status: "draft", createdAt: now, updatedAt: now });
    await ctx.db.insert("retrievalLogs", { organizationId: "org-a", agentId: agent, question: "Our question", resultCount: 1, sourceTitles: ["Our knowledge"], actorEmail: "private-actor@example.com", createdAt: now });
    await ctx.db.insert("retrievalLogs", { organizationId: "org-a", agentId: foreignAgent, question: "Inconsistent historical reference", resultCount: 0, sourceTitles: [], createdAt: now });
    await ctx.db.insert("retrievalLogs", { organizationId: "org-b", agentId: foreignAgent, question: "Foreign question", resultCount: 0, sourceTitles: [], createdAt: now });
    await ctx.db.insert("organizationSettings", { organizationId: "org-a", displayName: "Our workspace", defaultKnowledgeStatus: "draft", defaultCanUseToAnswer: false, defaultCanUseToAct: false, createdAt: now, updatedAt: now });
    return { agent, foreignAgent, knowledge };
  });
  const member = await addIdentity(t, { name: "user-a", organizationId: "org-a", role: "member" });
  return { t, ids, asMember: member.client };
}

describe("graph snapshot authorization and bounds", () => {
  test("rejects unauthenticated calls", async () => {
    const { t } = await fixture();
    await expect(t.query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" })).rejects.toThrow("Unauthorized");
  });

  test("rejects authenticated nonmembers and cross-tenant requests", async () => {
    const { t, asMember } = await fixture();
    await expect(t.withIdentity({ subject: "unknown-user" }).query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" })).rejects.toThrow("Unauthorized");
    await expect(asMember.query(api.knowledge.getGraphSnapshot, { organizationId: "org-b" })).rejects.toThrow("Unauthorized");
  });

  test("returns only member-scoped records and removes foreign graph references", async () => {
    const { asMember, ids } = await fixture();
    const snapshot = await asMember.query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" });
    expect(snapshot.organizationName).toBe("Our workspace");
    expect(snapshot.knowledge).toHaveLength(1);
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.knowledge[0].id).toBe(ids.knowledge);
    expect(snapshot.knowledge[0].allowedAgentIds).toEqual([ids.agent]);
    expect(snapshot.knowledge[0].summary).toHaveLength(600);
    expect(snapshot.knowledge[0].canUseToAnswer).toBe(false);
    expect(snapshot.knowledge[0].canUseToAct).toBe(false);
    expect(snapshot.retrievals.find((event) => event.question === "Inconsistent historical reference")?.agentId).toBeUndefined();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(ids.foreignAgent);
    expect(serialized).not.toContain("Foreign");
    expect(serialized).not.toContain("Unscoped");
    expect(serialized).not.toContain("private-owner@example.com");
    expect(serialized).not.toContain("private-actor@example.com");
  });

  test("caps workspace reads and reports truncated data", async () => {
    const { t, asMember } = await fixture();
    await t.run(async (ctx) => {
      for (let i = 0; i < GRAPH_LIMITS.knowledge; i++) {
        await ctx.db.insert("knowledge", { title: `Record ${i}`, content: "Bounded", category: "Policy", status: "draft", organizationId: "org-a", createdAt: i, updatedAt: i });
      }
    });
    const snapshot = await asMember.query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" });
    expect(snapshot.knowledge).toHaveLength(GRAPH_LIMITS.knowledge);
    expect(snapshot.truncated).toEqual({ knowledge: true, agents: false, retrievals: false });
  });

  test("returns an honest empty state for a new workspace", async () => {
    const t = createAuthTest();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { workosUserId: "empty-user", email: "empty@example.com", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("memberships", { userId, organizationId: "empty", role: "owner", createdAt: 1, updatedAt: 1 });
    });
    const member = await addIdentity(t, { name: "empty-user", organizationId: "empty", role: "owner" });
    const snapshot = await member.client.query(api.knowledge.getGraphSnapshot, { organizationId: "empty" });
    expect(snapshot.knowledge).toEqual([]);
    expect(snapshot.agents).toEqual([]);
    expect(snapshot.retrievals).toEqual([]);
    expect(snapshot.truncated).toEqual({ knowledge: false, agents: false, retrievals: false });
  });
});
