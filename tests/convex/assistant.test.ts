import { describe, expect, test } from "vitest";
import { api, components } from "../../convex/_generated/api";
import { ASSISTANT_LIMITS, documentHref } from "@agent-knowledge/shared";
import { addIdentity, createAuthTest } from "./authFixture";

async function seed(t: ReturnType<typeof createAuthTest>, organizationId = "org_test") {
  return await t.run(async (ctx) => {
    const documentId = await ctx.db.insert("knowledge", { title: "Onboarding policy", content: "SECRET BODY NEVER DISCLOSED", category: "Policy", status: "draft", organizationId, canUseToAnswer: false, canUseToAct: false, createdAt: 1, updatedAt: 1 });
    const agentId = await ctx.db.insert("agents", { name: "Onboarding agent", description: "SECRET AGENT PROMPT", organizationId, status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("agents", { name: "Onboarding disabled", description: "private", organizationId, status: "disabled", createdAt: 1, updatedAt: 1 });
    return { documentId, agentId };
  });
}
const search = { name: "search", args: { query: "Onboarding", entity: "all" } };

describe("assistant read dispatcher", () => {
  test("requires authentication even for navigation", async () => {
    const t = createAuthTest();
    await expect(t.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "navigate", args: { route: "/documents" } } })).rejects.toThrow("Unauthorized");
  });
  test.each(["owner", "admin", "member"] as const)("allows %s discovery but only returns workspace metadata", async (role) => {
    const t = createAuthTest();
    const actor = await addIdentity(t, { name: role, role, organizationId: "org_test" });
    const { documentId, agentId } = await seed(t);
    await seed(t, "other_org");
    const result = await actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: search });
    expect(result).toEqual({ kind: "discovery", scope: "metadata-only", hasMore: false, items: [
      { kind: "document", id: documentId, title: "Onboarding policy", href: documentHref(documentId) },
      { kind: "agent", id: agentId, title: "Onboarding agent", href: `/agents/${agentId}` },
    ] });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
  test("never treats navigation resolution as completed navigation", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", role: "member", organizationId: "org_test" });
    const { documentId } = await seed(t);
    expect(await actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "open.document", args: { id: documentId } } })).toEqual({ kind: "navigation", title: "Onboarding policy", href: documentHref(documentId), status: "pending-client" });
    expect(await actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "navigate", args: { route: "/documents" } } })).toMatchObject({ href: "/documents", status: "pending-client" });
  });
  test("denies cross-workspace selectors and document IDs", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", role: "member", organizationId: "org_test" });
    const { documentId } = await seed(t, "other_org");
    await expect(actor.client.query(api.assistant.executeRead, { organizationId: "other_org", command: search })).rejects.toThrow("Unauthorized");
    await expect(actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "open.document", args: { id: documentId } } })).rejects.toThrow("Document is not available");
    await expect(actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "open.document", args: { id: "bad-id" } } })).rejects.toThrow("Document is not available");
  });
  test("checks current membership rather than trusting a still-valid session", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", role: "member", organizationId: "org_test" });
    await t.run(async (ctx) => {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "member", where: [{ field: "_id", value: actor.memberId }] } });
    });
    await expect(actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: search })).rejects.toThrow("Unauthorized");
  });
  test("does not accept a mutation or a forged approval payload", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", role: "member", organizationId: "org_test" });
    await expect(actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "create.document", args: { title: "forged", approved: true } } })).rejects.toThrow("Invalid assistant command");
    expect(await t.run((ctx) => ctx.db.query("knowledge").collect())).toEqual([]);
  });
  test("bounds discovery and exposes truncation", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", role: "member", organizationId: "org_test" });
    await t.run(async (ctx) => {
      for (let index = 0; index < ASSISTANT_LIMITS.results + 2; index++) await ctx.db.insert("knowledge", { title: `Onboarding policy ${index}`, content: "private", category: "Policy", status: "draft", organizationId: "org_test", createdAt: 1, updatedAt: 1 });
    });
    const result = await actor.client.query(api.assistant.executeRead, { organizationId: "org_test", command: { name: "search", args: { query: "Onboarding", entity: "document" } } });
    expect(result.kind).toBe("discovery");
    if (result.kind !== "discovery") throw new Error("Expected discovery");
    expect(result.items).toHaveLength(ASSISTANT_LIMITS.results);
    expect(result.hasMore).toBe(true);
  });
});
