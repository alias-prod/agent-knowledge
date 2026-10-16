import { describe, expect, test } from "vitest";
import { assertAuthReady, getAuthEnvironment } from "../../convex/authEnvironment";

describe("Better Auth deployment configuration", () => {
  const preview = {
    NODE_ENV: "development",
    V0_RUNTIME_URL: "https://workspace.vercel.run",
    V0_BUILD_URL: "https://workspace.v0.build",
    V0_SANDBOX_URL: "https://direct.vercel.run/path",
  };

  test("uses exact preview origins and iframe-compatible development cookies", () => {
    expect(getAuthEnvironment(preview)).toMatchObject({
      baseURL: preview.V0_RUNTIME_URL,
      trustedOrigins: [preview.V0_RUNTIME_URL, "http://localhost:3000", preview.V0_BUILD_URL, "https://direct.vercel.run"],
      advanced: { defaultCookieAttributes: { sameSite: "none", secure: true } },
    });
    expect(getAuthEnvironment(preview).trustedOrigins.some((url) => url.includes("*"))).toBe(false);
  });

  test("production never trusts development origins or overrides cookie attributes", () => {
    const configuration = getAuthEnvironment({
      ...preview, NODE_ENV: "production", VERCEL_URL: "preview.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "production.vercel.app",
    });
    expect(configuration.baseURL).toBe("https://production.vercel.app");
    expect(configuration.trustedOrigins).toEqual(["https://production.vercel.app", "https://preview.vercel.app"]);
    expect(configuration).not.toHaveProperty("advanced");
  });

  test("canonical URL takes precedence and rejects credentials and invalid protocols", () => {
    expect(getAuthEnvironment({ ...preview, BETTER_AUTH_URL: "https://auth.example.com/base" }).baseURL)
      .toBe("https://auth.example.com");
    expect(() => getAuthEnvironment({ ...preview, BETTER_AUTH_URL: "javascript:alert(1)" })).toThrow();
    expect(() => getAuthEnvironment({ ...preview, V0_BUILD_URL: "https://*.v0.build" })).toThrow();
    expect(() => getAuthEnvironment({ ...preview, BETTER_AUTH_URL: "https://user:pass@example.com" })).toThrow();
  });

  test("dev trusts explicitly configured project Preview origins without changing the canonical URL", () => {
    const deployed = "https://alias-kr-ontology-lv4tpvgkr-prod-4689s-projects.vercel.app";
    const branch = "https://alias-kr-ontology-git-v0-fix-convex-8e7c1e-prod-4689s-projects.vercel.app";
    const configuration = getAuthEnvironment({
      ...preview, BETTER_AUTH_URL: branch,
      AUTH_PREVIEW_ORIGINS: JSON.stringify([deployed, branch, deployed]),
    });
    expect(configuration.baseURL).toBe(branch);
    expect(configuration.trustedOrigins.filter((value) => value === deployed)).toHaveLength(1);
    expect(configuration.trustedOrigins).toContain(branch);
    expect(configuration.trustedOrigins).not.toContain("https://unrelated-project.vercel.app");
    expect(configuration).not.toHaveProperty("advanced.disableCSRFCheck");
    expect(configuration).not.toHaveProperty("advanced.disableOriginCheck");
  });

  test("dev includes an exact Vercel deployment origin even with a separate canonical URL", () => {
    expect(getAuthEnvironment({ ...preview, VERCEL_URL: "project-preview.vercel.app" }).trustedOrigins)
      .toContain("https://project-preview.vercel.app");
  });

  test.each([
    "not-json", JSON.stringify("https://project.vercel.app"), JSON.stringify([null]),
    JSON.stringify(["https://*.vercel.app"]), JSON.stringify(["http://project.vercel.app"]),
    JSON.stringify(["https://user:pass@project.vercel.app"]),
    JSON.stringify(["https://project.vercel.app/path"]),
    JSON.stringify(["https://project.vercel.app/"]),
    JSON.stringify(["https://project.vercel.app?redirect=evil"]),
    JSON.stringify(["https://project.vercel.app#fragment"]),
    JSON.stringify(Array.from({ length: 21 }, (_, i) => `https://project-${i}.vercel.app`)),
  ])("rejects unsafe or malformed dev Preview configuration: %s", (value) => {
    expect(() => getAuthEnvironment({ ...preview, AUTH_PREVIEW_ORIGINS: value })).toThrow();
  });

  test("production ignores the dev allowlist entirely, including malformed values", () => {
    for (const value of ["not-json", JSON.stringify(["https://dev-preview.vercel.app"])]) {
      const configuration = getAuthEnvironment({
        NODE_ENV: "production", VERCEL_URL: "production.vercel.app", AUTH_PREVIEW_ORIGINS: value,
      });
      expect(configuration.trustedOrigins).toEqual(["https://production.vercel.app"]);
      expect(configuration).not.toHaveProperty("advanced");
    }
  });

  test("readiness fails closed without a real secret and canonical origin", () => {
    expect(() => assertAuthReady(preview)).toThrow("secret");
    expect(() => assertAuthReady({ ...preview, BETTER_AUTH_SECRET: "short" })).toThrow("secret");
    expect(() => assertAuthReady({ BETTER_AUTH_SECRET: "a".repeat(32) })).toThrow("canonical");
    expect(() => assertAuthReady({ ...preview, BETTER_AUTH_SECRET: "a".repeat(32) })).not.toThrow();
  });
});
