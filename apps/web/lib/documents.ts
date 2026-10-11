import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { DOCUMENT_LIMITS } from "@agent-knowledge/shared";

export type DocumentListing = FunctionReturnType<typeof api.knowledge.listDocuments>;
export type DocumentSummary = DocumentListing["documents"][number];
export type WorkspaceDocument = NonNullable<FunctionReturnType<typeof api.knowledge.getDocument>>;
export type DocumentVersion = FunctionReturnType<typeof api.knowledge.listDocumentVersions>[number];
export type DocumentConnection = FunctionReturnType<typeof api.knowledge.findDocumentConnections>["outgoing"][number];

export function updateDocumentParams(values: Record<string, string | null>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history[push ? "pushState" : "replaceState"](null, "", `${url.pathname}${url.search}`);
}

export function documentTree(documents: DocumentSummary[]) {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  function depth(doc: DocumentSummary) {
    let level = 0;
    let parent = doc.parentId;
    const visited = new Set<string>([doc.id]);
    while (parent && byId.has(parent) && !visited.has(parent) && level < DOCUMENT_LIMITS.depth) {
      visited.add(parent);
      level++;
      parent = byId.get(parent)?.parentId;
    }
    return level;
  }
  const result: { document: DocumentSummary; depth: number }[] = [];
  const visited = new Set<string>();
  function visit(doc: DocumentSummary, level: number) {
    if (visited.has(doc.id)) return;
    visited.add(doc.id);
    result.push({ document: doc, depth: level });
    documents.filter((child) => child.parentId === doc.id).sort((a, b) => a.title.localeCompare(b.title)).forEach((child) => visit(child, Math.min(level + 1, DOCUMENT_LIMITS.depth)));
  }
  documents.filter((doc) => !doc.parentId || !byId.has(doc.parentId)).sort((a, b) => a.title.localeCompare(b.title)).forEach((doc) => visit(doc, 0));
  documents.filter((doc) => !visited.has(doc.id)).forEach((doc) => visit(doc, depth(doc)));
  return result;
}

export function documentError(error: unknown) {
  const message = error instanceof Error ? error.message : "Check your connection and try again.";
  return message.replace(/^[\s\S]*Uncaught Error:\s*/, "").split("\n")[0];
}

export function downloadDocument(title: string, content: string) {
  const blob = new Blob([`# ${title}\n\n${content}`], { type: "text/markdown;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${title.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 100) || "document"}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
