import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createAuthTest, addIdentity } from "./authFixture";
const args = { organizationId: "org_test", displayName: "Updated Workspace", defaultKnowledgeStatus: "draft" as const, defaultCanUseToAnswer: true, defaultCanUseToAct: false, workosUserId: "forged-admin", actorEmail: "forged@example.com" };
describe("workspace settings authorization", () => {
  test("only live administrators can write settings", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "admin", organizationId: "org_test", role: "admin" });
    await actor.client.mutation(api.organizations.updateOrganizationSettings, args);
    expect(await actor.client.query(api.organizations.getOrganizationSettings, { organizationId: "org_test" })).toMatchObject({ displayName: "Updated Workspace" });
  });
  test("members can read their settings but cannot write or read another tenant", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", organizationId: "org_test", role: "member" });
    await expect(actor.client.mutation(api.organizations.updateOrganizationSettings, args)).rejects.toThrow("Unauthorized");
    await expect(actor.client.query(api.organizations.getOrganizationSettings, { organizationId: "other" })).rejects.toThrow("Unauthorized");
    expect(await actor.client.query(api.organizations.getOrganizationSettings, { organizationId: "org_test" })).toBeTruthy();
  });
  test("anonymous requests cannot read or write workspace settings", async () => {
    const t = createAuthTest();
    await expect(t.mutation(api.organizations.updateOrganizationSettings, args)).rejects.toThrow("Unauthorized");
    await expect(t.query(api.organizations.getOrganizationSettings, { organizationId: "org_test" })).rejects.toThrow("Unauthorized");
  });
});
