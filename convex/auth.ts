import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import authSchema from "./betterAuth/schema";
import { createAuthOptions } from "./authOptions";
import { assertAuthReady } from "./authEnvironment";

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
});

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  assertAuthReady(process.env);
  return betterAuth(createAuthOptions(authComponent.adapter(ctx)));
};

export async function getSession(ctx: GenericCtx<DataModel>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || typeof identity.sessionId !== "string") return null;
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
  return auth.api.getSession({ headers });
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const session = await getSession(ctx);
    if (!session) return null;
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) return { user: session.user, workspace: null };
    const membership = await ctx.runQuery(components.betterAuth.access.getSessionMembership, {
      sessionId: session.session.id, userId: session.user.id, organizationId,
    });
    if (!membership) return { user: session.user, workspace: null };
    const mapping = await ctx.db.query("authOrganizationMappings").withIndex("by_auth_organization", (q) =>
      q.eq("betterAuthOrganizationId", organizationId)).unique();
    return { user: session.user, workspace: mapping ? {
      organizationId: mapping.organizationId, authOrganizationId: organizationId,
      role: membership.role,
    } : null };
  },
});

export const initializeWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const session = await getSession(ctx);
    if (!session?.user.emailVerified) throw new Error("Verify your email before opening a workspace");
    const authId = session.user.id;
    let profile = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", authId)).unique();
    if (!profile) {
      // A matching email is never evidence of a legacy identity or entitlement.
      const id = await ctx.db.insert("users", { betterAuthUserId: authId, email: session.user.email,
        name: session.user.name, createdAt: Date.now(), updatedAt: Date.now() });
      profile = await ctx.db.get(id);
    }
    const organizationId = session.session.activeOrganizationId;
    if (!organizationId) return null;
    const membership = await ctx.runQuery(components.betterAuth.access.getSessionMembership, {
      sessionId: session.session.id, userId: authId, organizationId,
    });
    if (!membership) throw new Error("Unauthorized");
    let mapping = await ctx.db.query("authOrganizationMappings").withIndex("by_auth_organization", (q) =>
      q.eq("betterAuthOrganizationId", organizationId)).unique();
    if (!mapping) {
      if (membership.role !== "owner") throw new Error("The workspace owner must finish setup");
      const workspaceId = `workspace_${organizationId}`;
      const organization = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "organization", where: [{ field: "_id", value: organizationId }] });
      if (!organization) throw new Error("Workspace no longer exists");
      await ctx.db.insert("authOrganizationMappings", { betterAuthOrganizationId: organizationId,
        organizationId: workspaceId, source: "created", createdAt: Date.now() });
      await ctx.db.insert("organizationSettings", { organizationId: workspaceId, displayName: organization.name,
        defaultKnowledgeStatus: "draft", defaultCanUseToAnswer: false, defaultCanUseToAct: false,
        createdAt: Date.now(), updatedAt: Date.now() });
      return workspaceId;
    }
    return mapping.organizationId;
  },
});
