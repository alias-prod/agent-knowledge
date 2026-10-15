import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import type { DataModelFromSchemaDefinition, GenericQueryCtx } from "convex/server";

type Ctx = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>;

export const getSessionMembership = queryGeneric({
  args: { sessionId: v.string(), userId: v.string(), organizationId: v.string() },
  returns: v.union(v.null(), v.object({
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
  })),
  handler: async (ctx: Ctx, args) => {
    const sessionId = ctx.db.normalizeId("session", args.sessionId);
    const userId = ctx.db.normalizeId("user", args.userId);
    if (!sessionId || !userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session || session.expiresAt <= Date.now() || session.userId !== args.userId) return null;
    if (session.activeOrganizationId !== args.organizationId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.emailVerified) return null;
    const membership = await ctx.db.query("member")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId))
      .unique();
    if (!membership || !["owner", "admin", "member"].includes(membership.role)) return null;
    return {
      userId: args.userId, email: user.email, name: user.name,
      role: membership.role as "owner" | "admin" | "member",
    };
  },
});
