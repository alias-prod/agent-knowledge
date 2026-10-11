import type { QueryCtx, MutationCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function getMembershipForWorkosUser(
  ctx: Ctx,
  workosUserId: string,
  organizationId: string
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", workosUserId))
    .first();

  if (!user) return null;

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_org", (q) =>
      q.eq("userId", user._id).eq("organizationId", organizationId)
    )
    .first();

  return membership;
}

export async function requireMembershipForIdentity(ctx: Ctx, organizationId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !organizationId || organizationId.length > 256) throw new Error("Unauthorized");
  const membership = await getMembershipForWorkosUser(ctx, identity.subject, organizationId);
  if (!membership) throw new Error("Unauthorized");
  return { identity, membership };
}

export async function requireAdminForWorkosUser(
  ctx: Ctx,
  workosUserId: string,
  organizationId: string
) {
  const membership = await getMembershipForWorkosUser(
    ctx,
    workosUserId,
    organizationId
  );

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Unauthorized");
  }

  return membership;
}

// Authorization now requires a server-verified ctx.auth identity — no more
// falling back to a client-supplied workosUserId. writeAuditLog keeps its own
// separate fallback for actorId; that's unrelated to this authorization check.
export async function requireAdminForIdentity(
  ctx: Ctx,
  organizationId: string
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Unauthorized");
  }

  return await requireAdminForWorkosUser(ctx, identity.subject, organizationId);
}
