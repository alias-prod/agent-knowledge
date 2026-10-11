import type { KnowledgeType, RelationshipKind } from "./documents";

export const GRAPH_LIMITS = {
  knowledge: 120,
  agents: 60,
  retrievals: 60,
} as const;

export type GraphKnowledge = {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: "draft" | "verified";
  canUseToAnswer: boolean;
  canUseToAct: boolean;
  requiresApproval: boolean;
  allowedAgentIds: string[];
  sourceUrl?: string;
  documentType?: KnowledgeType;
  parentId?: string;
  relations?: { targetId: string; kind: RelationshipKind }[];
  updatedAt: number;
};

export type GraphAgent = {
  id: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  role?: string;
};

export type GraphRetrieval = {
  id: string;
  question: string;
  agentId?: string;
  resultCount: number;
  sourceTitles: string[];
  createdAt: number;
};

export type GraphSnapshot = {
  organizationId: string;
  organizationName: string;
  knowledge: GraphKnowledge[];
  agents: GraphAgent[];
  retrievals: GraphRetrieval[];
  truncated: Record<keyof typeof GRAPH_LIMITS, boolean>;
};
