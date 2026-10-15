import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMembershipForIdentity } from "./permissions";

// Legacy profiles and membership rows remain migration evidence, not an auth API.
export const getCurrentProfile = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const { membership } = await requireMembershipForIdentity(ctx, args.organizationId);
    return ctx.db.get(membership.userId);
  },
});
