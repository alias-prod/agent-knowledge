import type { Doc, TableNames } from "../../../convex/_generated/dataModel";

type OntologyRelation = {
  target: TableNames;
  label: string;
  field: string;
  description: string;
};

type OntologyEntity<T extends TableNames = TableNames> = T extends TableNames
  ? {
      table: T;
      title: string;
      description: string;
      fields: { name: keyof Doc<T> & string; description: string }[];
      relations: (OntologyRelation & { field: keyof Doc<T> & string })[];
    }
  : never;

export const ONTOLOGY_ENTITIES = [
  {
    table: "knowledge",
    title: "Knowledge",
    description: "The policies, playbooks, and context available to your agents.",
    fields: [
      { name: "title", description: "The name of a knowledge record." },
      { name: "content", description: "The source text used during retrieval." },
      { name: "category", description: "A category assigned to the record, not an inferred topic." },
      { name: "documentType", description: "A document, policy, playbook, decision, or reference. Documents are knowledge records, not a separate data store." },
      { name: "parentId", description: "An optional knowledge ID that nests this document inside another workspace document." },
      { name: "relations", description: "Explicit knowledge links: references, depends on, or supersedes. These also appear as graph edges and document backlinks." },
      { name: "metadataRevision", description: "A revision counter that prevents concurrent property edits from overwriting each other." },
      { name: "status", description: "Draft or verified. Verification is independent of approval." },
      { name: "canUseToAnswer", description: "Whether this knowledge may be used in answers." },
      { name: "canUseToAct", description: "Whether this knowledge may be used to take action." },
      { name: "requiresApproval", description: "Whether the record is awaiting human approval." },
      { name: "sourceUrl", description: "An optional source address. Sources are attributes, not a separate table." },
      { name: "allowedAgentIds", description: "Explicit agent assignments. An empty list does not grant access to all agents." },
      { name: "organizationId", description: "The workspace that owns this record." },
      { name: "updatedAt", description: "When this record was last changed." },
    ],
    relations: [
      { target: "knowledge", label: "nested in", field: "parentId", description: "An explicit parent knowledge ID defines the document hierarchy." },
      { target: "knowledge", label: "connects to", field: "relations", description: "Typed knowledge links define references, dependencies, and superseded records." },
      { target: "agents", label: "assigned to", field: "allowedAgentIds", description: "Explicit record IDs connect knowledge to agents. Assignment alone does not imply answer eligibility." },
      { target: "organizationSettings", label: "scoped to", field: "organizationId", description: "A shared organization identifier scopes records to a workspace." },
    ],
  },
  {
    table: "agents",
    title: "Agents",
    description: "The agents that retrieve and use company knowledge.",
    fields: [
      { name: "name", description: "The agent's display name." },
      { name: "description", description: "The purpose and responsibilities of the agent." },
      { name: "role", description: "An optional role description, distinct from a member's access role." },
      { name: "status", description: "Active or disabled." },
      { name: "organizationId", description: "The workspace that owns this agent." },
    ],
    relations: [
      { target: "organizationSettings", label: "scoped to", field: "organizationId", description: "Agents belong to a workspace through its organization identifier." },
    ],
  },
  {
    table: "retrievalLogs",
    title: "Retrievals",
    description: "A record of questions, the agent used, and the returned sources.",
    fields: [
      { name: "question", description: "The question submitted to the agent." },
      { name: "agentId", description: "The ID of the agent used for this retrieval." },
      { name: "resultCount", description: "The number of knowledge results returned." },
      { name: "sourceTitles", description: "Historical source titles, not knowledge IDs. They are not treated as record-level graph edges." },
      { name: "createdAt", description: "When this retrieval was recorded." },
    ],
    relations: [
      { target: "agents", label: "performed by", field: "agentId", description: "The stored agent ID identifies who performed the retrieval." },
      { target: "organizationSettings", label: "scoped to", field: "organizationId", description: "Retrieval history is isolated by workspace." },
    ],
  },
  {
    table: "knowledgeVersions",
    title: "Versions",
    description: "Historical snapshots of knowledge as it changes.",
    fields: [
      { name: "knowledgeId", description: "The original knowledge record's ID." },
      { name: "title", description: "The title at the time of this version." },
      { name: "content", description: "The content at the time of this version." },
      { name: "status", description: "The verification state at the time of this version." },
      { name: "changedByEmail", description: "The recorded editor, when available." },
      { name: "createdAt", description: "When the version was created." },
    ],
    relations: [
      { target: "knowledge", label: "version of", field: "knowledgeId", description: "A stored knowledge ID links each version to its original record." },
    ],
  },
  {
    table: "users",
    title: "People",
    description: "Stable application profiles linked to verified Better Auth identities. Profiles alone do not grant workspace access.",
    fields: [
      { name: "betterAuthUserId", description: "The authoritative Better Auth identity linked by a unique indexed mapping; never automatically matched by email." },
      { name: "workosUserId", description: "Preserved legacy WorkOS identity for migration evidence, not an accepted session authority." },
      { name: "name", description: "The person's optional display name." },
      { name: "email", description: "The person's email address." },
      { name: "createdAt", description: "When this identity was recorded." },
    ],
    relations: [],
  },
  {
    table: "memberships",
    title: "Memberships",
    description: "Read-only legacy membership evidence for reviewed migration and rollback. Live access is authorized by current Better Auth component membership and session.",
    fields: [
      { name: "userId", description: "The member's stored user ID." },
      { name: "organizationId", description: "The stable workspace identifier recorded in the legacy membership." },
      { name: "role", description: "The legacy owner/admin/member role, retained as reconciliation evidence. This is not a writable live authorization source." },
    ],
    relations: [
      { target: "users", label: "belongs to", field: "userId", description: "A stored user ID links the membership to a person." },
      { target: "organizationSettings", label: "legacy workspace", field: "organizationId", description: "Preserved migration evidence only. Current Better Auth memberships are authoritative." },
    ],
  },
  {
    table: "authOrganizationMappings",
    title: "Workspace Identity Mappings",
    description: "Server-owned one-to-one links from Better Auth organizations to stable workspace identifiers. Every protected data operation rechecks a live session and membership through this mapping.",
    fields: [
      { name: "betterAuthOrganizationId", description: "The authoritative organization ID in the Better Auth component." },
      { name: "organizationId", description: "The preserved business workspace ID used by documents, agents, and audit records." },
      { name: "source", description: "Created by a verified workspace owner, or imported with explicit reviewed migration evidence." },
    ],
    relations: [{ target: "organizationSettings", label: "maps workspace", field: "organizationId", description: "The stable workspace identifier preserves business records through an identity-provider migration." }],
  },
  {
    table: "assistantOperations",
    title: "Assistant Operations",
    description: "Single-use server-owned draft proposals. Only the originating verified actor and session can approve; cancellation, expiry, role changes and revision conflicts deny commits.",
    fields: [
      { name: "organizationId", description: "The authorized workspace for this operation." },
      { name: "actorId", description: "The verified Better Auth user, derived on the server." },
      { name: "sessionId", description: "The originating live session. Other sessions cannot replay an approval." },
      { name: "status", description: "Proposed, committed, or cancelled. A model cannot self-approve." },
      { name: "targetId", description: "Optional target document for a revision-checked edit; absent for a new draft." },
      { name: "expiresAt", description: "Approval expires five minutes after its originating request began." },
    ],
    relations: [{ target: "knowledge", label: "proposes change to", field: "targetId", description: "An explicit document ID binds an edit proposal to its exact target." }],
  },
  {
    table: "organizationSettings",
    title: "Workspaces",
    description: "Workspace identity and the defaults applied to new knowledge.",
    fields: [
      { name: "organizationId", description: "The external organization identifier used for tenant isolation." },
      { name: "displayName", description: "The workspace's display name." },
      { name: "defaultKnowledgeCategory", description: "The initial category for new knowledge." },
      { name: "defaultKnowledgeStatus", description: "The initial verification state for new knowledge." },
      { name: "defaultCanUseToAnswer", description: "The default answer permission for new records." },
      { name: "defaultCanUseToAct", description: "The default action permission for new records." },
    ],
    relations: [],
  },
  {
    table: "auditLogs",
    title: "Audit events",
    description: "The actions that explain how knowledge and access changed.",
    fields: [
      { name: "action", description: "The recorded creation, change, review, or administration action." },
      { name: "actorId", description: "The recorded actor identifier, when available." },
      { name: "knowledgeId", description: "An optional link to the affected knowledge record." },
      { name: "agentId", description: "An optional link to the affected agent." },
      { name: "createdAt", description: "When this action was recorded." },
    ],
    relations: [
      { target: "knowledge", label: "references", field: "knowledgeId", description: "When present, this ID connects the event to a knowledge record." },
      { target: "agents", label: "references", field: "agentId", description: "When present, this ID connects the event to an agent." },
    ],
  },
] satisfies OntologyEntity[];
