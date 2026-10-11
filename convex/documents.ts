import * as Y from "yjs";
import { v } from "convex/values";
import { DOCUMENT_LIMITS } from "@agent-knowledge/shared";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireMembershipForIdentity } from "./permissions";
import { writeAuditLog } from "./audit";
import { LIMITS, normalizeSourceUrl, requireText } from "./validation";
import { bytesBuffer, checkpointDocument, documentState, documentTypeValidator, loadCollaborativeDocument, relationValidator, replaceDocumentContent } from "./documentModel";

const scopeArgs = { organizationId: v.string() };
const recordArgs = { ...scopeArgs, id: v.id("knowledge") };
const summaryValidator = v.object({
  id: v.id("knowledge"), title: v.string(), category: v.string(), status: v.union(v.literal("draft"), v.literal("verified")),
  documentType: documentTypeValidator, parentId: v.optional(v.id("knowledge")), updatedAt: v.number(),
  excerpt: v.string(), relationCount: v.number(),
});

function summarize(item: Doc<"knowledge">) {
  return { id: item._id, title: item.title, category: item.category, status: item.status,
    documentType: item.documentType ?? "document" as const, parentId: item.parentId,
    updatedAt: item.updatedAt, excerpt: item.content.slice(0, 160), relationCount: item.relations?.length ?? 0 };
}

async function recordAccess(ctx: QueryCtx | MutationCtx, organizationId: string, id: Id<"knowledge">, write = false) {
  const actor = await requireMembershipForIdentity(ctx, organizationId);
  if (write && !["owner", "admin"].includes(actor.membership.role)) throw new Error("Unauthorized");
  const item = await ctx.db.get(id);
  if (!item || item.organizationId !== organizationId) throw new Error("Document not found");
  return { item, ...actor };
}

async function actorEmail(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return (await ctx.db.get(userId))?.email;
}

export const listDocuments = query({
  args: scopeArgs,
  returns: v.object({ documents: v.array(summaryValidator), truncated: v.boolean(), canEdit: v.boolean(), organizationName: v.string(), agents: v.array(v.object({ id: v.id("agents"), name: v.string() })) }),
  handler: async (ctx, args) => {
    const { membership } = await requireMembershipForIdentity(ctx, args.organizationId);
    const [rows, agents, settings] = await Promise.all([
      ctx.db.query("knowledge").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").take(DOCUMENT_LIMITS.list + 1),
      ctx.db.query("agents").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).take(100),
      ctx.db.query("organizationSettings").withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId)).first(),
    ]);
    const visible = rows.slice(0, DOCUMENT_LIMITS.list);
    const ids = new Set(visible.map((item) => item._id));
    return {
      documents: visible.map((item) => ({ ...summarize(item), parentId: item.parentId && ids.has(item.parentId) ? item.parentId : undefined })),
      truncated: rows.length > DOCUMENT_LIMITS.list, canEdit: ["owner", "admin"].includes(membership.role),
      organizationName: settings?.displayName || "ALIAS UCE Workspace", agents: agents.map((agent) => ({ id: agent._id, name: agent.name })),
    };
  },
});

