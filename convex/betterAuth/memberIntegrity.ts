import { Triggers } from "convex-helpers/server/triggers";
import type { DataModelFromSchemaDefinition } from "convex/server";
import schema from "./schema";

type AuthDataModel = DataModelFromSchemaDefinition<typeof schema>;
export const memberIntegrity = new Triggers<AuthDataModel>();

memberIntegrity.register("member", async (ctx, { oldDoc, newDoc }) => {
  if (newDoc) {
    if (!["owner", "admin", "member"].includes(newDoc.role)) {
      throw new Error("Unsupported organization role");
    }
    if (oldDoc && (oldDoc.organizationId !== newDoc.organizationId || oldDoc.userId !== newDoc.userId)) {
      throw new Error("Membership identity cannot be changed");
    }
    const duplicates = await ctx.db.query("member")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", newDoc.organizationId).eq("userId", newDoc.userId))
      .take(2);
    if (duplicates.length !== 1) throw new Error("Duplicate organization membership");
  }
  if (oldDoc?.role === "owner" && newDoc?.role !== "owner") {
    // A plugin hook alone races: this indexed read and the write must share a transaction.
    const remainingOwner = await ctx.db.query("member")
      .withIndex("by_organization_role", (q) =>
        q.eq("organizationId", oldDoc.organizationId).eq("role", "owner"))
      .first();
    if (!remainingOwner) throw new Error("An organization must retain an owner");
  }
});
