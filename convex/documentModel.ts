import * as Y from "yjs";
import { v } from "convex/values";
import { DOCUMENT_LIMITS } from "@agent-knowledge/shared";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const documentTypeValidator = v.union(v.literal("document"), v.literal("policy"), v.literal("playbook"), v.literal("decision"), v.literal("reference"));
export const relationValidator = v.object({ targetId: v.id("knowledge"), kind: v.union(v.literal("references"), v.literal("depends_on"), v.literal("supersedes")) });

export function bytesBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

export function loadCollaborativeDocument(item: Pick<Doc<"knowledge">, "content" | "collaborationState">) {
  const doc = new Y.Doc();
  if (item.collaborationState) {
    Y.applyUpdate(doc, new Uint8Array(item.collaborationState));
  } else {
    // A deterministic seed lets two editors open the same legacy record before its first save.
    doc.clientID = 1;
    doc.getText("content").insert(0, item.content);
  }
  return doc;
}

export function documentState(item: Pick<Doc<"knowledge">, "content" | "collaborationState">): ArrayBuffer {
  if (item.collaborationState) return item.collaborationState;
  const doc = loadCollaborativeDocument(item);
  try { return bytesBuffer(Y.encodeStateAsUpdate(doc)); } finally { doc.destroy(); }
}

export function replaceDocumentContent(item: Pick<Doc<"knowledge">, "content" | "collaborationState">, content: string): ArrayBuffer {
  const doc = loadCollaborativeDocument(item);
  try {
    const text = doc.getText("content");
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, content);
    });
    const state = bytesBuffer(Y.encodeStateAsUpdate(doc));
    if (state.byteLength > DOCUMENT_LIMITS.stateBytes) throw new Error("Document editing history is full. Export this document and create a new one.");
    return state;
  } finally { doc.destroy(); }
}

export async function checkpointDocument(ctx: MutationCtx, item: Doc<"knowledge">, email?: string, force = false) {
  const latest = await ctx.db.query("knowledgeVersions").withIndex("by_knowledge", (q) => q.eq("knowledgeId", item._id)).order("desc").first();
  const changed = !latest || latest.content !== item.content || latest.title !== item.title || latest.category !== item.category || latest.status !== item.status;
  if (!changed || (!force && latest && Date.now() - latest.createdAt < 60_000)) return;
  await ctx.db.insert("knowledgeVersions", {
    knowledgeId: item._id, title: item.title, content: item.content,
    category: item.category, status: item.status, organizationId: item.organizationId,
    changedByEmail: email, createdAt: Date.now(),
  });
}
