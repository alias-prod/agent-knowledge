import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { components } from "./_generated/api";

export const reviewPage = internalQuery({
  args: { runId: v.string(), cursor: v.union(v.string(), v.null()), limit: v.number() },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50) throw new Error("Review pages must contain 1–50 memberships");
    const run = await ctx.db.query("authMigrationRuns").withIndex("by_run", q => q.eq("runId", args.runId)).unique();
    if (!run || !run.backupReference || run.status !== "complete") throw new Error("A completed reviewed migration with a backup is required");
    const page = await ctx.db.query("memberships").withIndex("by_organization", q => q.eq("organizationId", run.organizationId)).paginate({ cursor: args.cursor, numItems: args.limit });
    const conflicts: { userId: string; reason: string }[] = [];
    for (const member of page.page) {
      const profile = await ctx.db.get(member.userId);
      if (!profile?.betterAuthUserId) { conflicts.push({ userId: member.userId, reason: "identity_mapping_missing" }); continue; }
      const current = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "member", where: [{ field: "userId", value: profile.betterAuthUserId }, { field: "organizationId", value: run.betterAuthOrganizationId }] });
      if (!current) conflicts.push({ userId: member.userId, reason: "removed_after_cutover_do_not_restore_access" });
      else if (current.role !== member.role) conflicts.push({ userId: member.userId, reason: "role_changed_after_cutover_requires_reconciliation" });
    }
    return { scanned: page.page.length, conflicts, continueCursor: page.continueCursor, isDone: page.isDone,
      backupReference: run.backupReference, automaticRollbackAllowed: false as const,
      additionalReview: "Reconcile all newly added memberships and invitations, freeze membership writes, validate the backup in an isolated target, then obtain explicit production approval. Never restore legacy privileges over live revocations." };
  },
});
