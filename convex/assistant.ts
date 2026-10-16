import { v } from "convex/values";
import { ASSISTANT_LIMITS, NAV_COMMANDS, documentHref, parseAssistantCommand } from "@agent-knowledge/shared";
import type { AssistantDiscoveryItem, AssistantReadResult } from "@agent-knowledge/shared";
import { query } from "./_generated/server";
import { requireMembershipForIdentity } from "./permissions";

const discoveryItem = v.object({ kind: v.union(v.literal("document"), v.literal("agent")), id: v.string(), title: v.string(), href: v.string() });

export const validateSources = query({
  args: { organizationId: v.string(), agentId: v.id("agents"), sources: v.array(v.object({ id: v.id("knowledge"), updatedAt: v.number() })) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    if (args.sources.length > 20) throw new Error("Too many citation sources");
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.organizationId !== args.organizationId || agent.status !== "active") return false;
    for (const source of args.sources) {
      const item = await ctx.db.get(source.id);
      if (!item || item.organizationId !== args.organizationId || item.status !== "verified" || item.canUseToAnswer !== true || item.requiresApproval === true || item.updatedAt !== source.updatedAt || !item.allowedAgentIds?.includes(args.agentId)) return false;
    }
    return true;
  },
});

export const executeRead = query({
  args: { organizationId: v.string(), command: v.any() },
  returns: v.union(
    v.object({ kind: v.literal("navigation"), href: v.string(), title: v.string(), status: v.literal("pending-client") }),
    v.object({ kind: v.literal("discovery"), items: v.array(discoveryItem), hasMore: v.boolean(), scope: v.literal("metadata-only") }),
  ),
  handler: async (ctx, args): Promise<AssistantReadResult> => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const command = parseAssistantCommand(args.command);
    if (command.name === "navigate") {
      const destination = NAV_COMMANDS.find(({ href }) => href === command.args.route)!;
      return { kind: "navigation", href: destination.href, title: destination.label, status: "pending-client" };
    }
    if (command.name === "open.document") {
      const id = ctx.db.normalizeId("knowledge", command.args.id);
      const document = id ? await ctx.db.get(id) : null;
      if (!document || document.organizationId !== args.organizationId) throw new Error("Document is not available in this workspace");
      return { kind: "navigation", href: documentHref(document._id), title: document.title.slice(0, ASSISTANT_LIMITS.label), status: "pending-client" };
    }
    if (command.name === "graph.view") {
      const { lens, query, status, view, documentId, focus } = command.args;
      const params = new URLSearchParams({ lens, q: query, status, view });
      if (documentId) {
        if (lens !== "knowledge") throw new Error("Select the knowledge lens to focus a document");
        const id = ctx.db.normalizeId("knowledge", documentId);
        const target = id ? await ctx.db.get(id) : null;
        if (!target || target.organizationId !== args.organizationId) throw new Error("Document is not available in this workspace");
        params.set("node", `knowledge:${target._id}`);
        if (focus === "yes") params.set("focus", `knowledge:${target._id}`);
      }
      return { kind: "navigation", href: `/graph?${params}`, title: `${lens} graph`, status: "pending-client" };
    }
    const { query: text, entity } = command.args;
    const limit = ASSISTANT_LIMITS.results;
    const [documents, agents] = await Promise.all([
      entity === "agent" ? [] : ctx.db.query("knowledge").withSearchIndex("assistant_title", (q) =>
        q.search("title", text).eq("organizationId", args.organizationId)).take(limit + 1),
      entity === "document" ? [] : ctx.db.query("agents").withSearchIndex("assistant_name", (q) =>
        q.search("name", text).eq("organizationId", args.organizationId).eq("status", "active")).take(limit + 1),
    ]);
    const items: AssistantDiscoveryItem[] = [];
    // Interleave independently ranked collections so an ambiguous name can surface both entity types.
    for (let index = 0; index < Math.max(documents.length, agents.length); index++) {
      const document = documents[index];
      const agent = agents[index];
      if (document) items.push({ kind: "document", id: document._id, title: document.title.slice(0, ASSISTANT_LIMITS.label), href: documentHref(document._id) });
      if (agent) items.push({ kind: "agent", id: agent._id, title: agent.name.slice(0, ASSISTANT_LIMITS.label), href: `/agents/${encodeURIComponent(agent._id)}` });
    }
    return { kind: "discovery", items: items.slice(0, limit), hasMore: items.length > limit, scope: "metadata-only" };
  },
});
