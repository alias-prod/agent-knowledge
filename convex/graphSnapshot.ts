import { v } from "convex/values";
import { DOCUMENT_LIMITS, GRAPH_LIMITS, type GraphSnapshot } from "@agent-knowledge/shared";
import { documentTypeValidator } from "./documentModel";
import type { QueryCtx } from "./_generated/server";
import { getMembershipForWorkosUser } from "./permissions";

export const graphSnapshotArgs = { organizationId: v.string() };

export const graphSnapshotReturns = v.object({
  organizationId: v.string(),
  organizationName: v.string(),
  knowledge: v.array(v.object({
    id: v.string(),
    title: v.string(),
    summary: v.string(),
    category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")),
    canUseToAnswer: v.boolean(),
    canUseToAct: v.boolean(),
    requiresApproval: v.boolean(),
    allowedAgentIds: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
    documentType: documentTypeValidator,
    parentId: v.optional(v.string()),
    relations: v.array(v.object({
      targetId: v.string(),
      kind: v.union(v.literal("references"), v.literal("depends_on"), v.literal("supersedes")),
    })),
    updatedAt: v.number(),
  })),
  agents: v.array(v.object({
    id: v.string(),
    name: v.string(),
    description: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    role: v.optional(v.string()),
  })),
  retrievals: v.array(v.object({
    id: v.string(),
    question: v.string(),
    agentId: v.optional(v.string()),
    resultCount: v.number(),
    sourceTitles: v.array(v.string()),
    createdAt: v.number(),
  })),
  truncated: v.object({ knowledge: v.boolean(), agents: v.boolean(), retrievals: v.boolean() }),
});

export async function readGraphSnapshot(ctx: QueryCtx, args: { organizationId: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !args.organizationId || args.organizationId.length > 256) throw new Error("Unauthorized");

  const membership = await getMembershipForWorkosUser(ctx, identity.subject, args.organizationId);
  if (!membership) throw new Error("Unauthorized");

  const [knowledgeRows, agentRows, retrievalRows, settings] = await Promise.all([
    ctx.db.query("knowledge").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").take(GRAPH_LIMITS.knowledge + 1),
    ctx.db.query("agents").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").take(GRAPH_LIMITS.agents + 1),
    ctx.db.query("retrievalLogs").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").take(GRAPH_LIMITS.retrievals + 1),
    ctx.db.query("organizationSettings").withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId)).first(),
  ]);

  const agents = agentRows.slice(0, GRAPH_LIMITS.agents);
  const visibleAgentIds = new Set(agents.map((agent) => String(agent._id)));
  const knowledge = knowledgeRows.slice(0, GRAPH_LIMITS.knowledge);
  const visibleKnowledgeIds = new Set(knowledge.map((item) => String(item._id)));

  return {
    organizationId: args.organizationId,
    organizationName: settings?.displayName || "ALIAS UCE Workspace",
    knowledge: knowledge.map((item) => ({
      id: item._id,
      title: item.title,
      summary: item.content.slice(0, 600),
      category: item.category,
      status: item.status,
      canUseToAnswer: item.canUseToAnswer === true,
      canUseToAct: item.canUseToAct === true,
      requiresApproval: item.requiresApproval === true,
      allowedAgentIds: [...new Set(item.allowedAgentIds ?? [])].filter((id) => visibleAgentIds.has(id)),
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      documentType: item.documentType ?? "document",
      ...(item.parentId && item.parentId !== item._id && visibleKnowledgeIds.has(item.parentId) ? { parentId: item.parentId } : {}),
      relations: (item.relations ?? []).slice(0, DOCUMENT_LIMITS.relations)
        .filter((relation) => relation.targetId !== item._id && visibleKnowledgeIds.has(relation.targetId)),
      updatedAt: item.updatedAt,
    })),
    agents: agents.map((agent) => ({
      id: agent._id,
      name: agent.name,
      description: agent.description.slice(0, 600),
      status: agent.status,
      ...(agent.role ? { role: agent.role } : {}),
    })),
    retrievals: retrievalRows.slice(0, GRAPH_LIMITS.retrievals).map((event) => ({
      id: event._id,
      question: event.question.slice(0, 300),
      ...(visibleAgentIds.has(event.agentId) ? { agentId: event.agentId } : {}),
      resultCount: event.resultCount,
      sourceTitles: event.sourceTitles.slice(0, 20).map((title) => title.slice(0, 250)),
      createdAt: event.createdAt,
    })),
    truncated: {
      knowledge: knowledgeRows.length > GRAPH_LIMITS.knowledge,
      agents: agentRows.length > GRAPH_LIMITS.agents,
      retrievals: retrievalRows.length > GRAPH_LIMITS.retrievals,
    },
  } satisfies GraphSnapshot;
}
