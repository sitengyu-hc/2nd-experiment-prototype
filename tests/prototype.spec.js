const { test, expect } = require("@playwright/test");

const advisor = page => page.locator("#advisor");
const promptToggle = page => page.locator("#prompt-toggle");

async function openFailedRun(page) {
  await page.goto("/");
  await page.locator('tr[data-nav="run"]').click();
}

async function openExplorer(page) {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
}

test("failed run entry opens Albus with expanded investigation prompts", async ({ page }) => {
  await openFailedRun(page);

  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(page.locator("#conversation")).toContainText("The plan failed because");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#prompt-menu")).toContainText("What options do I have to fix this?");
});

test("run prompts collapse after a guided question generates a response", async ({ page }) => {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What options do I have to fix this?" }).click();

  await expect(page.locator("#conversation")).toContainText("There are three paths");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu .prompt-list")).toBeHidden();
});

test("direct Explorer entry stays closed and Explorer prompts remain available", async ({ page }) => {
  await openExplorer(page);

  await expect(advisor(page)).not.toHaveClass(/is-open/);
  await expect(promptToggle(page)).toHaveText(/Suggested queries/);
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu")).toContainText("View all modules");
});

test("run-to-Explorer investigation carries the latest Albus answer into Explorer", async ({ page }) => {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What other workspaces are using RDS module v5.1.0?" }).click();
  await page.getByRole("button", { name: /View module consumers in Explorer/ }).click();

  await expect(page.locator(".explorer-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  // Explorer intentionally keeps only the latest answer (show-impact handler).
  await expect(page.locator("#conversation")).toContainText("Five other workspaces");
  await expect(page.locator(".compact-query")).toContainText("RDS module cross-workspace impact");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(page.locator("#conversation")).toContainText("Five other workspaces");
});

// The compact Explorer HUD has no Graph/Table toggle yet; the table-first
// redesign on demo/albus-tiers restores it.
test.fixme("Explorer view and selection survive graph and table changes", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("Drifted workspaces");
  await page.locator("#natural-query-form").press("Enter");
  await page.locator('.advisor-results [data-result-node="payments-prod-eu"]').click();

  await expect(page.locator(".selected-result")).toContainText("payments-prod-eu");
  await page.getByRole("button", { name: "Table View" }).click();
  await expect(page.locator(".explorer-table")).toContainText("payments-prod-eu");
  await expect(page.locator(".compact-query")).toContainText("Drifted workspaces");

  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator(".inventory-topology")).toBeVisible();
  await expect(page.locator(".selected-result")).toContainText("payments-prod-eu");
});

test("new session resets Explorer query, selection, and messages", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("Drifted workspaces");
  await page.locator("#natural-query-form").press("Enter");
  await page.locator('.advisor-results [data-result-node="payments-prod-eu"]').click();
  await page.getByRole("button", { name: "New session" }).click();

  await expect(page.locator("#natural-query-input")).toBeVisible();
  await expect(page.locator(".result-summary")).toHaveCount(0);
  await expect(page.locator(".selected-result")).toHaveCount(0);
  await expect(page.locator("#conversation")).toContainText("current context loaded");
  await expect(page.locator("#conversation")).not.toContainText("8 workspaces");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");
});

for (const viewport of [
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1440, height: 900 }
]) {
  test(`${viewport.name} keeps failed-run content and Albus visible`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFailedRun(page);

    await expect(page.locator(".run-page")).toBeVisible();
    await expect(advisor(page)).toBeVisible();
    await expect(page.locator("#advisor-composer")).toBeVisible();
  });
}
