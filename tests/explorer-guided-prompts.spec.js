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
