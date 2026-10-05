const { test, expect } = require("@playwright/test");

const hudInput = page => page.locator("#explorer-ask-input");
const panel = page => page.locator("#advisor");
const latestReceipt = page => page.locator("#conversation .receipt").last();
const tableRows = page => page.locator(".results-table tbody tr");
const nodeRows = page => page.locator("#conversation .node-row");

async function openExplorer(page) {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
}

// Entry heads-up display search box.
async function searchHud(page, question) {
  await hudInput(page).fill(question);
  await hudInput(page).press("Enter");
}

// Follow-ups once Albus is open.
async function askAlbus(page, question) {
  await page.locator("#advisor-input").fill(question);
  await page.locator("#advisor-input").press("Enter");
}

test("entry shows the original heads-up display with no Albus-specific wording", async ({ page }) => {
  await openExplorer(page);
  const hud = page.locator(".explorer-hud");

  await expect(panel(page)).not.toHaveClass(/is-open/);
  await expect(hud.locator(".breadcrumbs")).toContainText("CoolCorp / Explorer / Types");
  await expect(hud.locator("h1")).toHaveText("Explorer");
  await expect(hud).toContainText("Explore your data to analyze your organization's Terraform usage.");
  await expect(hud.locator(".field-label")).toHaveText(["VIEW MODE", "BROWSE", "ENTER A NATURAL LANGUAGE QUERY", "EXPLORE YOUR INFRASTRUCTURE"]);
  await expect(hud.locator(".hud-toggle button")).toHaveText(["Graph", "Table View"]);
  await expect(hud.getByRole("button", { name: /Types, Use cases and Saved views/ })).toBeVisible();
  await expect(hudInput(page)).toHaveAttribute("placeholder", "Ex. production workspaces using AWS vx.x.x");
  await expect(hudInput(page)).toHaveValue("");
  await expect(hud.getByRole("button", { name: "Search" })).toBeVisible();
  await expect(hud.locator(".hud-prompts button")).toHaveText(["View all modules↵", "View all providers↵"]);
  await expect(hud).not.toContainText(/albus|✦|no longer in use/i);
});

test("Browse dropdown opens the original menu and runs scripted views", async ({ page }) => {
  await openExplorer(page);
  const hud = page.locator(".explorer-hud");
  await hud.getByRole("button", { name: /Types, Use cases and Saved views/ }).click();
  await expect(hud.locator(".browse-menu")).toContainText("PRE-DEFINED VIEWS");
  await hud.locator(".browse-menu").getByRole("button", { name: "Modules" }).click();
  await expect(page.locator(".results-panel")).toContainText("View all modules");
});

test("a query opens Albus with a summary and the RETURNED NODES list (table)", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");

  await expect(panel(page)).toHaveClass(/is-open/);
  await expect(tableRows(page)).toHaveCount(8);
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
  await expect(latestReceipt(page)).toContainText("Built query: Workspaces where Drifted is true · 8 results");
  await expect(page.locator("#conversation .results-summary")).toContainText("This table lists workspaces where the infrastructure currently differs");
  await expect(page.locator("#conversation .results-heading")).toContainText("RETURNED NODES");
  await expect(nodeRows(page)).toHaveCount(8);
  await expect(page.locator("#node-search")).toHaveAttribute("placeholder", "Search nodes");
  // Albus is open, so the page has no second text box.
  await expect(hudInput(page)).toHaveCount(0);
});

test("list rows, table rows and graph nodes stay in sync", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");

  // Panel row -> details + table row selected.
  await page.locator('[data-node-row="payments-prod-us"]').first().click();
  const openRow = page.locator("#conversation .node-row.is-open");
  await expect(openRow).toContainText("payments-prod-us");
  await expect(openRow).toContainText("HIDE INFORMATION");
  await expect(openRow.locator(".node-row-details")).toContainText("VCS repo");
  await expect(page.locator('tr[data-row-key="payments-prod-us"]')).toHaveClass(/is-selected/);

  // Graph view: same node is focused; clicking another node opens it in the list.
  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator('[data-graph-node="payments-prod-us"]')).toHaveClass(/is-focused/);
  await page.locator('[data-graph-node="analytics-prod"]').click();
  await expect(page.locator("#conversation .node-row.is-open")).toContainText("analytics-prod");

  // Summary row link selects the row too.
  await page.getByRole("button", { name: "Table" }).click();
  await page.locator("#conversation .results-summary [data-row-ref=payments-prod-eu]").click();
  await expect(page.locator("#conversation .node-row.is-open")).toContainText("payments-prod-eu");
  await expect(page.locator('tr[data-row-key="payments-prod-eu"]')).toHaveClass(/is-selected/);

  // Hide information collapses it.
  await page.locator("#conversation .node-row.is-open .node-row-toggle").click();
  await expect(page.locator("#conversation .node-row.is-open")).toHaveCount(0);
});

