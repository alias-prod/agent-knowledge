import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";
import { getSession } from "./auth";

type AuditLogFields = WithoutSystemFields<Doc<"auditLogs">>;

type AuditLogEntry = Omit<AuditLogFields, "actorId" | "createdAt"> &
  Partial<Pick<AuditLogFields, "actorId" | "createdAt">>;

// Caller-supplied actor hints are retained in input contracts for old clients,
// but never determine the persisted actor.
export async function writeAuditLog(ctx: MutationCtx, entry: AuditLogEntry) {
  const session = await getSession(ctx);
  if (!session) throw new Error("Unauthorized");
  return await ctx.db.insert("auditLogs", {
    ...entry,
    createdAt: Date.now(),
    actorId: session.user.id,
    actorUserId: session.user.id,
    actorEmail: session.user.email,
  });
}
