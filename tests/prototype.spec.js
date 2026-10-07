const { test, expect } = require("@playwright/test");

const advisor = page => page.locator("#advisor");
const promptToggle = page => page.locator("#prompt-toggle");
const conversation = page => page.locator("#conversation");

async function openFailedRun(page) {
  await page.goto("/");
  await page.locator('button[data-nav="workspace-runs"]').click();
  await page.locator('.workspace-run-row[data-nav="run"]').first().click();
}

async function openRunInExplorer(page) {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What other workspaces are using RDS module v5.1.0?" }).click();
  await page.getByRole("button", { name: /View module consumers in Explorer/ }).click();
}

test("failed run entry opens Albus with expanded investigation prompts", async ({ page }) => {
  await openFailedRun(page);

  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("The plan failed because");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#prompt-menu")).toContainText("What options do I have to fix this?");
});

test("failed plan shows its 2 creates in red, not green", async ({ page }) => {
  await openFailedRun(page);
  await expect(page.locator(".create-bar")).toHaveText("＋ 2 to create");
  await expect(page.locator(".create-bar")).toHaveCSS("background-color", "rgb(209, 28, 36)");
  await expect(page.locator(".run-stats span", { hasText: "+2" })).toHaveClass("red");
});

test("run → Explorer keeps the module name from the run investigation (rds/v5.1.0)", async ({ page }) => {
  await openFailedRun(page);
  await expect(page.locator(".run-page")).toContainText("modules/rds/v5.1.0");
  await page.getByRole("button", { name: "What other workspaces are using RDS module v5.1.0?" }).click();
  await page.getByRole("button", { name: /View module consumers in Explorer/ }).click();

  await expect(page.locator(".table-compact-hud .aq-title")).toHaveText("Workspaces using rds/v5.1.0");
  await expect(page.locator('.results-table td:last-child').first()).toHaveText("rds/v5.1.0");
  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator(".module-node strong")).toHaveText("rds/v5.1.0");
  await expect(conversation(page).locator(".node-row").first()).toContainText("rds/v5.1.0");
  await expect(page.locator("body")).not.toContainText(/labels\/aws|terraform-aws-rds/);
});

test("Workspaces → workspace Runs page → current run opens the failed run", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[data-nav="workspace-runs"]').click();

  const runsPage = page.locator(".workspace-runs-page");
  await expect(runsPage.locator("h1")).toHaveText("payments-prod-eu");
  await expect(runsPage.locator(".current-run-card")).toContainText("Fix: db_name is the force-replacement trigger");
  await expect(runsPage.locator(".workspace-run-list .workspace-run-row")).toHaveCount(3);
  await expect(advisor(page)).not.toHaveClass(/is-open/);

  await runsPage.locator(".breadcrumbs").getByRole("button", { name: "Workspaces" }).click();
  await expect(page.locator(".page h1").first()).toHaveText("Workspaces");
  await page.locator('button[data-nav="workspace-runs"]').click();
  await runsPage.locator(".current-run-card .workspace-run-row").click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
});

test("the failing workspace is payments-prod-eu everywhere, and isn't listed as its own consumer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".workspace-name-link")).toHaveText("payments-prod-eu");
  await page.locator('button[data-nav="workspace-runs"]').click();
  await expect(page.locator(".workspace-runs-page .breadcrumbs")).toContainText("payments-prod-eu");
  await page.locator(".current-run-card .workspace-run-row").click();
  await expect(page.locator(".run-page .breadcrumbs")).toContainText("payments-prod-eu / Runs");
  await expect(page.locator(".run-page h1").first()).toHaveText("payments-prod-eu");
  await expect(page.locator("body")).not.toContainText("my-workspace");

  await page.getByRole("button", { name: "What other workspaces are using RDS module v5.1.0?" }).click();
  await page.getByRole("button", { name: /View module consumers in Explorer/ }).click();
  const names = await page.locator(".results-table .row-name-link").allTextContents();
  expect(names).toContain("payments-prod-sa");
  expect(names).not.toContain("payments-prod-eu");
  expect(new Set(names).size).toBe(names.length);
});

