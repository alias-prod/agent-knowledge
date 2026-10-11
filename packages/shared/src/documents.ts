export const KNOWLEDGE_TYPES = [
  { id: "document", label: "Document", description: "General workspace knowledge." },
  { id: "policy", label: "Policy", description: "Rules and constraints that govern decisions." },
  { id: "playbook", label: "Playbook", description: "Repeatable operating procedures." },
  { id: "decision", label: "Decision", description: "A recorded decision and its rationale." },
  { id: "reference", label: "Reference", description: "Supporting facts and source material." },
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]["id"];

export const RELATIONSHIP_KINDS = [
  { id: "references", label: "References", inverse: "Referenced by" },
  { id: "depends_on", label: "Depends on", inverse: "Dependency of" },
  { id: "supersedes", label: "Supersedes", inverse: "Superseded by" },
] as const;

export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number]["id"];

export const DOCUMENT_LIMITS = {
  list: 200,
  title: 200,
  content: 20_000,
  relations: 24,
  depth: 12,
  updateBytes: 128 * 1024,
  stateBytes: 512 * 1024,
  history: 30,
} as const;

export function documentHref(id: string) {
  return `/documents?doc=${encodeURIComponent(id)}`;
}

export function documentGraphHref(id: string) {
  return `/graph?lens=knowledge&view=list&node=${encodeURIComponent(`knowledge:${id}`)}`;
}
