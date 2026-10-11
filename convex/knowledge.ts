import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminForIdentity, requireMembershipForIdentity } from "./permissions";
import { replaceDocumentContent } from "./documentModel";
export { listDocuments, getDocument, createDocument, saveDocumentMetadata, syncDocument, listDocumentVersions, createDocumentCheckpoint, restoreDocumentVersion, findDocumentConnections } from "./documents";
import { writeAuditLog } from "./audit";
import { inOrg } from "./tenancy";
import { rankByRelevance } from "./retrieval";
import { graphSnapshotArgs, graphSnapshotReturns, readGraphSnapshot } from "./graphSnapshot";
import {
  LIMITS,
  normalizeSourceUrl,
  optionalText,
  requireText,
} from "./validation";

export const createKnowledge = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")),
    canUseToAnswer: v.boolean(),
    canUseToAct: v.boolean(),
    requiresApproval: v.boolean(),
    sourceUrl: v.optional(v.string()),
    lastReviewedAt: v.optional(v.number()),
    allowedAgentIds: v.optional(v.array(v.id("agents"))),
    actorEmail: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    organizationId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await requireAdminForIdentity(ctx, args.organizationId);

    const title = requireText(args.title, "Title", LIMITS.title);
    const content = requireText(args.content, "Content", LIMITS.content);
    const category = requireText(args.category, "Category", LIMITS.category);
    const sourceUrl = normalizeSourceUrl(args.sourceUrl);

    const knowledgeId = await ctx.db.insert("knowledge", {
      title,
      content,
      category,
      status: args.status,
      ownerId: "demo-user",
      canUseToAnswer: args.canUseToAnswer,
      canUseToAct: args.canUseToAct,
      requiresApproval: args.requiresApproval,
      sourceUrl,
      lastReviewedAt: args.lastReviewedAt,
      createdAt: now,
      updatedAt: now,
      allowedAgentIds: args.allowedAgentIds,
      ownerEmail: args.ownerEmail,
      organizationId: args.organizationId,
    });

    await writeAuditLog(ctx, {
      action: "created",
      knowledgeId,
      knowledgeTitle: title,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      createdAt: now,
      organizationId: args.organizationId,
    });

    await ctx.db.insert("knowledgeVersions", {
      knowledgeId,
      title,
      content,
      category,
      status: args.status,
      changedByEmail: args.actorEmail,
      organizationId: args.organizationId,
      createdAt: now,
    });

    return knowledgeId;
  },
});

export const getGraphSnapshot = query({
  args: graphSnapshotArgs,
  returns: graphSnapshotReturns,
  handler: readGraphSnapshot,
});

export const listKnowledge = query({
  args: {
    organizationId: v.string(),
    search: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("all"), v.literal("draft"), v.literal("verified"))
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const items = await ctx.db.query("knowledge")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc").collect();

    const search = args.search?.toLowerCase().trim() ?? "";
    const status = args.status ?? "all";
    const category = args.category ?? "all";

    const matchesOrg = inOrg(args.organizationId);

    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.content.toLowerCase().includes(search);

      const matchesStatus = status === "all" || item.status === status;

      const matchesCategory =
        category === "all" || item.category === category;

      return (
        matchesOrg(item) && matchesSearch && matchesStatus && matchesCategory
      );
    }).map(({ collaborationState, ...record }) => {
      void collaborationState;
      return record;
    });
  },
});

export const deleteKnowledge = mutation({
  args: {
    id: v.id("knowledge"),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Knowledge item not found");
    }

    const organizationId = item.organizationId ?? args.organizationId;

    await requireAdminForIdentity(ctx, organizationId);

    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      action: "deleted",
      knowledgeId: undefined,
      knowledgeTitle: item.title ?? "Unknown knowledge item",
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId,
    });
  },
});

