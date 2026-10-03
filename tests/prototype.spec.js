const { test, expect } = require("@playwright/test");

const advisor = page => page.locator("#advisor");
const promptToggle = page => page.locator("#prompt-toggle");
const conversation = page => page.locator("#conversation");

async function openFailedRun(page) {
  await page.goto("/");
  await page.locator('tr[data-nav="run"]').click();
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

  await expect(conversation(page)).toContainText("There are three paths");
  await expect(promptToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#prompt-menu .prompt-list")).toBeHidden();
});

test("tier 1 from the run: Explorer opens as a table with chips and a one-line receipt", async ({ page }) => {
  await openRunInExplorer(page);

  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(page.locator(".results-table tbody tr")).toHaveCount(5);
  await expect(page.locator(".active-query.in-bar .query-chip")).toHaveText(["Modules", "Name is terraform-aws-rds", "Version is 5.1.0"]);
  // The panel is open, so the top bar shows chips, not a second text box.
  await expect(page.locator("#explorer-ask-input")).toHaveCount(0);
  await expect(conversation(page)).toContainText("Five other workspaces");
  await expect(page.locator(".receipt")).toContainText("Built query: Modules where Name is terraform-aws-rds and Version is 5.1.0 · 5 results");
  await expect(page.locator(".answer-card")).toHaveCount(0);

  // Refining from the Albus composer narrows the same table.
  await page.locator("#advisor-input").fill("only production");
  await page.locator("#advisor-input").press("Enter");
  await expect(page.locator(".results-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".active-query .query-chip").last()).toHaveText("Workspaces contains production");
  await expect(page.locator(".receipt").last()).toContainText("Refined: + Workspaces contains production");
  await page.locator(".receipt").last().getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".results-table tbody tr")).toHaveCount(5);

  await page.getByRole("button", { name: "Back to run" }).click();
  await expect(page.locator(".run-page")).toBeVisible();
  await expect(advisor(page)).toHaveClass(/is-open/);
  await expect(conversation(page)).toContainText("Five other workspaces");
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
  await expect(page.locator(".results-panel")).toContainText("terraform-aws-rds — all published versions");
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
  await expect(page.locator('[data-graph-node="payments-prod-eu"]')).toHaveClass(/is-focused/);
  await expect(page.locator(".answer-card").last()).toContainText("5 workspaces consume v5.1.0");

  // Back to the derived view, save it (keeps ✦ badge), then export CSV.
  await page.locator(".answer-card").last().getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".derived-banner")).toBeVisible();
  await page.locator(".results-panel").getByRole("button", { name: /Save as view/ }).click();
  await expect(page.locator("#view-name")).toHaveValue("RDS version lifecycle");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(page.locator(".saved-note")).toContainText("RDS version lifecycle");
  await page.getByRole("button", { name: /Types, Use cases and Saved views/i }).click();
  await page.locator("[data-action=saved-views]").click();
  await expect(page.locator(".explorer-modal")).toContainText("RDS version lifecycle");
  await expect(page.locator(".explorer-modal .derived-tag")).toContainText("Albus-derived");
  await page.locator(".explorer-modal [data-action=close-modal]").click();

  const download = page.waitForEvent("download");
  await page.locator(".results-panel").getByRole("button", { name: /Export CSV/ }).click();
  expect((await download).suggestedFilename()).toBe("rds-version-lifecycle.csv");
});

test("table rows have no click affordance; graph selection survives Table/Graph changes", async ({ page }) => {
  await page.goto("/");
  await page.locator('button[data-nav="explorer"]').click();
  await page.locator("#explorer-ask-input").fill("Drifted workspaces");
  await page.locator("#explorer-ask-input").press("Enter");
  const row = page.locator('tr[data-row-key="payments-prod-eu"]');
  await expect(row).toHaveCSS("cursor", "auto");
  await row.hover();
  await expect(row.locator("td").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.getByRole("button", { name: "Graph" }).click();
  await page.locator('[data-graph-node="payments-prod-eu"]').click();
  await expect(page.locator(".node-detail")).toContainText("payments-prod-eu");
  await expect(page.locator(".active-query")).toContainText("Drifted is true");

  await page.getByRole("button", { name: "Table" }).click();
  await page.getByRole("button", { name: "Graph" }).click();
  await expect(page.locator(".node-detail")).toContainText("payments-prod-eu");
});

test("new session resets Explorer query, selection, and messages", async ({ page }) => {
  await openRunInExplorer(page);
  await page.getByRole("button", { name: "New session" }).click();

  await expect(page.locator(".results-panel")).toHaveCount(0);
  await expect(page.locator(".starter-card")).toBeVisible();
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
