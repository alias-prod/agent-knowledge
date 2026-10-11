import type { Brain, BrainNode } from "company-brain-3d";
import { documentHref, KNOWLEDGE_TYPES, RELATIONSHIP_KINDS, type GraphKnowledge, type GraphSnapshot } from "@agent-knowledge/shared";
import { ONTOLOGY_ENTITIES } from "./graph-ontology";
import { PRODUCT_SHORT_NAME } from "./brand";

export type GraphLens = "knowledge" | "context" | "ontology";
export type GraphStatus = "all" | "verified" | "draft";
export type NodeKind = "group" | "category" | "knowledge" | "agent" | "retrieval" | "type" | "field";

export const GRAPH_LENSES: { id: GraphLens; label: string; description: string }[] = [
  { id: "knowledge", label: "Knowledge", description: "Your records, organized by category." },
  { id: "context", label: "Context", description: "Agent assignments, usage permissions, and retrieval activity." },
  { id: "ontology", label: "Ontology", description: "The entity types and relationships behind your context engine." },
];

export interface ExplorerNode extends BrainNode {
  kind: NodeKind;
  entityId?: string;
  status?: GraphKnowledge["status"];
  href?: string;
  documentHref?: string;
  sourceUrl?: string;
  facts?: { label: string; value: string }[];
  children?: ExplorerNode[];
}

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
  description: string;
};

export type IndexedNode = {
  node: ExplorerNode;
  lens: GraphLens;
  path: string[];
};

export type GraphModel = {
  title: string;
  lenses: Record<GraphLens, ExplorerNode>;
  index: Map<string, IndexedNode>;
  edges: GraphEdge[];
};

export function isGraphLens(value: string | null): value is GraphLens {
  return GRAPH_LENSES.some((lens) => lens.id === value);
}

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function group(id: string, title: string, description: string, children: ExplorerNode[], kind: NodeKind = "group"): ExplorerNode {
  return { id, title, description, kind, value: countLabel(children.length, "item"), children };
}

export function groupSiblings(nodes: ExplorerNode[], parentId: string): ExplorerNode[] {
  const children = nodes.map((node) => ({
    ...node,
    ...(node.children ? { children: groupSiblings(node.children, node.id) } : {}),
  }));
  if (children.length <= 8) return children;

  const size = Math.ceil(children.length / 8);
  const groups: ExplorerNode[] = [];
  for (let start = 0; start < children.length; start += size) {
    const page = children.slice(start, start + size);
    const id = `${parentId}:group:${page[0].id}`;
    groups.push(group(
      id,
      `Items ${start + 1}–${start + page.length}`,
      `${page[0].title} through ${page[page.length - 1].title}`,
      groupSiblings(page, id),
    ));
  }
  return groups;
}

function knowledgeNode(item: GraphKnowledge): ExplorerNode {
  return {
    id: `knowledge:${item.id}`,
    entityId: `knowledge:${item.id}`,
    kind: "knowledge",
    title: item.title,
    description: item.summary,
    status: item.status,
    value: item.status === "verified" ? "Verified" : "Draft",
    href: `/knowledge/${encodeURIComponent(item.id)}`,
    documentHref: documentHref(item.id),
    sourceUrl: safeSourceUrl(item.sourceUrl),
    facts: [
      { label: "Category", value: item.category || "Uncategorized" },
      { label: "Knowledge type", value: KNOWLEDGE_TYPES.find((type) => type.id === item.documentType)?.label ?? "Document" },
      { label: "Verification", value: item.status },
      { label: "Answer permission", value: item.canUseToAnswer ? "Enabled" : "Not enabled" },
      { label: "Action permission", value: item.canUseToAct ? "Enabled" : "Not enabled" },
      { label: "Approval", value: item.requiresApproval ? "Required" : "Not required" },
    ],
  };
}

function occurrence(node: ExplorerNode, parent: string): ExplorerNode {
  return { ...node, id: `${parent}/${node.id}` };
}