export const getDocument = query({
  args: { ...scopeArgs, id: v.string() },
  returns: v.union(v.null(), v.object({
    id: v.id("knowledge"), title: v.string(), content: v.string(), category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")), documentType: documentTypeValidator,
    parentId: v.optional(v.id("knowledge")), relations: v.array(relationValidator),
    collaborationState: v.bytes(), metadataRevision: v.number(), updatedAt: v.number(),
    sourceUrl: v.optional(v.string()), canUseToAnswer: v.boolean(), canUseToAct: v.boolean(), requiresApproval: v.boolean(),
    allowedAgentIds: v.array(v.id("agents")), canEdit: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const { membership } = await requireMembershipForIdentity(ctx, args.organizationId);
    const id = ctx.db.normalizeId("knowledge", args.id);
    const item = id ? await ctx.db.get(id) : null;
    if (!item || item.organizationId !== args.organizationId) return null;
    const relations = (await Promise.all((item.relations ?? []).slice(0, DOCUMENT_LIMITS.relations).map(async (relation) => {
      const target = await ctx.db.get(relation.targetId);
      return target?.organizationId === args.organizationId ? relation : null;
    }))).filter((relation): relation is NonNullable<typeof relation> => relation !== null);
    const agents = (await Promise.all((item.allowedAgentIds ?? []).slice(0, 100).map(async (agentId) => {
      const agent = await ctx.db.get(agentId);
      return agent?.organizationId === args.organizationId ? agentId : null;
    }))).filter((agentId): agentId is Id<"agents"> => agentId !== null);
    const parent = item.parentId ? await ctx.db.get(item.parentId) : null;
    return { id: item._id, title: item.title, content: item.content, category: item.category, status: item.status,
      documentType: item.documentType ?? "document", parentId: parent?.organizationId === args.organizationId ? parent._id : undefined,
      relations, collaborationState: documentState(item), metadataRevision: item.metadataRevision ?? 0, updatedAt: item.updatedAt,
      sourceUrl: item.sourceUrl, canUseToAnswer: item.canUseToAnswer === true, canUseToAct: item.canUseToAct === true,
      requiresApproval: item.requiresApproval === true, allowedAgentIds: agents, canEdit: ["owner", "admin"].includes(membership.role) };
  },
});

export const createDocument = mutation({
  args: { ...scopeArgs, title: v.string(), documentType: documentTypeValidator, content: v.optional(v.string()), parentId: v.optional(v.id("knowledge")) },
  returns: v.id("knowledge"),
  handler: async (ctx, args) => {
    const { identity, membership } = await requireMembershipForIdentity(ctx, args.organizationId);
    if (!["owner", "admin"].includes(membership.role)) throw new Error("Unauthorized");
    const title = requireText(args.title, "Title", LIMITS.title);
    const content = args.content ?? "";
    if (content.length > DOCUMENT_LIMITS.content) throw new Error(`Content must be ${DOCUMENT_LIMITS.content} characters or fewer`);
    if (args.parentId) {
      const { item: parent } = await recordAccess(ctx, args.organizationId, args.parentId);
      await validateParent(ctx, args.organizationId, parent._id);
    }
    const email = await actorEmail(ctx, membership.userId);
    const settings = await ctx.db.query("organizationSettings").withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId)).first();
    const now = Date.now();
    const id = await ctx.db.insert("knowledge", {
      title, content, documentType: args.documentType, parentId: args.parentId, category: settings?.defaultKnowledgeCategory || "General",
      organizationId: args.organizationId, status: "draft", requiresApproval: true, canUseToAnswer: false, canUseToAct: false,
      allowedAgentIds: [], relations: [], ownerId: identity.subject, ownerEmail: email, createdAt: now, updatedAt: now,
      collaborationState: documentState({ content }), metadataRevision: 0,
    });
    await checkpointDocument(ctx, (await ctx.db.get(id))!, email, true);
    await writeAuditLog(ctx, { action: "created", knowledgeId: id, knowledgeTitle: title, organizationId: args.organizationId, actorEmail: email, metadata: { surface: "documents" } });
    return id;
  },
});

async function validateParent(ctx: MutationCtx, organizationId: string, parentId?: Id<"knowledge">, childId?: Id<"knowledge">) {
  let next = parentId;
  const visited = new Set<string>(childId ? [childId] : []);
  for (let depth = 0; next; depth++) {
    if (visited.has(next)) throw new Error("A document cannot be nested inside itself or one of its children");
    if (depth >= DOCUMENT_LIMITS.depth - 1) throw new Error(`Documents support up to ${DOCUMENT_LIMITS.depth} nesting levels`);
    visited.add(next);
    const parent = await ctx.db.get(next);
    if (!parent || parent.organizationId !== organizationId) throw new Error("Parent document not found");
    next = parent.parentId;
  }
}

