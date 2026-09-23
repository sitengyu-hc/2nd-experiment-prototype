(function () {
  "use strict";

  const data = window.PROTOTYPE_DATA;
  const state = {
    view: "workspaces",
    previousView: null,
    advisorOpen: true,
    messages: [],
    impactMode: false,
    advisorJourney: "run",
    navCollapsed: false,
    promptsOpen: true,
    explorerDisplay: "graph",
    browseOpen: false,
    explorerPanelHidden: false,
    selectedNode: null,
    modal: null,
    viewSaved: false,
    explorerQuery: null,
    explorerMode: "explore",
    queryDraft: null,
    queryConditions: []
  };

  const main = document.querySelector("#main-content");
  const advisor = document.querySelector("#advisor");
  const conversation = document.querySelector("#conversation");
  const promptMenu = document.querySelector("#prompt-menu");
  const input = document.querySelector("#advisor-input");
  const advisorTitle = document.querySelector("#advisor-title");
  const advisorComposer = document.querySelector("#advisor-composer");

  const icon = (name) => {
    const paths = {
      database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      warning: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/>',
      explorer: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/>'
    };
    return `<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  };

  function setView(view, options = {}) {
    if (state.view !== view) state.previousView = state.view;
    state.view = view;
    if (view === "run") {
      state.advisorOpen = true;
      advisor.classList.add("is-open");
      document.body.classList.add("advisor-open");
    } else if (view === "workspaces") {
      state.advisorOpen = false;
      advisor.classList.remove("is-open");
      document.body.classList.remove("advisor-open");
    }
    if (options.impactMode !== undefined) state.impactMode = options.impactMode;
    if (options.advisorJourney && options.advisorJourney !== state.advisorJourney) {
      state.advisorJourney = options.advisorJourney;
      state.messages = [];
      state.promptsOpen = true;
      initializeAdvisor();
    }
    renderMain();
    renderConversation();
    updateScope();
    updateNavigation();
    main.focus();
  }

  function renderMain() {
    const explorerResults = state.view === "explorer" && (state.impactMode || Boolean(state.explorerQuery));
    document.body.classList.toggle("explorer-view", state.view === "explorer");
    document.body.classList.toggle("explorer-impact", explorerResults);
    document.body.classList.toggle("explorer-direct", state.view === "explorer" && !explorerResults);
    document.querySelector(".app-shell").style.paddingLeft = explorerResults ? "16px" : "";
    document.querySelector(".side-nav").style.width = explorerResults ? "16px" : "";
    if (state.view === "workspaces") main.innerHTML = workspacesView();
    if (state.view === "run") main.innerHTML = runView();
    if (state.view === "explorer") main.innerHTML = explorerView();
  }

  function workspacesView() {
    const rows = [
      ["my-workspace", "Errored", "team-terraform-sleep", "Default Project", "a few seconds ago"],
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
      <div class="table-wrap"><table><thead><tr><th>Workspace</th><th>Status</th><th>Repository</th><th>Project</th><th>Latest change</th></tr></thead><tbody>
        ${rows.map((row, index) => `<tr ${index === 0 ? 'class="clickable" data-nav="run"' : ""}><td><strong>${row[0]}</strong></td><td><span class="status-dot ${row[1].toLowerCase().replaceAll(" ", "-")}"></span>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`).join("")}
      </tbody></table><div class="pagination">1–7 of 100 <button>1</button><button>2</button><button>3</button><button>…</button><button>10</button></div></div>
    </div>`;
  }

  function runView() {
    return `<div class="page run-page">
      <div class="breadcrumbs"><button class="text-link" data-nav="workspaces">CoolCorp / Workspaces</button> / my-workspace / Runs / <strong>#${data.run.id}</strong></div>
      <div class="page-title-row"><div><h1>${data.workspace.name}</h1><p>ID: ${data.workspace.id}</p><button class="text-link">Add workspace description</button></div><div><button class="secondary">▣ Lock</button> <button class="primary">＋ New Run</button></div></div>
      <div class="workspace-meta"><span>▣ Locked by <strong>johndoe</strong></span><span>▤ Resources <strong>${data.workspace.resources}</strong></span><span>◇ Tags <strong>3</strong></span><span>⚑ Terraform <u>${data.workspace.terraformVersion}</u></span></div>
      <p class="updated">◷ Updated today at 10:12 AM</p>
      <div class="run-heading"><h2>${data.run.title}</h2><span class="badge neutral">◷ Current</span><span class="badge danger">ⓧ Errored</span></div>
      <div class="run-stats"><div><small>Plan Duration</small><strong>${data.run.duration}</strong></div><div><small>Resources to be changed</small><strong><span class="green">+2</span> <span class="blue">~0</span> <span class="red">-0</span></strong></div></div>
      <section class="panel run-details"><div class="panel-title">⌄　▤　<strong>Run Details</strong><span><strong>${data.run.actor}</strong> triggered a run from ${data.run.source}</span></div></section>
      <section class="panel plan-panel"><div class="panel-title"><span class="red">ⓧ</span>　<strong>Plan errored</strong></div><div class="panel-body">
        <p><strong>Started</strong> 30 minutes ago　&gt; <strong>Finished</strong> 30 minutes ago</p><div class="create-bar">＋ 2 to create</div>
        <div class="filter-row"><button class="secondary wide">⌕ Filter by address...</button><button class="secondary">☷ Filter by action　⌄</button><span>terraform 1.8</span><button class="secondary">▣ Download raw log</button></div>
        <div class="diagnostics-heading"><strong>⌄ Diagnostics</strong><button class="advisor-gradient" data-action="open-initial">✦ Explore in Albus</button></div>
        <div class="error-card"><div class="error-title">Error: Instance cannot be destroyed</div><p>on ${data.run.sourceFile} line ${data.run.sourceLine}:</p><pre>resource "aws_db_instance" "this" {</pre><p>Resource <code>${data.run.address}</code> has <code>lifecycle.prevent_destroy</code> set, but the plan calls for this resource to be destroyed.</p></div>
      </div></section>
    </div>`;
  }

  function explorerView() {
    const showingResults = state.impactMode || Boolean(state.explorerQuery);
    const compact = showingResults || state.explorerMode !== "explore";
    return `<div class="explorer-page explorer-mode-${state.explorerMode} ${state.explorerPanelHidden ? "panel-hidden" : ""}">
      <section class="explorer-controls">
        <button class="hud-hide" data-action="toggle-explorer-panel">HIDE</button>
        <div class="breadcrumbs">CoolCorp　/　Explorer　/　<strong>${state.impactMode ? "Impact analysis" : "Types"}</strong></div>
        <h1>${icon("explorer")} Explorer</h1><p>Explore your data to analyze your organization's Terraform usage.</p>
        ${compact ? compactExplorerControls() : `<label class="field-label">VIEW MODE</label><div class="view-toggle"><button data-display="graph" class="${state.explorerDisplay === "graph" ? "active" : ""}">Graph</button><button data-display="table" class="${state.explorerDisplay === "table" ? "active" : ""}">Table View</button></div><label class="field-label">BROWSE</label><div class="browse-control"><button class="select-control" data-action="toggle-browse" aria-expanded="${state.browseOpen}">Types, Use cases and Saved views <span>${state.browseOpen ? "⌃" : "⌄"}</span></button>${state.browseOpen ? browseMenu() : ""}</div>${state.impactMode ? impactViewControls() : defaultExplorerControls()}`}
      </section>
      <button class="hud-show" data-action="toggle-explorer-panel">VIEW</button>
      ${showingResults ? (state.explorerDisplay === "graph" ? explorerResultsCanvas() : impactTable()) : `<div class="empty-explorer"><div class="empty-icon">⌘</div><strong>Get started.</strong><span>Select a Type or Use case to explore your infrastructure.</span></div>`}
      ${state.modal === "saved-views" ? savedViewsModal() : ""}
      ${state.modal === "save-view" ? saveViewModal() : ""}
    </div>`;
  }

  function defaultExplorerControls() {
    return `<form id="natural-query-form" class="natural-query"><label for="natural-query-input">ENTER A NATURAL LANGUAGE QUERY</label><div><input id="natural-query-input" placeholder="Ex. production workspaces using AWS vx.x.x" value="${state.queryDraft ? escapeHtml(state.queryDraft) : ""}"><button type="submit">Search</button></div></form>
      ${state.explorerQuery ? directReturnedNodes() : ""}`;
  }

  function directReturnedNodes() {
    const names = data.affectedWorkspaces.map(node => node.name);
    return `<div class="returned-heading"><span>RETURNED NODES</span><strong>${names.length}</strong></div><div class="returned-nodes">${names.map(name => `<button data-node="${name}"><i class="node-dot"></i><span>${name}</span><small>Workspace</small></button>`).join("")}</div>`;
  }

  function compactExplorerControls() {
    const title = state.impactMode ? "RDS module cross-workspace impact" : state.explorerQuery || "Current Explorer query";
    const result = data.explorerResults[state.explorerQuery];
    const count = state.impactMode ? "5 workspaces" : result ? `${result.count} ${result.unit}` : "Query results";
    return `<div class="compact-query"><span>ACTIVE QUERY</span><strong>${escapeHtml(title)}</strong><small>${count}</small>${state.queryConditions.length ? `<div>${state.queryConditions.map(item => `<code>${item}</code>`).join("")}</div>` : ""}<button data-action="return-explore">← Back to query and results</button></div>`;
  }

  function explorerQueryVisualization() {
    const queryViews = {
      "View all modules": { title: "Modules across CoolCorp", total: "32 modules", type: "module", nodes: ["rds", "vpc-baseline", "iam-roles", "eks", "s3-bucket", "cloudfront"] },
      "View all providers": { title: "Providers across CoolCorp", total: "12 providers", type: "provider", nodes: ["hashicorp/aws", "hashicorp/random", "hashicorp/tls", "hashicorp/vault", "hashicorp/null", "hashicorp/time"] },
      "Drifted workspaces": { title: "Drifted workspaces", total: "6 workspaces", type: "impact", nodes: ["prod-network", "payments-prod-eu", "analytics-prod", "platform-rds", "legacy-data", "sandbox-testing"] },
      "How many EC2 instances exist across my organization?": { title: "EC2 instances across CoolCorp", total: "47 instances", type: "resource", nodes: ["prod-web-01", "prod-api-02", "staging-web", "analytics-worker", "sandbox-testing", "qa-backend"] },
      "Which workspaces use AWS provider version 5.x?": { title: "AWS provider 5.x usage", total: "18 workspaces", type: "provider", nodes: ["my-workspace", "prod-payments", "prod-catalog", "staging-web", "analytics-worker", "qa-backend"] },
      "What resources depend on workspace X?": { title: "Workspace X dependencies", total: "7 resources", type: "dependent", nodes: ["vpc-main", "security-groups", "database-endpoint", "prod-api", "catalog-service", "analytics-worker"] },
      "What is the cross workspace impact of workspace Y?": { title: "Workspace Y cross-workspace impact", total: "5 workspaces", type: "impact", nodes: ["workspace-y", "prod-payments", "prod-catalog", "staging-web", "analytics-worker", "qa-backend"] },
      "Show resources using module Z.": { title: "Resources using module Z", total: "32 workspaces", type: "module", nodes: ["module-z", "prod-web", "prod-api", "staging-web", "analytics-worker", "sandbox-testing"] }
    };
    const view = queryViews[state.explorerQuery] || queryViews["How many EC2 instances exist across my organization?"];
    if (state.explorerDisplay === "table") {
      return `<div class="explorer-table query-results"><div class="table-topline"><strong>Results: ${view.total}</strong></div><table><thead><tr><th>Name</th><th>Type</th><th>Workspace</th><th>Status</th></tr></thead><tbody>${view.nodes.map((node, index) => `<tr><td><strong>${node}</strong></td><td>${view.type}</td><td>${index ? "CoolCorp" : "Selected"}</td><td>Active</td></tr>`).join("")}</tbody></table></div>`;
    }
    const positions = [[50, 48], [68, 25], [79, 46], [68, 70], [35, 70], [27, 34]];
    const edges = positions.slice(1).map(([x, y]) => `<line x1="50%" y1="48%" x2="${x}%" y2="${y}%"/>`).join("");
    return `<div class="query-visualization"><div class="query-result-title"><span>QUERY RESULT</span><strong>${view.title}</strong><small>${view.total}</small></div><svg aria-hidden="true">${edges}</svg>${view.nodes.map((node, index) => `<button class="query-node ${view.type} ${index === 0 ? "center" : ""}" style="left:${positions[index][0]}%;top:${positions[index][1]}%" data-node="${node}"><span>${index === 0 ? "◎" : "◇"}</span><strong>${node}</strong><small>${index === 0 ? "Selected" : view.type}</small></button>`).join("")}<div class="query-legend"><span><i></i>${view.type}</span><span><i></i>Related result</span></div></div>`;
  }

  function impactViewControls() {
    return `<div class="impact-query-card"><span>ACTIVE QUERY</span><strong>RDS module cross-workspace impact</strong><small>5 workspaces</small><button data-action="return-explore">← Back to query and results</button></div>`;
  }

  function browseMenu() {
    return `<div class="browse-menu"><div><span>TYPES</span><button>Workspaces</button><button>Policy Sets</button><button>Modules</button><button>Providers</button><button>Resources</button><button>Terraform Versions</button><button data-action="saved-views">Saved views <strong>${state.viewSaved ? 21 : 20}</strong></button></div><div><span>PRE-DEFINED VIEWS</span><button>View All Workspaces</button><button>Organized by Project</button><button>Organized by Status</button><button>Workspaces with failed checks</button><button>Drifted Workspaces</button><button>Latest updated workspaces</button></div></div>`;
  }

  function topologyCanvas() {
    const consumers = data.affectedWorkspaces.slice(1);
    const center = { x: 51, y: 43 };
    const positions = [
      { x: 51, y: 28 },
      { x: 58, y: 35 },
      { x: 58, y: 51 },
      { x: 44, y: 51 },
      { x: 43, y: 35 }
    ];
    const lines = consumers.map((node, index) => {
      const position = positions[index];
      const x1 = center.x * 10, y1 = center.y * 6.5, x2 = position.x * 10, y2 = position.y * 6.5;
      return `<path class="${node.relation}" d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" marker-end="url(#arrow-${node.relation})"/>`;
    }).join("");
    return `<div class="topology" aria-label="RDS module consumers"><div class="risk-banner"><span>!</span><strong>2 of these are production workspaces — changes carry elevated risk</strong></div><svg class="edges" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow-consumer" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker></defs>${lines}</svg><button class="module-node" style="left:${center.x}%;top:${center.y}%" data-action="select-module"><span>▣</span><strong>labels/aws</strong><small>v1.3.0</small></button>${consumers.map((node, index) => `<button class="graph-node ${node.relation} ${state.selectedNode === node.name ? "is-focused" : ""}" style="left:${positions[index].x}%;top:${positions[index].y}%" data-impact-node="${node.name}"><span class="node-symbol">▤</span><strong>${node.name}</strong><small>workspace</small></button>`).join("")}<div class="zoom-tools"><button>20%</button><button class="active">50%</button><button>100%</button></div><div class="legend"><span><i class="workspace-key"></i> Workspace</span><span><i class="selected-key"></i> selected</span><span><i class="consumer-key"></i> direct dependent</span></div></div>`;
  }

  function explorerResultsCanvas() {
    const result = data.explorerResults[state.explorerQuery];
    if (!state.impactMode && ["module", "provider"].includes(result?.type)) return relationshipResultsCanvas(result);
    return !state.impactMode && result ? inventoryResultsCanvas(result) : topologyCanvas();
  }

  function inventoryResultsCanvas(result) {
    const positions = [[32, 28], [47, 28], [32, 39], [47, 39], [32, 50], [47, 50], [32, 61], [47, 61]];
    const symbol = { module: "▱", provider: "⬡", resource: "◇", workspace: "▤" }[result.type];
    return `<div class="topology inventory-topology type-${result.type}" aria-label="${escapeHtml(state.explorerQuery)}"><div class="result-summary"><span>${result.count}</span><strong>${escapeHtml(result.summary)}</strong></div>${result.nodes.map((node, index) => `<button class="graph-node result-${result.type} ${state.selectedNode === node.name ? "is-focused" : ""}" style="left:${positions[index][0]}%;top:${positions[index][1]}%" data-result-node="${node.name}"><span class="node-symbol">${symbol}</span>${node.alert ? '<i>!</i>' : ''}<strong>${node.name}</strong><small>${node.detail}</small></button>`).join("")}<div class="zoom-tools"><button>20%</button><button class="active">50%</button><button>100%</button></div><div class="legend"><span><i class="result-key"></i> ${result.type}</span><span><i class="selected-key"></i> selected</span></div></div>`;
  }

  function relationshipResultsCanvas(result) {
    const entityPositions = [[31, 27], [31, 45], [31, 63]];
    const workspaceNames = [...new Set(result.nodes.flatMap(node => node.workspaces))];
    const workspacePositions = workspaceNames.map((_, index) => [55, 22 + index * (52 / Math.max(workspaceNames.length - 1, 1))]);
    const workspacePosition = Object.fromEntries(workspaceNames.map((name, index) => [name, workspacePositions[index]]));
    const lines = result.nodes.flatMap((node, nodeIndex) => node.workspaces.map(name => {
      const [x1, y1] = entityPositions[nodeIndex];
      const [x2, y2] = workspacePosition[name];
      return `<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"/>`;
    })).join("");
    const symbol = result.type === "module" ? "▱" : "⬡";
    return `<div class="topology relationship-topology type-${result.type}" aria-label="${escapeHtml(state.explorerQuery)}"><div class="result-summary"><span>${result.count}</span><strong>${escapeHtml(result.summary)}</strong></div><svg class="relationship-edges" aria-hidden="true">${lines}</svg>${result.nodes.map((node, index) => `<button class="graph-node relation-entity result-${result.type} ${state.selectedNode === node.name ? "is-focused" : ""}" style="left:${entityPositions[index][0]}%;top:${entityPositions[index][1]}%" data-result-node="${node.name}"><span class="node-symbol">${symbol}</span><strong>${node.name}</strong><small>${node.detail}</small></button>`).join("")}${workspaceNames.map(name => `<button class="graph-node relation-workspace ${state.selectedNode === name ? "is-focused" : ""}" style="left:${workspacePosition[name][0]}%;top:${workspacePosition[name][1]}%" data-result-node="${name}"><span class="node-symbol">▤</span><strong>${name}</strong><small>workspace</small></button>`).join("")}<div class="zoom-tools"><button>20%</button><button class="active">50%</button><button>100%</button></div><div class="legend"><span><i class="result-key"></i> ${result.type}</span><span><i class="workspace-key"></i> workspace</span><span><i class="selected-key"></i> selected</span></div></div>`;
  }

  function impactResultsPanel() {
    const consumers = data.affectedWorkspaces.slice(1);
    const workspace = consumers.find(node => node.name === state.selectedNode);
    if (state.selectedNode === "labels/aws") {
      const details = [
        ["Project name", "platform"],
        ["Current run ID", "run-Ax7mKPqZ2nLvYw"],
        ["Run status", "applied"],
        ["Current run applied", "Mar 12, 2025 11:22:05 am"],
        ["VCS repo", "example1/labels-aws"],
        ["No-code module", "no-code-module-3"],
        ["Module count", "12"],
        ["Modules", "vpc-baseline, iam-roles"],
        ["Provider count", "34"],
        ["Providers", "registry.terraform.io/hashicorp/aws"],
        ["Terraform version", "1.3.0"],
        ["Drifted", "false"],
        ["Health checks passed", "5"],
        ["Health checks failed", "0"],
        ["Resources drifted", "0"],
        ["Resources undrifted", "12"],
        ["Resource count", "21"],
        ["Tags", "platform, aws"]
      ];
      return `<section class="advisor-results"><div class="returned-heading"><span>RETURNED NODES</span></div><label class="node-search">⌕ <input placeholder="Search nodes"></label><div class="selected-result"><button class="selected-result-title" data-action="hide-node-details"><i class="node-dot module"></i><strong>labels/aws</strong><span>Hide information</span></button><dl>${details.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl></div>${returnedWorkspaceRows(consumers)}</section>`;
    }
    if (workspace) {
      const details = [
        ["Project name", "payments"],
        ["Current run ID", "run-J7pR4NkL9sQw2Vx"],
        ["Run status", workspace.runStatus],
        ["Current run applied", "Mar 11, 2025 4:18:42 pm"],
        ["VCS repo", `example1/${workspace.name}`],
        ["Module count", "8"],
        ["Provider count", "28"],
        ["Providers", "registry.terraform.io/hashicorp/aws"],
        ["Terraform version", "1.5.0"],
        ["Drifted", "false"],
        ["Resource count", String(workspace.resources)],
        ["Tags", `payments, ${workspace.environment}, eu`],
        ["Created", "Feb 3 2024"],
        ["Updated", "Mar 11 2025"]
      ];
      return `<section class="advisor-results"><div class="returned-heading"><span>RETURNED NODES</span></div><label class="node-search">⌕ <input placeholder="Search nodes"></label><div class="selected-result workspace-result"><button class="selected-result-title" data-action="hide-node-details"><i class="node-dot consumer"></i><strong>${workspace.name}</strong><span>Hide information</span></button><dl>${details.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl><div class="result-actions"><button>View resources <span>→</span></button><button>View modules <span>→</span></button><button>View providers <span>→</span></button><button class="primary-action" data-action="show-node-impact">View blast radius <span>→</span></button></div></div>${returnedWorkspaceRows(consumers, workspace.name)}</section>`;
    }
    return `<section class="advisor-results"><div class="returned-heading"><span>RETURNED NODES</span></div><label class="node-search">⌕ <input placeholder="Search nodes"></label><div class="returned-nodes"><button class="module-result" data-action="select-module"><i class="node-dot module"></i><span>labels/aws</span><small>View information</small></button>${consumers.map(node => returnedWorkspaceRow(node)).join("")}</div><div class="result-pagination"><span>1–6 of 6</span><span>‹　<strong>1</strong>　2　›</span></div></section>`;
  }

  function inventoryResultsPanel() {
    const result = data.explorerResults[state.explorerQuery];
    const relationshipResult = ["module", "provider"].includes(result.type);
    const entities = relationshipResult ? result.nodes.map(node => ({ ...node, kind: result.type })) : [];
    const workspaces = relationshipResult
      ? [...new Set(result.nodes.flatMap(node => node.workspaces))].map(name => ({
          name,
          kind: "workspace",
          detail: result.nodes.filter(node => node.workspaces.includes(name)).map(node => `${node.name} ${node.detail}`).join(", ")
        }))
      : result.nodes.map(node => ({ ...node, kind: "workspace" }));
    const rows = [...entities, ...workspaces];
    const selected = rows.find(node => node.name === state.selectedNode);
    const visibleRows = selected ? rows.filter(node => node.name !== selected.name) : rows;
    return `<section class="advisor-results"><div class="returned-heading"><span>RETURNED NODES</span></div><label class="node-search">⌕ <input placeholder="Search nodes"></label>${selected ? explorerSelectionCard(selected, result) : ""}<div class="returned-nodes ${selected ? "remaining-results" : ""}">${visibleRows.map(node => explorerResultRow(node, result.type)).join("")}</div><div class="result-pagination"><span>1–${rows.length} of ${rows.length}</span><span>‹　<strong>1</strong>　2　›</span></div></section>`;
  }

  function explorerResultRow(node, resultType) {
    const dotType = node.kind === "workspace" ? "workspace" : resultType;
    return `<button data-result-node="${node.name}"><i class="node-dot result-${dotType}"></i><span>${node.name}</span>${node.alert ? '<small class="risk-node">!</small>' : `<small>${node.detail}</small>`}</button>`;
  }

  function explorerSelectionCard(node, result) {
    const isWorkspace = node.kind === "workspace";
    const details = isWorkspace
      ? [
          ["Project name", node.name.includes("prod") ? "production" : "platform"],
          ["Current run ID", "run-J7pR4NkL9sQw2Vx"],
          ["Run status", node.alert ? "drifted" : "applied"],
          ["Current run applied", "Mar 12, 2025 11:22:05 am"],
          ["VCS repo", `example1/${node.name}`],
          ["Terraform version", "1.8.5"],
          ["Drifted", node.alert ? "true" : "false"],
          ["Resource count", "34"],
          [result.type === "module" ? "Modules" : result.type === "provider" ? "Providers" : "Context", node.detail]
        ]
      : [
          ["Type", node.kind],
          ["Version", node.detail],
          ["Workspace count", String(node.workspaces.length)],
          ["Workspaces", node.workspaces.join(", ")],
          ["Source", node.kind === "module" ? `app.terraform.io/CoolCorp/${node.name}` : `registry.terraform.io/${node.name}`],
          ["Last updated", "Mar 12 2025"]
        ];
    const actions = isWorkspace ? `<div class="result-actions"><button>View resources <span>→</span></button><button>View modules <span>→</span></button><button>View providers <span>→</span></button><button class="primary-action">View blast radius <span>→</span></button></div>` : "";
    return `<div class="selected-result explorer-selection ${isWorkspace ? "workspace-result" : ""}"><button class="selected-result-title" data-action="hide-node-details"><i class="node-dot result-${node.kind}"></i><strong>${node.name}</strong><span>Hide information</span></button><dl>${details.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("")}</dl>${actions}</div>`;
  }

  function selectExplorerResult(name, showPrompts = false) {
    state.selectedNode = name;
    if (showPrompts) state.promptsOpen = true;
    renderMain();
    renderConversation();
  }

  function returnedWorkspaceRows(consumers, excludedName) {
    const rows = consumers.filter(node => node.name !== excludedName).map(node => returnedWorkspaceRow(node)).join("");
    return `<div class="returned-nodes remaining-results">${rows}</div>`;
  }

  function returnedWorkspaceRow(node) {
    return `<button data-impact-node="${node.name}"><i class="node-dot consumer"></i><span>${node.name}</span>${node.environment === "production" ? '<small class="risk-node">!</small>' : '<small>View information</small>'}</button>`;
  }

  function impactTable() {
    return `<div class="explorer-table"><div class="table-topline"><strong>Results: ${data.affectedWorkspaces.length} workspaces found.</strong><div><button data-action="save-view">▣ Save</button><button data-action="download-view">⇩ Download</button></div></div><button class="conditions">Show conditions <span>Module is RDS · Version is v5.1.0</span></button><table><thead><tr><th>Name</th><th>Relationship</th><th>Environment</th><th>Current run</th><th>Module</th></tr></thead><tbody>${data.affectedWorkspaces.map(node => `<tr data-node="${node.name}"><td><strong>${node.name}</strong></td><td>${node.relation === "selected" ? "Originating workspace" : "Module consumer"}</td><td>${node.environment}</td><td>${node.runStatus}</td><td>rds v5.1.0</td></tr>`).join("")}</tbody></table><div class="table-pagination">1–${data.affectedWorkspaces.length} of ${data.affectedWorkspaces.length} <span>Items per page　10</span></div></div>`;
  }

  function savedViewsModal() {
    return `<div class="modal-backdrop"><section class="explorer-modal"><button class="modal-close" data-action="close-modal">×</button><h2>Saved Views</h2><p>${state.viewSaved ? 21 : 20} saved views available.</p><div class="saved-toolbar"><input placeholder="Search"><select><option>All types</option><option>Workspaces</option><option>Modules</option></select></div><table><thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Last Updated</th></tr></thead><tbody>${state.viewSaved ? '<tr><td><strong>RDS v5.1.0 module consumers</strong></td><td>Workspaces</td><td>AB</td><td>Just now</td></tr>' : ""}<tr><td>Production workspace health</td><td>Workspaces</td><td>Platform team</td><td>2 days ago</td></tr><tr><td>Outdated module versions</td><td>Modules</td><td>AB</td><td>5 days ago</td></tr></tbody></table></section></div>`;
  }

  function saveViewModal() {
    return `<div class="modal-backdrop"><section class="save-modal"><button class="modal-close" data-action="close-modal">×</button><h2>Save view</h2><p>Save the current filters and graph layout for future investigation.</p><label>Name<input id="view-name" value="RDS v5.1.0 module consumers"></label><div><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-save">Save view</button></div></section></div>`;
  }

  function downloadView() {
    const rows = ["workspace,relationship,environment,current_run,module", ...data.affectedWorkspaces.map(node => `${node.name},${node.relation},${node.environment},${node.runStatus},rds-v5.1.0`)];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    link.download = "rds-v5.1.0-module-consumers.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function openAdvisor(compactExplorer = true) {
    state.advisorOpen = true;
    if (state.view === "explorer") state.explorerMode = compactExplorer ? "converse" : "explore";
    advisor.classList.add("is-open");
    document.body.classList.add("advisor-open");
    renderMain();
    renderAdvisorPanel();
  }

  function closeAdvisor() {
    state.advisorOpen = false;
    if (state.view === "explorer") state.explorerMode = "explore";
    advisor.classList.remove("is-open");
    document.body.classList.remove("advisor-open");
    renderMain();
    renderAdvisorPanel();
  }

  function openInspector(nodeName) {
    state.selectedNode = nodeName;
    state.explorerMode = "inspect";
    state.advisorOpen = true;
    advisor.classList.add("is-open", "is-inspector");
    document.body.classList.add("advisor-open");
    renderMain();
    renderAdvisorPanel();
  }

  function renderAdvisorPanel() {
    const inspector = state.view === "explorer" && state.explorerMode === "inspect";
    advisor.classList.toggle("is-inspector", inspector);
    advisorTitle.textContent = inspector ? "Workspace details" : "Albus";
    advisorComposer.hidden = inspector;
    if (inspector) {
      conversation.innerHTML = inspectorView();
    } else {
      renderConversation();
    }
  }

  function inspectorView() {
    const node = data.affectedWorkspaces.find(item => item.name === state.selectedNode);
    const resources = node?.resources || 42;
    const relation = node ? (node.relation === "selected" ? "Originating workspace" : "Uses RDS v5.1.0") : "Query result";
    return `<div class="inspector-content"><span class="inspector-type">WORKSPACE</span><h2>${escapeHtml(state.selectedNode || "Workspace")}</h2><p>Selected from the current Explorer result set.</p><dl><dt>Project name</dt><dd>platform</dd><dt>Run status</dt><dd>${node?.runStatus || "applied"}</dd><dt>Resources</dt><dd>${resources}</dd><dt>Relationship</dt><dd>${relation}</dd><dt>Terraform version</dt><dd>1.8.5</dd><dt>Drifted</dt><dd>false</dd><dt>Health checks passed</dt><dd>5</dd><dt>Health checks failed</dt><dd>0</dd></dl><div class="inspector-actions"><button>View resources</button><button>View modules</button><button>View providers</button><button data-action="show-node-impact">View blast radius</button></div><button class="back-results" data-action="return-explore">← Back to results</button></div>`;
  }

  function initializeAdvisor() {
    if (state.messages.length) return;
    const initialResponse = state.advisorJourney === "explorer" ? data.responses.explorerInitial : data.responses.initial;
    state.messages.push({ role: "advisor", ...initialResponse });
    renderConversation();
  }

  function ask(question) {
    const response = getResponse(question);
    state.promptsOpen = false;
    if (state.view === "explorer" && state.advisorJourney === "explorer") {
      state.messages = [{ role: "advisor", ...response }];
      state.explorerQuery = question;
      state.explorerMode = "converse";
      state.navCollapsed = true;
      state.selectedNode = null;
      document.body.classList.add("nav-collapsed");
      renderMain();
    } else {
      state.messages.push({ role: "user", text: question });
      state.messages.push({ role: "advisor", ...response });
    }
    renderConversation();
  }

  function getResponse(question) {
    // Future live-model integration belongs behind this adapter.
    return data.responses[question] || {
      type: "answer",
      html: `<p>This prototype currently supports the suggested research paths. Try one of the prompts below.</p>`,
      evidence: []
    };
  }

  function renderConversation() {
    if (state.view === "explorer" && state.explorerMode === "inspect") return;
    conversation.innerHTML = state.messages.map((message, index) => {
      if (message.role === "user") return `<div class="message user-message"><span>♧</span><p>${escapeHtml(message.text)}</p></div>`;
      const html = state.view === "explorer" && state.impactMode
        ? message.html.replace(
            '<button class="inline-link" data-action="show-impact">View module consumers in Explorer →</button>',
            '<div class="current-location"><span>You are now viewing the module consumers in Explorer.</span><button class="text-link" data-nav="run">Back to run</button></div>'
          )
        : message.html;
      const hasUserQuestion = state.messages.slice(0, index).some(item => item.role === "user");
      const feedback = message.feedback && hasUserQuestion ? `<div class="feedback"><span>Did this response answer your question?</span><button aria-label="Thumbs up" title="Thumbs up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 10h10.4a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 18.8 9H14l.7-3.4A2.2 2.2 0 0 0 12.5 3L7 10Z"/></svg></button><button aria-label="Thumbs down" title="Thumbs down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H3v11h4Zm0-10h10.4a2 2 0 0 1 2 1.7l1.3 7a2 2 0 0 1-1.9 2.3H14l.7 3.4a2.2 2.2 0 0 1-2.2 2.6L7 14Z"/></svg></button></div>` : "";
      return `<article class="message advisor-message">${html}${message.evidence && message.evidence.length ? `<div class="references"><span>References</span>${message.evidence.map(item => `<a href="#" data-reference>${item}</a>`).join("")}</div>` : ""}${feedback}</article>`;
    }).join("") + (state.impactMode ? impactResultsPanel() : data.explorerResults[state.explorerQuery] ? inventoryResultsPanel() : "");
    const prompts = state.advisorJourney === "explorer" ? data.explorerPrompts : state.impactMode ? data.impactPrompts : data.suggestedPrompts;
    promptMenu.innerHTML = `<button id="prompt-toggle" class="prompt-toggle" type="button" aria-expanded="${state.promptsOpen}">Inspect further <span>${state.promptsOpen ? "⌃" : "⌄"}</span></button><div class="prompt-list" ${state.promptsOpen ? "" : "hidden"}>${prompts.map(prompt => `<button data-prompt="${prompt}">${prompt}</button>`).join("")}</div>`;
    requestAnimationFrame(() => {
      conversation.scrollTop = state.impactMode || state.explorerQuery ? 0 : conversation.scrollHeight;
    });
  }

  function updateScope() {
    const scope = document.querySelector("#scope");
    if (scope) scope.textContent = state.advisorJourney === "explorer" ? "CoolCorp / Explorer" : "CoolCorp / my-workspace";
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

  document.addEventListener("click", event => {
    if (state.browseOpen && !event.target.closest(".browse-control")) {
      state.browseOpen = false;
      renderMain();
    }

    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const directExplorerEntry = nav.dataset.nav === "explorer";
      const runEntry = nav.dataset.nav === "run";
      if (directExplorerEntry) {
        state.impactMode = false;
        state.explorerQuery = null;
        state.queryDraft = null;
        state.queryConditions = [];
        state.selectedNode = null;
        state.explorerMode = "explore";
        state.navCollapsed = false;
        state.messages = [];
        state.promptsOpen = true;
      }
      setView(nav.dataset.nav, {
        impactMode: false,
        advisorJourney: directExplorerEntry ? "explorer" : "run"
      });
      if (directExplorerEntry) openAdvisor(false);
      if (runEntry) { openAdvisor(); initializeAdvisor(); }
    }

    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "open-initial") { openAdvisor(); initializeAdvisor(); }
    if (action?.dataset.action === "open-advisor") { openAdvisor(); initializeAdvisor(); }
    if (action?.dataset.action === "new-session") {
      state.messages = [];
      state.explorerQuery = null;
      state.queryDraft = null;
      state.selectedNode = null;
      state.explorerMode = "explore";
      state.promptsOpen = true;
      initializeAdvisor();
      renderMain();
      renderAdvisorPanel();
    }
    if (action?.dataset.action === "show-impact") {
      state.navCollapsed = true;
      document.body.classList.add("nav-collapsed");
      state.messages = state.messages.length ? [state.messages[state.messages.length - 1]] : [];
      state.promptsOpen = false;
      state.selectedNode = "labels/aws";
      setView("explorer", { impactMode: true });
      openAdvisor();
    }
    if (action?.dataset.action === "select-module") {
      selectExplorerResult("labels/aws");
    }
    if (action?.dataset.action === "hide-node-details") {
      state.selectedNode = null;
      renderMain();
      renderConversation();
    }
    if (action?.dataset.action === "ask-advisor") { openAdvisor(); input.focus(); }
    if (action?.dataset.action === "toggle-browse") { state.browseOpen = !state.browseOpen; renderMain(); }
    if (action?.dataset.action === "toggle-explorer-panel") { state.explorerPanelHidden = !state.explorerPanelHidden; renderMain(); }
    if (action?.dataset.action === "saved-views") { state.modal = "saved-views"; state.browseOpen = false; renderMain(); }
    if (action?.dataset.action === "save-view") { state.modal = "save-view"; renderMain(); }
    if (action?.dataset.action === "confirm-save") { state.viewSaved = true; state.modal = null; renderMain(); }
    if (action?.dataset.action === "download-view") downloadView();
    if (action?.dataset.action === "close-modal") { state.modal = null; renderMain(); }
    if (action?.dataset.action === "clear-node") { state.selectedNode = null; renderMain(); }
    if (action?.dataset.action === "return-explore") {
      state.impactMode = false;
      state.explorerQuery = null;
      state.queryDraft = null;
      state.queryConditions = [];
      state.selectedNode = null;
      state.explorerMode = "explore";
      state.navCollapsed = false;
      state.advisorJourney = "explorer";
      state.messages = [{ role: "advisor", ...data.responses.explorerInitial }];
      state.promptsOpen = true;
      state.advisorOpen = true;
      advisor.classList.add("is-open");
      document.body.classList.add("advisor-open");
      updateNavigation();
      renderMain();
      renderAdvisorPanel();
      updateScope();
    }
    if (action?.dataset.action === "clear-query") { state.queryDraft = null; state.queryConditions = []; state.explorerQuery = null; renderMain(); }
    if (action?.dataset.action === "run-query") {
      state.explorerQuery = state.queryDraft || "Which workspaces use AWS provider version 5.x?";
      renderMain();
    }
    if (["explain-node", "show-node-impact", "compare-node", "refine-query"].includes(action?.dataset.action)) {
      const questions = {
        "explain-node": `Explain why ${state.selectedNode} is in these results`,
        "show-node-impact": `Show the blast radius for ${state.selectedNode}`,
        "compare-node": `Compare ${state.selectedNode} with the other returned workspaces`,
        "refine-query": `Help me refine the current query around ${state.selectedNode}`
      };
      state.explorerMode = "converse";
      state.promptsOpen = false;
      state.messages.push({ role: "user", text: questions[action.dataset.action] });
      state.messages.push({ role: "advisor", type: "answer", html: `<p>I'll use the selected workspace and active Explorer filters as context. The graph and result set remain unchanged while we investigate.</p>`, evidence: ["Current Explorer query", "Selected workspace"] });
      advisor.classList.remove("is-inspector");
      renderMain();
      renderAdvisorPanel();
    }

    const display = event.target.closest("[data-display]");
    if (display) { state.explorerDisplay = display.dataset.display; renderMain(); }

    const prompt = event.target.closest("[data-prompt]");
    if (prompt) ask(prompt.dataset.prompt);

    const template = event.target.closest("[data-query-template]");
    if (template) {
      state.queryDraft = template.dataset.queryTemplate;
      state.explorerQuery = state.queryDraft;
      renderMain();
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

    const node = event.target.closest("[data-node]");
    if (node) {
      if (state.view === "explorer" && (state.impactMode || state.explorerQuery)) {
        selectExplorerResult(node.dataset.node, state.impactMode);
      } else {
        openInspector(node.dataset.node);
      }
    }

    const impactNode = event.target.closest("[data-impact-node]");
    if (impactNode) {
      selectExplorerResult(impactNode.dataset.impactNode, true);
    }

    const resultNode = event.target.closest("[data-result-node]");
    if (resultNode) {
      selectExplorerResult(resultNode.dataset.resultNode);
    }
  });

  function conditionsForQuery(query) {
    if (query.includes("AWS provider")) return ["Provider is AWS", "Version starts with 5"];
    if (query.includes("EC2")) return ["Resource type is aws_instance", "Organization is CoolCorp"];
    if (query.includes("depend")) return ["Depends on workspace X", "Relationship is direct"];
    if (query.includes("module Z")) return ["Module name is module Z", "Workspace count is not empty"];
    return ["Name contains production", "Run status is active"];
  }

  document.addEventListener("submit", event => {
    if (event.target.id !== "natural-query-form") return;
    event.preventDefault();
    state.queryDraft = document.querySelector("#natural-query-input").value.trim();
    if (!state.queryDraft) return;
    state.explorerQuery = state.queryDraft;
    renderMain();
  });

  document.querySelector("#advisor-close").addEventListener("click", closeAdvisor);
  document.addEventListener("mousedown", event => {
    if (!event.target.closest(".node-details-resize")) return;
    const details = document.querySelector("#node-details");
    const startY = event.clientY;
    const startHeight = details.offsetHeight;
    const resize = moveEvent => {
      const maxHeight = Math.round(window.innerHeight * 0.65);
      state.nodeDetailsHeight = Math.max(110, Math.min(maxHeight, startHeight + moveEvent.clientY - startY));
      details.style.height = `${state.nodeDetailsHeight}px`;
    };
    const stop = () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stop);
    };
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stop);
    event.preventDefault();
  });
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

  document.body.classList.add("advisor-open");
  initializeAdvisor();
  renderMain();
  updateScope();
  updateNavigation();
})();
