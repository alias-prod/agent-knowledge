import { expect, test } from "vitest";
import { internal, components } from "../../convex/_generated/api";
import { createAuthTest } from "./authFixture";

test("rollback detects revoked access and changed roles without restoring legacy permissions", async () => {
  const t = createAuthTest();
  const identities = await t.run(async ctx => {
    const rows = [];
    for (let index = 0; index < 2; index++) {
      const userId = await ctx.db.insert("users", { workosUserId: `legacy-${index}`, email: `rollback-${index}@example.test`, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("memberships", { userId, organizationId: "legacy-workspace", role: index === 0 ? "owner" : "admin", createdAt: 1, updatedAt: 1 });
      rows.push({ userId, workosUserId: `legacy-${index}`, emailVerified: true as const });
    }
    return rows;
  });
  await t.mutation(internal.authImport.importReviewedPage, { runId: "rollback-reviewed", organizationId: "legacy-workspace", workspaceName: "Legacy", reviewedBy: "operator", backupReference: "isolated-restorable-backup", providerEvidenceDigest: "reviewed", cursor: null, limit: 50, identities, commit: true });
  const before = await t.query(internal.authRollback.reviewPage, { runId: "rollback-reviewed", cursor: null, limit: 50 });
  expect(before.conflicts).toEqual([]); expect(before.automaticRollbackAllowed).toBe(false);
  await t.run(async ctx => {
    const profile = await ctx.db.get(identities[1]!.userId);
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "member", where: [{ field: "userId", value: profile!.betterAuthUserId! }] } });
  });
  const after = await t.query(internal.authRollback.reviewPage, { runId: "rollback-reviewed", cursor: null, limit: 50 });
  expect(after.conflicts).toContainEqual({ userId: identities[1]!.userId, reason: "removed_after_cutover_do_not_restore_access" });
  expect(after.automaticRollbackAllowed).toBe(false);
});