export const updateKnowledge = mutation({
  args: {
    id: v.id("knowledge"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")),
    canUseToAnswer: v.boolean(),
    canUseToAct: v.boolean(),
    requiresApproval: v.boolean(),
    sourceUrl: v.optional(v.string()),
    lastReviewedAt: v.optional(v.number()),
    allowedAgentIds: v.optional(v.array(v.id("agents"))),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
    organizationId: v.string(),
    ownerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const title = requireText(args.title, "Title", LIMITS.title);
    const content = requireText(args.content, "Content", LIMITS.content);
    const category = requireText(args.category, "Category", LIMITS.category);
    const sourceUrl = normalizeSourceUrl(args.sourceUrl);
    const now = Date.now();
    const item = await ctx.db.get(args.id);
    if (!item || item.organizationId !== args.organizationId) throw new Error("Knowledge item not found");
    for (const agentId of args.allowedAgentIds ?? []) {
      const agent = await ctx.db.get(agentId);
      if (!agent || agent.organizationId !== args.organizationId) throw new Error("Agent does not belong to this organization");
    }

    await ctx.db.patch(args.id, {
      title,
      content,
      collaborationState: replaceDocumentContent(item, content),
      metadataRevision: (item.metadataRevision ?? 0) + 1,
      category,
      status: args.status,
      canUseToAnswer: args.canUseToAnswer,
      canUseToAct: args.canUseToAct,
      requiresApproval: args.requiresApproval,
      sourceUrl,
      lastReviewedAt: args.lastReviewedAt,
      updatedAt: now,
      allowedAgentIds: args.allowedAgentIds,
      ownerEmail: args.ownerEmail,
    });

    await writeAuditLog(ctx, {
      action: "updated",
      knowledgeId: args.id,
      knowledgeTitle: title,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });

    await ctx.db.insert("knowledgeVersions", {
      knowledgeId: args.id,
      title,
      content,
      category,
      status: args.status,
      changedByEmail: args.actorEmail,
      organizationId: args.organizationId,
      createdAt: now,
    });
  },
});

export const getKnowledge = query({
  args: {
    id: v.id("knowledge"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item?.organizationId) return null;
    await requireMembershipForIdentity(ctx, item.organizationId);
    const { collaborationState, ...record } = item;
    void collaborationState;
    return record;
  },
});

export const listAuditLogsForKnowledge = query({
  args: {
    knowledgeId: v.id("knowledge"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const logs = await ctx.db.query("auditLogs").order("desc").collect();
    const matchesOrg = (log: { organizationId?: string }) => log.organizationId === args.organizationId;

    return logs
      .filter((log) => log.knowledgeId === args.knowledgeId && matchesOrg(log))
      .slice(0, 10);
  },
});

export const listKnowledgeForAgent = query({
  args: {
    agentId: v.id("agents"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const items = await ctx.db.query("knowledge")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc").collect();
    const matchesOrg = inOrg(args.organizationId);

    return items.filter(
      (item) => item.allowedAgentIds?.includes(args.agentId) && matchesOrg(item)
    ).map(({ collaborationState, ...record }) => {
      void collaborationState;
      return record;
    });
  },
});

export const listApprovalQueue = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const items = await ctx.db.query("knowledge")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc").collect();
    const matchesOrg = inOrg(args.organizationId);

    return items.filter(
      (item) => item.requiresApproval === true && matchesOrg(item)
    ).map(({ collaborationState, ...record }) => {
      void collaborationState;
      return record;
    });
  },
});

export const rejectKnowledge = mutation({
  args: {
    id: v.id("knowledge"),
    organizationId: v.string(),
    workosUserId: v.string(),
    actorEmail: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Knowledge item not found");
    }

    if (
      item.organizationId !== args.organizationId &&
      item.organizationId !== undefined
    ) {
      throw new Error("Knowledge item does not belong to this organization");
    }

    const reviewNote = optionalText(args.reviewNote, "Review note", LIMITS.note);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "draft",
      requiresApproval: true,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      action: "knowledge.rejected",
      knowledgeId: args.id,
      knowledgeTitle: item.title,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      metadata: {
        note: reviewNote ?? "",
      },
      createdAt: now,
    });
  },
});

export const approveKnowledge = mutation({
  args: {
    id: v.id("knowledge"),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);
    const item = await ctx.db.get(args.id);
    if (!item || item.organizationId !== args.organizationId) throw new Error("Knowledge item not found");
    const now = Math.max(Date.now(), item.updatedAt + 1);

    await ctx.db.patch(args.id, {
      requiresApproval: false,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      action: "updated",
      knowledgeId: args.id,
      knowledgeTitle: item?.title ?? "Unknown knowledge item",
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });
  },
});

export const searchKnowledgeForAgent = query({
  args: {
    agentId: v.id("agents"),
    organizationId: v.string(),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.organizationId !== args.organizationId || agent.status !== "active") throw new Error("Agent is not available in this workspace");
    const question = optionalText(args.question, "Question", LIMITS.question);

    if (!question) {
      return [];
    }

    const knowledgeItems = await ctx.db.query("knowledge")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).collect();
    const matchesOrg = inOrg(args.organizationId);

    const allowedItems = knowledgeItems.filter(
      (item) =>
        matchesOrg(item) &&
        item.status === "verified" &&
        item.canUseToAnswer === true &&
        item.requiresApproval !== true &&
        (item.allowedAgentIds ?? []).some(
          (agentId) => agentId.toString() === args.agentId.toString()
        )
    );

    return rankByRelevance(allowedItems.map(({ collaborationState, ...record }) => {
      void collaborationState;
      return record;
    }), question);
  },
});