export const saveDocumentMetadata = mutation({
  args: { ...recordArgs, expectedRevision: v.number(), title: v.string(), category: v.string(), documentType: documentTypeValidator,
    parentId: v.optional(v.id("knowledge")), sourceUrl: v.optional(v.string()), relations: v.array(relationValidator),
    allowedAgentIds: v.array(v.id("agents")), canUseToAnswer: v.boolean(), canUseToAct: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { item, membership } = await recordAccess(ctx, args.organizationId, args.id, true);
    if ((item.metadataRevision ?? 0) !== args.expectedRevision) throw new Error("Document properties changed in another session. Reload the properties before saving.");
    const title = requireText(args.title, "Title", LIMITS.title);
    const category = requireText(args.category, "Category", LIMITS.category);
    const sourceUrl = normalizeSourceUrl(args.sourceUrl);
    await validateParent(ctx, args.organizationId, args.parentId, args.id);
    if (args.relations.length > DOCUMENT_LIMITS.relations) throw new Error(`Choose up to ${DOCUMENT_LIMITS.relations} relationships`);
    if (args.allowedAgentIds.length > 100) throw new Error("Choose up to 100 agents");
    const seen = new Set<string>();
    for (const relation of args.relations) {
      if (relation.targetId === args.id) throw new Error("A document cannot link to itself");
      const key = `${relation.kind}:${relation.targetId}`;
      if (seen.has(key)) throw new Error("This relationship is already linked");
      seen.add(key);
      await recordAccess(ctx, args.organizationId, relation.targetId);
    }
    for (const id of args.allowedAgentIds) {
      const agent = await ctx.db.get(id);
      if (!agent || agent.organizationId !== args.organizationId) throw new Error("Agent does not belong to this workspace");
    }
    const email = await actorEmail(ctx, membership.userId);
    await checkpointDocument(ctx, item, email, true);
    const invalidatesReview = title !== item.title || category !== item.category || sourceUrl !== item.sourceUrl ||
      args.documentType !== (item.documentType ?? "document") || JSON.stringify(args.relations) !== JSON.stringify(item.relations ?? []) ||
      args.canUseToAnswer !== (item.canUseToAnswer === true) || args.canUseToAct !== (item.canUseToAct === true) ||
      JSON.stringify(args.allowedAgentIds) !== JSON.stringify(item.allowedAgentIds ?? []);
    await ctx.db.patch(item._id, { title, category, documentType: args.documentType, parentId: args.parentId, sourceUrl,
      relations: args.relations, allowedAgentIds: [...new Set(args.allowedAgentIds)], canUseToAnswer: args.canUseToAnswer,
      canUseToAct: args.canUseToAct, metadataRevision: (item.metadataRevision ?? 0) + 1, updatedAt: Math.max(Date.now(), item.updatedAt + 1),
      ...(invalidatesReview ? { status: "draft" as const, requiresApproval: true } : {}),
    });
    await writeAuditLog(ctx, { action: "updated", knowledgeId: item._id, knowledgeTitle: title, organizationId: args.organizationId, actorEmail: email, metadata: { surface: "documents", change: "properties" } });
    return null;
  },
});

export const syncDocument = mutation({
  args: { ...recordArgs, update: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { item, membership } = await recordAccess(ctx, args.organizationId, args.id, true);
    if (args.update.byteLength > DOCUMENT_LIMITS.updateBytes) throw new Error("This edit is too large. Export a copy before reloading.");
    const doc = loadCollaborativeDocument(item);
    try {
      try { Y.applyUpdate(doc, new Uint8Array(args.update)); } catch { throw new Error("Invalid collaborative document update"); }
      if ([...doc.share.keys()].some((key) => key !== "content")) throw new Error("Unsupported document structure");
      const text = doc.getText("content");
      if (text.toDelta().some((part: { insert?: unknown }) => typeof part.insert !== "string")) throw new Error("Documents support text only");
      const content = text.toString();
      if (content.length > DOCUMENT_LIMITS.content) throw new Error(`Content must be ${DOCUMENT_LIMITS.content} characters or fewer`);
      const state = bytesBuffer(Y.encodeStateAsUpdate(doc));
      if (state.byteLength > DOCUMENT_LIMITS.stateBytes) throw new Error("Document editing history is full. Export this document and create a new one.");
      if (content === item.content) {
        await ctx.db.patch(item._id, { collaborationState: state });
        return null;
      }
      const email = await actorEmail(ctx, membership.userId);
      await checkpointDocument(ctx, item, email, item.status === "verified");
      await ctx.db.patch(item._id, { content, collaborationState: state, status: "draft", requiresApproval: true, updatedAt: Math.max(Date.now(), item.updatedAt + 1) });
      await writeAuditLog(ctx, { action: "updated", knowledgeId: item._id, knowledgeTitle: item.title, organizationId: args.organizationId, actorEmail: email, metadata: { surface: "documents", change: "content" } });
      return null;
    } finally { doc.destroy(); }
  },
});

