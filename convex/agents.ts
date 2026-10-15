import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminForIdentity, requireMembershipForIdentity } from "./permissions";
import { writeAuditLog } from "./audit";
import { inOrg } from "./tenancy";
import { LIMITS, requireText } from "./validation";

export const createAgent = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    organizationId: v.string(),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const name = requireText(args.name, "Name", LIMITS.name);
    const description = requireText(
      args.description,
      "Description",
      LIMITS.description
    );
    const role = requireText(args.role, "Role", LIMITS.role);

    const now = Date.now();

    const agentId = await ctx.db.insert("agents", {
      name,
      description,
      role,
      status: args.status,
      organizationId: args.organizationId,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(ctx, {
      action: "agent.created",
      agentId,
      agentName: name,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });

    return agentId;
  },
});

export const listAgents = query({
  args: {
    organizationId: v.string(),
    search: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("all"), v.literal("active"), v.literal("disabled"))
    ),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const agents = await ctx.db.query("agents").withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId)).order("desc").collect();

    const search = args.search?.toLowerCase().trim() ?? "";
    const status = args.status ?? "all";
    const role = args.role ?? "all";

    const matchesOrg = inOrg(args.organizationId);

    return agents.filter((agent) => {
      const matchesSearch =
        !search ||
        agent.name.toLowerCase().includes(search) ||
        agent.description.toLowerCase().includes(search);

      const matchesStatus = status === "all" || agent.status === status;

      const matchesRole = role === "all" || agent.role === role;

      return matchesOrg(agent) && matchesSearch && matchesStatus && matchesRole;
    });
  },
});

export const updateAgent = mutation({
  args: {
    id: v.id("agents"),
    name: v.string(),
    description: v.string(),
    role: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled")),
    organizationId: v.string(),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminForIdentity(ctx, args.organizationId);

    const name = requireText(args.name, "Name", LIMITS.name);
    const description = requireText(
      args.description,
      "Description",
      LIMITS.description
    );
    const role = requireText(args.role, "Role", LIMITS.role);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      name,
      description,
      role,
      status: args.status,
      updatedAt: now,
      organizationId: args.organizationId,
    });

    await writeAuditLog(ctx, {
      action: "agent.updated",
      agentId: args.id,
      agentName: name,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: args.organizationId,
      createdAt: now,
    });
  },
});

export const deleteAgent = mutation({
  args: {
    id: v.id("agents"),
    actorEmail: v.optional(v.string()),
    workosUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);

    if (!agent) {
      throw new Error("Agent not found");
    }

    if (!agent.organizationId) {
      throw new Error("Agent is missing organizationId");
    }

    await requireAdminForIdentity(ctx, agent.organizationId);

    await ctx.db.delete(args.id);

    await writeAuditLog(ctx, {
      action: "agent.deleted",
      agentId: undefined,
      agentName: agent.name,
      actorEmail: args.actorEmail,
      actorId: args.workosUserId,
      organizationId: agent.organizationId,
    });
  },
});

export const getAgent = query({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent?.organizationId) return null;
    await requireMembershipForIdentity(ctx, agent.organizationId);
    return agent;
  },
});

export const listAuditLogsForAgent = query({
  args: {
    agentId: v.id("agents"),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const logs = await ctx.db.query("auditLogs").order("desc").collect();
    const matchesOrg = inOrg(args.organizationId);

    return logs
      .filter((log) => log.agentId === args.agentId && matchesOrg(log))
      .slice(0, 10);
  },
});

export const listAuditLogs = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMembershipForIdentity(ctx, args.organizationId);
    const logs = await ctx.db.query("auditLogs").order("desc").collect();

    return logs.filter(inOrg(args.organizationId)).slice(0, 50);
  },
});