export const listRetrievalLogs = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("retrievalLogs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .take(50);
  },
});

export const logRetrievalSearch = mutation({
  args: {
    organizationId: v.string(),
    agentId: v.id("agents"),
    agentName: v.optional(v.string()),
    question: v.string(),
    resultCount: v.number(),
    sourceTitles: v.array(v.string()),
    actorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const question = optionalText(args.question, "Question", LIMITS.question);

    if (!question) {
      return null;
    }

    return await ctx.db.insert("retrievalLogs", {
      organizationId: args.organizationId,
      agentId: args.agentId,
      agentName: args.agentName,
      question,
      resultCount: args.resultCount,
      sourceTitles: args.sourceTitles,
      actorEmail: args.actorEmail,
      createdAt: Date.now(),
    });
  },
});

export const listVersionsForKnowledge = query({
  args: {
    knowledgeId: v.id("knowledge"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const item = await ctx.db.get(args.knowledgeId);
    if (!item || item.organizationId !== args.organizationId) return [];
    const versions = await ctx.db
      .query("knowledgeVersions")
      .withIndex("by_knowledge", (q) => q.eq("knowledgeId", args.knowledgeId))
      .order("desc")
      .take(20);

    const matchesOrg = (version: { organizationId?: string }) => version.organizationId === args.organizationId;

    return versions
      .filter(
        (version) =>
          version.knowledgeId === args.knowledgeId && matchesOrg(version)
      )
      .slice(0, 20);
  },
});

export const restoreKnowledgeVersion = mutation({
  args: {
    versionId: v.id("knowledgeVersions"),
    actorEmail: v.optional(v.string()),
    organizationId: v.string(),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);

    if (!version) {
      throw new Error("Version not found");
    }

    const organizationId = version.organizationId ?? args.organizationId;

    await requireAdminForIdentity(ctx, organizationId);

    const knowledge = await ctx.db.get(version.knowledgeId);

    if (!knowledge || knowledge.organizationId !== args.organizationId || version.organizationId !== args.organizationId) {
      throw new Error("Knowledge item not found");
    }

    const now = Date.now();

    await ctx.db.patch(version.knowledgeId, {
      title: version.title,
      content: version.content,
      category: version.category,
      status: "draft",
      requiresApproval: true,
      collaborationState: replaceDocumentContent(knowledge, version.content),
      metadataRevision: (knowledge.metadataRevision ?? 0) + 1,
      updatedAt: now,
    });

    await ctx.db.insert("knowledgeVersions", {
      knowledgeId: version.knowledgeId,
      title: version.title,
      content: version.content,
      category: version.category,
      status: version.status,
      changedByEmail: args.actorEmail,
      organizationId,
      createdAt: now,
    });

    await writeAuditLog(ctx, {
      action: "updated",
      knowledgeId: version.knowledgeId,
      knowledgeTitle: version.title,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId,
      createdAt: now,
    });
  },
});

export const listKnowledgeDueForReview = query({
  args: {
    organizationId: v.string(),
    reviewAfterDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviewAfterDays = args.reviewAfterDays ?? 90;
    const threshold = Date.now() - reviewAfterDays * 24 * 60 * 60 * 1000;

    const items = await ctx.db.query("knowledge").collect();
    const matchesOrg = inOrg(args.organizationId);

    return items
      .filter((item) => {
        const lastReviewed =
          item.lastReviewedAt ?? item.createdAt ?? item._creationTime;

        return matchesOrg(item) && lastReviewed <= threshold;
      })
      .sort((a, b) => {
        const aReviewed = a.lastReviewedAt ?? a.createdAt ?? a._creationTime;
        const bReviewed = b.lastReviewedAt ?? b.createdAt ?? b._creationTime;

        return aReviewed - bReviewed;
      });
  },
});

export const markKnowledgeReviewed = mutation({
  args: {
    id: v.id("knowledge"),
    organizationId: v.string(),
    workosUserId: v.string(),
    actorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const item = await ctx.db.get(args.id);

    if (!item) {
      throw new Error("Knowledge item not found");
    }

    if (
      item.organizationId !== args.organizationId &&
      item.organizationId !== undefined
    ) {
      throw new Error("Knowledge item does not belong to this organization");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      lastReviewedAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      action: "knowledge.reviewed",
      knowledgeId: args.id,
      knowledgeTitle: item.title,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });
  },
});

