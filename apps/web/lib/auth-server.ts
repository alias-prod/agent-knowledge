import "server-only";
import { connection } from "next/server";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server";

type AuthBridge = ReturnType<typeof convexBetterAuthNextJs>;

const CONFIG_ERROR = "Authentication service is not configured.";

export class AuthServerConfigurationError extends Error {
  constructor() {
    super(CONFIG_ERROR);
    this.name = "AuthServerConfigurationError";
  }
}

function configuredValue(publicName: "NEXT_PUBLIC_CONVEX_URL" | "NEXT_PUBLIC_CONVEX_SITE_URL", fallbackName: "CONVEX_URL" | "CONVEX_SITE_URL") {
  const publicValue = process.env[publicName]?.trim();
  return publicValue || process.env[fallbackName]?.trim() || undefined;
}

function createBridge(): AuthBridge {
  const convexUrl = configuredValue("NEXT_PUBLIC_CONVEX_URL", "CONVEX_URL");
  const convexSiteUrl = configuredValue("NEXT_PUBLIC_CONVEX_SITE_URL", "CONVEX_SITE_URL");
  if (!convexUrl || !convexSiteUrl) throw new AuthServerConfigurationError();
  return convexBetterAuthNextJs({ convexUrl, convexSiteUrl });
}

async function withBridge<Result>(run: (bridge: AuthBridge) => Promise<Result>) {
  await connection();
  return run(createBridge());
}

function unavailableResponse() {
  return Response.json({ error: CONFIG_ERROR }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export const handler = {
  GET: async (request: Request) => {
    try {
      return await withBridge(bridge => bridge.handler.GET(request));
    } catch (error) {
      if (error instanceof AuthServerConfigurationError) return unavailableResponse();
      throw error;
    }
  },
  POST: async (request: Request) => {
    try {
      return await withBridge(bridge => bridge.handler.POST(request));
    } catch (error) {
      if (error instanceof AuthServerConfigurationError) return unavailableResponse();
      throw error;
    }
  },
};

export function getToken() {
  return withBridge(bridge => bridge.getToken());
}

export function fetchAuthQuery<Query extends FunctionReference<"query">>(query: Query, ...args: OptionalRestArgs<Query>): Promise<FunctionReturnType<Query>> {
  return withBridge(bridge => bridge.fetchAuthQuery(query, ...args));
}

export function fetchAuthMutation<Mutation extends FunctionReference<"mutation">>(mutation: Mutation, ...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> {
  return withBridge(bridge => bridge.fetchAuthMutation(mutation, ...args));
}

export function fetchAuthAction<Action extends FunctionReference<"action">>(action: Action, ...args: OptionalRestArgs<Action>): Promise<FunctionReturnType<Action>> {
  return withBridge(bridge => bridge.fetchAuthAction(action, ...args));
}
