import { v } from "convex/values";
import { ASSISTANT_LIMITS, NAV_COMMANDS, documentHref, parseAssistantCommand } from "@agent-knowledge/shared";
import type { AssistantDiscoveryItem, AssistantReadResult } from "@agent-knowledge/shared";
import { query } from "./_generated/server";
import { requireMembershipForIdentity } from "./permissions";

const discoveryItem = v.object({ kind: v.union(v.literal("document"), v.literal("agent")), id: v.string(), title: v.string(), href: v.string() });

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
