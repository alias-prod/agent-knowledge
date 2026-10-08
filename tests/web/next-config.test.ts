// @vitest-environment node

import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import turboConfig from "../../turbo.json";

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

  test("includes the deployment URL and root env files in Turbo task inputs", () => {
    expect(turboConfig.globalEnv).toContain("NEXT_PUBLIC_CONVEX_URL");
    expect(turboConfig.globalDependencies).toContain(".env*");
  });
});
