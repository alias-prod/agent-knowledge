import { getAuthEnvironment } from "../../../convex/authEnvironment";

type Environment = Record<string, string | undefined>;

export function isTrustedRequestOrigin(request: Request, env: Environment = process.env): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (getAuthEnvironment(env).trustedOrigins.includes(origin)) return true;
  // NODE_ENV is production in deployed Previews too. Only Vercel's server-owned
  // branch hostname extends the allowlist; request/forwarded hosts never do.
  if (env.VERCEL_ENV !== "preview" || !env.VERCEL_BRANCH_URL) return false;
  const hostname = env.VERCEL_BRANCH_URL;
  if (!/^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(hostname)) return false;
  return origin === `https://${hostname}`;
}
