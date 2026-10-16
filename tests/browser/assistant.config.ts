import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";

const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig({
  root,
  publicDir: false,
  build: { rolldownOptions: { input: `${root}/tests/browser/assistant.html` } },
  plugins: [react(), {
    name: "isolated-assistant-fixture",
    enforce: "pre",
    resolveId(id) {
      if (id === "@/lib/auth-context" || id === `${root}/apps/web/lib/auth-context`) return "\0fixture-auth";
      if (id === "convex/react") return "\0fixture-convex";
    },
    load(id) {
      if (id === "\0fixture-auth") return 'export const useAuth = () => ({ organizationId: "fixture-only", authOrganizationId: "fixture-only" });';
      if (id === "\0fixture-convex") return 'export const useQuery = () => []; export const useMutation = () => async () => { throw new Error("Fixture mutations disabled"); };';
    },
  }],
  resolve: { alias: { "@": `${root}/apps/web` }, dedupe: ["react", "react-dom"] },
  css: { postcss: { plugins: [tailwind()] } },
  server: { host: "0.0.0.0", port: 4173, strictPort: true },
});
