const { test, expect } = require("@playwright/test");

const askBar = page => page.locator("#explorer-ask-input");

async function openExplorer(page) {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
}

async function askExplorer(page, question) {
  await askBar(page).fill(question);
  await askBar(page).press("Enter");
}

test("direct Explorer entry: one Ask bar, Albus panel closed, starters available", async ({ page }) => {
  await openExplorer(page);

  await expect(page.locator("#advisor")).not.toHaveClass(/is-open/);
  await expect(askBar(page)).toBeVisible();
  await expect(askBar(page)).toHaveAttribute("aria-label", "Search or ask a question");
  // One example per NL scenario: a complex Explorer query, and a question Explorer can't answer alone.
  await expect(askBar(page)).toHaveAttribute("placeholder", "e.g. drifted production workspaces, or unused module versions");
  await expect(page.locator("#advisor-input")).not.toBeInViewport();
  await expect(page.locator(".advisor-collapsed .collapsed-composer")).toBeHidden();
  await expect(page.locator(".starter-prompts").first()).toContainText("Drifted workspaces");
  await expect(page.locator(".albus-group")).toContainText("Which RDS module versions are no longer in use?");
});

test("tier 1 on direct entry updates the table only; panel stays closed", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");

  await expect(page.locator("#advisor")).not.toHaveClass(/is-open/);
  await expect(page.locator(".results-table tbody tr")).toHaveCount(8);
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
  await expect(page.locator(".query-receipt")).toContainText("Built query: Workspaces where Drifted is true · 8 results");
  // On results, the Ask field sits just above the table, below the chips and receipt.
  await expect(askBar(page)).toBeVisible();
  const receipt = await page.locator(".query-receipt").boundingBox();
  const ask = await page.locator(".ask-bar").boundingBox();
  const table = await page.locator(".results-panel").boundingBox();
  expect(ask.y).toBeGreaterThan(receipt.y + receipt.height);
  expect(ask.y + ask.height).toBeLessThan(table.y);

  await page.locator(".query-receipt").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".results-panel")).toHaveCount(0);
  await expect(page.locator(".starter-card")).toBeVisible();
});

test("Edit conditions follows the Explorer builder: Type, then WHERE column / operator / value", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await page.getByRole("button", { name: "Edit conditions" }).click();

  const editor = page.locator("#conditions-form");
  await expect(editor.getByLabel("Type")).toHaveValue("workspaces");
  const row = editor.locator('[data-condition-row="0"]');
  await expect(row.locator(".clause")).toHaveText("WHERE");
  await expect(row.getByLabel("Column")).toHaveValue("drifted");
  await expect(row.getByLabel("Operator")).toHaveValue("is");
  await expect(row.getByLabel("Value")).toHaveValue("true");

  // Operators follow the column type (number -> =, >, <, ...).
  await row.getByLabel("Column").selectOption({ label: "Resource count" });
  await expect(row.getByLabel("Operator").locator("option")).toContainText(["=", "≠", ">", "<"]);
  await row.getByLabel("Operator").selectOption({ label: ">" });
  await row.getByLabel("Value").fill("15");

  // AND a second condition, then remove it again.
  await editor.getByRole("button", { name: "+ Add condition" }).click();
  await expect(editor.locator('[data-condition-row="1"] .clause')).toHaveText("AND");
  await editor.locator('[data-condition-row="1"]').getByRole("button", { name: "Remove condition" }).click();
  await expect(editor.locator('[data-condition-row="1"]')).toHaveCount(0);

  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Resource count is greater than 15"]);
  await expect(page.locator(".query-receipt")).toContainText("Edited by you: Workspaces where Resource count is greater than 15");

  await page.locator(".query-receipt").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
});

test("changing Type in the builder swaps the available columns", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await page.getByRole("button", { name: "Edit conditions" }).click();
  const editor = page.locator("#conditions-form");

  await editor.getByLabel("Type").selectOption("modules");
  const column = editor.locator('[data-condition-row="0"]').getByLabel("Column");
  await expect(column.locator("option")).toHaveText(["Name", "Version", "Source", "Workspace count", "Workspaces"]);
  await editor.locator('[data-condition-row="0"]').getByLabel("Value").fill("terraform-aws-rds");
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Modules", "Name is terraform-aws-rds"]);
});

test("tier 2 on direct entry opens Albus with an Albus-derived table and swaps the bar for chips", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Which RDS module versions are no longer in use?");

  await expect(page.locator("#advisor")).toHaveClass(/is-open/);
  await expect(askBar(page)).toHaveCount(0);
  await expect(page.locator(".active-query.in-bar")).toContainText("Albus-derived");
  await expect(page.locator(".derived-table tbody tr")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Graph" })).toBeDisabled();
  await expect(page.locator("#conversation")).toContainText("3 of 6 versions are unused");

  // Closing the panel brings the single Ask bar back.
  await page.locator("#advisor-close").click();
  await expect(askBar(page)).toBeVisible();
  await expect(page.locator(".derived-table")).toBeVisible();
});

test("typed natural language returns the same rows as the starter query", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Show me all modules");
  const typedRows = await page.locator(".results-table tbody tr").allTextContents();

  await openExplorer(page);
  await page.locator(".starter-card").getByRole("button", { name: "View all modules" }).click();
  const starterRows = await page.locator(".results-table tbody tr").allTextContents();

  expect(typedRows).not.toHaveLength(0);
  expect(typedRows).toEqual(starterRows);
});

test("an unmatched question still returns a scoped Explorer table", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "show infrastructure I should review");

  await expect(page.locator(".results-panel")).toContainText("Production workspaces");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(6);
});

