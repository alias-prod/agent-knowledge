import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// Loaded relative to this file because the tests live outside the convex/ dir.
const modules = import.meta.glob("../../convex/**/*.*s");

describe("convex-test harness", () => {
  test("executes a real query against the real schema", async () => {
    const t = convexTest(schema, modules);

    const settings = await t.query(api.organizations.getOrganizationSettings, {
      organizationId: "org_harness",
    });

    expect(settings.organizationId).toBe("org_harness");
    expect(settings.displayName).toBe("ALIAS UCE Workspace");
  });

  test("returns rows seeded through the test database", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { workosUserId: "harness-user", email: "harness@example.com", createdAt: now, updatedAt: now });
      await ctx.db.insert("memberships", { userId, organizationId: "org_harness", role: "member", createdAt: now, updatedAt: now });
      await ctx.db.insert("knowledge", {
        title: "Refund policy",
        content: "Refunds are issued within 30 days.",
        category: "Company Policy",
        status: "verified",
        organizationId: "org_harness",
        createdAt: now,
        updatedAt: now,
      });
    });

    const items = await t.withIdentity({ subject: "harness-user" }).query(api.knowledge.listKnowledge, {
      organizationId: "org_harness",
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Refund policy");
  });

  test("enforces schema validation on writes", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert("knowledge", {
          title: "Missing required fields",
        } as never);
      })
    ).rejects.toThrow();
  });
});
