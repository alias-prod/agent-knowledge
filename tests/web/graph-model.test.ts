import { describe, expect, test } from "vitest";
import type { GraphSnapshot } from "@agent-knowledge/shared";
import { buildGraphModel, filterGraphTree, groupSiblings, listGraphNodes, safeSourceUrl, type ExplorerNode } from "../../apps/web/lib/graph";
import { ONTOLOGY_ENTITIES } from "../../apps/web/lib/graph-ontology";

const snapshot: GraphSnapshot = {
  organizationId: "org-a", organizationName: "Workspace A",
  knowledge: [
    { id: "policy", title: "Refund policy", summary: "Refunds within 30 days.", category: "Policies", status: "verified", canUseToAnswer: true, canUseToAct: false, requiresApproval: true, allowedAgentIds: ["support"], updatedAt: 1 },
    { id: "draft", title: "Draft launch plan", summary: "Internal launch planning.", category: "Operations", status: "draft", canUseToAnswer: true, canUseToAct: true, requiresApproval: false, allowedAgentIds: [], updatedAt: 2 },
  ],
  agents: [
    { id: "support", name: "Support", description: "Customer support.", status: "active" },
    { id: "other", name: "Other agent", description: "No assignments.", status: "disabled" },
  ],
  retrievals: [{ id: "retrieval", question: "Can I get a refund?", agentId: "support", resultCount: 1, sourceTitles: ["Refund policy"], createdAt: 1 }],
  truncated: { knowledge: false, agents: false, retrievals: false },
};

describe("company brain graph adapter", () => {
  test("exposes the actual ontology without inventing workspace records", () => {
    const graph = buildGraphModel();
    expect(graph.lenses.ontology.children).toHaveLength(8);
    expect(graph.lenses.knowledge.children).toEqual([]);
    expect(graph.edges.every((edge) => edge.source.startsWith("type:"))).toBe(true);
    expect(graph.index.get("type:knowledge:field:allowedAgentIds")?.node.description).toContain("empty list does not grant access");
    expect(graph.index.get("type:retrievalLogs:field:sourceTitles")?.node.description).toContain("not treated as record-level graph edges");
  });

  test("builds all three lenses and only explicit record relationships", () => {
    const graph = buildGraphModel(snapshot);
    expect(Object.keys(graph.lenses)).toEqual(["knowledge", "context", "ontology"]);
    const edges = graph.edges.filter((edge) => !edge.source.startsWith("type:"));
    expect(edges).toHaveLength(2);
    expect(edges).toContainEqual(expect.objectContaining({ source: "knowledge:policy", target: "agent:support", label: "assigned to" }));
    expect(edges).toContainEqual(expect.objectContaining({ source: "retrieval:retrieval", target: "agent:support", label: "performed by" }));
    expect(edges.some((edge) => edge.target === "agent:other")).toBe(false);
    expect(edges.some((edge) => edge.source.startsWith("retrieval:") && edge.target.startsWith("knowledge:"))).toBe(false);
  });

  test("keeps usage flags, verification, and approval separate", () => {
    const graph = buildGraphModel(snapshot);
    expect(graph.index.get("context:answers")?.node.children?.map((node) => node.entityId)).toEqual(["knowledge:policy"]);
    expect(graph.index.get("context:actions")?.node.children?.map((node) => node.entityId)).toEqual(["knowledge:draft"]);
    expect(graph.index.get("context:approvals")?.node.children?.map((node) => node.entityId)).toEqual(["knowledge:policy"]);
    expect(graph.index.get("context:unassigned")?.node.children?.map((node) => node.entityId)).toEqual(["knowledge:draft"]);
  });

  test("filters records while preserving the matching hierarchy", () => {
    const root = buildGraphModel(snapshot).lenses.knowledge;
    const filtered = filterGraphTree(root, "refund", "verified");
    expect(filtered.children?.map((node) => node.title)).toEqual(["Policies"]);
    expect(listGraphNodes(filtered).find((node) => node.kind === "knowledge")?.title).toBe("Refund policy");
    expect(filterGraphTree(root, "refund", "draft").children).toEqual([]);
    expect(filterGraphTree(root, "does-not-exist", "all").children).toEqual([]);
    expect(listGraphNodes(filterGraphTree(root, "policies", "all")).some((node) => node.id === "knowledge:policy")).toBe(true);
  });

  test("pages crowded regions without losing nodes or duplicating IDs", () => {
    const records: ExplorerNode[] = Array.from({ length: 120 }, (_, index) => ({ id: `record-${index}`, title: `Record ${index}`, kind: "knowledge" }));
    const root: ExplorerNode = { id: "root", title: "Root", kind: "group", children: groupSiblings(records, "root") };
    const all = listGraphNodes(root);
    expect(root.children!.length).toBeLessThanOrEqual(8);
    expect(all.every((node) => !node.children || node.children.length <= 8)).toBe(true);
    expect(all.filter((node) => node.kind === "knowledge")).toHaveLength(120);
    expect(new Set(all.map((node) => node.id)).size).toBe(all.length);
  });

  test("keeps canonical relationship targets reachable across lenses", () => {
    const graph = buildGraphModel(snapshot);
    for (const edge of graph.edges) {
      expect(graph.index.has(edge.source)).toBe(true);
      expect(graph.index.has(edge.target)).toBe(true);
    }
    expect(graph.index.get("agent:support/knowledge:policy")?.node.entityId).toBe("knowledge:policy");
    expect(graph.index.get("agent:support")?.lens).toBe("context");
    expect(graph.index.get("knowledge:policy")?.lens).toBe("knowledge");
  });

  test.each(["javascript:alert(1)", "data:text/html,bad", "not a url", "file:///etc/passwd"])("rejects unsafe source URL %s", (url) => {
    expect(safeSourceUrl(url)).toBeUndefined();
  });

  test("allows ordinary web source URLs", () => {
    expect(safeSourceUrl("https://example.com/policy")).toBe("https://example.com/policy");
  });

  test("ontology relation targets are declared entity types", () => {
    const tables = new Set(ONTOLOGY_ENTITIES.map((entity) => entity.table));
    for (const entity of ONTOLOGY_ENTITIES) {
      for (const relation of entity.relations) expect(tables.has(relation.target)).toBe(true);
    }
  });
});
