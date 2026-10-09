import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Resolve a single package instance for tests and components in both Bun's
// hoisted and isolated workspace layouts; mixed React instances break hooks.
const webPackage = (name: string) => {
  const hoisted = fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));
  return existsSync(hoisted)
    ? hoisted
    : fileURLToPath(new URL(`./apps/web/node_modules/${name}`, import.meta.url));
};
const projectRequire = createRequire(import.meta.url);

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["tests/convex/**/*.test.ts"],
          // convex-test ships ESM that must be transformed rather than externalized.
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: [
            { find: "@", replacement: fileURLToPath(new URL("./apps/web", import.meta.url)) },
            { find: /^next\//, replacement: `${webPackage("next")}/` },
            { find: "lucide-react", replacement: webPackage("lucide-react") },
            { find: "@radix-ui/react-slot", replacement: webPackage("@radix-ui/react-slot") },
            {
              find: "@workos-inc/authkit-nextjs/components",
              replacement: webPackage(
                "@workos-inc/authkit-nextjs/dist/esm/components/index.js"
              ),
            },
            {
              find: "convex/react",
              replacement: projectRequire.resolve("convex/react"),
            },
            { find: /^react$/, replacement: webPackage("react") },
            { find: /^react\//, replacement: `${webPackage("react")}/` },
            { find: /^react-dom$/, replacement: webPackage("react-dom") },
            { find: /^react-dom\//, replacement: `${webPackage("react-dom")}/` },
          ],
        },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["tests/web/**/*.test.{ts,tsx}"],
          setupFiles: ["./tests/setup/web.ts"],
        },
      },
    ],
  },
});