export function buildGraphModel(snapshot?: GraphSnapshot): GraphModel {
  const edges: GraphEdge[] = [];
  const knowledge = (snapshot?.knowledge ?? []).map(knowledgeNode);
  const knowledgeById = new Map(knowledge.map((node) => [node.id, node]));
  const agentIds = new Set((snapshot?.agents ?? []).map((agent) => agent.id));
  const categories = new Map<string, ExplorerNode[]>();

  for (const item of snapshot?.knowledge ?? []) {
    const source = `knowledge:${item.id}`;
    if (item.parentId && item.parentId !== item.id && knowledgeById.has(`knowledge:${item.parentId}`)) {
      edges.push({ source, target: `knowledge:${item.parentId}`, label: "nested in", description: "The parent document explicitly stored on this knowledge record." });
    }
    const seen = new Set<string>();
    for (const relation of item.relations ?? []) {
      const target = `knowledge:${relation.targetId}`;
      const kind = RELATIONSHIP_KINDS.find((kind) => kind.id === relation.kind);
      const key = `${relation.kind}:${target}`;
      if (!kind || source === target || !knowledgeById.has(target) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ source, target, label: kind.label.toLowerCase(), description: "An explicit document relationship, shared with the document workspace and its backlinks." });
    }
  }

  for (const node of knowledge) {
    const category = node.facts?.[0].value ?? "Uncategorized";
    categories.set(category, [...(categories.get(category) ?? []), node]);
  }

  const knowledgeLens = group("knowledge", "Knowledge", GRAPH_LENSES[0].description,
    [...categories.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([category, nodes]) =>
      group(`category:${category}`, category, "Knowledge explicitly assigned to this category.", nodes, "category"),
    ),
  );

  const agents: ExplorerNode[] = (snapshot?.agents ?? []).map((agent) => {
    const entityId = `agent:${agent.id}`;
    const assigned: ExplorerNode[] = [];
    for (const item of snapshot?.knowledge ?? []) {
      if (!item.allowedAgentIds.includes(agent.id)) continue;
      const node = knowledgeById.get(`knowledge:${item.id}`)!;
      assigned.push(occurrence(node, entityId));
      edges.push({
        source: node.id,
        target: entityId,
        label: "assigned to",
        description: "Explicit allowedAgentIds assignment. Verification and usage permissions are separate requirements.",
      });
    }
    return {
      id: entityId, entityId, kind: "agent", title: agent.name,
      description: agent.description, value: agent.status,
      href: `/agents/${encodeURIComponent(agent.id)}`,
      facts: [
        { label: "Status", value: agent.status },
        { label: "Role", value: agent.role || "Not specified" },
        { label: "Assignments in this view", value: String(assigned.length) },
      ],
      children: assigned.length ? assigned : undefined,
    };
  });

  const retrievals: ExplorerNode[] = (snapshot?.retrievals ?? []).map((retrieval) => {
    const id = `retrieval:${retrieval.id}`;
    if (retrieval.agentId && agentIds.has(retrieval.agentId)) {
      edges.push({
        source: id, target: `agent:${retrieval.agentId}`, label: "performed by",
        description: "Connected by the agent ID stored on this retrieval event.",
      });
    }
    return {
      id, entityId: id, kind: "retrieval", title: retrieval.question,
      description: "A recorded retrieval event. Source titles are historical labels, not record-level links.",
      value: countLabel(retrieval.resultCount, "result"), href: "/retrieval-history",
      facts: [
        { label: "Result count", value: String(retrieval.resultCount) },
        { label: "Recorded source titles", value: retrieval.sourceTitles.join(" · ") || "No sources returned" },
      ],
    };
  });

  function policyGroup(id: string, title: string, description: string, predicate: (item: GraphKnowledge) => boolean) {
    return group(id, title, description, (snapshot?.knowledge ?? []).filter(predicate).map((item) =>
      occurrence(knowledgeById.get(`knowledge:${item.id}`)!, id),
    ));
  }

  const contextLens = group("context", "Context", GRAPH_LENSES[1].description, [
    group("context:agents", "Agent assignments", "Explore explicitly assigned knowledge for each agent.", agents),
    policyGroup("context:answers", "Answer-enabled", "Verified knowledge with answer permission. Agents still need explicit assignment.", (item) => item.status === "verified" && item.canUseToAnswer),
    policyGroup("context:actions", "Action-enabled", "Records with action permission enabled. This is a permission flag, not proof an action occurred.", (item) => item.canUseToAct),
    policyGroup("context:approvals", "Awaiting approval", "Knowledge flagged for human approval.", (item) => item.requiresApproval),
    policyGroup("context:unassigned", "Unassigned in view", "No assignment to an agent in the loaded snapshot. A larger workspace may have additional agents.", (item) => !item.allowedAgentIds.some((id) => agentIds.has(id))),
    group("context:retrievals", "Retrieval activity", "Recent questions and their recorded agent connections.", retrievals),
  ]);

  const ontologyNodes: ExplorerNode[] = ONTOLOGY_ENTITIES.map((entity) => {
    const id = `type:${entity.table}`;
    for (const relation of entity.relations) {
      edges.push({
        source: id, target: `type:${relation.target}`, label: relation.label,
        description: `${relation.field} — ${relation.description}`,
      });
    }
    return {
      id, entityId: id, kind: "type", title: entity.title,
      description: entity.description, value: countLabel(entity.fields.length, "field"),
      facts: [
        { label: "Convex table", value: entity.table },
        { label: "View", value: "Schema definition, not a workspace record" },
      ],
      children: entity.fields.map((field) => ({
        id: `${id}:field:${field.name}`, kind: "field", title: field.name,
        description: field.description, value: "Attribute",
        facts: [{ label: "Entity type", value: entity.title }, { label: "Table", value: entity.table }],
      })),
    };
  });

  const lenses: Record<GraphLens, ExplorerNode> = {
    knowledge: { ...knowledgeLens, children: groupSiblings(knowledgeLens.children ?? [], "knowledge") },
    context: { ...contextLens, children: groupSiblings(contextLens.children ?? [], "context") },
    ontology: group("ontology", "Ontology", GRAPH_LENSES[2].description, groupSiblings(ontologyNodes, "ontology")),
  };
  const index = new Map<string, IndexedNode>();
  function visit(node: ExplorerNode, lens: GraphLens, path: string[]) {
    const nextPath = [...path, node.id];
    index.set(node.id, { node, lens, path: nextPath });
    node.children?.forEach((child) => visit(child, lens, nextPath));
  }
  for (const lens of GRAPH_LENSES) visit(lenses[lens.id], lens.id, []);
  return { title: snapshot?.organizationName || PRODUCT_SHORT_NAME, lenses, index, edges };
}

