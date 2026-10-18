import { defineConfig, devices } from "@playwright/test";
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Browser acceptance is opt-in. Set ${name}; see docs/browser-acceptance.md.`);
  return value;
};

const baseURL = required("E2E_PREVIEW_BASE_URL");
const expectedWorkspace = required("E2E_EXPECTED_WORKSPACE");
const expectedDraftTitle = required("E2E_ACCEPTANCE_DRAFT_TITLE");
const storageState = required("E2E_STORAGE_STATE");
const repositoryRoot = realpathSync(process.cwd());
const requestedStatePath = resolve(storageState);
const preview = new URL(baseURL);

if (preview.protocol !== "https:" || preview.username || preview.password || !preview.hostname.endsWith(".vercel.app") || !preview.hostname.includes("-git-")) {
  throw new Error("E2E_PREVIEW_BASE_URL must be an HTTPS Vercel Preview deployment URL with a -git- hostname. Credential-bearing, production, local, and arbitrary origins are rejected.");
}
if (preview.pathname !== "/" || preview.search || preview.hash) {
  throw new Error("E2E_PREVIEW_BASE_URL must be the Preview deployment origin only, with no path, query, or hash.");
}
if (!existsSync(requestedStatePath)) throw new Error(`E2E_STORAGE_STATE does not exist: ${requestedStatePath}`);
// Resolve symlinks before the repository-boundary check so an in-repo link cannot disguise its target.
const statePath = realpathSync(requestedStatePath);
const stateRelativePath = relative(repositoryRoot, statePath);
const stateIsOutsideRepository = stateRelativePath.startsWith(".." + sep) || isAbsolute(stateRelativePath);
const stateIsIgnoredRepositoryAuthFile = stateRelativePath === "playwright/.auth" || stateRelativePath.startsWith(`playwright${sep}.auth${sep}`);
if (!stateIsOutsideRepository && !stateIsIgnoredRepositoryAuthFile) {
  throw new Error("E2E_STORAGE_STATE must be outside this repository or under ignored playwright/.auth/. Do not store signed-in state elsewhere in the repository.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: preview.origin,
    storageState: statePath,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], reducedMotion: "no-preference" } },
    { name: "desktop-chromium-reduced", use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" } },
    {
      name: "mobile-375-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        screen: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      },
    },
  ],
  metadata: { expectedWorkspace, expectedDraftTitle, previewOrigin: preview.origin },
});
