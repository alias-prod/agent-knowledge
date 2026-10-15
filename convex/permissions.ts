import type { QueryCtx, MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { getSession } from "./auth";

type Ctx = QueryCtx | MutationCtx;

export async function requireMembershipForIdentity(ctx: Ctx, organizationId: string) {
  if (!organizationId || organizationId.length > 256) throw new Error("Unauthorized");
  const session = await getSession(ctx);
  if (!session?.user.emailVerified) throw new Error("Unauthorized");
  const mapping = await ctx.db.query("authOrganizationMappings").withIndex("by_organization", (q) =>
    q.eq("organizationId", organizationId)).unique();
  if (!mapping || session.session.activeOrganizationId !== mapping.betterAuthOrganizationId) throw new Error("Unauthorized");
  const member = await ctx.runQuery(components.betterAuth.access.getSessionMembership, {
    sessionId: session.session.id, userId: session.user.id, organizationId: mapping.betterAuthOrganizationId,
  });
  if (!member) throw new Error("Unauthorized");
  const profile = await ctx.db.query("users").withIndex("by_betterAuthUserId", (q) =>
    q.eq("betterAuthUserId", session.user.id)).unique();
  if (!profile) throw new Error("Finish account setup before opening this workspace");
  return {
    identity: { subject: session.user.id, email: member.email, name: member.name },
    membership: { userId: profile._id, organizationId, role: member.role },
    authOrganizationId: mapping.betterAuthOrganizationId,
  };
}

export async function getMembershipForAuthUser(ctx: Ctx, userId: string, organizationId: string) {
  const result = await requireMembershipForIdentity(ctx, organizationId);
  if (result.identity.subject !== userId) throw new Error("Unauthorized");
  return result.membership;
}

export async function requireAdminForIdentity(ctx: Ctx, organizationId: string) {
  const result = await requireMembershipForIdentity(ctx, organizationId);
  if (!["owner", "admin"].includes(result.membership.role)) throw new Error("Unauthorized");
  return result.membership;
}