export const listDocumentVersions = query({
  args: recordArgs,
  returns: v.array(v.object({ id: v.id("knowledgeVersions"), title: v.string(), content: v.string(), createdAt: v.number(), changedByEmail: v.optional(v.string()) })),
  handler: async (ctx, args) => {
    await recordAccess(ctx, args.organizationId, args.id);
    const rows = await ctx.db.query("knowledgeVersions").withIndex("by_knowledge", (q) => q.eq("knowledgeId", args.id)).order("desc").take(DOCUMENT_LIMITS.history);
    return rows.filter((row) => row.organizationId === args.organizationId).map((row) => ({ id: row._id, title: row.title, content: row.content, createdAt: row.createdAt, changedByEmail: row.changedByEmail }));
  },
});

export const createDocumentCheckpoint = mutation({
  args: recordArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { item, membership } = await recordAccess(ctx, args.organizationId, args.id, true);
    await checkpointDocument(ctx, item, await actorEmail(ctx, membership.userId), true);
    return null;
  },
});

export const restoreDocumentVersion = mutation({
  args: { ...recordArgs, versionId: v.id("knowledgeVersions"), expectedUpdatedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { item, membership } = await recordAccess(ctx, args.organizationId, args.id, true);
    if (item.updatedAt !== args.expectedUpdatedAt) throw new Error("The document changed. Review the latest version before restoring.");
    const version = await ctx.db.get(args.versionId);
    if (!version || version.knowledgeId !== item._id || version.organizationId !== args.organizationId) throw new Error("Version not found");
    const email = await actorEmail(ctx, membership.userId);
    await checkpointDocument(ctx, item, email, true);
    await ctx.db.patch(item._id, { content: version.content, title: version.title, category: version.category,
      collaborationState: replaceDocumentContent(item, version.content), status: "draft", requiresApproval: true,
      updatedAt: Math.max(Date.now(), item.updatedAt + 1), metadataRevision: (item.metadataRevision ?? 0) + 1 });
    await writeAuditLog(ctx, { action: "updated", knowledgeId: item._id, knowledgeTitle: version.title, organizationId: args.organizationId, actorEmail: email, metadata: { surface: "documents", restoredVersion: version._id } });
    return null;
  },
});

export const findDocumentConnections = query({
  args: recordArgs,
  returns: v.object({ outgoing: v.array(v.object({ ...summaryValidator.fields, kind: v.string() })), incoming: v.array(v.object({ ...summaryValidator.fields, kind: v.string() })), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    const { item } = await recordAccess(ctx, args.organizationId, args.id);
    const targets = await Promise.all((item.relations ?? []).slice(0, DOCUMENT_LIMITS.relations).map(async (relation) => {
      const target = await ctx.db.get(relation.targetId);
      return target?.organizationId === args.organizationId ? { ...summarize(target), kind: relation.kind } : null;
    }));
    const rows = await ctx.db.query("knowledge").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").take(DOCUMENT_LIMITS.list + 1);
    const incoming = rows.slice(0, DOCUMENT_LIMITS.list).flatMap((row) => (row.relations ?? []).filter((relation) => relation.targetId === args.id).map((relation) => ({ ...summarize(row), kind: relation.kind })));
    return { outgoing: targets.filter((target): target is NonNullable<typeof target> => target !== null), incoming, truncated: rows.length > DOCUMENT_LIMITS.list };
  },
});
