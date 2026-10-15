type Environment = Record<string, string | undefined>;

function origin(value?: string, hostname = false) {
  if (!value) return undefined;
  const url = new URL(hostname && !value.includes("://") ? `https://${value}` : value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hostname.includes("*")) {
    throw new Error("Invalid authentication origin configuration");
  }
  return url.origin;
}

export function getAuthEnvironment(env: Environment) {
  const development = env.NODE_ENV === "development";
  const baseURL = origin(env.BETTER_AUTH_URL)
    ?? origin(env.VERCEL_PROJECT_PRODUCTION_URL, true)
    ?? origin(env.VERCEL_URL, true)
    ?? (development ? origin(env.V0_RUNTIME_URL) : undefined);
  const trustedOrigins = development
    ? ["http://localhost:3000", ...[
        env.V0_RUNTIME_URL,
        env.V0_DEV_APP_URL,
        env.V0_BUILD_URL,
        env.V0_SANDBOX_URL,
      ].map((url) => origin(url))]
    : [origin(env.VERCEL_URL, true), origin(env.VERCEL_PROJECT_PRODUCTION_URL, true)];

  return {
    baseURL,
    trustedOrigins: [...new Set([baseURL, ...trustedOrigins].filter((url): url is string => Boolean(url)))],
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    ...(development
      ? {
          advanced: {
            // The cross-site v0 iframe cannot use Better Auth's default Lax cookie.
            defaultCookieAttributes: { sameSite: "none" as const, secure: true },
          },
        }
      : {}),
  };
}

export function assertAuthReady(env: Environment) {
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    throw new Error("Authentication requires a configured secret of at least 32 characters");
  }
  const configuration = getAuthEnvironment(env);
  if (!configuration.baseURL) throw new Error("Authentication requires a canonical site origin");
  return configuration;
}