test("Search nodes filters the list", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await page.locator("#node-search").fill("staging");
  await expect(page.locator("#conversation .node-row:not([hidden]) .node-name")).toHaveText(["payments-staging", "platform-staging"]);
  await page.locator("#node-search").fill("");
  await expect(page.locator("#conversation .node-row:not([hidden])")).toHaveCount(8);
});

test("VIEW MODE on the entry card carries into the first query", async ({ page }) => {
  await openExplorer(page);
  await page.locator(".hud-toggle").getByRole("button", { name: "Graph" }).click();
  await expect(page.locator(".hud-toggle button.active")).toHaveText("Graph");
  await page.locator(".hud-prompts").getByRole("button", { name: /View all providers/ }).click();

  await expect(page.locator(".relationship-topology")).toBeVisible();
  // Graph results get the same RETURNED NODES list.
  await expect(nodeRows(page).first()).toContainText("hashicorp/aws");
  await expect(page.locator("#conversation .results-summary")).toContainText("providers used across CoolCorp");
});

test("refining in Albus narrows the table and the list; Undo restores both", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await askAlbus(page, "only production");

  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true", "Tags contains production"]);
  await expect(tableRows(page)).toHaveCount(4);
  await expect(nodeRows(page)).toHaveCount(4);
  await expect(latestReceipt(page)).toContainText("Refined: + Tags contains production · Workspaces where Drifted is true and Tags contains production · 4 results");

  await latestReceipt(page).getByRole("button", { name: "Undo" }).click();
  await expect(tableRows(page)).toHaveCount(8);
  await expect(nodeRows(page)).toHaveCount(8);
});

test("with Albus closed, the page search field refines results", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await page.locator("#advisor-close").click();

  await expect(hudInput(page)).toHaveAttribute("placeholder", "Refine these results or ask a question…");
  await hudInput(page).fill("only staging");
  await hudInput(page).press("Enter");
  await expect(tableRows(page)).toHaveCount(2);
  await expect(page.locator(".query-receipt")).toContainText("Refined: + Tags contains staging");
  // Refining doesn't reopen Albus.
  await expect(panel(page)).not.toHaveClass(/is-open/);
});

test("a complex query and its refinement can be typed in one go", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "drifted production workspaces");
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true", "Tags contains production"]);
  await expect(tableRows(page)).toHaveCount(4);
  await expect(latestReceipt(page)).toContainText("Built query: Workspaces where Drifted is true and Tags contains production · 4 results");

  await latestReceipt(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".explorer-hud")).toBeVisible();
});

test("unmatched text on results changes nothing and says so", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await askAlbus(page, "make it sparkle");

  await expect(tableRows(page)).toHaveCount(8);
  await expect(latestReceipt(page)).toContainText("No change: I couldn't turn “make it sparkle” into a condition");
});

test("a different known query starts a new query, with Undo", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await askAlbus(page, "View all providers");

  await expect(page.locator(".query-chip")).toHaveText(["Providers"]);
  await expect(latestReceipt(page)).toContainText("New query: Providers · 12 results");
  await latestReceipt(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
});

test("typed natural language returns the same rows as the starting point", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Show me all modules");
  const typedRows = await tableRows(page).allTextContents();

  await openExplorer(page);
  await page.locator(".hud-prompts").getByRole("button", { name: /View all modules/ }).click();
  const starterRows = await tableRows(page).allTextContents();

  expect(typedRows).not.toHaveLength(0);
  expect(typedRows).toEqual(starterRows);
});

test("an unmatched question on entry still returns a scoped Explorer table", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "show infrastructure I should review");
  await expect(page.locator(".results-panel")).toContainText("Production workspaces");
  await expect(tableRows(page)).toHaveCount(6);
});

test("Albus questions on entry still get the Albus-derived answer", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Which RDS module versions are no longer in use?");

  await expect(panel(page)).toHaveClass(/is-open/);
  await expect(page.locator(".derived-table tbody tr")).toHaveCount(6);
  await expect(page.locator("#conversation .card-basis")).toHaveText("I compared your private registry with Explorer usage.");
  await expect(page.locator("#conversation")).toContainText("3 of 6 versions are unused");
  await expect(nodeRows(page)).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Graph" })).toBeDisabled();
});

