import { internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

const source = v.union(
  v.literal("users"), v.literal("memberships"),
  v.literal("organizationSettings"), v.literal("authOrganizationMappings"),
);
const issueCode = v.union(
  v.literal("missing_legacy_identity"), v.literal("duplicate_legacy_identity"),
  v.literal("duplicate_auth_identity"), v.literal("missing_auth_identity"),
  v.literal("legacy_profile_membership_requires_review"),
  v.literal("orphaned_membership"), v.literal("duplicate_membership"),
  v.literal("missing_workspace_owner"), v.literal("missing_workspace_mapping"),
  v.literal("conflicting_workspace_mapping"), v.literal("duplicate_workspace_settings"),
);
const issue = v.object({ recordId: v.string(), code: issueCode });
type Issue = { recordId: string; code: typeof issueCode.type };

async function checkWorkspace(ctx: QueryCtx, organizationId: string, recordId: string, issues: Issue[]) {
  const owner = await ctx.db.query("memberships")
    .withIndex("by_organization_role", (q) => q.eq("organizationId", organizationId).eq("role", "owner"))
    .first();
  if (!owner) issues.push({ recordId, code: "missing_workspace_owner" });
  const mappings = await ctx.db.query("authOrganizationMappings")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).take(2);
  if (!mappings.length) issues.push({ recordId, code: "missing_workspace_mapping" });
  if (mappings.length > 1) issues.push({ recordId, code: "conflicting_workspace_mapping" });
}

// Internal and read-only: this reports local migration evidence, never imports,
// links by email, grants membership, or certifies provider/cutover readiness.
export const inventoryPage = internalQuery({
  args: { source, cursor: v.union(v.string(), v.null()), limit: v.number() },
  returns: v.object({
    source, scanned: v.number(), continueCursor: v.string(), isDone: v.boolean(),
    issues: v.array(issue), observedAt: v.number(), readyForCutover: v.literal(false),
    scope: v.literal("local_evidence_only"),
  }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) {
      throw new Error("Inventory page size must be an integer between 1 and 100");
    }
    const pagination = { cursor: args.cursor, numItems: args.limit };
    const issues: Issue[] = [];
    const result = (page: { page: unknown[]; continueCursor: string; isDone: boolean }) => ({
      source: args.source, scanned: page.page.length, continueCursor: page.continueCursor,
      isDone: page.isDone, issues, observedAt: Date.now(),
      readyForCutover: false as const, scope: "local_evidence_only" as const,
    });

    if (args.source === "users") {
      const page = await ctx.db.query("users").paginate(pagination);
      for (const user of page.page) {
        const recordId = user._id;
        if (!user.workosUserId) issues.push({ recordId, code: "missing_legacy_identity" });
        else {
          const matches = await ctx.db.query("users")
            .withIndex("by_workosUserId", (q) => q.eq("workosUserId", user.workosUserId)).take(2);
          if (matches.length > 1) issues.push({ recordId, code: "duplicate_legacy_identity" });
        }
        if (!user.betterAuthUserId) issues.push({ recordId, code: "missing_auth_identity" });
        else {
          const matches = await ctx.db.query("users")
            .withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", user.betterAuthUserId)).take(2);
          if (matches.length > 1) issues.push({ recordId, code: "duplicate_auth_identity" });
        }
        if (user.organizationId || user.role) {
          issues.push({ recordId, code: "legacy_profile_membership_requires_review" });
        }
      }
      return result(page);
    }

    if (args.source === "memberships") {
      const page = await ctx.db.query("memberships").paginate(pagination);
      for (const membership of page.page) {
        const recordId = membership._id;
        if (!(await ctx.db.get(membership.userId))) issues.push({ recordId, code: "orphaned_membership" });
        const matches = await ctx.db.query("memberships").withIndex("by_user_org", (q) =>
          q.eq("userId", membership.userId).eq("organizationId", membership.organizationId)).take(2);
        if (matches.length > 1) issues.push({ recordId, code: "duplicate_membership" });
        await checkWorkspace(ctx, membership.organizationId, recordId, issues);
      }
      return result(page);
    }

    if (args.source === "organizationSettings") {
      const page = await ctx.db.query("organizationSettings").paginate(pagination);
      for (const settings of page.page) {
        const matches = await ctx.db.query("organizationSettings")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", settings.organizationId)).take(2);
        if (matches.length > 1) issues.push({ recordId: settings._id, code: "duplicate_workspace_settings" });
        await checkWorkspace(ctx, settings.organizationId, settings._id, issues);
      }
      return result(page);
    }

    const page = await ctx.db.query("authOrganizationMappings").paginate(pagination);
    for (const mapping of page.page) {
      const byAuth = await ctx.db.query("authOrganizationMappings")
        .withIndex("by_auth_organization", (q) => q.eq("betterAuthOrganizationId", mapping.betterAuthOrganizationId)).take(2);
      if (byAuth.length > 1) issues.push({ recordId: mapping._id, code: "conflicting_workspace_mapping" });
      await checkWorkspace(ctx, mapping.organizationId, mapping._id, issues);
    }
    return result(page);
  },
});
