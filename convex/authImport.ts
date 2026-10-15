import { internalMutation } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { normalizeEmail } from "./validation";

export const importReviewedPage = internalMutation({
  args: {
    runId: v.string(), organizationId: v.string(), workspaceName: v.string(),
    reviewedBy: v.string(), backupReference: v.string(), providerEvidenceDigest: v.string(),
    cursor: v.union(v.string(), v.null()), limit: v.number(), commit: v.optional(v.boolean()),
    identities: v.array(v.object({ userId: v.id("users"), workosUserId: v.string(),
      emailVerified: v.literal(true), betterAuthUserId: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    for (const value of [args.runId, args.organizationId, args.workspaceName, args.reviewedBy, args.backupReference, args.providerEvidenceDigest]) {
      if (!value.trim() || value.length > 256) throw new Error("A reviewed inventory and restorable backup are required");
    }
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 50 || args.identities.length > 50) throw new Error("Import pages must contain at most 50 reviewed identities");
    const fingerprint = JSON.stringify(args.identities);
    const previous = await ctx.db.query("authMigrationPages").withIndex("by_run_cursor", (q) => q.eq("runId", args.runId).eq("cursor", args.cursor)).unique();
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error("A committed page cannot be changed");
      return { scanned: previous.scanned, continueCursor: previous.nextCursor, isDone: previous.isDone, committed: true, replay: true };
    }
    const run = await ctx.db.query("authMigrationRuns").withIndex("by_run", (q) => q.eq("runId", args.runId)).unique();
    if (run && (run.organizationId !== args.organizationId || run.cursor !== args.cursor || run.status !== "importing"
      || run.reviewedBy !== args.reviewedBy || run.backupReference !== args.backupReference || run.providerEvidenceDigest !== args.providerEvidenceDigest)) throw new Error("Migration checkpoint conflicts with this request");
    if (!run && args.cursor !== null) throw new Error("Start a new import at the first page");
    const conflict = await ctx.db.query("authMigrationRuns").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).unique();
    if (conflict && conflict.runId !== args.runId) throw new Error("Workspace already belongs to another migration run");
    const existingMapping = await ctx.db.query("authOrganizationMappings").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).unique();
    if (existingMapping) throw new Error("Workspace is already mapped");
    const page = await ctx.db.query("memberships").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).paginate({ cursor: args.cursor, numItems: args.limit });
    if (!page.page.length) throw new Error("Cannot import a workspace without reviewed members");
    if (new Set(args.identities.map((item) => item.userId)).size !== args.identities.length || args.identities.length !== page.page.length) throw new Error("Every page member requires exactly one reviewed identity");
    const validated = [];
    for (const member of page.page) {
      const profile = await ctx.db.get(member.userId);
      const evidence = args.identities.find((item) => item.userId === member.userId);
      if (!profile?.workosUserId || !evidence || profile.workosUserId !== evidence.workosUserId) throw new Error("Legacy identity requires reconciliation");
      const email = normalizeEmail(profile.email);
      const duplicates = await ctx.db.query("memberships").withIndex("by_user_org", (q) => q.eq("userId", member.userId).eq("organizationId", args.organizationId)).take(2);
      if (duplicates.length !== 1) throw new Error("Duplicate legacy membership");
      if (profile.betterAuthUserId && profile.betterAuthUserId !== evidence.betterAuthUserId) throw new Error("Conflicting identity mapping");
      const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: evidence.betterAuthUserId ? "_id" : "email", value: evidence.betterAuthUserId ?? email }] });
      if (authUser && (!evidence.betterAuthUserId || authUser.email !== email || !authUser.emailVerified)) throw new Error("Existing auth identity requires explicit verified reconciliation");
      if (evidence.betterAuthUserId && !authUser) throw new Error("Reviewed auth identity does not exist");
      validated.push({ member, profile, email, authUser });
    }
    if (!args.commit) return { scanned: page.page.length, continueCursor: page.continueCursor, isDone: page.isDone, committed: false, replay: false };
    let authOrganizationId = run?.betterAuthOrganizationId;
    let runId = run?._id;
    if (!authOrganizationId) {
      const organization = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "organization", data: { name: args.workspaceName.trim(), slug: `migration-${args.runId}`, createdAt: Date.now() } } });
      authOrganizationId = organization._id;
      if (!authOrganizationId) throw new Error("Organization creation returned no identity");
      runId = await ctx.db.insert("authMigrationRuns", { runId: args.runId, organizationId: args.organizationId, betterAuthOrganizationId: authOrganizationId,
        reviewedBy: args.reviewedBy, backupReference: args.backupReference, providerEvidenceDigest: args.providerEvidenceDigest, cursor: args.cursor, status: "importing", createdAt: Date.now(), updatedAt: Date.now() });
    }
    if (!authOrganizationId || !runId) throw new Error("Migration checkpoint is unavailable");
    const targetOrganizationId = authOrganizationId;
    for (const item of validated) {
      const user = item.authUser ?? await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: item.profile.name ?? item.email, email: item.email, emailVerified: true, createdAt: item.profile.createdAt, updatedAt: Date.now() } } });
      const duplicateLink = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", user._id)).take(2);
      if (duplicateLink.some((profile) => profile._id !== item.profile._id)) throw new Error("Auth user already links to another stable profile");
      await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "member", data: { userId: user._id, organizationId: targetOrganizationId, role: item.member.role, createdAt: item.member.createdAt } } });
      await ctx.db.patch(item.profile._id, { betterAuthUserId: user._id });
      const existingLink = await ctx.db.query("authMigrationLinks").withIndex("by_user", (q) => q.eq("userId", item.profile._id)).unique();
      if (!existingLink) await ctx.db.insert("authMigrationLinks", { runId: args.runId, userId: item.profile._id, betterAuthUserId: user._id, workosUserId: item.profile.workosUserId!, reviewedBy: args.reviewedBy, createdAt: Date.now() });
    }
    if (page.isDone) {
      const owner = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "member", where: [{ field: "organizationId", value: targetOrganizationId }, { field: "role", value: "owner" }] });
      if (!owner) throw new Error("Reconcile workspace ownership before completing the import");
      await ctx.db.insert("authOrganizationMappings", { betterAuthOrganizationId: targetOrganizationId, organizationId: args.organizationId, source: "migration", createdAt: Date.now() });
    }
    await ctx.db.patch(runId!, { cursor: page.continueCursor, status: page.isDone ? "complete" : "importing", updatedAt: Date.now() });
    await ctx.db.insert("authMigrationPages", { runId: args.runId, cursor: args.cursor, nextCursor: page.continueCursor, isDone: page.isDone, scanned: page.page.length, fingerprint });
    return { scanned: page.page.length, continueCursor: page.continueCursor, isDone: page.isDone, committed: true, replay: false };
  },
});
