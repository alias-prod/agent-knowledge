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

  test("readiness fails closed without a real secret and canonical origin", () => {
    expect(() => assertAuthReady(preview)).toThrow("secret");
    expect(() => assertAuthReady({ ...preview, BETTER_AUTH_SECRET: "short" })).toThrow("secret");
    expect(() => assertAuthReady({ BETTER_AUTH_SECRET: "a".repeat(32) })).toThrow("canonical");
    expect(() => assertAuthReady({ ...preview, BETTER_AUTH_SECRET: "a".repeat(32) })).not.toThrow();
  });
});