test("a new page starts scrolled to the top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.locator("#main-content").evaluate(element => { element.scrollTop = 200; });
  expect(await page.locator("#main-content").evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.locator('button[data-nav="workspace-runs"]').click();
  await expect(page.locator(".workspace-runs-page h1")).toBeInViewport();
  expect(await page.locator("#main-content").evaluate(element => element.scrollTop)).toBe(0);
});

test("Workspaces list: Albus insight names the failed run and the workspaces at risk", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".workspace-albus-alert");
  await expect(card.locator("strong").first()).toHaveText("payments-prod-eu: latest run failed");
  await expect(card).toContainText("rds/v5.1.0 renames db_name");
  await expect(card).toContainText("5 other workspaces use rds/v5.1.0 (2 production)");
  await expect(card).toContainText("may hit the same failure on their next run");
  await expect(card.locator(".workspace-albus-sources")).toContainText("Explorer usage (indexed 6h ago)");
  await expect(card).not.toContainText(/More context available|ALBUS/);
  await expect(advisor(page)).not.toHaveClass(/is-open/);
});

test("Workspaces insight → Investigate run opens the failed run with Albus", async ({ page }) => {
  await page.goto("/");
  await page.locator(".workspace-albus-alert").getByRole("button", { name: "Investigate run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("The plan failed because");
  await expect(conversation(page)).not.toContainText("Five other workspaces");
  await expect(page.locator("#prompt-menu")).toContainText("What options do I have to fix this?");
});

test("Investigate run starts the default analysis even after viewing the at-risk workspaces", async ({ page }) => {
  await page.goto("/");
  await page.locator(".workspace-albus-alert").getByRole("button", { name: "View 5 workspaces" }).click();
  await expect(conversation(page)).toContainText("Five other workspaces");

  await page.locator("#nav-collapse").click();
  await page.locator('.side-nav button[data-nav-item="workspaces"]').click();
  await page.locator(".workspace-albus-alert").getByRole("button", { name: "Investigate run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(conversation(page)).toContainText("The plan failed because");
  await expect(conversation(page)).not.toContainText("Five other workspaces");

  // Same from the workspace overview card.
  await page.locator('.run-page .breadcrumbs [data-nav="workspaces"]').click();
  await page.locator('button[data-nav="workspace-runs"]').click();
  await page.locator(".workspace-runs-page .workspace-albus-alert").getByRole("button", { name: "Investigate run" }).click();
  await expect(conversation(page)).toContainText("The plan failed because");
});

test("Workspaces insight → View 5 workspaces lands on the consumers view and the main path continues", async ({ page }) => {
  await page.goto("/");
  await page.locator(".workspace-albus-alert").getByRole("button", { name: "View 5 workspaces" }).click();

  await expect(page.locator(".table-compact-hud .aq-title")).toHaveText("Workspaces using rds/v5.1.0");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(5);
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("Five other workspaces are using the RDS module at v5.1.0.");
  await expect(conversation(page)).toContainText("You are now viewing the module consumers in Explorer.");
  await expect(conversation(page)).not.toContainText("Ask about the results in the table");

  // Tier 2 continues from here, and "Back to run" still reaches the failed run.
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Which RDS module versions are no longer in use?" }).click();
  await expect(page.locator(".table-compact-hud")).toContainText("rds — all published versions");
  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
});

test("workspace overview insight is about this workspace only and opens its failed run", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[data-nav="workspace-runs"]').click();
  const card = page.locator(".workspace-runs-page .workspace-albus-alert");
  await expect(card.locator("strong").first()).toHaveText("Latest run failed");
  await expect(card).toContainText("rds v4.0.0 → v5.1.0 upgrade would replace this production database");
  await expect(card).not.toContainText(/other workspaces|rds\/v5\.1\.0 \(/);
  await card.getByRole("button", { name: "Investigate run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
});

test("Explore in Albus opens and closes the Albus panel", async ({ page }) => {
  await openFailedRun(page);
  const toggle = page.getByRole("button", { name: "✦ Explore in Albus" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await toggle.click();
  await expect(advisor(page)).not.toHaveClass(/is-open/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("The plan failed because");
});

test("run prompts collapse after a guided question generates a response", async ({ page }) => {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What options do I have to fix this?" }).click();

  await expect(conversation(page)).toContainText("You can get onto v5.1 without replacing the database");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu .prompt-list")).toBeHidden();
});

test("fix options lead with the forward path (v5.1.1 keeping db_name); v4.0.0 is only interim", async ({ page }) => {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What options do I have to fix this?" }).click();
  const options = conversation(page).locator(".advisor-message").last().locator("ol > li");
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toContainText("Recommended: upgrade to v5.1.1 that keeps your db_name");
  await expect(options.nth(1)).toContainText("Until v5.1.1 is published: stay on v4.0.0");
  await expect(options.nth(2)).toContainText("Controlled replacement");
  await expect(conversation(page).locator(".code-card")).toContainText('db_name = "app-db"');
  await expect(conversation(page)).not.toContainText(/revert|roll ?back/i);
});

test("RETURNED list is named for its contents, never 'nodes'", async ({ page }) => {
  await openRunInExplorer(page);
  await expect(conversation(page).locator(".results-heading span")).toHaveText("RETURNED MODULES & WORKSPACES");
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Which RDS module versions are no longer in use?" }).click();
  await expect(conversation(page).locator(".results-heading span")).toHaveText("RETURNED VERSIONS");
  await expect(page.locator('tr[data-row-key="v4.0.0"]')).toContainText("Interim target until v5.1.1");
});

test("tier 1 from the run: Explorer opens as a table with chips and a one-line receipt", async ({ page }) => {
  await openRunInExplorer(page);

  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(page.locator(".results-table tbody tr")).toHaveCount(5);
  await expect(page.locator(".conditions-accordion .query-chip")).toHaveText(["Modules", "Name is rds", "Version is 5.1.0"]);
  // The panel is open, so the top bar shows chips, not a second text box.
  await expect(page.locator("#explorer-ask-input")).toHaveCount(0);
  await expect(conversation(page)).toContainText("Five other workspaces");
  await expect(page.locator(".receipt")).toContainText("Built query: Modules where Name is rds and Version is 5.1.0 · 5 results");
  await expect(page.locator(".answer-card")).toHaveCount(0);

  // Refining from the Albus composer narrows the same table.
  await page.locator("#advisor-input").fill("only production");
  await page.locator("#advisor-input").press("Enter");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".conditions-accordion .query-chip").last()).toHaveText("Workspaces contains production");
  await expect(page.locator(".receipt").last()).toContainText("Refined: + Workspaces contains production");
  await page.locator(".receipt").last().getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".results-table tbody tr")).toHaveCount(5);

  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("Five other workspaces");
});

test("Back to query and results keeps Albus open with the run conversation", async ({ page }) => {
  await openRunInExplorer(page);
  await page.locator(".table-compact-hud").getByRole("button", { name: "← Back to query and results" }).click();

  await expect(page.locator(".explorer-hud")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("Five other workspaces");
  await expect(page.locator(".explorer-hud")).toContainText("Type your question in Albus →");

  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
});

test("Back to run restores the run investigation history", async ({ page }) => {
  await openFailedRun(page);
  await page.getByRole("button", { name: "What options do I have to fix this?" }).click();
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "What other workspaces are using RDS module v5.1.0?" }).click();
  await page.getByRole("button", { name: /View module consumers in Explorer/ }).click();

  // In Explorer, continue with tier 2, then go back.
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Which RDS module versions are no longer in use?" }).click();
  await expect(page.locator(".table-compact-hud")).toContainText("rds — all published versions");
  await page.getByRole("button", { name: "Back to run" }).click();

  await expect(page.locator(".run-page")).toBeVisible();
  const questions = conversation(page).locator(".user-message p");
  await expect(questions).toHaveText(["What options do I have to fix this?", "What other workspaces are using RDS module v5.1.0?"]);
  await expect(conversation(page)).toContainText("The plan failed because");
  await expect(conversation(page)).toContainText("Recommended: upgrade to v5.1.1");
  await expect(conversation(page)).toContainText("Five other workspaces");
  await expect(conversation(page)).not.toContainText("RETURNED");

  // Keep investigating on the run page, go to Explorer again, and come back: nothing is lost.
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Who introduced the lifecycle guard?" }).click();
  await conversation(page).getByRole("button", { name: /View module consumers in Explorer/ }).click();
  await expect(page.locator(".table-compact-hud .aq-title")).toHaveText("Workspaces using rds/v5.1.0");
  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(questions).toHaveText(["What options do I have to fix this?", "What other workspaces are using RDS module v5.1.0?", "Who introduced the lifecycle guard?"]);
});

test("tier 2 → tier 3 → graph → save → export (demo flow §5)", async ({ page }) => {
  await openRunInExplorer(page);

  // Tier 2: Albus names the sources it combined and switches the table to an Albus-derived view.
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Which RDS module versions are no longer in use?" }).click();
  const card = page.locator(".answer-card").last();
  await expect(card.locator(".card-basis")).toHaveText("I compared your private registry with Explorer usage.");
  await expect(card).not.toContainText(/Explorer (only|can't|doesn't)/);
  await expect(card.locator(".card-label")).toHaveText(["Interpretation", "Sources & freshness", "Insight"]);
  await expect(card).not.toContainText(/beyond explorer/i);
  // Follow-ups are not repeated in the card; Suggested questions follows the latest answer.
  await expect(card.locator("[data-prompt]")).toHaveCount(0);
  await expect(page.locator("#prompt-menu")).toContainText("Should we deprecate v5.1.0?");
  await expect(card).toContainText("Private registry");
  await expect(card).toContainText("last indexed 6h ago");
  await expect(card).toContainText("Couldn't check");
  await expect(card).toContainText("Applied to table");
  await expect(page.locator(".derived-banner")).toContainText("Albus-derived view");
  await expect(page.locator(".table-compact-hud")).toContainText("rds — all published versions");
  await expect(page.locator("th.albus-col")).toHaveText(["✦ Registry status", "✦ Last used", "✦ Note"]);
  await expect(page.locator("th.albus-col").first()).toHaveAttribute("title", /Private registry/);
  await expect(page.locator(".derived-table tbody tr")).toHaveCount(6);
  await expect(page.locator("tr.is-highlighted")).toHaveCount(3);
  await expect(page.locator('tr[data-row-key="v4.1.0"]')).toHaveClass(/is-highlighted/);
  // The chat never repeats the table.
  await expect(conversation(page).locator("table")).toHaveCount(0);

  // Row links in the insight highlight the table row.
  await card.locator('[data-row-ref="v3.2.0"]').click();
  await expect(page.locator('tr[data-row-key="v3.2.0"]')).toHaveClass(/is-highlighted/);
  await expect(page.locator("tr.is-highlighted")).toHaveCount(1);

  // Tier 3: read-only recommendation that references rows.
  await promptToggle(page).click();
  await page.locator("#prompt-menu").getByRole("button", { name: "Should we deprecate v5.1.0?" }).click();
  const recommendation = page.locator(".answer-card.tier-3").last();
  await expect(recommendation).toContainText("publish a fix first");
  await expect(recommendation).toContainText("v5.1.1");
  await expect(page.locator('tr[data-row-key="v5.1.0"]')).toHaveClass(/is-highlighted/);
  await expect(recommendation.getByRole("button", { name: /Copy recommendation/ })).toBeVisible();
  await recommendation.getByRole("button", { name: /Copy recommendation/ }).click();
  await expect(recommendation).toContainText("Copied");

  // Graph on demand: the v5.1.0 row's link opens the consumer topology.
  await page.locator('tr[data-row-key="v5.1.0"]').getByRole("button", { name: /view blast radius/ }).click();
  await expect(page.locator(".topology")).toBeVisible();
  await expect(page.locator('[data-graph-node="payments-prod-sa"]')).toHaveClass(/is-focused/);
  await expect(page.locator(".answer-card").last()).toContainText("5 workspaces consume v5.1.0");

  // Back to the derived view, save it (keeps ✦ badge), then export CSV.
  await page.locator(".answer-card").last().getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".derived-banner")).toBeVisible();
  await page.locator(".table-actions").getByRole("button", { name: /Save as view/ }).click();
  await expect(page.locator("#view-name")).toHaveValue("RDS version lifecycle");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(page.locator(".saved-note")).toContainText("RDS version lifecycle");

  const download = page.waitForEvent("download");
  await page.locator(".table-actions").getByRole("button", { name: /Export CSV/ }).click();
  expect((await download).suggestedFilename()).toBe("rds-version-lifecycle.csv");

  // The saved view (with its ✦ badge) is listed under Browse → Saved views on the Explorer entry card.
  await page.locator(".table-compact-hud").getByRole("button", { name: "← Back to query and results" }).click();
  await page.locator(".explorer-hud").getByRole("button", { name: /Types, Use cases and Saved views/i }).click();
  await page.locator("[data-action=saved-views]").click();
  await expect(page.locator(".explorer-modal")).toContainText("RDS version lifecycle");
  await expect(page.locator(".explorer-modal .derived-tag")).toContainText("Albus-derived");
});

test("table rows have no hover affordance; graph selection shows in the Albus list and survives Table/Graph", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
  await page.locator("#explorer-ask-input").fill("Drifted workspaces");
  await page.locator("#explorer-ask-input").press("Enter");
  const row = page.locator('tr[data-row-key="payments-prod-sa"]');
  await expect(row).toHaveCSS("cursor", "auto");
  await row.hover();
  await expect(row.locator("td").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "Graph" }).click();
  await page.locator('[data-graph-node="payments-prod-sa"]').click();
  await expect(conversation(page).locator(".node-row.is-open")).toContainText("payments-prod-sa");
  await expect(page.locator(".graph-query-row .compact-query-content")).toContainText("Drifted workspaces");

  await page.getByRole("button", { name: "Table" }).click();
  await expect(row).toHaveClass(/is-selected/);
  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator('[data-graph-node="payments-prod-sa"]')).toHaveClass(/is-focused/);
});

