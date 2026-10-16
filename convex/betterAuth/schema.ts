import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

export default defineSchema({
  ...tables,
  invitation: tables.invitation
    .index("by_email_organization_status", ["email", "organizationId", "status"])
    .index("by_organization_status", ["organizationId", "status"]),
  member: tables.member
    .index("by_organization_user", ["organizationId", "userId"])
    .index("by_organization_role", ["organizationId", "role"]),
});
