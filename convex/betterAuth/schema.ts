import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

export default defineSchema({
  ...tables,
  member: tables.member
    .index("by_organization_user", ["organizationId", "userId"])
    .index("by_organization_role", ["organizationId", "role"]),
});
