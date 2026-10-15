import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createAuthTest, addIdentity } from "./authFixture";
describe("convex-test harness", () => {
  test("executes a protected query against the real schema and auth component", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "harness", organizationId: "org_harness", role: "member" });
    expect(await actor.client.query(api.organizations.getOrganizationSettings, { organizationId: "org_harness" })).toMatchObject({ organizationId: "org_harness", displayName: "ALIAS UCE Workspace" });
  });
  test("returns rows seeded through the test database", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "harness", organizationId: "org_harness", role: "member" });
    await t.run((ctx) => ctx.db.insert("knowledge", { title: "Refund policy", content: "30 days.", category: "Policy", status: "verified", organizationId: "org_harness", createdAt: 1, updatedAt: 1 }));
    expect(await actor.client.query(api.knowledge.listKnowledge, { organizationId: "org_harness" })).toHaveLength(1);
  });
  test("enforces schema validation on writes", async () => {
    const t = createAuthTest();
    await expect(t.run((ctx) => ctx.db.insert("knowledge", { title: "Missing required fields" } as never))).rejects.toThrow();
  });
});
