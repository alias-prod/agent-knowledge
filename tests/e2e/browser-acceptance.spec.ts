import { expect, test, type Page } from "@playwright/test";

const workspaceName = required("E2E_EXPECTED_WORKSPACE");
const acceptanceDraftTitle = required("E2E_ACCEPTANCE_DRAFT_TITLE");

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Browser acceptance must fail closed; see docs/browser-acceptance.md.`);
  return value;
}

async function expectSignedInWorkspace(page: Page) {
  await page.goto("/documents");
  await expect(page).toHaveURL(/\/documents/);
  await expect(page.getByText(`${workspaceName} / Workspace`, { exact: true })).toBeVisible();
  await expect(page.locator('[data-documents-ready="true"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign In" })).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

async function expectSearchParams(page: Page, pathname: string, expected: Record<string, string>) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
  const url = new URL(page.url());
  for (const [name, value] of Object.entries(expected)) {
    expect(url.searchParams.has(name), `expected ${name} query parameter`).toBe(true);
    expect(url.searchParams.get(name), `expected ${name} query value`).toBe(value);
  }
}

async function openAssistant(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Ask ALIAS" });
  if (!await dialog.isVisible()) {
    await page.getByRole("button", { name: "Open Ask ALIAS companion" }).click();
    await expect(dialog).toBeVisible();
  }
  const privacy = dialog.getByText("Privacy & History", { exact: true });
  const history = dialog.getByRole("checkbox", { name: "Save new conversations for 7 days" });
  if (!await history.isVisible()) await privacy.click();
  await expect(history).toBeVisible();
  await expect(history).not.toBeChecked();
  return dialog.getByRole("textbox", { name: "Ask ALIAS" });
}

async function sendReadCommand(page: Page, command: string) {
  const question = await openAssistant(page);
  await question.fill(command);
  await page.getByRole("button", { name: "Send Question" }).click();
}

test.beforeEach(async ({ page }) => {
  await expectSignedInWorkspace(page);
  await expectNoHorizontalOverflow(page);
});

test("uses the signed-in assistant's Open Documents read command and keyboard destination", async ({ page }) => {
  await sendReadCommand(page, "Open Documents");
  const destination = page.getByRole("link", { name: "Documents Select to open; not yet navigated." });
  await expect(destination).toBeVisible();
  await destination.focus();
  await page.keyboard.press("Enter");
  await expectSearchParams(page, "/documents", {});
  await expect(page.getByText(`${workspaceName} / Workspace`, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("finds the approved existing acceptance draft and opens the graph with read-only shortcuts", async ({ page }, testInfo) => {
  await sendReadCommand(page, `Find ${acceptanceDraftTitle}`);
  const draft = page.getByRole("link", { name: `${acceptanceDraftTitle} document · metadata only` });
  await expect(draft).toBeVisible();
  await draft.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/documents");
  expect(new URL(page.url()).searchParams.get("doc")).toBeTruthy();
  await expectNoHorizontalOverflow(page);

  await sendReadCommand(page, "Show knowledge graph");
  const graph = page.getByRole("link", { name: "knowledge graph Select to open; not yet navigated." });
  await expect(graph).toBeVisible();
  await graph.click();
  await expectSearchParams(page, "/graph", { lens: "knowledge", q: "", status: "all", view: "list" });
  await expect(page.locator('[data-graph-ready="true"]')).toBeVisible();
  await expect(page.getByText("Live workspace", { exact: true })).toBeVisible();
  if (testInfo.project.use.reducedMotion === "reduce") {
    await expect(page.getByText("List view is enabled to respect your reduced-motion preference.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "3D" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("link", { name: "3D" })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
});
