import { describe, expect, test } from "vitest";
import { api, components, internal } from "../../convex/_generated/api";
import { addIdentity, createAuthTest } from "./authFixture";

const requestId = () => crypto.randomUUID();
async function fixture() {
  const t = createAuthTest();
  const owner = await addIdentity(t, { name: "owner", organizationId: "workspace-a", role: "owner" });
  const member = await addIdentity(t, { name: "member", organizationId: "workspace-a", role: "member" });
  const outsider = await addIdentity(t, { name: "outsider", organizationId: "workspace-b", role: "owner" });
  const id = requestId();
  await owner.client.mutation(api.assistantOperations.beginRequest, { organizationId: "workspace-a", requestId: id, historyEnabled: false });
  return { t, owner, member, outsider, scope: { organizationId: "workspace-a", requestId: id } };
}
describe("assistant request and operation security", () => {
  test("never saves a proposal without confirmation and makes confirmation idempotent", async () => {
    const { t, owner, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Proposed text" });
    expect(await t.run(ctx => ctx.db.query("knowledge").collect())).toHaveLength(0);
    const id = await owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId });
    expect(await owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).toBe(id);
    const rows = await t.run(ctx => ctx.db.query("knowledge").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ content: "Proposed text", status: "draft", requiresApproval: true, canUseToAnswer: false, canUseToAct: false });
    expect(await t.run(ctx => ctx.db.get(operationId))).toMatchObject({ status: "committed", content: "" });
  });
  test("members and other actors cannot commit the owner's proposal or read its payload", async () => {
    const { owner, member, outsider, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Confidential draft" });
    await expect(member.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).rejects.toThrow("Unauthorized");
    await expect(outsider.client.mutation(api.assistantOperations.commitDraft, { organizationId: "workspace-b", operationId })).rejects.toThrow("Unauthorized");
    expect(await member.client.query(api.assistantOperations.listOperations, scope)).toEqual([]);
    await expect(outsider.client.query(api.assistantOperations.listOperations, scope)).rejects.toThrow("Unauthorized");
  });
  test("revoked membership invalidates a valid-session proposal", async () => {
    const { t, owner, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Draft" });
    await t.run(ctx => ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: owner.sessionId }] } }));
    await expect(owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).rejects.toThrow("Unauthorized");
  });
  test("cancellation prevents late proposals and approvals", async () => {
    const { owner, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Draft" });
    await owner.client.mutation(api.assistantOperations.cancelRequest, scope);
    await expect(owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Late", content: "Draft" })).rejects.toThrow("no longer active");
    await expect(owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).rejects.toThrow("no longer available");
  });
  test("expired proposals are not actionable", async () => {
    const { t, owner, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Draft" });
    await t.run(ctx => ctx.db.patch(operationId, { expiresAt: Date.now() - 1 }));
    await expect(owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).rejects.toThrow("no longer available");
  });
  test("optimistic edits preserve concurrent document updates and checkpoints", async () => {
    const { t, owner, scope } = await fixture();
    const targetId = await owner.client.mutation(api.documents.createDocument, { organizationId: scope.organizationId, title: "Original", content: "Original", documentType: "document" });
    const target = await t.run(ctx => ctx.db.get(targetId));
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Changed", content: "Proposed", targetId, expectedUpdatedAt: target!.updatedAt });
    await t.run(ctx => ctx.db.patch(targetId, { content: "Concurrent", updatedAt: target!.updatedAt + 1 }));
    await expect(owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId })).rejects.toThrow("Document changed");
    expect((await t.run(ctx => ctx.db.get(targetId)))?.content).toBe("Concurrent");
  });
  test("an edit writes Yjs-compatible content and retains restoration evidence", async () => {
    const { t, owner, scope } = await fixture();
    const targetId = await owner.client.mutation(api.documents.createDocument, { organizationId: scope.organizationId, title: "Original", content: "Original", documentType: "document" });
    const target = await t.run(ctx => ctx.db.get(targetId));
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Changed", content: "Proposed", targetId, expectedUpdatedAt: target!.updatedAt });
    await owner.client.mutation(api.assistantOperations.commitDraft, { organizationId: scope.organizationId, operationId });
    expect(await owner.client.query(api.documents.getDocument, { organizationId: scope.organizationId, id: targetId })).toMatchObject({ title: "Changed", content: "Proposed", status: "draft" });
    expect((await t.run(ctx => ctx.db.query("knowledgeVersions").collect())).some(row => row.content === "Original")).toBe(true);
  });
  test("one actor cannot overlap requests or reuse request IDs", async () => {
    const { owner, scope } = await fixture();
    await expect(owner.client.mutation(api.assistantOperations.beginRequest, { ...scope, requestId: requestId(), historyEnabled: false })).rejects.toThrow("Wait for the current");
    await owner.client.mutation(api.assistantOperations.finishRequest, { ...scope, failed: false });
    await expect(owner.client.mutation(api.assistantOperations.beginRequest, { ...scope, historyEnabled: false })).rejects.toThrow("already used");
  });
  test("conversation persistence requires explicit opt-in and deletion is actor-scoped", async () => {
    const { t, owner, outsider, scope } = await fixture();
    await owner.client.mutation(api.assistantOperations.finishRequest, { ...scope, failed: false, question: "Private", message: "Private" });
    expect(await t.run(ctx => ctx.db.query("assistantMessages").collect())).toHaveLength(0);
    const savedScope = { organizationId: scope.organizationId, requestId: requestId() };
    await owner.client.mutation(api.assistantOperations.beginRequest, { ...savedScope, historyEnabled: true });
    await owner.client.mutation(api.assistantOperations.finishRequest, { ...savedScope, failed: false, question: "Question", message: "Response" });
    expect(await owner.client.query(api.assistantOperations.history, { organizationId: scope.organizationId })).toHaveLength(1);
    await expect(outsider.client.query(api.assistantOperations.history, { organizationId: scope.organizationId })).rejects.toThrow("Unauthorized");
    await owner.client.mutation(api.assistantOperations.deleteHistory, { organizationId: scope.organizationId });
    expect(await owner.client.query(api.assistantOperations.history, { organizationId: scope.organizationId })).toEqual([]);
  });
  test("bounded retention cleanup removes expired sensitive payloads", async () => {
    const { t, owner, scope } = await fixture();
    const operationId = await owner.client.mutation(api.assistantOperations.proposeDraft, { ...scope, title: "Decision", content: "Draft" });
    await t.run(ctx => ctx.db.patch(operationId, { expiresAt: 1 }));
    await t.mutation(internal.assistantOperations.cleanupExpired, {});
    expect(await t.run(ctx => ctx.db.get(operationId))).toBeNull();
  });
});
