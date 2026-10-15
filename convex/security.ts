import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getSession } from "./auth";

export const checkRateLimit = mutation({
  args: {
    key: v.string(),
    route: v.string(),
    limit: v.number(),
    windowMs: v.number(),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await getSession(ctx);
    if (!session?.user.emailVerified) throw new Error("Unauthorized");
    if (args.route !== "ask-answer") throw new Error("Unsupported request budget");
    const key = `user:${session.user.id}`;
    const limit = 10;
    const windowMs = 10 * 60 * 1000;
    const now = Date.now();

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_route", (q) =>
        q.eq("key", key).eq("route", args.route)
      )
      .first();

    if (!existing || existing.resetAt <= now) {
      await ctx.db.insert("rateLimits", {
        key: key,
        route: args.route,
        count: 1,
        resetAt: now + windowMs,
        updatedAt: now,
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: now + windowMs,
      };
    }

    if (existing.count >= limit) {
      throw new Error(
        `Rate limit exceeded. Try again after ${new Date(
          existing.resetAt
        ).toLocaleTimeString()}.`
      );
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      updatedAt: now,
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count - 1),
      resetAt: existing.resetAt,
    };
  },
});
