import * as Y from "yjs";
import { createAuthTest, addIdentity } from "./authFixture";
import { describe, expect, test } from "vitest";
import { DOCUMENT_LIMITS } from "@agent-knowledge/shared";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.*s");

async function fixture() {
  const t = createAuthTest();
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    for (const [subject, organizationId, role] of [
      ["owner", "org-a", "owner"],
      ["member", "org-a", "member"],
      ["foreign-owner", "org-b", "owner"],
    ] as const) {
      const userId = await ctx.db.insert("users", { workosUserId: subject, email: `${subject}@example.com`, createdAt: now, updatedAt: now });
      await ctx.db.insert("memberships", { userId, organizationId, role, createdAt: now, updatedAt: now });
    }
    const agent = await ctx.db.insert("agents", { name: "Context agent", description: "Uses approved context", status: "active", organizationId: "org-a", createdAt: now, updatedAt: now });
    const foreignAgent = await ctx.db.insert("agents", { name: "Other agent", description: "Private", status: "active", organizationId: "org-b", createdAt: now, updatedAt: now });
    const foreign = await ctx.db.insert("knowledge", { title: "Foreign knowledge", content: "Private content", category: "Policy", status: "verified", organizationId: "org-b", createdAt: now, updatedAt: now });
    return { agent, foreignAgent, foreign };
  });
  const owner = await addIdentity(t, { name: "owner", organizationId: "org-a", role: "owner" });
  const member = await addIdentity(t, { name: "member", organizationId: "org-a", role: "member" });
  const foreign = await addIdentity(t, { name: "foreign-owner", organizationId: "org-b", role: "owner" });
  return { t, ids, owner: owner.client, member: member.client, foreignOwner: foreign.client, ownerId: owner.userId };
}

function replica(state: ArrayBuffer) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(state));
  return doc;
}

function update(doc: Y.Doc) {
  return Uint8Array.from(Y.encodeStateAsUpdate(doc)).buffer;
}

