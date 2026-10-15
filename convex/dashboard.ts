import { query } from "./_generated/server";
import { v } from "convex/values";
import { inOrg } from "./tenancy";
import { requireMembershipForIdentity } from "./permissions";
import { authComponent, createAuth } from "./auth";

export const getDashboardMetrics = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { authOrganizationId } = await requireMembershipForIdentity(ctx, args.organizationId);
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    const members = await auth.api.listMembers({ query: { organizationId: authOrganizationId }, headers });
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const knowledgeItems = await ctx.db.query("knowledge").collect();
    const agents = await ctx.db.query("agents").collect();

    const auditLogs = await ctx.db.query("auditLogs").collect();
    const retrievalLogs = await ctx.db.query("retrievalLogs").collect();

    const matchesOrg = inOrg(args.organizationId);

    const orgKnowledge = knowledgeItems.filter(matchesOrg);
    const orgAgents = agents.filter(matchesOrg);
    const orgMemberships = members.members;
    const orgAuditLogs = auditLogs.filter(matchesOrg);
    const orgRetrievalLogs = retrievalLogs.filter(matchesOrg);

    const recentRetrievalLogs = orgRetrievalLogs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    const recentAuditLogs = orgAuditLogs
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    const retrievalsByDay = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const count = orgRetrievalLogs.filter(
        (log) => log.createdAt >= start.getTime() && log.createdAt <= end.getTime()
      ).length;

      return {
        label: date.toLocaleDateString("en-US", {
          weekday: "short",
        }),
        count,
      };
    });

    const questionCounts = new Map<string, number>();

    for (const log of orgRetrievalLogs) {
      const question = log.question.trim();

      if (!question) continue;

      questionCounts.set(question, (questionCounts.get(question) ?? 0) + 1);
    }

    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sourceCounts = new Map<string, number>();

    for (const log of orgRetrievalLogs) {
      for (const title of new Set(log.sourceTitles)) {
        sourceCounts.set(title, (sourceCounts.get(title) ?? 0) + 1);
      }
    }

    const topSources = Array.from(sourceCounts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const pendingApprovals = orgKnowledge.filter(
      (item) => item.requiresApproval === true || item.status === "draft"
    ).length;

    const reviewThreshold = now - 90 * 24 * 60 * 60 * 1000;

    const reviewDueCount = orgKnowledge.filter((item) => {
      const lastReviewed = item.lastReviewedAt ?? item.createdAt ?? item._creationTime;
      return lastReviewed <= reviewThreshold;
    }).length;

    const knowledgeHealthScore =
      orgKnowledge.length === 0
        ? 0
        : Math.round(
          ((orgKnowledge.filter((item) => item.status === "verified").length /
            orgKnowledge.length) *
            0.5 +
            (orgKnowledge.filter((item) => item.canUseToAnswer === true).length /
              orgKnowledge.length) *
            0.3 +
            ((orgKnowledge.length - reviewDueCount) / orgKnowledge.length) * 0.2) *
          100
        );

    return {
      totalKnowledge: orgKnowledge.length,
      verifiedKnowledge: orgKnowledge.filter(
        (item) => item.status === "verified"
      ).length,
      draftKnowledge: orgKnowledge.filter((item) => item.status === "draft")
        .length,
      answerableKnowledge: orgKnowledge.filter(
        (item) => item.canUseToAnswer === true
      ).length,

      totalAgents: orgAgents.length,
      activeAgents: orgAgents.filter((agent) => agent.status === "active")
        .length,

      totalMembers: orgMemberships.length,

      totalRetrievals: orgRetrievalLogs.length,
      retrievalsLast7Days: orgRetrievalLogs.filter(
        (log) => log.createdAt >= sevenDaysAgo
      ).length,

      totalAuditEvents: orgAuditLogs.length,

      recentRetrievalLogs,
      recentAuditLogs,
      knowledgeHealthScore,
      pendingApprovals,
      reviewDueCount,
      retrievalsByDay,
      topQuestions,
      topSources,
    };
  },
});
