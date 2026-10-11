import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminForIdentity } from "./permissions";
import { writeAuditLog } from "./audit";
import { LIMITS, optionalText } from "./validation";

export const getOrganizationSettings = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    return (
      settings ?? {
        organizationId: args.organizationId,
        displayName: "ALIAS UCE Workspace",
        defaultKnowledgeCategory: "Company Policy",
        defaultKnowledgeStatus: "draft" as const,
        defaultCanUseToAnswer: true,
        defaultCanUseToAct: false,
        updatedByEmail: undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    );
  },
});

export const updateOrganizationSettings = mutation({
  args: {
    organizationId: v.string(),
    workosUserId: v.string(),
    actorEmail: v.optional(v.string()),
    displayName: v.string(),
    defaultKnowledgeCategory: v.optional(v.string()),
    defaultKnowledgeStatus: v.union(v.literal("draft"), v.literal("verified")),
    defaultCanUseToAnswer: v.boolean(),
    defaultCanUseToAct: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const now = Date.now();

    const existing = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    const payload = {
      organizationId: args.organizationId,
      displayName:
        optionalText(args.displayName, "Display name", LIMITS.name) ??
        "ALIAS UCE Workspace",
      defaultKnowledgeCategory:
        optionalText(
          args.defaultKnowledgeCategory,
          "Default category",
          LIMITS.category
        ) ?? "Company Policy",
      defaultKnowledgeStatus: args.defaultKnowledgeStatus,
      defaultCanUseToAnswer: args.defaultCanUseToAnswer,
      defaultCanUseToAct: args.defaultCanUseToAct,
      updatedByEmail: args.actorEmail,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("organizationSettings", {
        ...payload,
        createdAt: now,
      });
    }

    await writeAuditLog(ctx, {
      action: "organization_settings_updated",
      knowledgeTitle: "Organization settings updated",
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });
  },
});