describe("integrated document workspace", () => {
  test("creates a real knowledge record with safe agent defaults and a verified audit actor", async () => {
    const { t, owner, ownerId } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "  Access policy  ", documentType: "policy", content: "Initial policy" });
    const document = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(document).toMatchObject({ id, title: "Access policy", documentType: "policy", status: "draft", requiresApproval: true, canUseToAnswer: false, canUseToAct: false, allowedAgentIds: [] });
    const record = await t.run((ctx) => ctx.db.get(id));
    expect(record?.organizationId).toBe("org-a");
    expect(record?.ownerId).toBe(ownerId);
    const logs = await t.run((ctx) => ctx.db.query("auditLogs").collect());
    expect(logs).toContainEqual(expect.objectContaining({ knowledgeId: id, actorEmail: "owner@example.com", action: "created" }));
    const library = await owner.query(api.knowledge.listKnowledge, { organizationId: "org-a" });
    expect(library.map((item) => item._id)).toContain(id);
    expect(library[0]).not.toHaveProperty("collaborationState");
  });

  test("requires a real membership for reads and owner or admin permission for writes", async () => {
    const { t, owner, member } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Read me", documentType: "document" });
    await expect(t.query(api.knowledge.listDocuments, { organizationId: "org-a" })).rejects.toThrow("Unauthorized");
    await expect(t.query(api.knowledge.listKnowledge, { organizationId: "org-a" })).rejects.toThrow("Unauthorized");
    await expect(member.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Forbidden", documentType: "document" })).rejects.toThrow("Unauthorized");
    expect(await member.query(api.knowledge.getDocument, { organizationId: "org-a", id })).toMatchObject({ canEdit: false });
    await expect(member.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: new ArrayBuffer(0) })).rejects.toThrow("Unauthorized");
    await expect(member.mutation(api.knowledge.createDocumentCheckpoint, { organizationId: "org-a", id })).rejects.toThrow("Unauthorized");
  });

  test("does not expose another workspace or malformed document IDs", async () => {
    const { owner, foreignOwner, ids } = await fixture();
    expect(await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id: ids.foreign })).toBeNull();
    expect(await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id: "not-a-document-id" })).toBeNull();
    await expect(foreignOwner.query(api.knowledge.listDocuments, { organizationId: "org-a" })).rejects.toThrow("Unauthorized");
    await expect(owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Bad parent", documentType: "document", parentId: ids.foreign })).rejects.toThrow("Document not found");
  });

  test("opens legacy knowledge as a document without duplicating its content", async () => {
    const { t, owner } = await fixture();
    const id = await t.run((ctx) => ctx.db.insert("knowledge", { title: "Legacy policy", content: "Original context", category: "Policies", status: "verified", organizationId: "org-a", createdAt: 1, updatedAt: 1 }));
    const a = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    const b = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(a?.documentType).toBe("document");
    const first = replica(a!.collaborationState);
    const second = replica(b!.collaborationState);
    Y.applyUpdate(first, new Uint8Array(update(second)));
    expect(first.getText("content").toString()).toBe("Original context");
    first.destroy(); second.destroy();
  });

  test("merges concurrent editing and makes retries idempotent while invalidating review", async () => {
    const { t, owner } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Shared context", documentType: "document", content: "Initial" });
    await t.run((ctx) => ctx.db.patch(id, { status: "verified", requiresApproval: false }));
    const initial = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    const first = replica(initial!.collaborationState);
    const second = replica(initial!.collaborationState);
    first.getText("content").insert(0, "Left ");
    second.getText("content").insert(0, "Right ");
    await owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(first) });
    await owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(second) });
    const merged = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(merged?.content).toContain("Left ");
    expect(merged?.content).toContain("Right ");
    expect(merged?.content.endsWith("Initial")).toBe(true);
    expect(merged).toMatchObject({ status: "draft", requiresApproval: true });
    await owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(second) });
    const retried = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(retried?.content).toBe(merged?.content);
    expect(retried?.updatedAt).toBe(merged?.updatedAt);
    expect((await owner.query(api.knowledge.listDocumentVersions, { organizationId: "org-a", id })).some((version) => version.content === "Initial")).toBe(true);
    first.destroy(); second.destroy();
  });

  test("rejects oversized content and unsupported CRDT structures", async () => {
    const { owner } = await fixture();
    await expect(owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Oversized", documentType: "document", content: "x".repeat(DOCUMENT_LIMITS.content + 1) })).rejects.toThrow("characters or fewer");
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Safe structure", documentType: "document" });
    const malicious = new Y.Doc();
    malicious.getMap("other").set("secret", "not supported");
    await expect(owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(malicious) })).rejects.toThrow("Unsupported document structure");
    await expect(owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: new ArrayBuffer(DOCUMENT_LIMITS.updateBytes + 1) })).rejects.toThrow("too large");
    malicious.destroy();
  });

  test("connects typed relationships, backlinks, hierarchy, and the graph on the same records", async () => {
    const { owner, ids } = await fixture();
    const parent = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Policy", documentType: "policy" });
    const child = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Playbook", documentType: "playbook", parentId: parent });
    await owner.mutation(api.knowledge.saveDocumentMetadata, { organizationId: "org-a", id: child, expectedRevision: 0, title: "Playbook", category: "Operations", documentType: "playbook", parentId: parent, relations: [{ targetId: parent, kind: "depends_on" }], allowedAgentIds: [ids.agent], canUseToAnswer: true, canUseToAct: false });
    const connections = await owner.query(api.knowledge.findDocumentConnections, { organizationId: "org-a", id: parent });
    expect(connections.incoming).toContainEqual(expect.objectContaining({ id: child, kind: "depends_on" }));
    const graph = await owner.query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" });
    expect(graph.knowledge.find((item) => item.id === child)).toMatchObject({ documentType: "playbook", parentId: parent, relations: [{ targetId: parent, kind: "depends_on" }], allowedAgentIds: [ids.agent] });
    const listing = await owner.query(api.knowledge.listDocuments, { organizationId: "org-a" });
    expect(listing.documents.find((item) => item.id === child)?.parentId).toBe(parent);
  });

  test("rejects metadata conflicts, cross-workspace links, agent assignments, and hierarchy cycles", async () => {
    const { owner, ids } = await fixture();
    const parent = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Parent", documentType: "document" });
    const child = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Child", documentType: "document", parentId: parent });
    const properties = { organizationId: "org-a", id: parent, expectedRevision: 0, title: "Parent", category: "General", documentType: "document" as const, relations: [], allowedAgentIds: [], canUseToAnswer: false, canUseToAct: false };
    await expect(owner.mutation(api.knowledge.saveDocumentMetadata, { ...properties, parentId: child })).rejects.toThrow("children");
    await expect(owner.mutation(api.knowledge.saveDocumentMetadata, { ...properties, relations: [{ targetId: ids.foreign, kind: "references" }] })).rejects.toThrow("Document not found");
    await expect(owner.mutation(api.knowledge.saveDocumentMetadata, { ...properties, allowedAgentIds: [ids.foreignAgent] })).rejects.toThrow("does not belong");
    await owner.mutation(api.knowledge.saveDocumentMetadata, { ...properties, title: "Updated parent" });
    await expect(owner.mutation(api.knowledge.saveDocumentMetadata, properties)).rejects.toThrow("changed in another session");
  });

  test("filters foreign document references from graph and detail responses", async () => {
    const { t, owner, ids } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Historical inconsistency", documentType: "reference" });
    await t.run((ctx) => ctx.db.patch(id, { parentId: ids.foreign, relations: [{ targetId: ids.foreign, kind: "references" }], allowedAgentIds: [ids.foreignAgent] }));
    const document = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(document).toMatchObject({ relations: [], allowedAgentIds: [] });
    expect(document?.parentId).toBeUndefined();
    const graph = await owner.query(api.knowledge.getGraphSnapshot, { organizationId: "org-a" });
    const serialized = JSON.stringify(graph);
    expect(serialized).not.toContain(ids.foreign);
    expect(serialized).not.toContain(ids.foreignAgent);
    expect(graph.knowledge[0].relations).toEqual([]);
  });

  test("shares content updates with the existing governance editor without losing CRDT compatibility", async () => {
    const { owner } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Governed document", documentType: "document", content: "Initial" });
    await owner.mutation(api.knowledge.updateKnowledge, { organizationId: "org-a", workosUserId: "owner", id, title: "Governed document", content: "Updated from governance", category: "General", status: "draft", canUseToAnswer: false, canUseToAct: false, requiresApproval: true });
    const document = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    const editor = replica(document!.collaborationState);
    expect(editor.getText("content").toString()).toBe("Updated from governance");
    expect(document?.metadataRevision).toBe(1);
    editor.destroy();
  });

  test("restores a version as draft and rejects restoration after a concurrent change", async () => {
    const { owner } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Versioned context", documentType: "document", content: "Original" });
    const versions = await owner.query(api.knowledge.listDocumentVersions, { organizationId: "org-a", id });
    const original = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    const editor = replica(original!.collaborationState);
    editor.getText("content").insert(0, "Edited ");
    await owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(editor) });
    await expect(owner.mutation(api.knowledge.restoreDocumentVersion, { organizationId: "org-a", id, versionId: versions[0].id, expectedUpdatedAt: original!.updatedAt })).rejects.toThrow("document changed");
    const latest = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    await owner.mutation(api.knowledge.restoreDocumentVersion, { organizationId: "org-a", id, versionId: versions[0].id, expectedUpdatedAt: latest!.updatedAt });
    const restored = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    expect(restored).toMatchObject({ content: "Original", status: "draft", requiresApproval: true });
    Y.applyUpdate(editor, new Uint8Array(restored!.collaborationState));
    expect(editor.getText("content").toString()).toBe("Original");
    expect((await owner.query(api.knowledge.listDocumentVersions, { organizationId: "org-a", id })).some((version) => version.content === "Edited Original")).toBe(true);
    editor.destroy();
  });

  test("excludes draft and unapproved document context from agent answers", async () => {
    const { t, owner, ids } = await fixture();
    const id = await owner.mutation(api.knowledge.createDocument, { organizationId: "org-a", title: "Access policy", documentType: "policy", content: "Access requires an owner" });
    await t.run((ctx) => ctx.db.patch(id, { allowedAgentIds: [ids.agent], canUseToAnswer: true, status: "verified", requiresApproval: true }));
    const args = { organizationId: "org-a", agentId: ids.agent, question: "access policy" };
    expect(await owner.query(api.knowledge.searchKnowledgeForAgent, args)).toEqual([]);
    await owner.mutation(api.knowledge.approveKnowledge, { organizationId: "org-a", id, workosUserId: "owner" });
    expect((await owner.query(api.knowledge.searchKnowledgeForAgent, args)).map((item) => item._id)).toContain(id);
    const document = await owner.query(api.knowledge.getDocument, { organizationId: "org-a", id });
    const editor = replica(document!.collaborationState);
    editor.getText("content").insert(0, "Changed ");
    await owner.mutation(api.knowledge.syncDocument, { organizationId: "org-a", id, update: update(editor) });
    expect(await owner.query(api.knowledge.searchKnowledgeForAgent, args)).toEqual([]);
    editor.destroy();
  });
});
