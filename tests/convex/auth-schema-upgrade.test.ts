import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../../convex/betterAuth/schema";

const modules = import.meta.glob("../../convex/betterAuth/**/*.*s");

function createTest() {
  return convexTest(schema, modules);
}

describe("Better Auth two-factor schema upgrade", () => {
  test("accepts an enrolled record written before lockout fields existed", async () => {
    const t = createTest();
    const twoFactorId = await t.run((ctx) => ctx.db.insert("twoFactor", {
      secret: "legacy-secret",
      backupCodes: "legacy-backup-codes",
      userId: "legacy-user",
      verified: true,
    }));

    const enrolledBeforeUpgrade = await t.run((ctx) => ctx.db.get(twoFactorId));
    expect(enrolledBeforeUpgrade).toMatchObject({
      secret: "legacy-secret",
      backupCodes: "legacy-backup-codes",
      userId: "legacy-user",
      verified: true,
    });
    expect(enrolledBeforeUpgrade).not.toHaveProperty("failedVerificationCount");
    expect(enrolledBeforeUpgrade).not.toHaveProperty("lockedUntil");
  });

  test("persists lockout state added by Better Auth 1.6.33", async () => {
    const t = createTest();
    const lockedUntil = Date.now() + 15 * 60_000;
    const twoFactorId = await t.run((ctx) => ctx.db.insert("twoFactor", {
      secret: "new-secret",
      backupCodes: "new-backup-codes",
      userId: "new-user",
      verified: true,
      failedVerificationCount: 10,
      lockedUntil,
    }));

    await expect(t.run((ctx) => ctx.db.get(twoFactorId))).resolves.toMatchObject({
      failedVerificationCount: 10,
      lockedUntil,
    });
  });
});
