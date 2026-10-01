const { test, expect } = require("@playwright/test");

async function openExplorer(page) {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
}

test("Explorer landing keeps guided prompts available but collapsed", async ({ page }) => {
  await openExplorer(page);

  const promptToggle = page.locator("#prompt-toggle");
  await expect(promptToggle).toHaveText(/Suggested queries/);
  await expect(promptToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu")).toContainText("View all modules");
});

test("Explorer query results keep guided prompts available but collapsed", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("Drifted workspaces");
  await page.locator("#natural-query-form").press("Enter");

  await expect(page.locator("#advisor")).toHaveClass(/is-open/);
  await expect(page.locator("#conversation")).toContainText("8 workspaces");
  await expect(page.locator("#prompt-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu")).toContainText("View all providers");
});

test("typed natural language returns the same conversation node list as a prepopulated query", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("Show me all modules");
  await page.locator("#natural-query-form").press("Enter");

  const typedNodes = await page.locator("#conversation .returned-nodes [data-result-node]").allTextContents();
  await expect(page.locator("#conversation")).toContainText("24 modules");
  await expect(page.locator("#conversation .returned-heading")).toContainText("RETURNED NODES");

  await openExplorer(page);
  await page.getByRole("button", { name: "View all modules" }).first().click();

  const prepopulatedNodes = await page.locator("#conversation .returned-nodes [data-result-node]").allTextContents();
  expect(typedNodes).not.toHaveLength(0);
  expect(typedNodes).toEqual(prepopulatedNodes);
});

test("the Explorer textbox example returns an Albus node list", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("production workspaces using AWS v5.x");
  await page.locator("#natural-query-form").press("Enter");

  await expect(page.locator("#conversation")).toContainText("18 workspaces");
  await expect(page.locator("#conversation .returned-heading")).toContainText("RETURNED NODES");
  await expect(page.locator("#conversation .returned-nodes [data-result-node]")).toHaveCount(6);
  await expect(page.locator("#conversation")).toContainText("payments-prod-eu");
});

test("an unmatched natural-language query still returns scoped Explorer nodes", async ({ page }) => {
  await openExplorer(page);
  await page.locator("#natural-query-input").fill("show infrastructure I should review");
  await page.locator("#natural-query-form").press("Enter");

  await expect(page.locator("#conversation")).toContainText("6 production workspaces");
  await expect(page.locator("#conversation .returned-nodes [data-result-node]")).toHaveCount(6);
});
