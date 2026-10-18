import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FunctionReference } from "convex/server";

const mocks = vi.hoisted(() => ({
  bridgeFactory: vi.fn(),
  connection: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  getToken: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
  action: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("@convex-dev/better-auth/nextjs", () => ({ convexBetterAuthNextJs: mocks.bridgeFactory }));

const query: FunctionReference<"query", "public", Record<string, never>, string> = {
  _type: "query", _visibility: "public", _args: {}, _returnType: "", _componentPath: undefined,
};
const mutation: FunctionReference<"mutation", "public", Record<string, never>, string> = {
  _type: "mutation", _visibility: "public", _args: {}, _returnType: "", _componentPath: undefined,
};
const action: FunctionReference<"action", "public", Record<string, never>, string> = {
  _type: "action", _visibility: "public", _args: {}, _returnType: "", _componentPath: undefined,
};

function bridge() {
  return {
    handler: { GET: mocks.get, POST: mocks.post },
    getToken: mocks.getToken,
    fetchAuthQuery: mocks.query,
    fetchAuthMutation: mocks.mutation,
    fetchAuthAction: mocks.action,
  };
}

async function authServer() {
  vi.resetModules();
  return import("../../apps/web/lib/auth-server");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connection.mockResolvedValue(undefined);
  mocks.bridgeFactory.mockReturnValue(bridge());
  mocks.get.mockResolvedValue(new Response("get"));
  mocks.post.mockResolvedValue(new Response("post"));
  mocks.getToken.mockResolvedValue("token");
  mocks.query.mockResolvedValue("query");
  mocks.mutation.mockResolvedValue("mutation");
  mocks.action.mockResolvedValue("action");
  for (const name of ["NEXT_PUBLIC_CONVEX_URL", "CONVEX_URL", "NEXT_PUBLIC_CONVEX_SITE_URL", "CONVEX_SITE_URL"]) vi.stubEnv(name, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("lazy auth server bridge", () => {
  test("does not construct the SDK bridge at module import", async () => {
    await authServer();
    expect(mocks.bridgeFactory).not.toHaveBeenCalled();
  });

  test("returns no-store 503 for missing or partial configuration without contacting a backend", async () => {
    const server = await authServer();
    for (const request of [new Request("https://app.test/api/auth", { method: "GET" }), new Request("https://app.test/api/auth", { method: "POST" })]) {
      const response = request.method === "GET" ? await server.handler.GET(request) : await server.handler.POST(request);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "Authentication service is not configured." });
    }
    await expect(server.getToken()).rejects.toMatchObject({ name: "AuthServerConfigurationError", message: "Authentication service is not configured." });
    vi.stubEnv("CONVEX_URL", "https://partial.convex.cloud");
    await expect(server.fetchAuthQuery(query)).rejects.toMatchObject({ name: "AuthServerConfigurationError", message: "Authentication service is not configured." });
    expect(mocks.bridgeFactory).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  test("trims public settings, falls back for blank public values, and forwards configured calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", " https://public.convex.cloud ");
    vi.stubEnv("CONVEX_URL", "https://fallback.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "   ");
    vi.stubEnv("CONVEX_SITE_URL", " https://site.convex.cloud ");
    const server = await authServer();
    await expect(server.getToken()).resolves.toBe("token");
    await expect(server.fetchAuthQuery(query)).resolves.toBe("query");
    await expect(server.fetchAuthMutation(mutation)).resolves.toBe("mutation");
    await expect(server.fetchAuthAction(action)).resolves.toBe("action");
    await expect(server.handler.GET(new Request("https://app.test/api/auth"))).resolves.toMatchObject({ status: 200 });
    expect(mocks.bridgeFactory).toHaveBeenCalledWith({ convexUrl: "https://public.convex.cloud", convexSiteUrl: "https://site.convex.cloud" });
    expect(mocks.query).toHaveBeenCalledWith(query);
    expect(mocks.mutation).toHaveBeenCalledWith(mutation);
    expect(mocks.action).toHaveBeenCalledWith(action);
    expect(mocks.connection).toHaveBeenCalled();
  });
});
