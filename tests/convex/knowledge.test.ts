import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createAuthTest, addIdentity } from "./authFixture";
const args = { title: "Refund policy", content: "Refunds within 30 days.", category: "Policy", status: "verified" as const, canUseToAnswer: true, canUseToAct: false, requiresApproval: false, organizationId: "org_test", workosUserId: "forged-legacy-admin" };
describe("knowledge mutation authorization", () => {
  test("authorizes the live Better Auth admin, not caller identity hints", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "admin", organizationId: "org_test", role: "admin" });
    expect(await actor.client.mutation(api.knowledge.createKnowledge, args)).toBeTruthy();
  });
  test("a member cannot forge an admin identity", async () => {
    const t = createAuthTest(); const actor = await addIdentity(t, { name: "member", organizationId: "org_test", role: "member" });
    await expect(actor.client.mutation(api.knowledge.createKnowledge, args)).rejects.toThrow("Unauthorized");
  });
  test("anonymous and old provider JWT identities cannot write", async () => {
    const t = createAuthTest();
    await expect(t.mutation(api.knowledge.createKnowledge, args)).rejects.toThrow("Unauthorized");
    await expect(t.withIdentity({ subject: "forged-legacy-admin" }).mutation(api.knowledge.createKnowledge, args)).rejects.toThrow("Unauthorized");
  });
});