test("run → Explorer graph: RETURNED MODULES & WORKSPACES lists the module and its consumers (design 03)", async ({ page }) => {
  await openRunInExplorer(page);
  await page.getByRole("button", { name: "Graph" }).click();
  await expect(conversation(page).locator(".node-row")).toHaveCount(6);
  await expect(conversation(page).locator(".results-heading span")).toHaveText("RETURNED MODULES & WORKSPACES");
  await expect(conversation(page)).not.toContainText(/nodes/i);
  await page.locator('[data-action="select-module"]').click();
  const open = conversation(page).locator(".node-row.is-open");
  await expect(open).toContainText("rds/v5.1.0");
  await expect(open).toContainText("app.terraform.io/CoolCorp/rds/aws");
  await expect(open).toContainText("5 workspaces (2 production)");
  await expect(conversation(page)).toContainText("Five other workspaces");
});

test("module consumers use the Explorer Tag property, not Environment", async ({ page }) => {
  await openRunInExplorer(page);
  await expect(page.locator(".results-table th")).toContainText(["Tag"]);
  await expect(page.locator(".results-table thead")).not.toContainText("Environment");

  await conversation(page).locator('[data-node-row="payments-prod-sa"]').click();
  const details = conversation(page).locator(".node-row.is-open .node-row-details");
  await expect(details.locator("dt").first()).toHaveText("Tag");
  await expect(details.locator("dd").first()).toHaveText("production");
  await expect(details).not.toContainText("Environment");

  // Canvas node card (Albus closed) uses the same label.
  await page.locator("#advisor-close").click();
  await page.getByRole("button", { name: "Graph" }).click();
  await page.locator('[data-graph-node="payments-staging"]').click();
  await expect(page.locator(".node-detail")).toContainText("Tag");
  await expect(page.locator(".node-detail")).not.toContainText("Environment");
});

test("new session resets Explorer query, selection, and messages", async ({ page }) => {
  await openRunInExplorer(page);
  await page.getByRole("button", { name: "New session" }).click();

  await expect(page.locator(".results-panel")).toHaveCount(0);
  await expect(page.locator(".explorer-hud")).toBeVisible();
  await expect(conversation(page)).not.toContainText("Five other workspaces");
  await expect(conversation(page)).not.toContainText("Built query");
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

  test(`${viewport.name} keeps the derived table and answer card visible side by side`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openRunInExplorer(page);
    await page.locator("#advisor-input").fill("Which RDS module versions are no longer in use?");
    await page.locator("#advisor-input").press("Enter");

    await expect(page.locator(".derived-table")).toBeVisible();
    await expect(page.locator(".answer-card")).toBeVisible();
    const table = await page.locator(".results-panel").boundingBox();
    const panel = await advisor(page).boundingBox();
    expect(table.x + table.width).toBeLessThanOrEqual(panel.x + 1);
  });
}
