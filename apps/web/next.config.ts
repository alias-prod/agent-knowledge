import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { NextConfig } from "next";

const environment = process.env.NODE_ENV || "development";
const workspaceEnvFiles = [
  `.env.${environment}.local`,
  ...(environment === "test" ? [] : [".env.local"]),
  `.env.${environment}`,
  ".env",
];

// Convex and preview tooling write env files at the workspace root, while Next
// loads apps/web's files. Existing process/app values take precedence.
for (const filename of workspaceEnvFiles) {
  const path = new URL(`../../${filename}`, import.meta.url);
  if (existsSync(path)) loadEnvFile(path);
}

const workspaceRequire = createRequire(new URL("../../package.json", import.meta.url));
const convexPackage = dirname(workspaceRequire.resolve("convex/package.json"));

const nextConfig: NextConfig = {
  // Bun can resolve separate physical copies for the app and the auth adapter;
  // both must share one React auth context, in development and production.
  turbopack: { resolveAlias: { "convex/react": "../../node_modules/convex/dist/esm/react/index.js", convex: "../../node_modules/convex" } },
  webpack(config) {
    config.resolve.alias.convex = convexPackage;
    return config;
  },
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? process.env.CONVEX_SITE_URL,
  },
  transpilePackages: ["@agent-knowledge/shared", "@convex-dev/better-auth", "convex"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Keep known v0 Preview embedding; never permit arbitrary framing.
        { key: "Content-Security-Policy", value: process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"
          ? "frame-ancestors 'self' https://v0.app https://v0.dev"
          : "frame-ancestors 'self'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ],
    }];
  },
};

export default nextConfig;
