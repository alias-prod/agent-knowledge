import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/betterAuth/_generated/api";
import schema from "../../convex/betterAuth/schema";

const modules = import.meta.glob("../../convex/betterAuth/**/*.*s");

async function seedOwners(count = 1) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organization", {
      name: "Existing workspace", slug: "existing-workspace", createdAt: Date.now(),
    });
    const members = [];
    for (let index = 0; index < count; index++) {
      const userId = await ctx.db.insert("user", {
        name: `Owner ${index}`, email: `owner${index}@example.com`, emailVerified: true,
        createdAt: Date.now(), updatedAt: Date.now(),
      });
      members.push(await ctx.db.insert("member", {
        userId, organizationId, role: "owner", createdAt: Date.now(),
      }));
    }
    return { organizationId, members };
  });
  return { t, ...ids };
}

describe("Better Auth component member integrity", () => {
  test("direct plugin adapter calls cannot demote or remove the last owner", async () => {
    const { t, members } = await seedOwners();
    const where = [{ field: "_id", value: members[0] }];
    await expect(t.mutation(api.adapter.updateOne, {
      input: { model: "member", where, update: { role: "admin" } },
    })).rejects.toThrow("retain an owner");
    await expect(t.mutation(api.adapter.deleteOne, {
      input: { model: "member", where },
    })).rejects.toThrow("retain an owner");
    expect(await t.run((ctx) => ctx.db.get(members[0]))).toMatchObject({ role: "owner" });
  });

  test("bulk update and delete also retain an owner and roll back the full transaction", async () => {
    const { t, organizationId } = await seedOwners(2);
    const where = [{ field: "organizationId", value: organizationId }];
    const paginationOpts = { numItems: 100, cursor: null };
    await expect(t.mutation(api.adapter.updateMany, {
      input: { model: "member", where, update: { role: "member" } }, paginationOpts,
    })).rejects.toThrow("retain an owner");
    await expect(t.mutation(api.adapter.deleteMany, {
      input: { model: "member", where }, paginationOpts,
    })).rejects.toThrow("retain an owner");
    const owners = await t.run((ctx) => ctx.db.query("member").collect());
    expect(owners).toHaveLength(2);
    expect(owners.every((owner) => owner.role === "owner")).toBe(true);
  });

  test("concurrent demotions cannot leave the organization ownerless", async () => {
    const { t, members } = await seedOwners(2);
    await Promise.allSettled(members.map((id) => t.mutation(api.adapter.updateOne, {
      input: { model: "member", where: [{ field: "_id", value: id }], update: { role: "admin" } },
    })));
    const remaining = await t.run((ctx) => ctx.db.query("member")
      .filter((q) => q.eq(q.field("role"), "owner")).collect());
    expect(remaining).toHaveLength(1);
  });

  test("an owner may be demoted when another owner remains", async () => {
    const { t, members } = await seedOwners(2);
    await t.mutation(api.adapter.updateOne, {
      input: { model: "member", where: [{ field: "_id", value: members[0] }], update: { role: "admin" } },
    });
    expect(await t.run((ctx) => ctx.db.get(members[0]))).toMatchObject({ role: "admin" });
  });

  test("rejects duplicate membership and unsupported compound roles", async () => {
    const { t, members } = await seedOwners();
    const member = await t.run((ctx) => ctx.db.get(members[0]));
    await expect(t.mutation(api.adapter.create, {
      input: { model: "member", data: {
        userId: member!.userId, organizationId: member!.organizationId,
        role: "member", createdAt: Date.now(),
      } },
    })).rejects.toThrow("Duplicate organization membership");
    await expect(t.mutation(api.adapter.updateOne, {
      input: { model: "member", where: [{ field: "_id", value: members[0] }], update: { role: "owner,admin" } },
    })).rejects.toThrow("Unsupported organization role");
  });

  test("cannot transfer a membership identity to another user or organization", async () => {
    const { t, members } = await seedOwners(2);
    for (const update of [{ userId: "another-user" }, { organizationId: "another-organization" }]) {
      await expect(t.mutation(api.adapter.updateOne, {
        input: { model: "member", where: [{ field: "_id", value: members[0] }], update },
      })).rejects.toThrow("Membership identity cannot be changed");
    }
  });
});

describe("live session organization authorization", () => {
  async function sessionFixture() {
    const { t, members, organizationId } = await seedOwners();
    const member = await t.run((ctx) => ctx.db.get(members[0]));
    const sessionId = await t.run((ctx) => ctx.db.insert("session", {
      token: "test-only-session-token", userId: member!.userId, activeOrganizationId: organizationId,
      createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 60_000,
    }));
    return { t, membershipId: members[0], sessionId, userId: member!.userId, organizationId };
  }

  test("accepts only a verified user with a live session and active membership", async () => {
    const { t, sessionId, userId, organizationId } = await sessionFixture();
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId }))
      .resolves.toMatchObject({ userId, role: "owner", email: "owner0@example.com" });
    await expect(t.query(api.access.getSessionMembership, {
      sessionId, userId, organizationId: "wrong-org",
    })).resolves.toBeNull();
    await expect(t.query(api.access.getSessionMembership, {
      sessionId, userId: "wrong-user", organizationId,
    })).resolves.toBeNull();
  });

  test("membership removal takes effect despite a still-valid session", async () => {
    const { t, membershipId, sessionId, userId, organizationId } = await sessionFixture();
    await t.run((ctx) => ctx.db.delete(membershipId));
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId })).resolves.toBeNull();
  });

  test("expired and revoked sessions cannot authorize workspace access", async () => {
    const { t, sessionId, userId, organizationId } = await sessionFixture();
    await t.run((ctx) => ctx.db.patch(sessionId, { expiresAt: Date.now() - 1 }));
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId })).resolves.toBeNull();
    await t.run((ctx) => ctx.db.delete(sessionId));
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId })).resolves.toBeNull();
  });

  test("organization switching invalidates the old workspace selector", async () => {
    const { t, sessionId, userId, organizationId } = await sessionFixture();
    await t.run((ctx) => ctx.db.patch(sessionId, { activeOrganizationId: "next-org" }));
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId })).resolves.toBeNull();
  });

  test("an unverified user is denied even when a membership exists", async () => {
    const { t, sessionId, userId, organizationId } = await sessionFixture();
    await t.run(async (ctx) => {
      const id = ctx.db.normalizeId("user", userId)!;
      await ctx.db.patch(id, { emailVerified: false });
    });
    await expect(t.query(api.access.getSessionMembership, { sessionId, userId, organizationId })).resolves.toBeNull();
  });
});
