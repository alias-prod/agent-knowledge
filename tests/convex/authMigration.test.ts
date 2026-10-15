import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import schema from "../../convex/schema";
import type { ApiFromModules, FunctionArgs, FunctionReturnType } from "convex/server";
import type * as migration from "../../convex/authMigration";

type Inventory = ApiFromModules<{ authMigration: typeof migration }>["authMigration"]["inventoryPage"];
const modules = import.meta.glob("../../convex/**/*.*s");
const inventory = makeFunctionReference<"query", FunctionArgs<Inventory>, FunctionReturnType<Inventory>>(
  "authMigration:inventoryPage",
);

function setup() { return convexTest(schema, modules); }
async function addUser(t: ReturnType<typeof setup>, fields = {}) {
  return t.run((ctx) => ctx.db.insert("users", {
    workosUserId: "legacy-user", email: "same@example.com", createdAt: 1, updatedAt: 1, ...fields,
  }));
}
async function addMember(t: ReturnType<typeof setup>, userId: Awaited<ReturnType<typeof addUser>>, role: "owner" | "admin" | "member" = "owner") {
  return t.run((ctx) => ctx.db.insert("memberships", {
    userId, organizationId: "workspace", role, createdAt: 1, updatedAt: 1,
  }));
}
const request = { source: "users" as const, cursor: null, limit: 2 };

describe("privileged read-only migration preflight", () => {
  test("detects duplicate legacy and target IDs without linking matching email addresses", async () => {
    const t = setup();
    await addUser(t, { betterAuthUserId: "auth-user" });
    await addUser(t, { betterAuthUserId: "auth-user" });
    const before = await t.run((ctx) => ctx.db.query("users").collect());
    const page = await t.query(inventory, request);
    expect(page.issues.filter((issue) => issue.code === "duplicate_legacy_identity")).toHaveLength(2);
    expect(page.issues.filter((issue) => issue.code === "duplicate_auth_identity")).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual(before);
    expect(await t.run((ctx) => ctx.db.query("authMigrationLinks").collect())).toEqual([]);
  });

  test("returns bounded resumable pages and never equates completion with cutover approval", async () => {
    const t = setup();
    for (let index = 0; index < 3; index++) await addUser(t, { workosUserId: `legacy-${index}` });
    const first = await t.query(inventory, request);
    const second = await t.query(inventory, { ...request, cursor: first.continueCursor });
    expect(first.scanned).toBe(2);
    expect(first.isDone).toBe(false);
    expect(second.scanned).toBe(1);
    expect(second.isDone).toBe(true);
    expect(second.readyForCutover).toBe(false);
    expect(second.scope).toBe("local_evidence_only");
    expect(first.issues.every((issue) => issue.code === "missing_auth_identity")).toBe(true);
    expect(JSON.stringify(first)).not.toContain("same@example.com");
  });

  test("flags duplicate, orphaned and ownerless memberships without promoting admins", async () => {
    const t = setup();
    const userId = await addUser(t);
    await addMember(t, userId, "admin");
    await addMember(t, userId, "admin");
    await t.run((ctx) => ctx.db.delete(userId));
    const page = await t.query(inventory, { ...request, source: "memberships" });
    expect(page.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "duplicate_membership", "orphaned_membership", "missing_workspace_owner", "missing_workspace_mapping",
    ]));
    const members = await t.run((ctx) => ctx.db.query("memberships").collect());
    expect(members.every((member) => member.role === "admin")).toBe(true);
  });

  test("detects both directions of conflicting workspace mappings", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      for (const [betterAuthOrganizationId, organizationId] of [["auth-a", "workspace"], ["auth-b", "workspace"], ["auth-a", "other-workspace"]]) {
        await ctx.db.insert("authOrganizationMappings", { betterAuthOrganizationId, organizationId, source: "migration", createdAt: 1 });
      }
    });
    const page = await t.query(inventory, { ...request, source: "authOrganizationMappings", limit: 100 });
    expect(new Set(page.issues.filter((issue) => issue.code === "conflicting_workspace_mapping").map((issue) => issue.recordId)).size).toBe(3);
  });

  test("reports missing identities and scalar legacy roles as manual-review evidence", async () => {
    const t = setup();
    await addUser(t, { workosUserId: undefined, organizationId: "workspace", role: "admin" });
    const page = await t.query(inventory, request);
    expect(page.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing_legacy_identity", "missing_auth_identity", "legacy_profile_membership_requires_review",
    ]));
  });

  test("checks empty workspaces and duplicate settings even without memberships", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < 2; index++) await ctx.db.insert("organizationSettings", {
        organizationId: "empty", displayName: "Empty", defaultKnowledgeStatus: "draft",
        defaultCanUseToAnswer: false, defaultCanUseToAct: false, createdAt: 1, updatedAt: 1,
      });
    });
    const page = await t.query(inventory, { ...request, source: "organizationSettings" });
    expect(page.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing_workspace_owner", "missing_workspace_mapping", "duplicate_workspace_settings",
    ]));
  });

  test("clean local evidence is not provider reconciliation or production approval", async () => {
    const t = setup();
    const userId = await addUser(t, { betterAuthUserId: "auth-user" });
    await addMember(t, userId);
    await t.run((ctx) => ctx.db.insert("authOrganizationMappings", {
      betterAuthOrganizationId: "auth-workspace", organizationId: "workspace", source: "migration", createdAt: 1,
    }));
    const page = await t.query(inventory, { ...request, source: "memberships" });
    expect(page.issues).toEqual([]);
    expect(page.readyForCutover).toBe(false);
  });

  test.each([0, -1, 101, 1.5])("rejects invalid page limit %s", async (limit) => {
    await expect(setup().query(inventory, { ...request, limit })).rejects.toThrow("page size");
  });
});
