import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.*s");

async function seedAdmin(
  t: ReturnType<typeof convexTest>,
  workosUserId: string,
  organizationId: string
) {
  const now = Date.now();

  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId,
      email: `${workosUserId}@example.com`,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("memberships", {
      userId,
      organizationId,
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedTargetMember(
  t: ReturnType<typeof convexTest>,
  organizationId: string
) {
  const now = Date.now();

  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      workosUserId: "workos_target_member",
      email: "target@example.com",
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.insert("memberships", {
      userId,
      organizationId,
      role: "member",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("profile provisioning and membership reads", () => {
  const profile = {
    workosUserId: "workos_admin",
    email: "forged@example.com",
    name: "Forged name",
    organizationId: "org_test",
  };

  test("rejects anonymous profile provisioning without writing users or memberships", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.upsertCurrentUser, profile)).rejects.toThrow("Unauthorized");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("users").collect()).toEqual([]);
      expect(await ctx.db.query("memberships").collect()).toEqual([]);
    });
  });

  test("does not bootstrap an authenticated stranger into an admin", async () => {
    const t = convexTest(schema, modules);
    const stranger = t.withIdentity({ subject: profile.workosUserId });
    await expect(stranger.mutation(api.users.upsertCurrentUser, profile)).rejects.toThrow("Unauthorized");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("memberships").collect()).toEqual([]);
    });
  });

  test("cannot refresh another user's profile using a forged identity argument", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, "workos_admin", "org_test");
    await seedAdmin(t, "workos_other", "org_test");
    const other = t.withIdentity({ subject: "workos_other" });
    await expect(other.mutation(api.users.upsertCurrentUser, profile)).rejects.toThrow("Unauthorized");
  });

  test("refreshes only verified profile claims without changing membership roles", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, "workos_admin", "org_test");
    const actor = t.withIdentity({
      subject: "workos_admin",
      email: "verified@example.com",
      name: "Verified name",
    });
    const userId = await actor.mutation(api.users.upsertCurrentUser, profile);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(userId)).toMatchObject({ email: "verified@example.com", name: "Verified name" });
      const memberships = await ctx.db.query("memberships").collect();
      expect(memberships).toHaveLength(1);
      expect(memberships[0].role).toBe("admin");
    });
    await expect(actor.mutation(api.users.upsertCurrentUser, { ...profile, organizationId: "other_org" })).rejects.toThrow("Unauthorized");
  });

  test("restricts membership lookup to the verified actor in an authorized organization", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, "workos_admin", "org_test");
    const args = { workosUserId: "workos_admin", organizationId: "org_test" };
    await expect(t.query(api.users.getMembershipByWorkosUser, args)).rejects.toThrow("Unauthorized");
    const actor = t.withIdentity({ subject: "workos_admin" });
    await expect(actor.query(api.users.getMembershipByWorkosUser, args)).resolves.toMatchObject({ membership: { role: "admin" } });
    await expect(actor.query(api.users.getMembershipByWorkosUser, { ...args, workosUserId: "someone_else" })).rejects.toThrow("Unauthorized");
    await expect(actor.query(api.users.getMembershipByWorkosUser, { ...args, organizationId: "other_org" })).rejects.toThrow("Unauthorized");
  });

  test("restricts the member directory to live workspace members", async () => {
    const t = convexTest(schema, modules);
    await seedAdmin(t, "workos_admin", "org_test");
    await expect(t.query(api.users.listMembers, { organizationId: "org_test" })).rejects.toThrow("Unauthorized");
    const actor = t.withIdentity({ subject: "workos_admin" });
    await expect(actor.query(api.users.listMembers, { organizationId: "org_test" })).resolves.toHaveLength(1);
    await expect(actor.query(api.users.listMembers, { organizationId: "other_org" })).rejects.toThrow("Unauthorized");
    await t.run(async (ctx) => {
      const membership = await ctx.db.query("memberships").first();
      await ctx.db.delete(membership!._id);
    });
    await expect(actor.query(api.users.listMembers, { organizationId: "org_test" })).rejects.toThrow("Unauthorized");
  });
});

describe("users.ts mutation authorization", () => {
  describe("updateMemberRole", () => {
    test("authorizes using ctx.auth's verified identity, ignoring an unprivileged caller-supplied workosUserId", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_verified_admin", "org_test");
      const membershipId = await seedTargetMember(t, "org_test");

      const asVerifiedAdmin = t.withIdentity({ subject: "workos_verified_admin" });

      await expect(
        asVerifiedAdmin.mutation(api.users.updateMemberRole, {
          membershipId,
          role: "admin",
          organizationId: "org_test",
          workosUserId: "workos_no_membership",
        })
      ).resolves.not.toThrow();
    });

    test("rejects when ctx.auth's verified identity lacks admin membership, even if the caller-supplied workosUserId would qualify", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");
      const membershipId = await seedTargetMember(t, "org_test");

      const asUnprivilegedUser = t.withIdentity({ subject: "workos_no_membership" });

      await expect(
        asUnprivilegedUser.mutation(api.users.updateMemberRole, {
          membershipId,
          role: "admin",
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });

    test("rejects the caller when ctx.auth has no identity, even if workosUserId would qualify as admin", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");
      const membershipId = await seedTargetMember(t, "org_test");

      await expect(
        t.mutation(api.users.updateMemberRole, {
          membershipId,
          role: "admin",
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("removeMember", () => {
    test("rejects when ctx.auth's verified identity lacks admin membership, even if the caller-supplied workosUserId would qualify", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");
      const membershipId = await seedTargetMember(t, "org_test");

      const asUnprivilegedUser = t.withIdentity({ subject: "workos_no_membership" });

      await expect(
        asUnprivilegedUser.mutation(api.users.removeMember, {
          membershipId,
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });

    test("rejects the caller when ctx.auth has no identity, even if workosUserId would qualify as admin", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");
      const membershipId = await seedTargetMember(t, "org_test");

      await expect(
        t.mutation(api.users.removeMember, {
          membershipId,
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("inviteMember", () => {
    test("rejects when ctx.auth's verified identity lacks admin membership, even if the caller-supplied workosUserId would qualify", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");

      const asUnprivilegedUser = t.withIdentity({ subject: "workos_no_membership" });

      await expect(
        asUnprivilegedUser.mutation(api.users.inviteMember, {
          email: "new-member@example.com",
          role: "member",
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });

    test("rejects the caller when ctx.auth has no identity, even if workosUserId would qualify as admin", async () => {
      const t = convexTest(schema, modules);
      await seedAdmin(t, "workos_admin", "org_test");

      await expect(
        t.mutation(api.users.inviteMember, {
          email: "new-member@example.com",
          role: "member",
          organizationId: "org_test",
          workosUserId: "workos_admin",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
