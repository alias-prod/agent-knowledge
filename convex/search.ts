import { query } from "./_generated/server";
import { v } from "convex/values";
import { inOrg } from "./tenancy";
import { requireMembershipForIdentity } from "./permissions";

function includesSearch(value: string | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search);
}

export const globalSearch = query({
  args: {
    organizationId: v.string(),
    search: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const search = args.search.trim().toLowerCase();

    if (search.length < 2) {
      return [];
    }

    const knowledgeItems = await ctx.db.query("knowledge").collect();
    const agents = await ctx.db.query("agents").collect();
    const retrievalLogs = await ctx.db.query("retrievalLogs").collect();
    const auditLogs = await ctx.db.query("auditLogs").collect();

    const matchesOrg = inOrg(args.organizationId);

    const knowledgeResults = knowledgeItems
      .filter((item) => {
        return (
          matchesOrg(item) &&
          (includesSearch(item.title, search) ||
            includesSearch(item.category, search) ||
            includesSearch(item.content, search))
        );
      })
      .slice(0, 8)
      .map((item) => ({
        type: "Knowledge",
        title: item.title,
        description: item.content.slice(0, 160),
        meta: `${item.category} · ${item.status}`,
        href: `/knowledge/${item._id}`,
        createdAt: item.createdAt ?? item._creationTime,
      }));

    const agentResults = agents
      .filter((agent) => {
        return (
          matchesOrg(agent) &&
          (includesSearch(agent.name, search) ||
            includesSearch(agent.role, search) ||
            includesSearch(agent.description, search))
        );
      })
      .slice(0, 8)
      .map((agent) => ({
        type: "Agent",
        title: agent.name,
        description: agent.description,
        meta: `${agent.role} · ${agent.status}`,
        href: `/agents/${agent._id}`,
        createdAt: agent.createdAt ?? agent._creationTime,
      }));

    const retrievalResults = retrievalLogs
      .filter((log) => {
        const sourceText = log.sourceTitles.join(" ");

        return (
          matchesOrg(log) &&
          (includesSearch(log.question, search) ||
            includesSearch(log.agentName, search) ||
            includesSearch(log.actorEmail, search) ||
            includesSearch(sourceText, search))
        );
      })
      .slice(0, 8)
      .map((log) => ({
        type: "Retrieval",
        title: log.question,
        description: `Asked by ${log.actorEmail ?? "Unknown user"}`,
        meta: `${log.agentName ?? "Unknown agent"} · ${log.resultCount} result${
          log.resultCount === 1 ? "" : "s"
        }`,
        href: "/retrieval-history",
        createdAt: log.createdAt,
      }));

    const auditResults = auditLogs
      .filter((log) => {
        const title =
          log.knowledgeTitle ?? log.agentName ?? log.metadata?.title ?? "";

        return (
          matchesOrg(log) &&
          (includesSearch(title, search) ||
            includesSearch(log.action, search) ||
            includesSearch(log.actorEmail, search))
        );
      })
      .slice(0, 8)
      .map((log) => ({
        type: "Audit",
        title:
          log.knowledgeTitle ??
          log.agentName ??
          log.metadata?.title ??
          "Workspace event",
        description: log.action,
        meta: log.actorEmail ?? log.actorId ?? "Unknown user",
        href: "/audit",
        createdAt: log.createdAt,
      }));

    return [
      ...knowledgeResults,
      ...agentResults,
      ...retrievalResults,
      ...auditResults,
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  },
});
