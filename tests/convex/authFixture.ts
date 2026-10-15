import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import authSchema from "../../convex/betterAuth/schema";
import { components } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.*s");
const authModules = import.meta.glob("../../convex/betterAuth/**/*.*s");
export function createAuthTest() {
  process.env.BETTER_AUTH_URL = "https://auth.example.test";
  process.env.CONVEX_SITE_URL = "https://test.convex.site";
  process.env.BETTER_AUTH_SECRET = "test-only-auth-secret-not-for-production-123456";
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", authSchema, authModules);
  return t;
}
export async function addIdentity(t: ReturnType<typeof createAuthTest>, options: {
  name: string; organizationId: string; role: "owner" | "admin" | "member";
  email?: string; verified?: boolean; provision?: boolean;
}) {
  const { name, organizationId, role } = options;
  const result = await t.run(async (ctx) => {
    const mapping = await ctx.db.query("authOrganizationMappings").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).unique();
    let authOrganizationId = mapping?.betterAuthOrganizationId;
    if (!authOrganizationId) {
      const org = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "organization", data: { name: organizationId, slug: organizationId, createdAt: Date.now() } } });
      authOrganizationId = org._id;
      await ctx.db.insert("authOrganizationMappings", { organizationId, betterAuthOrganizationId: authOrganizationId, source: "migration", createdAt: Date.now() });
    }
    const email = options.email ?? `${name}@example.com`;
    const user = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name, email, emailVerified: options.verified !== false, createdAt: Date.now(), updatedAt: Date.now() } } });
    const member = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "member", data: { userId: user._id, organizationId: authOrganizationId, role, createdAt: Date.now() } } });
    const session = await ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "session", data: { userId: user._id, token: crypto.randomUUID(), activeOrganizationId: authOrganizationId, createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 3600_000 } } });
    if (options.provision !== false) await ctx.db.insert("users", { betterAuthUserId: user._id, email, name, createdAt: Date.now(), updatedAt: Date.now() });
    return { userId: user._id, memberId: member._id, sessionId: session._id, authOrganizationId };
  });
  return { ...result, client: t.withIdentity({ subject: result.userId, sessionId: result.sessionId }) };
}
