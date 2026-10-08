import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
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

const nextConfig: NextConfig = {
  transpilePackages: ["@agent-knowledge/shared"],
};

export default nextConfig;
