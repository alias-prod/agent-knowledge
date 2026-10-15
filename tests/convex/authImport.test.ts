import { describe, expect, test } from "vitest";
import { api, internal, components } from "../../convex/_generated/api";
import { createAuthTest } from "./authFixture";

async function fixture(role: "owner" | "member" = "owner") {
  const t = createAuthTest();
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { workosUserId: "legacy-owner", email: "owner@example.com", name: "Legacy Owner", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("memberships", { userId: id, organizationId: "stable-workspace", role, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("knowledge", { title: "Existing policy", content: "Unchanged", category: "Policy", status: "verified", organizationId: "stable-workspace", ownerId: "legacy-owner", createdAt: 1, updatedAt: 1 });
    return id;
  });
  const args = { runId: "reviewed-run", organizationId: "stable-workspace", workspaceName: "Legacy Workspace", reviewedBy: "migration-operator", backupReference: "restorable-backup-001", providerEvidenceDigest: "reviewed-provider-inventory", cursor: null, limit: 1, identities: [{ userId, workosUserId: "legacy-owner", emailVerified: true as const }] };
  return { t, userId, args };
}

describe("reviewed identity importer", () => {
  test("defaults to a read-only dry run", async () => {
    const { t, args, userId } = await fixture();
    expect(await t.mutation(internal.authImport.importReviewedPage, args)).toMatchObject({ scanned: 1, committed: false, isDone: true });
    expect(await t.run((ctx) => ctx.db.query("authOrganizationMappings").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(userId))).not.toHaveProperty("betterAuthUserId");
  });
  test("preserves stable users, workspace and knowledge IDs and makes retries idempotent", async () => {
    const { t, args, userId } = await fixture();
    await t.mutation(internal.authImport.importReviewedPage, { ...args, commit: true });
    expect(await t.mutation(internal.authImport.importReviewedPage, { ...args, commit: true })).toMatchObject({ committed: true, replay: true });
    const profile = await t.run((ctx) => ctx.db.get(userId));
    expect(profile?.betterAuthUserId).toBeTruthy();
    const rows = await t.run((ctx) => ctx.db.query("knowledge").collect());
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ organizationId: "stable-workspace", ownerId: "legacy-owner", content: "Unchanged" });
    expect(await t.run((ctx) => ctx.db.query("authMigrationLinks").collect())).toHaveLength(1);
  });
  test("requires reconciled ownership and rolls back a failed page atomically", async () => {
    const { t, args, userId } = await fixture("member");
    await expect(t.mutation(internal.authImport.importReviewedPage, { ...args, commit: true })).rejects.toThrow("ownership");
    expect(await t.run((ctx) => ctx.db.get(userId))).not.toHaveProperty("betterAuthUserId");
    expect(await t.run((ctx) => ctx.db.query("authMigrationRuns").collect())).toEqual([]);
  });
  test("does not silently link an existing account by matching email", async () => {
    const { t, args } = await fixture();
    await t.run((ctx) => ctx.runMutation(components.betterAuth.adapter.create, { input: { model: "user", data: { name: "Existing account", email: "owner@example.com", emailVerified: false, createdAt: 1, updatedAt: 1 } } }));
    await expect(t.mutation(internal.authImport.importReviewedPage, { ...args, commit: true })).rejects.toThrow("reconciliation");
  });
  test("requires reviewed legacy identity evidence and rejects mismatches", async () => {
    const { t, args } = await fixture();
    await expect(t.mutation(internal.authImport.importReviewedPage, { ...args, identities: [] })).rejects.toThrow("reviewed identity");
    await expect(t.mutation(internal.authImport.importReviewedPage, { ...args, identities: [{ ...args.identities[0], workosUserId: "forged" }] })).rejects.toThrow("reconciliation");
    await expect(t.mutation(internal.authImport.importReviewedPage, { ...args, backupReference: "" })).rejects.toThrow("backup");
  });
  test("old provider sessions cannot access imported data", async () => {
    const { t, args } = await fixture();
    await t.mutation(internal.authImport.importReviewedPage, { ...args, commit: true });
    await expect(t.withIdentity({ subject: "legacy-owner" }).query(api.knowledge.listKnowledge, { organizationId: "stable-workspace" })).rejects.toThrow("Unauthorized");
  });
});
