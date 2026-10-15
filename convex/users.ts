import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { canManageKnowledge } from "@agent-knowledge/shared";
import { requireAdminForIdentity, requireMembershipForIdentity } from "./permissions";
import { writeAuditLog } from "./audit";
import { LIMITS, normalizeEmail, optionalText } from "./validation";

export const upsertCurrentUser = mutation({
    args: {
        workosUserId: v.string(),
        email: v.string(),
        name: v.optional(v.string()),
        organizationId: v.string(),
        actorEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { identity, membership } = await requireMembershipForIdentity(
            ctx,
            args.organizationId
        );
        if (identity.subject !== args.workosUserId) {
            throw new Error("Unauthorized");
        }

        // Membership provisioning belongs to the identity migration/invitation
        // flow, never to a browser-triggered profile refresh.
        await ctx.db.patch(membership.userId, {
            ...(identity.email ? { email: normalizeEmail(identity.email) } : {}),
            ...(identity.name
                ? { name: optionalText(identity.name, "Name", LIMITS.name) }
                : {}),
            updatedAt: Date.now(),
        });
        return membership.userId;
    },
});

export const getMembershipByWorkosUser = query({
    args: {
        workosUserId: v.string(),
        organizationId: v.string(),
    },
    handler: async (ctx, args) => {
        const { identity } = await requireMembershipForIdentity(ctx, args.organizationId);
        if (identity.subject !== args.workosUserId) {
            throw new Error("Unauthorized");
        }
        const user = await ctx.db
            .query("users")
            .withIndex("by_workosUserId", (q) =>
                q.eq("workosUserId", args.workosUserId)
            )
            .first();

        if (!user) return null;

        const membership = await ctx.db
            .query("memberships")
            .withIndex("by_user_org", (q) =>
                q.eq("userId", user._id).eq("organizationId", args.organizationId)
            )
            .first();

        if (!membership) return null;

        return {
            user,
            membership,
        };
    },
});

export const listMembers = query({
    args: {
        organizationId: v.string(),
    },
    handler: async (ctx, args) => {
        await requireMembershipForIdentity(ctx, args.organizationId);
        const memberships = await ctx.db
            .query("memberships")
            .withIndex("by_organization", (q) =>
                q.eq("organizationId", args.organizationId)
            )
            .order("desc")
            .collect();

        const members = await Promise.all(
            memberships.map(async (membership) => {
                const user = await ctx.db.get(membership.userId);

                return {
                    _id: membership._id,
                    role: membership.role,
                    organizationId: membership.organizationId,
                    createdAt: membership.createdAt,
                    updatedAt: membership.updatedAt,
                    userEmail: user?.email ?? "Unknown user",
                    userName: user?.name ?? "",
                    workosUserId: user?.workosUserId ?? "",
                };
            })
        );

        return members;
    },
});

export const updateMemberRole = mutation({
    args: {
        membershipId: v.id("memberships"),
        role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
        organizationId: v.string(),
        workosUserId: v.string(),
        actorEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdminForIdentity(ctx, args.organizationId);

        const membership = await ctx.db.get(args.membershipId);

        if (!membership) {
            throw new Error("Membership not found");
        }

        if (membership.organizationId !== args.organizationId) {
            throw new Error("Membership does not belong to this organization");
        }

        const isCurrentRolePrivileged = canManageKnowledge(membership.role);

        const isNewRoleNonPrivileged = args.role === "member";

        if (isCurrentRolePrivileged && isNewRoleNonPrivileged) {
            const orgMemberships = await ctx.db
                .query("memberships")
                .withIndex("by_organization", (q) =>
                    q.eq("organizationId", args.organizationId)
                )
                .collect();

            const privilegedMemberships = orgMemberships.filter((item) =>
                canManageKnowledge(item.role)
            );

            if (privilegedMemberships.length <= 1) {
                throw new Error(
                    "Cannot remove the last owner/admin from this organization"
                );
            }
        }

        await ctx.db.patch(args.membershipId, {
            role: args.role,
            updatedAt: Date.now(),
        });

        const user = await ctx.db.get(membership.userId);

        await writeAuditLog(ctx, {
            action: "member_role_updated",
            knowledgeId: undefined,
            knowledgeTitle: user?.email
                ? `Changed member role for ${user.email} to ${args.role}`
                : `Changed member role to ${args.role}`,
            actorEmail: args.actorEmail,
            actorId: args.workosUserId,
            organizationId: args.organizationId,
        });
    },
});

export const removeMember = mutation({
    args: {
        membershipId: v.id("memberships"),
        organizationId: v.string(),
        workosUserId: v.string(),
        actorEmail: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdminForIdentity(ctx, args.organizationId);

        const membership = await ctx.db.get(args.membershipId);

        if (!membership) {
            throw new Error("Membership not found");
        }

        if (membership.organizationId !== args.organizationId) {
            throw new Error("Membership does not belong to this organization");
        }

        const isPrivileged = canManageKnowledge(membership.role);

        if (isPrivileged) {
            const orgMemberships = await ctx.db
                .query("memberships")
                .withIndex("by_organization", (q) =>
                    q.eq("organizationId", args.organizationId)
                )
                .collect();

            const privilegedMemberships = orgMemberships.filter((item) =>
                canManageKnowledge(item.role)
            );

            if (privilegedMemberships.length <= 1) {
                throw new Error(
                    "Cannot remove the last owner/admin from this organization"
                );
            }
        }

        const user = await ctx.db.get(membership.userId);

        await writeAuditLog(ctx, {
            action: "member_removed",
            knowledgeId: undefined,
            knowledgeTitle: user?.email
                ? `Removed member ${user.email}`
                : "Removed member",
            actorEmail: args.actorEmail,
            actorId: args.workosUserId,
            organizationId: args.organizationId,
        });

        await ctx.db.delete(args.membershipId);
    },
});

export const inviteMember = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    organizationId: v.string(),
    workosUserId: v.string(),
    actorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const now = Date.now();
    const normalizedEmail = normalizeEmail(args.email);
    const name = optionalText(args.name, "Name", LIMITS.name);

    let user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    let userId = user?._id;

    if (!userId) {
      userId = await ctx.db.insert("users", {
        email: normalizedEmail,
        name: name ?? normalizedEmail,
        workosUserId: undefined,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(userId, {
        updatedAt: now,
      });
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("organizationId"), args.organizationId)
        )
      )
      .first();

    if (existingMembership) {
      throw new Error("This member is already in the organization");
    }

    await ctx.db.insert("memberships", {
      userId,
      organizationId: args.organizationId,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      action: "member_invited",
      knowledgeId: undefined,
      knowledgeTitle: `Invited member ${normalizedEmail} as ${args.role}`,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });

    return userId;
  },
});
