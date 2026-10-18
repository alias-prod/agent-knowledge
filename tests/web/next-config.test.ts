// @vitest-environment node

import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import turboConfig from "../../turbo.json";
import vercelConfig from "../../vercel.json";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  loadEnvFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  default: { existsSync: mocks.existsSync },
}));
vi.mock("node:process", () => ({
  loadEnvFile: mocks.loadEnvFile,
  default: { loadEnvFile: mocks.loadEnvFile },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function loadedFilenames() {
  return mocks.loadEnvFile.mock.calls.map(([url]) =>
    new URL(url).pathname.split("/").pop()
  );
}

describe("workspace environment configuration", () => {
  test("loads workspace defaults in Next.js development precedence order", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.existsSync.mockReturnValue(true);

    const { default: config } = await import("../../apps/web/next.config");

    expect(loadedFilenames()).toEqual([
      ".env.development.local",
      ".env.local",
      ".env.development",
      ".env",
    ]);
    expect(fileURLToPath(mocks.loadEnvFile.mock.calls[0][0])).toBe(
      fileURLToPath(new URL("../../.env.development.local", import.meta.url))
    );
    expect(config.transpilePackages).toContain("@agent-knowledge/shared");
  });

  test("uses production defaults instead of development defaults during builds", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.existsSync.mockReturnValue(true);

    await import("../../apps/web/next.config");

    expect(loadedFilenames()).toEqual([
      ".env.production.local",
      ".env.local",
      ".env.production",
      ".env",
    ]);
  });

  test("does not load developer-local defaults into tests", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mocks.existsSync.mockReturnValue(true);

    await import("../../apps/web/next.config");

    expect(loadedFilenames()).toEqual([".env.test.local", ".env.test", ".env"]);
  });

  test("does not try to load files that are absent", async () => {
    mocks.existsSync.mockReturnValue(false);

    await import("../../apps/web/next.config");

    expect(mocks.loadEnvFile).not.toHaveBeenCalled();
  });

  test("packages the web workspace as Next.js instead of a generic root deployment", () => {
    expect(vercelConfig.framework).toBe("nextjs");
    expect(vercelConfig.buildCommand).toBe("bun run build");
    expect(vercelConfig.outputDirectory).toBe("apps/web/.next");
  });

  test("includes endpoint and origin configuration in Turbo task inputs", () => {
    expect(turboConfig.globalEnv).toEqual(expect.arrayContaining([
      "NEXT_PUBLIC_CONVEX_URL", "NEXT_PUBLIC_CONVEX_SITE_URL",
      "CONVEX_URL", "CONVEX_SITE_URL", "BETTER_AUTH_URL",
      "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_ENV", "VERCEL_TARGET_ENV",
      "VERCEL_BRANCH_URL", "AUTH_PREVIEW_ORIGINS", "V0_RUNTIME_URL", "V0_DEV_APP_URL", "V0_BUILD_URL", "V0_SANDBOX_URL",
    ]));
    expect(turboConfig.globalDependencies).toContain(".env*");
  });

  test("passes server credentials through strict Turbo without exposing them through Next config", async () => {
    const serverVariables = ["CONVEX_DEPLOY_KEY", "BETTER_AUTH_SECRET", "RESEND_API_KEY", "RESEND_EMAIL_DOMAIN"];
    for (const name of serverVariables) vi.stubEnv(name, "test-only-server-value");
    mocks.existsSync.mockReturnValue(false);
    const { default: config } = await import("../../apps/web/next.config");

    expect(turboConfig.globalPassThroughEnv).toEqual(expect.arrayContaining(serverVariables));
    for (const name of serverVariables) {
      expect(config.env).not.toHaveProperty(name);
      expect(config.env).not.toHaveProperty(`NEXT_PUBLIC_${name}`);
      expect(turboConfig.globalEnv).not.toContain(name);
    }
  });

  test("uses explicit server endpoints without requiring local env files", async () => {
    vi.stubEnv("CONVEX_URL", "https://test-deployment.convex.cloud");
    vi.stubEnv("CONVEX_SITE_URL", "https://test-deployment.convex.site");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", undefined);
    mocks.existsSync.mockReturnValue(false);
    const { default: config } = await import("../../apps/web/next.config");

    expect(config.env).toEqual({
      NEXT_PUBLIC_CONVEX_URL: "https://test-deployment.convex.cloud",
      NEXT_PUBLIC_CONVEX_SITE_URL: "https://test-deployment.convex.site",
    });
    expect(mocks.loadEnvFile).not.toHaveBeenCalled();
  });
});

test.each(["production", "preview"])("restricts framing for %s without widening other origins", async environment => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VERCEL_ENV", environment);
  mocks.existsSync.mockReturnValue(false);
  const { default: config } = await import("../../apps/web/next.config");
  const entries = await config.headers!();
  const policy = entries[0].headers.find(header => header.key === "Content-Security-Policy")!.value;
  expect(policy).toBe(environment === "preview" ? "frame-ancestors 'self' https://v0.app https://v0.dev" : "frame-ancestors 'self'");
  expect(policy).not.toContain("*");
});