export function filterGraphTree(root: ExplorerNode, search: string, status: GraphStatus): ExplorerNode {
  const query = search.trim().toLocaleLowerCase("en");
  function visit(node: ExplorerNode, ancestorMatches: boolean): ExplorerNode | null {
    if (node.kind === "knowledge" && status !== "all" && node.status !== status) return null;
    const matches = ancestorMatches || !query || [node.title, node.description, ...(node.facts?.map((fact) => fact.value) ?? [])]
      .join(" ").toLocaleLowerCase("en").includes(query);
    const children = node.children?.map((child) => visit(child, matches)).filter((child): child is ExplorerNode => child !== null);
    if (!matches && !children?.length) return null;
    if (node.children?.length && !children?.length) return null;
    return { ...node, ...(children ? { children } : {}) };
  }
  return { ...root, children: root.children?.map((child) => visit(child, false)).filter((child): child is ExplorerNode => child !== null) ?? [] };
}

export function listGraphNodes(root: ExplorerNode): ExplorerNode[] {
  const nodes: ExplorerNode[] = [];
  function visit(node: ExplorerNode) {
    nodes.push(node);
    node.children?.forEach(visit);
  }
  root.children?.forEach(visit);
  return nodes;
}

export function brainForLens(model: GraphModel, root: ExplorerNode): Brain {
  return { version: 1, title: model.title, children: [root] };
}
