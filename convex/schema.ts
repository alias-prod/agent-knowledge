import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  knowledge: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")),
    ownerId: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    organizationId: v.optional(v.string()),

    sourceUrl: v.optional(v.string()),
    lastReviewedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),

    canUseToAct: v.optional(v.boolean()),
    canUseToAnswer: v.optional(v.boolean()),
    requiresApproval: v.optional(v.boolean()),
    allowedAgentIds: v.optional(v.array(v.id("agents"))),
    documentType: v.optional(v.union(v.literal("document"), v.literal("policy"), v.literal("playbook"), v.literal("decision"), v.literal("reference"))),
    parentId: v.optional(v.id("knowledge")),
    relations: v.optional(v.array(v.object({
      targetId: v.id("knowledge"),
      kind: v.union(v.literal("references"), v.literal("depends_on"), v.literal("supersedes")),
    }))),
    collaborationState: v.optional(v.bytes()),
    metadataRevision: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_parent", ["organizationId", "parentId"])
    .searchIndex("search_content", { searchField: "content", filterFields: ["organizationId"] }),

  rateLimits: defineTable({
    key: v.string(),
    route: v.string(),
    organizationId: v.optional(v.string()),
    count: v.number(),
    resetAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key_route", ["key", "route"])
    .index("by_route", ["route"]),

  users: defineTable({
    workosUserId: v.optional(v.string()),
    betterAuthUserId: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),

    // old seed fields
    organizationId: v.optional(v.string()),
    role: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workosUserId", ["workosUserId"])
    .index("by_betterAuthUserId", ["betterAuthUserId"]),

  authOrganizationMappings: defineTable({
    betterAuthOrganizationId: v.string(),
    organizationId: v.string(),
    source: v.union(v.literal("migration"), v.literal("created")),
    createdAt: v.number(),
  })
    .index("by_auth_organization", ["betterAuthOrganizationId"])
    .index("by_organization", ["organizationId"]),

  authMigrationLinks: defineTable({
    runId: v.string(),
    userId: v.id("users"),
    betterAuthUserId: v.string(),
    workosUserId: v.string(),
    reviewedBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_auth_user", ["betterAuthUserId"])
    .index("by_run", ["runId"]),

  memberships: defineTable({
    userId: v.id("users"),
    organizationId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_org", ["userId", "organizationId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_role", ["organizationId", "role"]),

  organizationSettings: defineTable({
    organizationId: v.string(),
    displayName: v.string(),
    defaultKnowledgeCategory: v.optional(v.string()),
    defaultKnowledgeStatus: v.union(v.literal("draft"), v.literal("verified")),
    defaultCanUseToAnswer: v.boolean(),
    defaultCanUseToAct: v.boolean(),
    updatedByEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organizationId", ["organizationId"]),

  auditLogs: defineTable({
    action: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("deleted"),
      v.literal("seed.demo_created"),
      v.literal("agent.created"),
      v.literal("agent.updated"),
      v.literal("agent.deleted"),
      v.literal("member_role_updated"),
      v.literal("member_removed"),
      v.literal("member_invited"),
      v.literal("organization_settings_updated"),
      v.literal("knowledge.reviewed"),
      v.literal("knowledge.rejected"),
      v.literal("knowledge.approved")
    ),

    knowledgeId: v.optional(v.id("knowledge")),
    knowledgeTitle: v.optional(v.string()),
    actorId: v.optional(v.string()),
    actorEmail: v.optional(v.string()),
    actorUserId: v.optional(v.string()),

    organizationId: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetType: v.optional(v.string()),
    metadata: v.optional(v.any()),

    createdAt: v.number(),

    agentId: v.optional(v.id("agents")),
    agentName: v.optional(v.string()),

  }),

  retrievalLogs: defineTable({
    organizationId: v.string(),
    agentId: v.id("agents"),
    agentName: v.optional(v.string()),
    question: v.string(),
    resultCount: v.number(),
    sourceTitles: v.array(v.string()),
    actorEmail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_agent", ["agentId"]),

  agents: defineTable({
    name: v.string(),
    description: v.string(),
    role: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("disabled")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  knowledgeVersions: defineTable({
    knowledgeId: v.id("knowledge"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    status: v.union(v.literal("draft"), v.literal("verified")),
    changedByEmail: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_knowledge", ["knowledgeId"]),

});
