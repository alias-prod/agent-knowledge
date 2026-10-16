import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { addIdentity, createAuthTest } from "./authFixture";

test("citation validation rechecks approval, agent status, assignment, workspace, and source revision", async () => {
  const t = createAuthTest();
  const actor = await addIdentity(t, { name: "reader", role: "member", organizationId: "org-test" });
  const ids = await t.run(async ctx => {
    const agentId = await ctx.db.insert("agents", { organizationId: "org-test", name: "Agent", description: "", status: "active", createdAt: 1, updatedAt: 1 });
    const id = await ctx.db.insert("knowledge", { organizationId: "org-test", title: "Policy", content: "Evidence", category: "Policy", status: "verified", canUseToAnswer: true, requiresApproval: false, allowedAgentIds: [agentId], createdAt: 1, updatedAt: 1 });
    return { agentId, id };
  });
  const args = { organizationId: "org-test", agentId: ids.agentId, sources: [{ id: ids.id, updatedAt: 1 }] };
  expect(await actor.client.query(api.assistant.validateSources, args)).toBe(true);
  for (const change of [{ status: "draft" as const }, { requiresApproval: true }, { canUseToAnswer: false }, { allowedAgentIds: [] }, { organizationId: "other-org" }, { updatedAt: 2 }]) {
    const original = await t.run(ctx => ctx.db.get(ids.id));
    await t.run(ctx => ctx.db.patch(ids.id, change));
    expect(await actor.client.query(api.assistant.validateSources, args)).toBe(false);
    await t.run(ctx => ctx.db.replace(ids.id, original!));
  }
  await t.run(ctx => ctx.db.patch(ids.agentId, { status: "disabled" }));
  expect(await actor.client.query(api.assistant.validateSources, args)).toBe(false);
});
test("graph view commands validate destination record ownership rather than trusting an ID", async () => {
  const t = createAuthTest();
  const actor = await addIdentity(t, { name: "reader", role: "member", organizationId: "org-test" });
  const id = await t.run(ctx => ctx.db.insert("knowledge", { organizationId: "other-org", title: "Private", content: "Private", category: "Policy", status: "draft", createdAt: 1, updatedAt: 1 }));
  const args = { organizationId: "org-test", command: { name: "graph.view", args: { lens: "knowledge", query: "", status: "all", view: "list", documentId: id, focus: "yes" } } };
  await expect(actor.client.query(api.assistant.executeRead, args)).rejects.toThrow("not available");
  const result = await actor.client.query(api.assistant.executeRead, { ...args, command: { ...args.command, args: { ...args.command.args, documentId: "", lens: "ontology" } } });
  expect(result).toMatchObject({ kind: "navigation", status: "pending-client" });
  if (result.kind !== "navigation") throw new Error("Expected navigation");
  expect(result.href).toContain("lens=ontology");
});
