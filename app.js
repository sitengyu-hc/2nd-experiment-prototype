(function () {
  "use strict";

  // Albus tiers demo ("Explorer shows, Albus answers"). See ../albus-tiers-demo-plan.md.
  //   Tier 1 (translate): question -> Explorer query. Table + editable chips; one-line receipt only.
  //   Tier 2 (join sources): Albus-derived view joining Explorer with other sources; answer card in the panel.
  //   Tier 3 (reason): recommendation in the panel referencing table rows (click -> highlight).
  // One text box at a time: the "Ask Albus or filter…" bar while the panel is closed, the panel
  // composer while it is open (the bar then shows the active query as chips).

  const data = window.PROTOTYPE_DATA;
  const RDS_CONSUMERS = data.rdsConsumersQuery;
  const RDS_VERSIONS = data.rdsVersionsQuery;
  // Same name the run investigation uses for the failing module (modules/rds/v5.1.0).
  const RDS_MODULE = `rds/${data.run.currentModuleVersion}`;

  const state = {
    view: "workspaces",
    previousView: null,
    advisorOpen: false,
    messages: [],
    impactMode: false, // true while the run investigation is continued in Explorer
    advisorJourney: "run",
    navCollapsed: false,
    promptsOpen: true,
    explorerDisplay: "table",
    browseOpen: false,
    selectedNode: null,
    modal: null,
    savedViews: [],
    lastSaved: null,
    explorerQuery: null,
    queryType: null,
    queryConditions: [],
    queryAlbus: null,
    refinements: [], // ids of data.refinements applied to the current query
    runMessages: null, // the run investigation, kept while the user is in Explorer so "Back to run" restores it
    nodeSearch: "", // filter text for the RETURNED <type> list in the Albus panel
    hiddenColumns: [], // table columns hidden via "View columns"
    columnsMenuOpen: false,
    graphHudHidden: false,
    tableHudHidden: false,
    conditionDraft: null,
    editingConditions: false,
    queryHistory: [],
    highlightedRows: [],
    receipt: null
  };

  const main = document.querySelector("#main-content");
  const advisor = document.querySelector("#advisor");
  const conversation = document.querySelector("#conversation");
  const promptMenu = document.querySelector("#prompt-menu");
  const input = document.querySelector("#advisor-input");

  function defaultPromptsOpen(journey = state.advisorJourney) {
    return journey === "run";
  }

  const icon = (name) => {
    const paths = {
      database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      warning: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/>',
      explorer: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/>'
    };
    return `<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  };

  const consumers = () => data.affectedWorkspaces.slice(1);
  const rdsModuleDetails = () => {
    const production = consumers().filter(node => node.environment === "production").length;
    return [
      ["Version", data.run.currentModuleVersion],
      ["Source", "app.terraform.io/CoolCorp/rds/aws"],
      ["Consumers", `${consumers().length} workspaces (${production} production)`],
      [`Change from ${data.run.previousModuleVersion}`, "Renames db_name (forces replacement); adds prevent_destroy"]
    ];
  };

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  function setView(view, options = {}) {
    const changed = state.view !== view;
    if (changed) state.previousView = state.view;
    state.view = view;
    if (view === "run" || view === "workspaces" || view === "workspace-runs") {
      state.advisorOpen = false;
      advisor.classList.remove("is-open");
      document.body.classList.remove("advisor-open");
    }
    if (options.impactMode !== undefined) state.impactMode = options.impactMode;
    if (options.advisorJourney && options.advisorJourney !== state.advisorJourney) {
      state.advisorJourney = options.advisorJourney;
      state.messages = [];
      state.promptsOpen = defaultPromptsOpen(options.advisorJourney);
      initializeAdvisor();
    }
    renderMain();
    // A new page starts at the top (the main pane otherwise keeps the previous page's scroll position).
    if (changed) main.scrollTop = 0;
    renderConversation();
    updateScope();
    updateNavigation();
    main.focus();
  }

  function renderMain() {
    const explorerResults = state.view === "explorer" && Boolean(state.explorerQuery);
    document.body.classList.toggle("explorer-view", state.view === "explorer");
    document.body.classList.toggle("explorer-impact", explorerResults);
    document.body.classList.toggle("explorer-direct", state.view === "explorer" && !explorerResults);
    // Explorer results collapse the nav to a thin rail by default; the nav toggle still expands it (CSS keyed on nav-collapsed).
    if (state.view === "workspaces") main.innerHTML = workspacesView();
    if (state.view === "workspace-runs") main.innerHTML = workspaceRunsView();
    if (state.view === "run") main.innerHTML = runView();
    if (state.view === "explorer") main.innerHTML = explorerView();
  }

  function workspacesView() {
    const rows = [
      [data.workspace.name, "Errored", "team-terraform-sleep", "Default Project", "a few seconds ago"],
      ["staging-web", "Policy checked", "None", "tf-remote-dev", "a few seconds ago"],
      ["prod-database", "Planned and finished", "None", "tf-remote-test", "2 minutes ago"],
      ["sandbox-testing", "No status reported", "None", "tf-local-cloud", "3 minutes ago"],
      ["feature-toggle-x", "Paused", "telemetry-vcs-3", "tf-local-cloud-dev", "6 minutes ago"],
      ["qa-backend", "Running", "team-terraform-sleep", "tf-local-box-ci", "a day ago"],
      ["legacy-migration", "Applied", "None", "tf-test-canary", "5 days ago"]
    ];
    return `<div class="page standard-page">
      <div class="breadcrumbs">CoolCorp / <strong>Workspaces</strong></div>
      <div class="page-title-row"><div><h1>Workspaces</h1><p class="lede">Manage infrastructure across your organization.</p></div><button class="primary">New workspace</button></div>
      <div class="tabs"><button class="active">Needs attention</button><button>Errored</button><button>Running</button><button>On hold</button><button>Completed</button></div>
      <div class="toolbar"><label class="search-box">⌕ <input placeholder="Search by workspace name"></label><button class="secondary">All filters</button><span>No filters applied</span></div>
      ${workspacesInsight()}
      <div class="table-wrap"><table><thead><tr><th>Workspace</th><th>Status</th><th>Repository</th><th>Project</th><th>Latest change</th></tr></thead><tbody>
        ${rows.map((row, index) => `<tr><td>${index === 0 ? `<button type="button" class="workspace-name-link" data-nav="workspace-runs"><strong>${row[0]}</strong></button>` : `<strong>${row[0]}</strong>`}</td><td><span class="status-dot ${row[1].toLowerCase().replaceAll(" ", "-")}"></span>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`).join("")}
      </tbody></table><div class="pagination">1–7 of 100 <button>1</button><button>2</button><button>3</button><button>…</button><button>10</button></div></div>
    </div>`;
  }

  // Albus insight cards (one persona each). Workspaces list = platform engineer: one failed run plus the
  // workspaces at risk of the same failure. Overview = this workspace only. Counts come from the scenario data.
  function albusInsight({ label, title, body, sources, actions, className = "" }) {
    return `<section class="workspace-albus-alert ${className}" aria-label="${escapeAttr(label)}"><div class="workspace-albus-copy"><span class="workspace-albus-spark" aria-hidden="true">✦</span><div><strong>${title}</strong><p>${body}</p>${sources ? `<small class="workspace-albus-sources">Sources: ${sources}</small>` : ""}</div></div><div class="workspace-albus-actions">${actions}</div></section>`;
  }

  function workspacesInsight() {
    const atRisk = consumers();
    const production = atRisk.filter(node => node.environment === "production").length;
    return albusInsight({
      label: "Albus insight",
      title: `${escapeHtml(data.workspace.name)}: latest run failed`,
      body: `<code>${RDS_MODULE}</code> renames <code>db_name</code>, which forces the production database to be replaced; <code>prevent_destroy</code> blocked it. <b>${atRisk.length} other workspaces use ${RDS_MODULE} (${production} production)</b> and may hit the same failure on their next run.`,
      sources: "run diagnostics · Explorer usage (indexed 6h ago)",
      actions: `<button type="button" class="workspace-albus-button" data-action="investigate-run">Investigate run</button><button type="button" class="workspace-albus-button" data-action="view-at-risk">View ${atRisk.length} workspaces</button>`
    });
  }

  function overviewInsight() {
    return albusInsight({
      label: "Albus insight",
      className: "workspace-runs-alert",
      title: "Latest run failed",
      body: `The <code>rds</code> ${data.run.previousModuleVersion} → ${data.run.currentModuleVersion} upgrade would replace this production database. Nothing was changed; <code>prevent_destroy</code> stopped it.`,
      actions: `<button type="button" class="workspace-albus-button" data-action="investigate-run">Investigate run</button>`
    });
  }

  function workspaceRunsView() {
    const runs = [
      { title: data.run.title, id: `#${data.run.id}`, actor: data.run.actor, source: data.run.source, branch: "Main", commit: "d972f24", status: "Current", current: true },
      { title: "Update workflow triggers", id: "#run-gRf9Hj2sNc", actor: "jdoe", source: "GitHub", branch: "Main", commit: "b81e7g9", status: "Applied" },
      { title: "Use new trusted SHA", id: "#run-tY5Lp8qJa", actor: "jdoe", source: "GitHub", branch: "Main", commit: "h53i1a8", status: "Applied" }
    ];
    const runRow = run => `<button type="button" class="workspace-run-row ${run.current ? "current" : ""}" data-nav="run"><span class="run-avatar">${run.actor === data.run.actor ? "👨🏻‍💻" : "👨🏻‍💻"}</span><span class="run-row-content"><strong>${run.title}</strong><small>${run.id}　|　<b>${run.actor}</b> triggered via ${run.source}　|　Branch <em>${run.branch}</em>　|　<a>${run.commit}</a></small></span><span class="run-status">${run.status}</span></button>`;
    return `<div class="workspace-runs-page">
      <main class="workspace-runs-content">
        <div class="breadcrumbs"><button class="text-link" data-nav="workspaces">CoolCorp</button>　/　<button class="text-link" data-nav="workspaces">Workspaces</button>　/　<strong>${data.workspace.name}</strong>　/　Overview</div>
        <div class="workspace-runs-title"><div><h1>${data.workspace.name}</h1><p>ID: ${data.workspace.id}　<span class="copy-id">▣</span></p><button class="text-link">Add workspace description</button></div><button class="primary">＋ New Run</button></div>
        <div class="workspace-runs-meta"><span>♧ Unlocked</span><span>▣ Resources <b>${data.workspace.resources}</b></span><span>◇ Tags <b>3</b></span><span>◈ Terraform <u>${data.workspace.terraformVersion}</u></span><span>◷ Updated <b>today at 10:12 AM</b></span></div>
        <h2 class="current-run-heading">Current Run</h2>
        <div class="current-run-card" data-nav="run">${runRow(runs[0])}</div>
        ${overviewInsight()}
        <h2 class="run-list-heading">Run List</h2>
        <div class="run-tabs"><button class="active">All <b>126</b></button><button>⚠ Needs Attention <b>0</b></button><button>ⓧ Errored <b>12</b></button><button>◯ Running <b>0</b></button><button>◉ On Hold <b>0</b></button></div>
        <div class="run-list-toolbar"><label class="search-box">⌕ <input placeholder="Search Runs"></label><button class="secondary">☷ Status⌄</button><button class="secondary">☷ Operation⌄</button></div>
        <section class="workspace-run-list">${runs.map(runRow).join("")}</section>
      </main>
    </div>`;
  }

  function runView() {
    return `<div class="page run-page">
      <div class="breadcrumbs"><button class="text-link" data-nav="workspaces">CoolCorp / Workspaces</button> / ${data.workspace.name} / Runs / <strong>#${data.run.id}</strong></div>
      <div class="page-title-row"><div><h1>${data.workspace.name}</h1><p>ID: ${data.workspace.id}</p><button class="text-link">Add workspace description</button></div><div><button class="secondary">▣ Lock</button> <button class="primary">＋ New Run</button></div></div>
      <div class="workspace-meta"><span>▣ Locked by <strong>johndoe</strong></span><span>▤ Resources <strong>${data.workspace.resources}</strong></span><span>◇ Tags <strong>3</strong></span><span>⚑ Terraform <u>${data.workspace.terraformVersion}</u></span></div>
      <p class="updated">◷ Updated today at 10:12 AM</p>
      <div class="run-heading"><h2>${data.run.title}</h2><span class="badge neutral">◷ Current</span><span class="badge danger">ⓧ Errored</span></div>
      <div class="run-stats"><div><small>Plan Duration</small><strong>${data.run.duration}</strong></div><div><small>Resources to be changed</small><strong><span class="red">+2</span> <span class="blue">~0</span> <span class="red">-0</span></strong></div></div>
      <section class="panel run-details"><div class="panel-title">⌄　▤　<strong>Run Details</strong><span><strong>${data.run.actor}</strong> triggered a run from ${data.run.source}</span></div></section>
      <section class="panel plan-panel"><div class="panel-title"><span class="red">ⓧ</span>　<strong>Plan errored</strong></div><div class="panel-body">
        <p><strong>Started</strong> 30 minutes ago　&gt; <strong>Finished</strong> 30 minutes ago</p><div class="create-bar">＋ 2 to create</div>
        <div class="filter-row"><button class="secondary wide">⌕ Filter by address...</button><button class="secondary">☷ Filter by action　⌄</button><span>terraform 1.8</span><button class="secondary">▣ Download raw log</button></div>
        <div class="diagnostics-heading"><strong>⌄ Diagnostics</strong><button class="advisor-gradient ${state.advisorOpen ? "is-active" : ""}" data-action="toggle-albus" aria-expanded="${state.advisorOpen}" aria-controls="advisor">✦ Explore in Albus</button></div>
        <div class="error-card"><div class="error-title">Error: Instance cannot be destroyed</div><p>on ${data.run.sourceFile} line ${data.run.sourceLine}:</p><pre>resource "aws_db_instance" "this" {</pre><p>Resource <code>${data.run.address}</code> has <code>lifecycle.prevent_destroy</code> set, but the plan calls for this resource to be destroyed.</p></div>
      </div></section>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // Explorer: single entry point, table first
  // ---------------------------------------------------------------------------

  const refinementById = id => data.refinements.find(item => item.id === id);

  // Rows for the current query after any refinements ("only production") have narrowed it.
  function visibleRows(key) {
    const base = key === RDS_CONSUMERS ? consumers() : data.explorerResults[key]?.nodes || [];
    return state.refinements.map(refinementById).reduce((rows, refinement) => rows.filter(refinement.keep), base);
  }

  function queryInfo(key) {
    if (!key) return null;
    if (key === RDS_VERSIONS) return { key, title: RDS_VERSIONS, count: data.rdsVersions.rows.length, unit: "versions", derived: true };
    if (key === RDS_CONSUMERS) return { key, title: RDS_CONSUMERS, count: visibleRows(key).length, unit: "workspaces" };
    const result = data.explorerResults[key];
    if (!result) return null;
    const refined = state.refinements.length > 0;
    const nodes = visibleRows(key);
    const count = refined ? nodes.length : result.count;
    return { key, title: key, count, unit: result.unit, result: { ...result, nodes, count } };
  }

  function refinementScope(key) {
    if (key === RDS_CONSUMERS) return "rds-consumers";
    return data.explorerResults[key]?.type === "workspace" ? "workspace-results" : null;
  }

  const sameCondition = (a, b) => a.column === b.column && a.operator === b.operator && a.value === b.value;

  // A refinement that matches the text, fits the current results, and isn't already applied.
  function findRefinement(question) {
    const scope = refinementScope(state.explorerQuery);
    const normalized = question.toLowerCase();
    return data.refinements.find(item => item.scope === scope && item.match.test(normalized) && !state.queryConditions.some(condition => sameCondition(condition, item.condition)));
  }

  function addRefinement(refinement) {
    state.queryConditions.push({ ...refinement.condition });
    state.refinements.push(refinement.id);
  }

  // Explorer query model (mirrors HCP Terraform Explorer): object type + WHERE column operator value AND ...
  const schema = data.explorerSchema;
  const typeLabel = key => schema.types.find(type => type.key === key)?.label || key;
  const columnDef = (type, key) => schema.columns[type].find(column => column.key === key) || schema.columns[type][0];
  const operatorsFor = (type, columnKey) => schema.operators[columnDef(type, columnKey).type];
  const isEmptyOperator = operator => operator === "is-empty" || operator === "is-not-empty";

  function loadQuery(key) {
    const definition = data.queryDefs[key] || { type: "workspaces", conditions: [] };
    state.queryType = definition.type;
    state.queryConditions = definition.conditions.map(condition => ({ ...condition }));
    state.queryAlbus = definition.albus || null;
  }

  function conditionText(type, condition) {
    const column = columnDef(type, condition.column);
    const operator = operatorsFor(type, condition.column).find(item => item.key === condition.operator);
    const operatorLabel = operator ? operator.badge || operator.label : condition.operator;
    return isEmptyOperator(condition.operator) ? `${column.label} ${operatorLabel}` : `${column.label} ${operatorLabel} ${condition.value}`;
  }

  function queryText() {
    const conditions = state.queryConditions.map(condition => conditionText(state.queryType, condition));
    return `${typeLabel(state.queryType)}${conditions.length ? ` where ${conditions.join(" and ")}` : ""}${state.queryAlbus ? ` + ${state.queryAlbus}` : ""}`;
  }

  function receiptText(info = queryInfo(state.explorerQuery)) {
    return `${queryText()} · ${info.count} results`;
  }

  function explorerView() {
    const info = queryInfo(state.explorerQuery);
    if (!info) {
      return `<div class="explorer-page explorer-entry">${entryHud()}
      ${state.modal === "saved-views" ? savedViewsModal() : ""}
    </div>`;
    }
    // Results follow the designer layout (design-assets/explorer-oct-5): table view has the Active query card,
    // Show conditions, and View columns above the table; graph view has a floating HUD over the canvas.
    if (state.explorerDisplay === "graph" && !info.derived) {
      return `<div class="explorer-page explorer-graph-page">
        <div class="active-query-row graph-query-row">${state.graphHudHidden ? '<button type="button" class="table-hud-show" data-action="toggle-graph-hud">VIEW</button>' : `<div class="table-compact-hud"><div class="compact-hud-header"><strong>ACTIVE QUERY</strong><button type="button" class="table-hud-hide" data-action="toggle-graph-hud">HIDE</button></div>${compactQueryContent(info)}</div>`}${displayToggle(info)}</div>
        ${receiptLine(info)}${refineField(info)}
        <div class="explorer-canvas is-full">${graphFor(info)}${state.advisorOpen ? "" : nodeDetailCard()}</div>
        ${state.modal === "save-view" ? saveViewModal() : ""}
      </div>`;
    }
    const spec = tableSpec(info);
    const savedNote = state.lastSaved ? `<span class="saved-note">Saved as “${escapeHtml(state.lastSaved)}”</span>` : "";
    return `<div class="explorer-page table-first">
      <div class="active-query-row">${state.tableHudHidden ? '<button type="button" class="table-hud-show" data-action="toggle-table-hud">VIEW</button>' : `<div class="table-compact-hud"><div class="compact-hud-header"><strong>ACTIVE QUERY</strong><button type="button" class="table-hud-hide" data-action="toggle-table-hud">HIDE</button></div>${compactQueryContent(info)}</div>`}${displayToggle(info)}</div>
      ${conditionsAccordion()}
      ${receiptLine(info)}
      ${refineField(info)}
      ${info.derived ? derivedBanner() : ""}
      <div class="table-toolbar">${viewColumnsControl(spec)}<div class="table-actions">${savedNote}<button type="button" data-action="save-view">▣ Save as view</button><button type="button" data-action="download-view">⇩ Export CSV</button></div></div>
      <section class="explorer-results"><div class="results-panel ${info.derived ? "is-derived" : ""}">${renderTable(spec)}</div></section>
      ${state.modal === "saved-views" ? savedViewsModal() : ""}
      ${state.modal === "save-view" ? saveViewModal() : ""}
    </div>`;
  }

  // "← Back to query and results" returns to the Explorer entry HUD (Albus panel stays as it is).
  function compactQueryContent(info) {
    return `<div class="compact-query-content">
      <strong class="aq-title">${info.derived ? '<span class="derived-tag" title="Computed by Albus, not a native Explorer query">✦ Albus-derived</span> ' : ""}${escapeHtml(info.title)}</strong>
      <span class="aq-count">${tableCountLabel(info)}</span>
      <button type="button" class="aq-back" data-action="back-to-explorer">← Back to query and results</button>
    </div>`;
  }

  function activeQueryCard(info) {
    return `<section class="active-query-card" aria-label="Active query">
      <span class="aq-label">ACTIVE QUERY</span>
      <strong class="aq-title">${info.derived ? '<span class="derived-tag" title="Computed by Albus, not a native Explorer query">✦ Albus-derived</span> ' : ""}${escapeHtml(info.title)}</strong>
      <span class="aq-count">${tableCountLabel(info)}</span>
      <button type="button" class="aq-back" data-action="back-to-explorer">← Back to query and results</button>
    </section>`;
  }

  function displayToggle(info) {
    const graphDisabled = info.derived ? 'disabled title="Graph shows relationships. Select v5.1.0 or ask “show blast radius” to see its consumers."' : "";
    const graphActive = state.explorerDisplay === "graph" && !info.derived;
    return `<div class="display-toggle" role="group" aria-label="Display"><button type="button" data-display="graph" class="${graphActive ? "active" : ""}" aria-pressed="${graphActive}" ${graphDisabled}>${viewIcons.graph}Graph</button><button type="button" data-display="table" class="${graphActive ? "" : "active"}" aria-pressed="${!graphActive}">${viewIcons.table}Table</button></div>`;
  }

  // Collapsed: "Show conditions" with the applied conditions as tags. Expanded: the Explorer-style builder.
  function conditionsAccordion() {
    const open = state.editingConditions;
    const tags = [
      `<span class="query-chip type"><b>${escapeHtml(typeLabel(state.queryType))}</b></span>`,
      ...state.queryConditions.map(condition => `<span class="query-chip">${escapeHtml(conditionText(state.queryType, condition))}</span>`),
      state.queryAlbus ? `<span class="query-chip albus">✦ ${escapeHtml(state.queryAlbus)}</span>` : ""
    ].join("");
    const summary = state.queryConditions.length || state.queryAlbus ? "Conditions applied:" : 'No conditions applied <span class="info-dot" title="Expand this section to modify your search query.">i</span>';
    return `<section class="conditions-accordion ${open ? "is-open" : ""}">
      <button type="button" class="conditions-toggle" data-action="toggle-conditions" aria-expanded="${open}"><span class="conditions-chevron" aria-hidden="true">⌄</span><span class="conditions-text"><strong>${open ? "Hide conditions" : "Show conditions"}</strong><span class="conditions-summary">${summary} <span class="query-chips">${tags}</span></span></span></button>
      ${open ? conditionsEditor() : ""}
    </section>`;
  }

  function receiptLine(info) {
    if (!info || state.advisorOpen || !state.receipt) return "";
    return `<div class="query-receipt" role="status"><span class="ask-spark">✦</span><span><strong>${escapeHtml(state.receipt.label)}:</strong> ${escapeHtml(state.receipt.text)}</span>${state.receipt.applied ? appliedActions() : '<div class="card-actions"><button type="button" data-action="edit-conditions">Edit conditions</button></div>'}</div>`;
  }

  function refineField(info) {
    return info && !state.advisorOpen && !state.editingConditions ? askBar("Refine these results or ask a question…") : "";
  }

  function viewColumnsControl(spec) {
    const open = state.columnsMenuOpen;
    const items = spec.columns.map(column => `<label><input type="checkbox" data-column-toggle="${column.id}" ${column.locked || !state.hiddenColumns.includes(column.id) ? "checked" : ""} ${column.locked ? "disabled" : ""}> ${escapeHtml(column.label)}</label>`).join("");
    return `<div class="view-columns"><button type="button" class="view-columns-button" data-action="toggle-columns" aria-expanded="${open}">View columns <span aria-hidden="true">⌄</span></button>${open ? `<div class="columns-menu" role="group" aria-label="Columns">${items}</div>` : ""}</div>`;
  }

  // One field for both NL scenarios: a complex Explorer query typed instead of clicked, or a question
  // Explorer can't answer from its own data (Albus brings in other sources). Hidden while the builder is open.
  function askBar(placeholder) {
    return `<form id="explorer-ask-form" class="ask-bar"><span class="ask-spark">✦</span><input id="explorer-ask-input" type="text" autocomplete="off" placeholder="${escapeAttr(placeholder)}" aria-label="Search or ask a question"><button type="submit" aria-label="Search" title="Search (Enter)">↵</button></form>`;
  }

  // Same pattern as the Explorer query builder: Type, then WHERE <column> <operator> <value>, AND ...
  function conditionsEditor() {
    const draft = state.conditionDraft;
    const columns = schema.columns[draft.type];
    const option = (value, label, selected) => `<option value="${escapeAttr(value)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    const rows = draft.conditions.map((condition, index) => {
      const column = columnDef(draft.type, condition.column);
      const operators = schema.operators[column.type];
      const disabled = isEmptyOperator(condition.operator) ? "disabled" : "";
      const valueControl = column.type === "boolean"
        ? `<select data-draft="value" data-index="${index}" aria-label="Value" ${disabled}>${option("true", "True", condition.value === "true")}${option("false", "False", condition.value === "false")}</select>`
        : `<input data-draft="value" data-index="${index}" aria-label="Value" type="${column.type === "date" ? "date" : column.type === "number" ? "number" : "text"}" value="${escapeAttr(condition.value)}" placeholder="${disabled ? "" : "Enter a value"}" ${disabled}>`;
      return `<div class="condition-row" data-condition-row="${index}"><span class="clause">${index ? "AND" : "WHERE"}</span><div class="segmented"><select data-draft="column" data-index="${index}" aria-label="Column">${columns.map(item => option(item.key, item.label, item.key === column.key)).join("")}</select><select data-draft="operator" data-index="${index}" aria-label="Operator">${operators.map(item => option(item.key, item.label, item.key === condition.operator)).join("")}</select>${valueControl}</div><button type="button" class="remove-condition" data-action="remove-condition" data-index="${index}" aria-label="Remove condition" title="Remove condition"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div>`;
    }).join("");
    return `<form id="conditions-form" class="conditions-editor" aria-label="Edit conditions">
      <div class="editor-head"><span>Prototype: edits update the query; result rows stay scripted.</span></div>
      <label class="type-field"><span>Type</span><select data-draft="type" aria-label="Type">${schema.types.map(type => option(type.key, type.label, type.key === draft.type)).join("")}</select></label>
      ${rows || '<p class="editor-empty">No conditions applied.</p>'}
      ${draft.albus ? `<div class="condition-row albus-row"><span class="clause">AND</span><span class="albus-scope">✦ Albus adds: ${escapeHtml(draft.albus)}</span></div>` : ""}
      <button type="button" class="link-button add-condition" data-action="add-condition">+ Add condition</button>
      <div class="editor-actions"><button type="button" class="secondary" data-action="cancel-conditions">Cancel</button><button type="submit" class="primary">Apply</button></div>
    </form>`;
  }

  function newCondition(type) {
    const column = schema.columns[type][0];
    return { column: column.key, operator: schema.operators[column.type][0].key, value: column.type === "boolean" ? "true" : "" };
  }

  function updateDraft(field, index, value) {
    const draft = state.conditionDraft;
    if (field === "type") {
      draft.type = value;
      draft.conditions = [newCondition(value)];
      draft.albus = value === state.queryType ? state.queryAlbus : null;
      return true;
    }
    const condition = draft.conditions[index];
    if (field === "column") {
      const column = columnDef(draft.type, value);
      Object.assign(condition, { column: column.key, operator: schema.operators[column.type][0].key, value: column.type === "boolean" ? "true" : "" });
      return true;
    }
    if (field === "operator") {
      condition.operator = value;
      if (isEmptyOperator(value)) condition.value = "";
      return true;
    }
    condition.value = value;
    return false;
  }

  function appliedActions() {
    const undo = state.queryHistory.length ? '<button type="button" data-action="undo-query">Undo</button>' : "";
    return `<div class="card-actions"><span class="applied-pill">✓ Applied to table</span><button type="button" data-action="edit-conditions">Edit</button>${undo}</div>`;
  }

  function browseControl() {
    return `<div class="browse-control"><button class="select-control" data-action="toggle-browse" aria-expanded="${state.browseOpen}">Types, Use cases and Saved views <span>${state.browseOpen ? "⌃" : "⌄"}</span></button>${state.browseOpen ? browseMenu() : ""}</div>`;
  }

  function browseMenu() {
    return `<div class="browse-menu"><div><span>TYPES</span><button>Workspaces</button><button>Policy Sets</button><button data-prompt="View all modules">Modules</button><button data-prompt="View all providers">Providers</button><button>Resources</button><button>Terraform Versions</button><button data-action="saved-views">Saved views <strong>${20 + state.savedViews.length}</strong></button></div><div><span>PRE-DEFINED VIEWS</span><button>View All Workspaces</button><button>Organized by Project</button><button>Organized by Status</button><button>Workspaces with failed checks</button><button data-prompt="Drifted workspaces">Drifted Workspaces</button><button>Latest updated workspaces</button></div></div>`;
  }

  const viewIcons = {
    graph: '<svg class="hud-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><path d="M5.8 7.1 10.2 4.9M5.8 8.9l4.4 2.2"/></svg>',
    table: '<svg class="hud-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6.5h12M6 6.5V13"/></svg>',
    search: '<svg class="hud-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>'
  };

  // Entry heads-up display, as in Experiment 2 (design-assets/explorer-oct-5): view mode, browse,
  // a plain natural-language box, and two starting points. No Albus-specific wording; routing happens behind the box.
  function entryHud() {
    const toggle = mode => `<button type="button" data-display="${mode}" class="${state.explorerDisplay === mode ? "active" : ""}" aria-pressed="${state.explorerDisplay === mode}">${viewIcons[mode]}${mode === "graph" ? "Graph" : "Table View"}</button>`;
    const queryBox = state.advisorOpen
      ? '<p class="ask-hint">Type your question in Albus →, or pick a starting point below.</p>'
      : `<form id="explorer-ask-form" class="hud-query"><label class="hud-input">${viewIcons.search}<input id="explorer-ask-input" type="text" autocomplete="off" placeholder="Ex. production workspaces using AWS vx.x.x" aria-label="Enter a natural language query"></label><button type="submit">Search</button></form>`;
    return `<section class="explorer-hud" aria-label="Explorer">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><button type="button" class="text-link" data-nav="workspaces">CoolCorp</button>　/　Explorer　/　<strong aria-current="page">Types</strong></nav>
      <h1>${icon("explorer")} Explorer</h1>
      <p class="hud-lede">Explore your data to analyze your organization's Terraform usage.</p>
      <label class="field-label">VIEW MODE</label>
      <div class="hud-toggle" role="group" aria-label="View mode">${toggle("graph")}${toggle("table")}</div>
      <label class="field-label">BROWSE</label>${browseControl()}
      <label class="field-label" for="explorer-ask-input">ENTER A NATURAL LANGUAGE QUERY</label>${queryBox}
      <label class="field-label">EXPLORE YOUR INFRASTRUCTURE</label>
      <div class="hud-prompts">${data.explorerStarters.map(starter => `<button type="button" data-prompt="${escapeAttr(starter.text)}">${escapeHtml(starter.text)}<span aria-hidden="true">↵</span></button>`).join("")}</div>
    </section>`;
  }

  function tableCountLabel(info) {
    if (info.result && info.result.nodes.length < info.count) return `Showing ${info.result.nodes.length} of ${info.count} ${info.unit}`;
    return `${info.count} ${info.unit}`;
  }

  function derivedBanner() {
    return `<div class="derived-banner"><span class="albus-mark">✦</span><div><strong>Albus-derived view.</strong> Combines Explorer usage with your private registry and run history. Columns marked ✦ are computed by Albus; hover for sources.</div></div>`;
  }

  // Rows themselves aren't clickable; the name link selects the row (and opens it in Albus's RETURNED <type> list).
  const rowClass = key => [state.highlightedRows.includes(key) ? "is-highlighted" : "", state.selectedNode === key ? "is-selected" : ""].join(" ").trim();
  const nameLink = (key, label, alert, review) => `<button type="button" class="row-name-link" data-node-row="${escapeAttr(key)}">${escapeHtml(label)}</button>${alert ? ` <span class="risk-node" title="${escapeAttr(review || "Needs review")}">!</span>` : ""}`;

  // Column definitions per result type, so "View columns" can hide any but the name.
  function tableSpec(info) {
    if (info.derived) {
      const { rows, provenance } = data.rdsVersions;
      return {
        className: "derived-table",
        rows: rows.map(item => ({ key: item.version, item })),
        footer: `1–${rows.length} of ${rows.length}`,
        columns: [
          { id: "version", label: "Version", locked: true, cell: ({ item }) => nameLink(item.version, item.version) },
          { id: "workspaces", label: "Workspaces (Explorer)", head: `Workspaces <small>(Explorer)</small>`, title: provenance.workspaces, cell: ({ item }) => `${item.workspaces}${item.detail ? ` <small>${escapeHtml(item.detail)}</small>` : ""}` },
          { id: "registryStatus", label: "✦ Registry status", albus: true, title: provenance.registryStatus, cell: ({ item }) => `<span class="status-pill ${item.status}">${escapeHtml(item.registryStatus)}</span>` },
          { id: "lastUsed", label: "✦ Last used", albus: true, title: provenance.lastUsed, cell: ({ item }) => item.lastUsed },
          { id: "note", label: "✦ Note", albus: true, title: provenance.note, cell: ({ item }) => item.graph ? `<button type="button" class="link-button" data-action="show-blast-radius">${escapeHtml(item.note)} →</button>` : escapeHtml(item.note) }
        ]
      };
    }
    if (info.key === RDS_CONSUMERS) {
      const rows = visibleRows(RDS_CONSUMERS);
      return {
        rows: rows.map(node => ({ key: node.name, node })),
        footer: `1–${rows.length} of ${rows.length}`,
        columns: [
          { id: "name", label: "Workspace", locked: true, cell: ({ node }) => nameLink(node.name, node.name) },
          { id: "environment", label: "Tag", cell: ({ node }) => node.environment === "production" ? '<span class="status-pill breaking">production</span>' : node.environment },
          { id: "runStatus", label: "Current run", cell: ({ node }) => node.runStatus },
          { id: "module", label: "Module", cell: () => RDS_MODULE }
        ]
      };
    }
    const { result } = info;
    const footer = `${result.nodes.length ? `1–${result.nodes.length}` : 0} of ${result.count}`;
    const rows = result.nodes.map(node => ({ key: node.name, node }));
    const name = { id: "name", label: "Name", locked: true, cell: ({ node }) => nameLink(node.name, node.name, node.alert, node.review) };
    if (["module", "provider"].includes(result.type)) {
      return { rows, footer, columns: [name,
        { id: "version", label: "Version", cell: ({ node }) => escapeHtml(node.detail) },
        { id: "workspaceCount", label: "Workspace count", cell: ({ node }) => String(node.workspaces.length) },
        { id: "workspaces", label: "Workspaces", cell: ({ node }) => node.workspaces.map(escapeHtml).join(", ") }
      ] };
    }
    if (result.type === "workspace") {
      const detail = (node, term) => escapeHtml(workspaceDetails(node).find(([label]) => label === term)?.[1] || "");
      return { rows, footer, columns: [name,
        { id: "projectName", label: "Project name", cell: ({ node }) => detail(node, "Project name") },
        { id: "currentRunId", label: "Current run ID", cell: ({ node }) => detail(node, "Current run ID") },
        { id: "runStatus", label: "Run status", cell: ({ node }) => detail(node, "Run status") },
        { id: "details", label: "Details", cell: ({ node }) => escapeHtml(node.detail) }
      ] };
    }
    return { rows, footer, columns: [name,
      { id: "type", label: "Type", cell: () => result.type },
      { id: "details", label: "Details", cell: ({ node }) => escapeHtml(node.detail) }
    ] };
  }

  function renderTable(spec) {
    const columns = spec.columns.filter(column => column.locked || !state.hiddenColumns.includes(column.id));
    const head = columns.map(column => `<th class="${column.albus ? "albus-col" : ""}" ${column.title ? `title="${escapeAttr(column.title)}"` : ""} data-col="${column.id}">${column.head || escapeHtml(column.label)}</th>`).join("");
    const body = spec.rows.map(row => `<tr data-row-key="${escapeAttr(row.key)}" class="${rowClass(row.key)}"><td class="check-col"><input type="checkbox" aria-label="Select ${escapeAttr(row.key)}"></td>${columns.map(column => `<td class="${column.albus ? "albus-cell" : ""}" ${column.title ? `title="${escapeAttr(column.title)}"` : ""}>${column.cell(row)}</td>`).join("")}</tr>`).join("");
    return `<table class="results-table ${spec.className || ""}"><thead><tr><th class="check-col"><input type="checkbox" aria-label="Select all rows"></th>${head}</tr></thead><tbody>${body}</tbody></table><div class="table-pagination">${spec.footer}</div>`;
  }

  function graphFor(info) {
    if (info.key === RDS_CONSUMERS) return topologyCanvas();
    if (["module", "provider"].includes(info.result.type)) return relationshipResultsCanvas(info.result);
    return inventoryResultsCanvas(info.result);
  }

  const isFocused = name => state.selectedNode === name || state.highlightedRows.includes(name);

  function topologyCanvas() {
    const nodes = visibleRows(RDS_CONSUMERS);
    // Laid out right of the floating HUD (top-left).
    const center = { x: 60, y: 46 };
    const positions = [
      { x: 60, y: 22 },
      { x: 76, y: 34 },
      { x: 76, y: 60 },
      { x: 44, y: 62 },
      { x: 44, y: 36 }
    ];
    const lines = nodes.map((node, index) => {
      const position = positions[index];
      const x1 = center.x * 10, y1 = center.y * 6.5, x2 = position.x * 10, y2 = position.y * 6.5;
      return `<path class="${node.relation}" d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" marker-end="url(#arrow-${node.relation})"/>`;
    }).join("");
    return `<div class="topology" aria-label="RDS module consumers"><div class="risk-banner"><span>!</span><strong>2 of these are production workspaces — changes carry elevated risk</strong></div><svg class="edges" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow-consumer" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker></defs>${lines}</svg><button class="module-node" style="left:${center.x}%;top:${center.y}%" data-action="select-module"><span>▣</span><strong>${RDS_MODULE}</strong><small>module</small></button>${nodes.map((node, index) => `<button class="graph-node ${node.relation} ${isFocused(node.name) ? "is-focused" : ""}" style="left:${positions[index].x}%;top:${positions[index].y}%" data-graph-node="${node.name}"><span class="node-symbol">▤</span>${node.environment === "production" ? "<i>!</i>" : ""}<strong>${node.name}</strong><small>${node.environment}</small></button>`).join("")}<div class="force-tools"><span>Force</span><button type="button" aria-label="Previous layout">‹</button><button type="button" aria-label="Next layout">›</button></div><div class="legend"><span><i class="workspace-key"></i> Workspace</span><span><i class="selected-key"></i> selected</span><span><i class="consumer-key"></i> direct dependent</span></div></div>`;
  }

  function inventoryResultsCanvas(result) {
    const positions = [[50, 22], [72, 22], [50, 38], [72, 38], [50, 54], [72, 54], [50, 70], [72, 70]]; // right of the floating HUD
    const symbol = { module: "▱", provider: "⬡", resource: "◇", workspace: "▤" }[result.type];
    return `<div class="topology inventory-topology type-${result.type}" aria-label="${escapeAttr(state.explorerQuery)}"><div class="result-summary"><span>${result.count}</span><strong>${escapeHtml(result.summary)}</strong></div>${result.nodes.map((node, index) => `<button class="graph-node result-${result.type} ${isFocused(node.name) ? "is-focused" : ""}" style="left:${positions[index][0]}%;top:${positions[index][1]}%" data-graph-node="${escapeAttr(node.name)}"><span class="node-symbol">${symbol}</span>${node.alert ? "<i>!</i>" : ""}<strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.detail)}</small></button>`).join("")}<div class="force-tools"><span>Force</span><button type="button" aria-label="Previous layout">‹</button><button type="button" aria-label="Next layout">›</button></div><div class="legend"><span><i class="result-key"></i> ${result.type}</span><span><i class="selected-key"></i> selected</span></div></div>`;
  }

  // Lays out `count` nodes in columns of up to 6, spread across the given x positions (in %).
  function columnLayout(count, xs) {
    const perColumn = Math.max(Math.ceil(count / xs.length), Math.min(count, 6));
    const columns = Math.ceil(count / perColumn);
    const x = columns === 1 ? [xs[Math.floor((xs.length - 1) / 2)]] : xs.slice(xs.length - columns);
    return Array.from({ length: count }, (_, index) => {
      const column = Math.floor(index / perColumn);
      const row = index % perColumn;
      const rows = Math.min(perColumn, count - column * perColumn);
      // Rows stay between ~20% and ~84% so they clear the summary badge (top) and legend (bottom) on short screens.
      const step = rows > 1 ? Math.min(13, 64 / (rows - 1)) : 0;
      return [x[column], 52 - (step * (rows - 1)) / 2 + row * step];
    });
  }

  // Every result row is drawn (entities on the left, their workspaces on the right), so the graph matches the table.
  function relationshipResultsCanvas(result) {
    const entityPositions = columnLayout(result.nodes.length, [12, 33]);
    const workspaceNames = [...new Set(result.nodes.flatMap(node => node.workspaces))];
    const workspacePositions = columnLayout(workspaceNames.length, [67, 88]);
    const workspacePosition = Object.fromEntries(workspaceNames.map((name, index) => [name, workspacePositions[index]]));
    const lines = result.nodes.flatMap((node, nodeIndex) => node.workspaces.map(name => {
      const [x1, y1] = entityPositions[nodeIndex];
      const [x2, y2] = workspacePosition[name];
      return `<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"/>`;
    })).join("");
    const symbol = result.type === "module" ? "▱" : "⬡";
    return `<div class="topology relationship-topology type-${result.type}" aria-label="${escapeAttr(state.explorerQuery)}"><div class="result-summary"><span>${result.count}</span><strong>${escapeHtml(result.summary)}</strong></div><svg class="relationship-edges" aria-hidden="true">${lines}</svg>${result.nodes.map((node, index) => `<button class="graph-node relation-entity result-${result.type} ${isFocused(node.name) ? "is-focused" : ""}" style="left:${entityPositions[index][0]}%;top:${entityPositions[index][1]}%" data-graph-node="${escapeAttr(node.name)}"><span class="node-symbol">${symbol}</span>${node.alert ? `<i title="${escapeAttr(node.review || "Needs review")}">!</i>` : ""}<strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.detail)}</small></button>`).join("")}${workspaceNames.map(name => `<button class="graph-node relation-workspace ${isFocused(name) ? "is-focused" : ""}" style="left:${workspacePosition[name][0]}%;top:${workspacePosition[name][1]}%" data-graph-node="${escapeAttr(name)}"><span class="node-symbol">▤</span><strong>${escapeHtml(name)}</strong><small>workspace</small></button>`).join("")}<div class="force-tools"><span>Force</span><button type="button" aria-label="Previous layout">‹</button><button type="button" aria-label="Next layout">›</button></div><div class="legend"><span><i class="result-key"></i> ${result.type}</span><span><i class="workspace-key"></i> workspace</span><span><i class="selected-key"></i> selected</span></div></div>`;
  }

  function nodeDetailCard() {
    const name = state.selectedNode;
    if (!name) return "";
    const workspace = data.affectedWorkspaces.find(node => node.name === name);
    const result = data.explorerResults[state.explorerQuery];
    const resultNode = result?.nodes.find(node => node.name === name);
    let type = "WORKSPACE";
    let details;
    if (name === RDS_MODULE) {
      type = "MODULE";
      details = rdsModuleDetails();
    } else if (workspace) {
      details = [["Tag", workspace.environment], ["Run status", workspace.runStatus], ["Resources", String(workspace.resources)], ["Module", RDS_MODULE]];
    } else if (resultNode) {
      type = (resultNode.workspaces ? result.type : result.type === "resource" ? "resource" : "workspace").toUpperCase();
      details = [["Details", resultNode.detail], ...(resultNode.workspaces ? [["Workspaces", resultNode.workspaces.join(", ")]] : [])];
    } else {
      details = [["Relationship", "Related workspace"]];
    }
    return `<div class="node-detail" role="dialog" aria-label="${escapeAttr(name)} details"><button type="button" data-action="clear-node" aria-label="Close details">×</button><span>${type}</span><h3>${escapeHtml(name)}</h3><dl>${details.map(([term, value]) => `<dt>${term}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl></div>`;
  }

  function defaultSaveName() {
    if (state.explorerQuery === RDS_VERSIONS) return "RDS version lifecycle";
    if (state.explorerQuery === RDS_CONSUMERS) return "RDS v5.1.0 module consumers";
    return state.explorerQuery || "Explorer view";
  }

  function savedViewsModal() {
    const saved = state.savedViews.map(view => `<tr><td><strong>${escapeHtml(view.name)}</strong>${view.derived ? ' <span class="derived-tag" title="Albus-derived: includes columns computed by Albus">✦ Albus-derived</span>' : ""}</td><td>${view.type}</td><td>AB</td><td>Just now</td></tr>`).join("");
    return `<div class="modal-backdrop"><section class="explorer-modal" role="dialog" aria-label="Saved views"><button class="modal-close" data-action="close-modal">×</button><h2>Saved Views</h2><p>${20 + state.savedViews.length} saved views available.</p><div class="saved-toolbar"><input placeholder="Search"><select><option>All types</option><option>Workspaces</option><option>Modules</option></select></div><table><thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Last Updated</th></tr></thead><tbody>${saved}<tr><td>Production workspace health</td><td>Workspaces</td><td>Platform team</td><td>2 days ago</td></tr><tr><td>Outdated module versions</td><td>Modules</td><td>AB</td><td>5 days ago</td></tr></tbody></table></section></div>`;
  }

  function saveViewModal() {
    const derived = state.explorerQuery === RDS_VERSIONS;
    return `<div class="modal-backdrop"><section class="save-modal" role="dialog" aria-label="Save view"><button class="modal-close" data-action="close-modal">×</button><h2>Save view</h2><p>Save the current conditions${derived ? " and Albus-derived columns" : ""} for future investigation.</p>${derived ? '<p class="derived-note"><span class="albus-mark">✦</span> This view keeps its Albus-derived badge. Registry status and Last used are recomputed when the view is opened.</p>' : ""}<label>Name<input id="view-name" value="${escapeAttr(defaultSaveName())}"></label><div><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-save">Save view</button></div></section></div>`;
  }

  function downloadView() {
    const csv = value => `"${String(value).replaceAll('"', '""')}"`;
    let rows;
    if (state.explorerQuery === RDS_VERSIONS) {
      rows = [["version", "workspaces", "workspace_detail", "registry_status_albus", "last_used_albus", "note_albus"], ...data.rdsVersions.rows.map(item => [item.version, item.workspaces, item.detail, item.registryStatus, item.lastUsed, item.note])];
    } else if (state.explorerQuery === RDS_CONSUMERS) {
      rows = [["workspace", "tag", "current_run", "module"], ...visibleRows(RDS_CONSUMERS).map(node => [node.name, node.environment, node.runStatus, RDS_MODULE])];
    } else {
      const result = queryInfo(state.explorerQuery).result;
      rows = [["name", "type", "details"], ...result.nodes.map(node => [node.name, result.type, node.detail])];
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.map(item => item.map(csv).join(",")).join("\n")], { type: "text/csv" }));
    link.download = `${defaultSaveName().toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ---------------------------------------------------------------------------
  // Explorer query state (with undo)
  // ---------------------------------------------------------------------------

  function snapshot() {
    return {
      explorerQuery: state.explorerQuery,
      queryType: state.queryType,
      queryConditions: state.queryConditions.map(condition => ({ ...condition })),
      queryAlbus: state.queryAlbus,
      refinements: [...state.refinements],
      explorerDisplay: state.explorerDisplay,
      highlightedRows: [...state.highlightedRows],
      receipt: state.receipt
    };
  }

  function applyExplorerQuery(key, options = {}) {
    state.queryHistory.push(snapshot());
    state.explorerQuery = key;
    loadQuery(key);
    state.refinements = [];
    state.nodeSearch = "";
    state.hiddenColumns = [];
    state.columnsMenuOpen = false;
    // New queries keep the chosen view mode (entry HUD or Table/Graph toggle) unless the answer asks for one.
    state.explorerDisplay = options.display || state.explorerDisplay || "table";
    state.highlightedRows = [];
    state.selectedNode = null;
    state.editingConditions = false;
    state.lastSaved = null;
    state.navCollapsed = true;
    document.body.classList.add("nav-collapsed");
  }

  function undoQuery() {
    const previous = state.queryHistory.pop();
    if (!previous) return;
    Object.assign(state, previous, { selectedNode: null, editingConditions: false, lastSaved: null });
    const applied = latestAppliedMessage();
    if (applied) { applied.applied = false; applied.undone = true; }
    renderMain();
    renderConversation();
  }

  function latestAppliedMessage() {
    for (let index = state.messages.length - 1; index >= 0; index -= 1) {
      if (state.messages[index].applied) return state.messages[index];
    }
    return null;
  }

  function resetExplorerQuery() {
    state.explorerQuery = null;
    state.queryType = null;
    state.queryConditions = [];
    state.queryAlbus = null;
    state.refinements = [];
    state.nodeSearch = "";
    state.hiddenColumns = [];
    state.columnsMenuOpen = false;
    state.conditionDraft = null;
    state.queryHistory = [];
    state.highlightedRows = [];
    state.selectedNode = null;
    state.editingConditions = false;
    state.receipt = null;
    state.lastSaved = null;
    state.explorerDisplay = "table";
  }

  // ---------------------------------------------------------------------------
  // Albus panel
  // ---------------------------------------------------------------------------

  function openAdvisor() {
    state.advisorOpen = true;
    advisor.classList.add("is-open");
    document.body.classList.add("advisor-open");
    renderMain();
    renderConversation();
  }

  function closeAdvisor() {
    state.advisorOpen = false;
    advisor.classList.remove("is-open");
    document.body.classList.remove("advisor-open");
    renderMain();
    renderConversation();
  }

  function initializeAdvisor() {
    if (state.messages.length) return;
    const initialResponse = state.advisorJourney === "explorer" ? data.responses.explorerInitial : data.responses.initial;
    state.messages.push({ role: "advisor", ...initialResponse });
    renderConversation();
  }

  // Route words in the question to a scripted answer. Order matters: tier 2/3 asks first.
  function resolveQuery(question, inExplorer, fallback = true) {
    if (data.responses[question]?.tier || data.explorerResults[question] || question === RDS_CONSUMERS || question === RDS_VERSIONS) return question;
    if (!inExplorer && data.responses[question]) return question;
    const normalized = question.toLowerCase();
    if (normalized.includes("blast radius") || normalized.includes("would be affected")) return "Show blast radius for v5.1.0";
    if (/should (we|i) deprecate|deprecate v?\d/.test(normalized)) return "Should we deprecate v5.1.0?";
    if (normalized.includes("deprecated")) return "Which RDS versions are deprecated but still in use?";
    if (/no longer|unused|not (being )?used|not in use/.test(normalized)) return normalized.includes("rds") ? "Which RDS module versions are no longer in use?" : "What modules are no longer being used?";
    if (normalized.includes("last used") || normalized.includes("last time")) return "When was each RDS version last used?";
    if (normalized.includes("save")) return "Save as view";
    if (normalized.includes("5.1.0") || (normalized.includes("rds") && /workspace|using|consum/.test(normalized))) return RDS_CONSUMERS;
    // Scripted run-investigation answers (e.g. "What options do I have to fix this?") work everywhere.
    if (!inExplorer || data.responses[question]) return question;
    if (normalized.includes("drift")) return "Drifted workspaces";
    if (normalized.includes("ec2") || normalized.includes("instance")) return "How many EC2 instances exist across my organization?";
    if (normalized.includes("aws") && (normalized.includes("5") || normalized.includes("provider"))) return "Which workspaces use AWS provider version 5.x?";
    if (normalized.includes("depend") || normalized.includes("remote state")) return "What resources depend on workspace X?";
    if (normalized.includes("module")) return "View all modules";
    if (normalized.includes("provider")) return "View all providers";
    return fallback ? "Production workspaces" : null;
  }

  function getResponse(key, inExplorer) {
    // Future live-model integration belongs behind this adapter.
    if (inExplorer && (key === RDS_CONSUMERS || data.explorerResults[key])) return { tier: 1, query: key };
    if (!inExplorer && key === RDS_CONSUMERS) return data.responses["What other workspaces are using RDS module v5.1.0?"];
    if (data.responses[key]) return data.responses[key];
    return {
      type: "answer",
      html: `<p>This prototype currently supports the suggested research paths. Try one of the prompts below.</p>`,
      evidence: []
    };
  }

  function ask(question) {
    const inExplorer = state.view === "explorer";
    if (inExplorer && state.explorerQuery) { askOnResults(question); return; }
    const key = resolveQuery(question, inExplorer);
    const response = getResponse(key, inExplorer);
    state.promptsOpen = false;
    if (!inExplorer && (response.tier === 2 || response.tier === 3)) {
      // Tier 2/3 asks from the run page continue in Explorer, where the table lives.
      continueInExplorer();
      answerInExplorer(question, response);
      return;
    }
    if (!inExplorer) {
      state.messages.push({ role: "user", text: question });
      state.messages.push({ role: "advisor", ...response });
      renderConversation();
      return;
    }
    answerInExplorer(question, response);
  }

  // On a results page, typing narrows what's there by default. Order: Albus questions (tier 2/3, scripted
  // answers) -> refinement of the current query -> a different known query -> honest "no change".
  function askOnResults(question) {
    state.promptsOpen = false;
    const key = resolveQuery(question, true, false);
    const response = key ? getResponse(key, true) : null;
    if (response && response.tier !== 1) { answerInExplorer(question, response); return; }
    const refinement = findRefinement(question);
    if (refinement) {
      state.messages.push({ role: "user", text: question });
      state.queryHistory.push(snapshot());
      addRefinement(refinement);
      state.highlightedRows = [];
      state.selectedNode = null;
      state.lastSaved = null;
      setReceipt("Refined", `+ ${conditionText(state.queryType, refinement.condition)} · ${receiptText()}`, true);
      renderMain();
      renderConversation();
      return;
    }
    if (response) { answerInExplorer(question, response); return; }
    state.messages.push({ role: "user", text: question });
    setReceipt("No change", `I couldn't turn “${question}” into a condition for these results. Try Edit conditions.`, false);
    renderMain();
    renderConversation();
  }

  function setReceipt(label, text, applied) {
    state.receipt = { label, text, applied };
    state.messages.push({ role: "advisor", kind: "receipt", label, text, applied });
  }

  function answerInExplorer(question, response) {
    state.messages.push({ role: "user", text: question });
    if (response.tier === 1) {
      const label = state.explorerQuery ? "New query" : "Built query";
      applyExplorerQuery(response.query);
      // "drifted production workspaces": the query plus any refinement in the same sentence, as one undo step.
      const refinement = findRefinement(question);
      if (refinement) addRefinement(refinement);
      setReceipt(label, receiptText(), true);
      // Running a query opens Albus with a summary and the RETURNED <type> list (table and graph).
      if (!state.advisorOpen) { openAdvisor(); return; }
      // Tier 1 only updates the table; the panel stays as it was (closed on direct entry).
    } else if (response.tier === 2 || response.tier === 3) {
      const changesQuery = response.query && response.query !== state.explorerQuery;
      if (changesQuery) applyExplorerQuery(response.query, { display: response.display });
      else if (response.display) state.explorerDisplay = response.display;
      state.receipt = null;
      state.highlightedRows = [...(response.rowRefs || [])];
      state.selectedNode = null;
      state.messages.push({ role: "advisor", kind: "card", ...response, applied: changesQuery });
      if (!state.advisorOpen) { openAdvisor(); return; }
    } else if (response.tier === "action") {
      state.messages.push({ role: "advisor", ...response });
      if (response.action === "save-view" && state.explorerQuery) state.modal = "save-view";
    } else {
      state.messages.push({ role: "advisor", ...response });
      if (!state.advisorOpen) { openAdvisor(); return; }
    }
    renderMain();
    renderConversation();
  }

  // Run -> Explorer (tier 1): Albus is already open and stays open; the chat gets a one-line receipt.
  function showImpact() {
    continueInExplorer();
    state.promptsOpen = false;
    applyExplorerQuery(RDS_CONSUMERS);
    state.queryHistory = [];
    setReceipt("Built query", receiptText(), true);
    renderMain();
    renderConversation();
  }

  function continueInExplorer() {
    state.navCollapsed = true;
    document.body.classList.add("nav-collapsed");
    resetExplorerQuery();
    if (state.view === "run") state.runMessages = state.messages.slice();
    // Carry the impact answer (it holds "Back to run") even if the user followed its link from an older answer.
    const impactAnswer = [...state.messages].reverse().find(message => message.html?.includes('data-action="show-impact"'));
    const carried = impactAnswer || state.messages[state.messages.length - 1];
    state.messages = carried ? [carried] : [];
    setView("explorer", { impactMode: true });
    if (!state.advisorOpen) openAdvisor();
  }

  // ---------------------------------------------------------------------------
  // Albus panel: what the current results are, plus the RETURNED <type> list (designs 02-04)
  // ---------------------------------------------------------------------------

  function workspaceDetails(node) {
    const production = /prod/.test(node.name) || node.environment === "production";
    return [
      ["Project name", node.environment && node.environment !== "production" ? node.environment : production ? "production" : "platform"],
      ["Current run ID", `run-${btoa(node.name).replace(/[^a-z0-9]/gi, "").slice(-12).toLowerCase()}`],
      ["Run status", node.runStatus || (node.alert ? "drifted" : "applied")],
      ["Current run applied", "Mar 12, 2025 11:22:05 am"],
      ["VCS repo", `example1/${node.name}`],
      ["Terraform version", "1.8.5"],
      ["Drifted", node.alert ? "true" : "false"],
      ["Resource count", String(node.resources || 34)],
      ...(node.detail ? [["Details", node.detail]] : [])
    ];
  }

  function panelRows(info) {
    if (info.derived) {
      return data.rdsVersions.rows.map(item => ({
        key: item.version, name: item.version, kind: "module", alert: item.status !== "published",
        details: [["Workspaces (Explorer)", `${item.workspaces}${item.detail ? ` · ${item.detail}` : ""}`], ["✦ Registry status", item.registryStatus], ["✦ Last used", item.lastUsed], ["✦ Note", item.note]]
      }));
    }
    if (info.key === RDS_CONSUMERS) {
      const module = { key: RDS_MODULE, name: RDS_MODULE, kind: "module", details: rdsModuleDetails() };
      return [module, ...visibleRows(RDS_CONSUMERS).map(node => ({ key: node.name, name: node.name, kind: "workspace", alert: node.environment === "production", details: [["Tag", node.environment], ...workspaceDetails(node).filter(([term]) => term !== "Project name"), ["Module", RDS_MODULE]] }))];
    }
    const { result } = info;
    if (["module", "provider"].includes(result.type)) {
      const entities = result.nodes.map(node => ({
        key: node.name, name: node.name, kind: result.type, alert: node.alert,
        details: [["Type", result.type], ["Version", node.detail], ...(node.review ? [["Needs review", node.review]] : []), ["Workspace count", String(node.workspaces.length)], ["Workspaces", node.workspaces.join(", ")], ["Source", result.type === "module" ? `app.terraform.io/CoolCorp/${node.name}` : `registry.terraform.io/${node.name}`]]
      }));
      const workspaces = [...new Set(result.nodes.flatMap(node => node.workspaces))].map(name => ({
        key: name, name, kind: "workspace",
        details: workspaceDetails({ name, detail: result.nodes.filter(node => node.workspaces.includes(name)).map(node => `${node.name} ${node.detail}`).join(", ") })
      }));
      return [...entities, ...workspaces];
    }
    return result.nodes.map(node => ({
      key: node.name, name: node.name, kind: result.type, alert: node.alert,
      details: result.type === "workspace" ? workspaceDetails(node) : [["Type", result.type], ["Details", node.detail]]
    }));
  }

  // Name what the list holds ("RETURNED WORKSPACES", "RETURNED MODULES & WORKSPACES") instead of the graph
  // term "nodes", which users read as "notes" (JPMC round 2).
  const KIND_LABELS = { workspace: "WORKSPACES", module: "MODULES", provider: "PROVIDERS", resource: "RESOURCES" };
  function resultsLabel(info, rows) {
    if (info.derived) return "RETURNED VERSIONS";
    const kinds = [...new Set(rows.map(row => row.kind))].map(kind => KIND_LABELS[kind] || "RESULTS");
    return `RETURNED ${kinds.length ? [...new Set(kinds)].join(" & ") : "RESULTS"}`;
  }

  function resultsSection() {
    const info = queryInfo(state.explorerQuery);
    if (!info) return "";
    const rows = panelRows(info);
    // The run journey and Albus cards already explain these results; other queries get a short summary.
    const summary = info.derived || (info.key === RDS_CONSUMERS && state.impactMode) ? "" : data.resultSummaries[info.key] || "";
    const search = state.nodeSearch.toLowerCase();
    const total = info.result && info.result.nodes.length < info.count ? `${rows.length} shown · ${info.count} ${info.unit} in Explorer` : `1–${rows.length} of ${rows.length}`;
    const rowHtml = item => {
      const open = state.selectedNode === item.key;
      const hidden = search && !item.name.toLowerCase().includes(search) ? "hidden" : "";
      return `<div class="node-row ${open ? "is-open" : ""} ${state.highlightedRows.includes(item.key) ? "is-highlighted" : ""}" data-node-name="${escapeAttr(item.name.toLowerCase())}" ${hidden}><button type="button" class="node-row-toggle" data-node-row="${escapeAttr(item.key)}" aria-expanded="${open}"><span class="node-chevron" aria-hidden="true">›</span><i class="node-icon kind-${item.kind}" aria-hidden="true"></i><span class="node-name">${escapeHtml(item.name)}</span>${open ? '<span class="node-hide">HIDE INFORMATION</span>' : item.alert ? '<small class="node-alert" title="Needs review">!</small>' : ""}</button>${open ? `<dl class="node-row-details">${item.details.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : ""}</div>`;
    };
    return `<section class="results-section" aria-label="Query results">
      ${summary ? `<article class="message advisor-message results-summary">${summary}</article>` : ""}
      <div class="results-heading"><span>${resultsLabel(info, rows)}</span><strong>${rows.length}</strong></div>
      <label class="node-filter">${viewIcons.search}<input id="node-search" type="search" placeholder="Search results" aria-label="Search results" value="${escapeAttr(state.nodeSearch)}"></label>
      <div class="node-list">${rows.map(rowHtml).join("")}</div>
      <div class="node-pagination"><span>${total}</span><span aria-hidden="true">‹　1 / 1　›</span></div>
    </section>`;
  }

  function selectNode(key) {
    state.selectedNode = state.selectedNode === key ? null : key;
    // Opening a node collapses "Inspect further" so the prompts don't cover its details.
    if (state.selectedNode) state.promptsOpen = false;
    renderMain();
    renderConversation();
    if (state.selectedNode) {
      requestAnimationFrame(() => {
        main.querySelector(`[data-row-key="${CSS.escape(key)}"], [data-graph-node="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" });
        revealOpenNode();
      });
    }
  }

  // Scrolls the conversation so the whole expanded node card is visible (its header wins if it's taller than the panel).
  function revealOpenNode() {
    const row = conversation.querySelector(".node-row.is-open");
    if (!row) return;
    const view = conversation.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    const pad = 12;
    if (box.bottom > view.bottom - pad) conversation.scrollTop += Math.min(box.bottom - view.bottom + pad, box.top - view.top - pad);
    else if (box.top < view.top + pad) conversation.scrollTop -= view.top + pad - box.top;
  }

  function renderConversation() {
    const inExplorer = state.view === "explorer";
    const latestApplied = latestAppliedMessage();
    conversation.innerHTML = state.messages.map((message, index) => {
      if (message.role === "user") return `<div class="message user-message"><span>♧</span><p>${escapeHtml(message.text)}</p></div>`;
      const canUndo = inExplorer && message === latestApplied;
      if (message.kind === "receipt") return receiptMessage(message, canUndo);
      if (message.kind === "card") return answerCard(message, index, canUndo, inExplorer);
      const html = inExplorer && state.impactMode
        ? message.html.replace(
            '<button class="inline-link" data-action="show-impact">View module consumers in Explorer →</button>',
            '<div class="current-location"><span>You are now viewing the module consumers in Explorer.</span><button class="text-link" data-nav="run">Back to run</button></div>'
          )
        : message.html;
      const hasUserQuestion = state.messages.slice(0, index).some(item => item.role === "user");
      return `<article class="message advisor-message">${html}${message.evidence && message.evidence.length ? `<div class="references"><span>References</span>${message.evidence.map(item => `<a href="#" data-reference>${item}</a>`).join("")}</div>` : ""}${message.feedback && hasUserQuestion ? feedbackHtml() : ""}</article>`;
    }).join("") + (inExplorer ? resultsSection() : "");
    // Follow-ups live only here (not repeated inside answer cards); they follow the latest answer.
    const latestCard = [...state.messages].reverse().find(message => message.kind === "card" && message.nextPrompts?.length);
    const prompts = inExplorer ? (latestCard ? latestCard.nextPrompts : state.impactMode ? data.impactPrompts : data.explorerPrompts) : data.suggestedPrompts;
    const promptLabel = "Inspect further";
    promptMenu.innerHTML = prompts.length ? `<button id="prompt-toggle" class="prompt-toggle" type="button" aria-expanded="${state.promptsOpen}">${promptLabel} <span>${state.promptsOpen ? "⌃" : "⌄"}</span></button><div class="prompt-list" ${state.promptsOpen ? "" : "hidden"}>${prompts.map(prompt => `<button data-prompt="${escapeAttr(prompt)}">${escapeHtml(prompt)}</button>`).join("")}</div>` : "";
    requestAnimationFrame(() => {
      // Keep the latest question in view so long answer cards read from the top.
      const questions = conversation.querySelectorAll(".user-message");
      const latest = questions[questions.length - 1];
      conversation.scrollTop = latest ? latest.offsetTop - conversation.offsetTop - 8 : 0;
    });
  }

  function feedbackHtml() {
    return `<div class="feedback"><span>Did this response answer your question?</span><button aria-label="Thumbs up" title="Thumbs up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 10h10.4a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 18.8 9H14l.7-3.4A2.2 2.2 0 0 0 12.5 3L7 10Z"/></svg></button><button aria-label="Thumbs down" title="Thumbs down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H3v11h4Zm0-10h10.4a2 2 0 0 1 2 1.7l1.3 7a2 2 0 0 1-1.9 2.3H14l.7 3.4a2.2 2.2 0 0 1-2.2 2.6L7 14Z"/></svg></button></div>`;
  }

  function appliedStatus(message, canUndo) {
    if (canUndo) return appliedActions();
    if (message.undone) return '<div class="card-actions"><span class="applied-pill muted">Undone</span></div>';
    return "";
  }

  // Tier 1: one line. The table already shows the results.
  function receiptMessage(message, canUndo) {
    return `<article class="message advisor-message receipt"><p><strong>${escapeHtml(message.label || "Built query")}:</strong> ${escapeHtml(message.text)}</p>${appliedStatus(message, canUndo)}</article>`;
  }

  // Tier 2/3: interpretation, sources & freshness, insight, next steps. Never repeats the table.
  function answerCard(message, index, canUndo, inExplorer) {
    const actionLabels = {
      "save-view": "▣ Save as view",
      "download-view": "⇩ Export CSV",
      "copy-recommendation": message.copied ? "✓ Copied" : "⧉ Copy recommendation"
    };
    const actions = (message.actions || []).filter(action => inExplorer || action === "copy-recommendation");
    return `<article class="message advisor-message answer-card tier-${message.tier}" data-tier="${message.tier}">
      ${message.tier === 3 ? '<span class="tier-label">Recommendation · read-only</span>' : ""}
      ${message.basis ? `<p class="card-basis">${message.basis}</p>` : ""}
      <section class="card-section card-interpretation"><span class="card-label">Interpretation</span><p>${message.interpretation}</p>${inExplorer ? appliedStatus(message, canUndo) : ""}</section>
      <section class="card-section card-sources"><span class="card-label">Sources &amp; freshness</span><ul>${message.sources.map(source => `<li><strong>${source.label}</strong> <span>${source.detail}</span> <em>${source.freshness}</em></li>`).join("")}</ul>${message.gaps && message.gaps.length ? `<div class="card-gaps"><strong>Couldn't check</strong><ul>${message.gaps.map(gap => `<li>${gap}</li>`).join("")}</ul></div>` : ""}</section>
      <section class="card-section card-insight"><span class="card-label">Insight</span>${message.insight}</section>
      ${actions.length ? `<div class="card-actions card-footer">${actions.map(action => `<button type="button" data-action="${action}" data-message-index="${index}">${actionLabels[action]}</button>`).join("")}</div>` : ""}
      ${message.feedback ? feedbackHtml() : ""}
    </article>`;
  }

  function updateScope() {
    const scope = document.querySelector("#scope");
    if (scope) scope.textContent = state.advisorJourney === "explorer" ? "CoolCorp / Explorer" : `CoolCorp / ${data.workspace.name}`;
  }

  function updateNavigation() {
    const activeItem = state.view === "explorer" ? "explorer" : "workspaces";
    document.querySelectorAll("[data-nav-item]").forEach(item => {
      item.classList.toggle("active", item.dataset.navItem === activeItem);
    });
    document.body.classList.toggle("nav-collapsed", state.navCollapsed);
    const toggle = document.querySelector("#nav-collapse");
    toggle.setAttribute("aria-expanded", String(!state.navCollapsed));
    toggle.setAttribute("aria-label", state.navCollapsed ? "Expand navigation" : "Collapse navigation");
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
  }

  function escapeAttr(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function highlightRow(key) {
    state.highlightedRows = [key];
    state.selectedNode = key;
    renderMain();
    renderConversation();
    requestAnimationFrame(() => {
      main.querySelector(`[data-row-key="${CSS.escape(key)}"], [data-graph-node="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  document.addEventListener("click", event => {
    if (state.browseOpen && !event.target.closest(".browse-control")) {
      state.browseOpen = false;
      renderMain();
    }
    if (state.columnsMenuOpen && !event.target.closest(".view-columns")) {
      state.columnsMenuOpen = false;
      renderMain();
    }

    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const directExplorerEntry = nav.dataset.nav === "explorer";
      const runEntry = nav.dataset.nav === "run";
      if (directExplorerEntry) {
        state.impactMode = false;
        resetExplorerQuery();
        state.navCollapsed = false;
        state.messages = [];
        state.promptsOpen = defaultPromptsOpen("explorer");
      }
      setView(nav.dataset.nav, {
        impactMode: false,
        advisorJourney: directExplorerEntry ? "explorer" : "run"
      });
      if (directExplorerEntry) closeAdvisor();
      if (runEntry && state.runMessages) {
        // Back to run: pick the run investigation up where the user left it.
        state.messages = state.runMessages;
        state.runMessages = null; // the live conversation is the run's again
        state.promptsOpen = false;
      }
      if (runEntry) { openAdvisor(); initializeAdvisor(); renderConversation(); }
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "toggle-albus") {
      if (state.advisorOpen) closeAdvisor();
      else { openAdvisor(); initializeAdvisor(); }
    }
    if (action === "investigate-run") {
      // Always the default run investigation (turn-zero analysis + fix prompts), even if an earlier
      // conversation (e.g. "View 5 workspaces") is still in the panel.
      state.messages = [];
      state.runMessages = null;
      state.impactMode = false;
      state.promptsOpen = defaultPromptsOpen("run");
      setView("run", { impactMode: false, advisorJourney: "run" });
      openAdvisor();
      initializeAdvisor();
    }
    if (action === "view-at-risk") {
      // Workspaces list → straight to the at-risk workspaces: same state as asking the run page
      // "What other workspaces…?" and following its Explorer link, so the rest of the demo path continues.
      setView("run", { impactMode: false, advisorJourney: "run" });
      openAdvisor();
      initializeAdvisor();
      ask("What other workspaces are using RDS module v5.1.0?");
      showImpact();
    }
    if (action === "open-advisor") { openAdvisor(); initializeAdvisor(); }
    if (action === "new-session") {
      state.messages = [];
      state.runMessages = null;
      if (state.view === "explorer") resetExplorerQuery();
      state.promptsOpen = defaultPromptsOpen();
      initializeAdvisor();
      renderMain();
      renderConversation();
    }
    if (action === "show-impact") showImpact();
    if (action === "show-blast-radius") ask("Show blast radius for v5.1.0");
    if (action === "select-module") selectNode(RDS_MODULE);
    if (action === "clear-node") { state.selectedNode = null; renderMain(); renderConversation(); }
    if (action === "toggle-browse") { state.browseOpen = !state.browseOpen; renderMain(); }
    if (action === "saved-views") { state.modal = "saved-views"; state.browseOpen = false; renderMain(); }
    if (action === "save-view") { state.modal = "save-view"; renderMain(); }
    if (action === "confirm-save") {
      const name = document.querySelector("#view-name")?.value.trim() || defaultSaveName();
      const derived = state.explorerQuery === RDS_VERSIONS;
      state.savedViews.unshift({ name, derived, type: derived ? "Modules" : "Workspaces" });
      state.lastSaved = name;
      state.modal = null;
      renderMain();
    }
    if (action === "download-view") downloadView();
    if (action === "copy-recommendation") {
      const message = state.messages[Number(event.target.closest("[data-message-index]").dataset.messageIndex)];
      navigator.clipboard?.writeText(message.copyText || "").catch(() => {});
      message.copied = true;
      renderConversation();
    }
    if (action === "close-modal") { state.modal = null; renderMain(); }
    if (action === "toggle-conditions" && state.editingConditions) { state.editingConditions = false; state.conditionDraft = null; renderMain(); return; }
    if (action === "toggle-columns") { state.columnsMenuOpen = !state.columnsMenuOpen; renderMain(); }
    if (action === "toggle-graph-hud") { state.graphHudHidden = !state.graphHudHidden; renderMain(); }
    if (action === "toggle-table-hud") { state.tableHudHidden = !state.tableHudHidden; renderMain(); }
    if (action === "edit-conditions" || action === "toggle-conditions") {
      if (state.explorerDisplay === "graph") state.explorerDisplay = "table";
      state.conditionDraft = { type: state.queryType, conditions: state.queryConditions.map(condition => ({ ...condition })), albus: state.queryAlbus };
      state.editingConditions = true;
      renderMain();
      main.querySelector("#conditions-form select")?.focus();
    }
    if (action === "add-condition") { state.conditionDraft.conditions.push(newCondition(state.conditionDraft.type)); renderMain(); }
    if (action === "remove-condition") { state.conditionDraft.conditions.splice(Number(event.target.closest("[data-index]").dataset.index), 1); renderMain(); }
    if (action === "cancel-conditions") { state.editingConditions = false; state.conditionDraft = null; renderMain(); }
    if (action === "undo-query") undoQuery();
    // Breadcrumb "Explorer" and "Clear" both return to the entry card. The Albus panel and conversation stay as they are.
    if (action === "clear-query" || action === "back-to-explorer") {
      const display = state.explorerDisplay; // keep the chosen view mode when going back
      resetExplorerQuery();
      state.explorerDisplay = display;
      if (!state.impactMode) { state.navCollapsed = false; updateNavigation(); }
      renderMain();
      renderConversation();
    }

    const display = event.target.closest("[data-display]");
    if (display && !display.disabled) { state.explorerDisplay = display.dataset.display; renderMain(); }

    const prompt = event.target.closest("[data-prompt]");
    if (prompt) ask(prompt.dataset.prompt);

    const rowRef = event.target.closest("[data-row-ref]");
    if (rowRef && state.view === "explorer") highlightRow(rowRef.dataset.rowRef);

    const graphNode = event.target.closest("[data-graph-node]");
    if (graphNode) selectNode(graphNode.dataset.graphNode);

    const nodeRow = event.target.closest("[data-node-row]");
    if (nodeRow) {
      if (!state.advisorOpen && main.contains(nodeRow)) {
        state.selectedNode = nodeRow.dataset.nodeRow;
        state.promptsOpen = false;
        openAdvisor();
        requestAnimationFrame(revealOpenNode);
      }
      else selectNode(nodeRow.dataset.nodeRow);
    }

    if (event.target.closest("#prompt-toggle")) {
      state.promptsOpen = !state.promptsOpen;
      renderConversation();
    }

    if (event.target.closest("#history-toggle")) {
      const toggle = document.querySelector("#history-toggle");
      const menu = document.querySelector("#history-menu");
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }

    const history = event.target.closest("[data-history]");
    if (history) {
      document.querySelector("#history-menu").hidden = true;
      document.querySelector("#history-toggle").setAttribute("aria-expanded", "false");
      state.messages = [];
      state.messages.push({ role: "user", text: history.dataset.history });
      state.messages.push({ role: "advisor", type: "answer", feedback: true, html: `<p>Here is the latest simulated context from the <strong>${escapeHtml(history.dataset.history)}</strong> conversation.</p>`, evidence: ["Conversation history"] });
      renderConversation();
    }

    if (event.target.closest("[data-reference]")) event.preventDefault();
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "explorer-ask-form") {
      event.preventDefault();
      const question = document.querySelector("#explorer-ask-input").value.trim();
      if (question) ask(question);
    }
    if (event.target.id === "conditions-form") {
      event.preventDefault();
      const draft = state.conditionDraft;
      state.queryHistory.push(snapshot());
      state.queryType = draft.type;
      state.queryConditions = draft.conditions.filter(condition => isEmptyOperator(condition.operator) || String(condition.value).trim()).map(condition => ({ ...condition, value: String(condition.value).trim() }));
      state.queryAlbus = draft.albus;
      // Keep only refinements whose condition survived the edit (their row filters follow the conditions).
      state.refinements = draft.type === state.queryHistory[state.queryHistory.length - 1].queryType
        ? state.refinements.filter(id => state.queryConditions.some(condition => sameCondition(condition, refinementById(id).condition)))
        : [];
      state.editingConditions = false;
      state.conditionDraft = null;
      setReceipt("Edited by you", receiptText(), true);
      renderMain();
      renderConversation();
    }
  });

  // Query builder draft: selects re-render (operators/value depend on column); text input updates in place.
  document.addEventListener("change", event => {
    const columnToggle = event.target.closest("[data-column-toggle]");
    if (columnToggle) {
      const id = columnToggle.dataset.columnToggle;
      state.hiddenColumns = columnToggle.checked ? state.hiddenColumns.filter(item => item !== id) : [...state.hiddenColumns, id];
      renderMain();
      return;
    }
    const field = event.target.closest("[data-draft]");
    if (!field || !state.conditionDraft) return;
    if (updateDraft(field.dataset.draft, Number(field.dataset.index), field.value)) renderMain();
  });
  document.addEventListener("input", event => {
    if (event.target.id === "node-search") {
      state.nodeSearch = event.target.value;
      const search = state.nodeSearch.toLowerCase();
      conversation.querySelectorAll(".node-row").forEach(row => { row.hidden = Boolean(search) && !row.dataset.nodeName.includes(search); });
      return;
    }
    const field = event.target.closest('input[data-draft="value"]');
    if (field && state.conditionDraft) updateDraft("value", Number(field.dataset.index), field.value);
  });

  document.querySelector("#advisor-close").addEventListener("click", closeAdvisor);
  document.querySelector("#nav-collapse").addEventListener("click", () => {
    state.navCollapsed = !state.navCollapsed;
    updateNavigation();
  });
  document.querySelector("#composer").addEventListener("submit", event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    ask(question);
    input.value = "";
  });

  initializeAdvisor();
  renderMain();
  updateScope();
  updateNavigation();
})();