test("Edit conditions follows the Explorer builder: Type, then WHERE column / operator / value", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await page.getByRole("button", { name: "Edit conditions" }).click();

  const editor = page.locator("#conditions-form");
  await expect(editor.getByLabel("Type")).toHaveValue("workspaces");
  const row = editor.locator('[data-condition-row="0"]');
  await expect(row.locator(".clause")).toHaveText("WHERE");
  await expect(row.getByLabel("Column")).toHaveValue("drifted");
  await expect(row.getByLabel("Operator")).toHaveValue("is");
  await expect(row.getByLabel("Value")).toHaveValue("true");

  await row.getByLabel("Column").selectOption({ label: "Resource count" });
  await expect(row.getByLabel("Operator").locator("option")).toContainText(["=", "≠", ">", "<"]);
  await row.getByLabel("Operator").selectOption({ label: ">" });
  await row.getByLabel("Value").fill("15");

  await editor.getByRole("button", { name: "+ Add condition" }).click();
  await expect(editor.locator('[data-condition-row="1"] .clause')).toHaveText("AND");
  await editor.locator('[data-condition-row="1"]').getByRole("button", { name: "Remove condition" }).click();
  await expect(editor.locator('[data-condition-row="1"]')).toHaveCount(0);

  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Resource count is greater than 15"]);
  await expect(latestReceipt(page)).toContainText("Edited by you: Workspaces where Resource count is greater than 15");

  await latestReceipt(page).getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Workspaces", "Drifted is true"]);
});

test("changing Type in the builder swaps the available columns", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await page.getByRole("button", { name: "Edit conditions" }).click();
  const editor = page.locator("#conditions-form");

  await editor.getByLabel("Type").selectOption("modules");
  const column = editor.locator('[data-condition-row="0"]').getByLabel("Column");
  await expect(column.locator("option")).toHaveText(["Name", "Version", "Source", "Workspace count", "Workspaces"]);
  await editor.locator('[data-condition-row="0"]').getByLabel("Value").fill("terraform-aws-rds");
  await editor.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".query-chip")).toHaveText(["Modules", "Name is terraform-aws-rds"]);
});

test("the page search field is hidden while the query builder is open", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await page.locator("#advisor-close").click();
  await page.getByRole("button", { name: "Edit conditions" }).click();
  await expect(hudInput(page)).toHaveCount(0);

  await page.locator("#conditions-form").getByRole("button", { name: "Cancel" }).click();
  await expect(hudInput(page)).toBeVisible();
});

test("removing a refinement's condition in the builder restores its rows", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  await askAlbus(page, "only staging");
  await expect(tableRows(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Edit conditions" }).click();
  await page.locator('[data-condition-row="1"]').getByRole("button", { name: "Remove condition" }).click();
  await page.locator("#conditions-form").getByRole("button", { name: "Apply" }).click();
  await expect(tableRows(page)).toHaveCount(8);
  await expect(nodeRows(page)).toHaveCount(8);
});

test("entry card points to Albus when the panel is open before any query", async ({ page }) => {
  await openExplorer(page);
  await page.locator(".advisor-collapsed [data-action=open-advisor]").first().click();
  await expect(hudInput(page)).toHaveCount(0);
  await expect(page.locator(".explorer-hud")).toContainText("Type your question in Albus →, or pick a starting point below.");
});

test("breadcrumb: Explorer links back to the entry card; CoolCorp goes to Workspaces", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  const crumbs = page.locator(".explorer-header .breadcrumbs");
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText("Drifted workspaces");

  await crumbs.getByRole("button", { name: "Explorer" }).click();
  await expect(page.locator(".explorer-hud")).toBeVisible();
  // Going back keeps Albus open; the entry card points to it instead of showing a second text box.
  await expect(panel(page)).toHaveClass(/is-open/);
  await expect(page.locator(".explorer-hud")).toContainText("Type your question in Albus →");
  await expect(page.locator('.side-nav button[data-nav-item="workspaces"]')).toBeVisible();

  await page.locator(".explorer-hud .breadcrumbs").getByRole("button", { name: "CoolCorp" }).click();
  await expect(page.locator(".standard-page h1")).toHaveText("Workspaces");
});

test("side navigation can be expanded from Explorer results to get back to Workspaces", async ({ page }) => {
  await openExplorer(page);
  await searchHud(page, "Drifted workspaces");
  const workspacesLink = page.locator('.side-nav button[data-nav-item="workspaces"]');
  await expect(workspacesLink).toBeHidden();

  await page.locator("#nav-collapse").click();
  await expect(workspacesLink).toBeVisible();
  await workspacesLink.click();
  await expect(page.locator(".standard-page h1")).toHaveText("Workspaces");
});