test("the unused-modules question is answered from registry + Explorer usage with sources", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "What modules are no longer being used?");

  await expect(page.locator("#conversation .card-basis")).toHaveText("I compared your private registry with Explorer usage.");
  await expect(page.locator("#conversation")).toContainText("Sources & freshness");
  await expect(page.locator("#conversation")).not.toContainText("Start a new Explorer query");
  await expect(page.locator(".derived-banner")).toBeVisible();
});

test("entry HUD keeps the original Browse dropdown above the four starting points", async ({ page }) => {
  await openExplorer(page);
  const hud = page.locator(".starter-card");
  await expect(hud.locator(".field-label")).toHaveText(["BROWSE", "EXPLORE YOUR INFRASTRUCTURE", "SEARCH OR ASK A QUESTION"]);
  // Explorer's own starting points on top; Albus (description, example question, search field) grouped below.
  const explorerOptions = hud.locator(".starter-prompts:not(.albus-starters) button");
  await expect(explorerOptions).toHaveText(["Drifted workspaces→", "View all modules→", "View all providers→"]);
  const albus = hud.locator(".albus-group");
  await expect(albus.locator(".albus-group-note")).toContainText("Albus turns questions into Explorer queries");
  await expect(albus.locator(".albus-starters button")).toHaveText(["✦ Which RDS module versions are no longer in use?→"]);
  await expect(albus.locator("#explorer-ask-input")).toBeVisible();
  const options = await hud.locator(".starter-prompts:not(.albus-starters)").boundingBox();
  const group = await albus.boundingBox();
  expect(group.y).toBeGreaterThan(options.y + options.height);
  const note = await albus.locator(".albus-group-note").boundingBox();
  const example = await albus.locator(".albus-starters").boundingBox();
  const ask = await albus.locator(".ask-bar").boundingBox();
  expect(example.y).toBeGreaterThan(note.y);
  expect(ask.y).toBeGreaterThan(example.y);

  await hud.getByRole("button", { name: /Types, Use cases and Saved views/ }).click();
  await expect(hud.locator(".browse-menu")).toContainText("PRE-DEFINED VIEWS");
  await expect(hud.locator(".browse-menu")).toContainText("Saved views");
  await hud.locator(".browse-menu").getByRole("button", { name: "Modules" }).click();
  await expect(page.locator(".results-panel")).toContainText("View all modules");
});

test("side navigation can be expanded from Explorer results to get back to Workspaces", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  const workspacesLink = page.locator('.side-nav button[data-nav-item="workspaces"]');
  await expect(workspacesLink).toBeHidden();

  await page.locator("#nav-collapse").click();
  await expect(workspacesLink).toBeVisible();
  await workspacesLink.click();
  await expect(page.locator(".standard-page h1")).toHaveText("Workspaces");
});

test("typing on results narrows the current query; Undo restores it", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await expect(askBar(page)).toHaveAttribute("placeholder", "Refine these results or ask a question…");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(8);

  await askExplorer(page, "only production");
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true", "Tags contains production"]);
  await expect(page.locator(".results-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".query-receipt")).toContainText("Refined: + Tags contains production · Workspaces where Drifted is true and Tags contains production · 4 results");
  await expect(page.locator("#advisor")).not.toHaveClass(/is-open/);

  await page.locator(".query-receipt").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".results-table tbody tr")).toHaveCount(8);
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
});

test("a complex query and its refinement can be typed in one go on entry", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "drifted production workspaces");
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true", "Tags contains production"]);
  await expect(page.locator(".results-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".query-receipt")).toContainText("Built query: Workspaces where Drifted is true and Tags contains production · 4 results");

  // One Undo returns to the empty starting point.
  await page.locator(".query-receipt").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".starter-card")).toBeVisible();
});

test("unmatched text on results changes nothing and says so", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await askExplorer(page, "make it sparkle");

  await expect(page.locator(".results-table tbody tr")).toHaveCount(8);
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
  await expect(page.locator(".query-receipt")).toContainText("No change: I couldn't turn “make it sparkle” into a condition");
  await expect(page.locator(".query-receipt")).not.toContainText("Applied to table");
});

test("a different known query on results starts a new query, with Undo", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await askExplorer(page, "View all providers");

  await expect(page.locator(".query-chip")).toHaveText(["Providers"]);
  await expect(page.locator(".query-receipt")).toContainText("New query: Providers · 12 results");
  await page.locator(".query-receipt").getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
});

test("the search field is hidden while the query builder is open", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await page.getByRole("button", { name: "Edit conditions" }).click();
  await expect(askBar(page)).toHaveCount(0);

  await page.locator("#conditions-form").getByRole("button", { name: "Cancel" }).click();
  await expect(askBar(page)).toBeVisible();

  await page.getByRole("button", { name: "Edit conditions" }).click();
  await page.locator("#conditions-form").getByRole("button", { name: "Apply" }).click();
  await expect(askBar(page)).toBeVisible();
});

test("removing a refinement's condition in the builder restores its rows", async ({ page }) => {
  await openExplorer(page);
  await askExplorer(page, "Drifted workspaces");
  await askExplorer(page, "only staging");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(2);

  await page.getByRole("button", { name: "Edit conditions" }).click();
  await page.locator('[data-condition-row="1"]').getByRole("button", { name: "Remove condition" }).click();
  await page.locator("#conditions-form").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".results-table tbody tr")).toHaveCount(8);
});

test("entry helper text points to Albus when the panel is open before any query", async ({ page }) => {
  await openExplorer(page);
  await page.locator(".advisor-collapsed [data-action=open-advisor]").first().click();
  await expect(askBar(page)).toHaveCount(0);
  await expect(page.locator(".starter-card")).toContainText("Type your question in Albus →, or pick a starting point above.");
});
