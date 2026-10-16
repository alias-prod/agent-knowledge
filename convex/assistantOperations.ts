import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { getSession } from "./auth";
import { requireMembershipForIdentity } from "./permissions";
import { checkpointDocument, documentState, replaceDocumentContent } from "./documentModel";
import { writeAuditLog } from "./audit";
import { LIMITS, requireText } from "./validation";

const scope = { organizationId: v.string(), requestId: v.string() };
async function requestAccess(ctx: MutationCtx, organizationId: string, requestId: string, running = false) {
  const actor = await requireMembershipForIdentity(ctx, organizationId);
  const session = await getSession(ctx);
  const request = await ctx.db.query("assistantRequests").withIndex("by_actor_request", q => q.eq("actorId", actor.identity.subject).eq("requestId", requestId)).unique();
  if (!request || request.organizationId !== organizationId || request.sessionId !== session?.session.id || request.expiresAt <= Date.now() || ["cancelled", "failed"].includes(request.status) || running && request.status !== "running") throw new Error("Assistant request is no longer active");
  return { ...actor, request };
}
export const beginRequest = mutation({
  args: { ...scope, historyEnabled: v.boolean(), shortcut: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireMembershipForIdentity(ctx, args.organizationId);
    const session = await getSession(ctx);
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(args.requestId)) throw new Error("Invalid request identity");
    const now = Date.now();
    const recent = await ctx.db.query("assistantRequests").withIndex("by_actor_created", q => q.eq("actorId", actor.identity.subject).gt("createdAt", now - 60_000)).take(7);
    if (recent.length >= 6 || recent.some(r => r.status === "running" && r.expiresAt > now)) throw new Error("Wait for the current request, or try again in a minute");
    const existing = await ctx.db.query("assistantRequests").withIndex("by_actor_request", q => q.eq("actorId", actor.identity.subject).eq("requestId", args.requestId)).unique();
    if (existing) throw new Error("Request already used");
    await ctx.db.insert("assistantRequests", { organizationId: args.organizationId, requestId: args.requestId, historyEnabled: args.historyEnabled, actorId: actor.identity.subject, sessionId: session!.session.id, status: "running", createdAt: now, expiresAt: now + 5 * 60_000, model: args.shortcut ? "none-shortcut" : "openai/gpt-6-luna", libraryVersion: "alias-assistant-1" });
    return { actorId: actor.identity.subject };
  },
});
export const finishRequest = mutation({
  args: { ...scope, failed: v.boolean(), inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()), question: v.optional(v.string()), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { request } = await requestAccess(ctx, args.organizationId, args.requestId, true);
    for (const value of [args.inputTokens, args.outputTokens]) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000)) throw new Error("Invalid usage");
    await ctx.db.patch(request._id, { status: args.failed ? "failed" : "complete", inputTokens: args.inputTokens, outputTokens: args.outputTokens });
    if (!args.failed && request.historyEnabled && args.question && args.message) {
      if (args.question.length > 2000 || args.message.length > 30_000) throw new Error("Message too long");
      await ctx.db.insert("assistantMessages", { organizationId: args.organizationId, actorId: request.actorId, requestId: args.requestId, question: args.question, message: args.message, createdAt: Date.now(), expiresAt: Date.now() + 7 * 86400_000 });
    }
    return null;
  },
});
export const cancelRequest = mutation({ args: scope, handler: async (ctx, args) => {
  const actor = await requireMembershipForIdentity(ctx, args.organizationId);
  const request = await ctx.db.query("assistantRequests").withIndex("by_actor_request", q => q.eq("actorId", actor.identity.subject).eq("requestId", args.requestId)).unique();
  if (!request || request.organizationId !== args.organizationId) return null;
  await ctx.db.patch(request._id, { status: "cancelled" });
  const operations = await ctx.db.query("assistantOperations").withIndex("by_actor_request", q => q.eq("actorId", actor.identity.subject).eq("requestId", args.requestId)).take(10);
  for (const operation of operations) if (operation.status === "proposed") await ctx.db.patch(operation._id, { status: "cancelled", title: "", content: "", beforeTitle: undefined, beforeContent: undefined });
  return null;
} });
export const proposeDraft = mutation({
  args: { ...scope, title: v.string(), content: v.string(), targetId: v.optional(v.id("knowledge")), expectedUpdatedAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { request, membership } = await requestAccess(ctx, args.organizationId, args.requestId, true);
    if (!["owner", "admin"].includes(membership.role)) throw new Error("Unauthorized");
    const title = requireText(args.title, "Title", LIMITS.title);
    if (args.content.length > 20_000) throw new Error("Draft is too long");
    let beforeTitle: string | undefined;
    let beforeContent: string | undefined;
    if (args.targetId) {
      const target = await ctx.db.get(args.targetId);
      if (!target || target.organizationId !== args.organizationId || target.updatedAt !== args.expectedUpdatedAt) throw new Error("The document has changed. Open it and prepare a new proposal.");
      if (target.content.length > 20_000) throw new Error("Open the document editor to change a document this large.");
      beforeTitle = target.title; beforeContent = target.content;
    } else if (args.expectedUpdatedAt !== undefined) throw new Error("Invalid revision");
    const prior = await ctx.db.query("assistantOperations").withIndex("by_actor_request", q => q.eq("actorId", request.actorId).eq("requestId", args.requestId)).first();
    if (prior) throw new Error("Only one proposed change is allowed per request");
    return await ctx.db.insert("assistantOperations", { organizationId: args.organizationId, actorId: request.actorId, sessionId: request.sessionId, requestId: args.requestId, kind: args.targetId ? "edit" : "create", title, content: args.content, targetId: args.targetId, expectedUpdatedAt: args.expectedUpdatedAt, beforeTitle, beforeContent, status: "proposed", createdAt: Date.now(), expiresAt: request.expiresAt });
  },
});
export const listOperations = query({ args: scope, handler: async (ctx, args) => {
  const actor = await requireMembershipForIdentity(ctx, args.organizationId);
  const session = await getSession(ctx);
  const rows = await ctx.db.query("assistantOperations").withIndex("by_actor_request", q => q.eq("actorId", actor.identity.subject).eq("requestId", args.requestId)).take(10);
  return rows.filter(row => row.organizationId === args.organizationId && row.sessionId === session?.session.id);
} });
export const commitDraft = mutation({ args: { organizationId: v.string(), operationId: v.id("assistantOperations") }, handler: async (ctx, args) => {
  const actor = await requireMembershipForIdentity(ctx, args.organizationId);
  if (!["owner", "admin"].includes(actor.membership.role)) throw new Error("Unauthorized");
  const session = await getSession(ctx);
  const operation = await ctx.db.get(args.operationId);
  if (!operation || operation.organizationId !== args.organizationId || operation.actorId !== actor.identity.subject || operation.sessionId !== session?.session.id) throw new Error("Unauthorized");
  if (operation.status === "committed") return operation.resultId!;
  if (operation.status !== "proposed" || operation.expiresAt <= Date.now()) throw new Error("This proposal is no longer available");
  await requestAccess(ctx, args.organizationId, operation.requestId);
  const now = Date.now();
  let id = operation.targetId;
  if (id) {
    const target = await ctx.db.get(id);
    if (!target || target.organizationId !== args.organizationId || target.updatedAt !== operation.expectedUpdatedAt) throw new Error("Document changed. Prepare a new proposal; no changes were saved.");
    await checkpointDocument(ctx, target, actor.identity.email, true);
    await ctx.db.patch(id, { title: operation.title, content: operation.content, collaborationState: replaceDocumentContent(target, operation.content), status: "draft", requiresApproval: true, metadataRevision: (target.metadataRevision ?? 0) + 1, updatedAt: Math.max(now, target.updatedAt + 1) });
  } else {
    id = await ctx.db.insert("knowledge", { organizationId: args.organizationId, title: operation.title, content: operation.content, category: "General", documentType: "document", status: "draft", requiresApproval: true, canUseToAnswer: false, canUseToAct: false, allowedAgentIds: [], relations: [], ownerId: actor.identity.subject, ownerEmail: actor.identity.email, collaborationState: documentState({ content: operation.content }), metadataRevision: 0, createdAt: now, updatedAt: now });
    await checkpointDocument(ctx, (await ctx.db.get(id))!, actor.identity.email, true);
  }
  await writeAuditLog(ctx, { action: operation.kind === "create" ? "created" : "updated", organizationId: args.organizationId, knowledgeId: id, knowledgeTitle: operation.title, metadata: { surface: "assistant", operationId: operation._id } });
  await ctx.db.patch(operation._id, { status: "committed", resultId: id, title: "", content: "", beforeTitle: undefined, beforeContent: undefined });
  return id;
} });
export const history = query({ args: { organizationId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireMembershipForIdentity(ctx, args.organizationId);
  return (await ctx.db.query("assistantMessages").withIndex("by_actor_workspace", q => q.eq("actorId", actor.identity.subject).eq("organizationId", args.organizationId)).order("desc").take(20)).filter(row => row.expiresAt > Date.now());
} });
export const deleteHistory = mutation({ args: { organizationId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireMembershipForIdentity(ctx, args.organizationId);
  const rows = await ctx.db.query("assistantMessages").withIndex("by_actor_workspace", q => q.eq("actorId", actor.identity.subject).eq("organizationId", args.organizationId)).take(100);
  for (const row of rows) await ctx.db.delete(row._id);
  return { remaining: rows.length === 100 };
} });
export const cleanupExpired = internalMutation({ args: {}, handler: async ctx => {
  const now = Date.now();
  for (const table of ["assistantMessages", "assistantOperations", "assistantRequests"] as const) {
    const rows = await ctx.db.query(table).withIndex("by_expiry", q => q.lt("expiresAt", now - (table === "assistantRequests" ? 86400_000 : 0))).take(100);
    for (const row of rows) await ctx.db.delete(row._id);
  }
} });
