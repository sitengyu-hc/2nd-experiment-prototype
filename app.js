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
        <div class="diagnostics-heading"><strong>⌄ Diagnostics</strong><button class="advisor-gradient" data-action="open-initial">✦ Explore in Advisor</button></div>
        <div class="error-card"><div class="error-title">Error: Instance cannot be destroyed</div><p>on ${data.run.sourceFile} line ${data.run.sourceLine}:</p><pre>resource "aws_db_instance" "this" {</pre><p>Resource <code>${data.run.address}</code> has <code>lifecycle.prevent_destroy</code> set, but the plan calls for this resource to be destroyed.</p></div>
      </div></section>
    </div>`;
  }

  function explorerView() {
    const compact = state.explorerMode !== "explore";
    return `<div class="explorer-page explorer-mode-${state.explorerMode} ${state.explorerPanelHidden ? "panel-hidden" : ""}">
      <section class="explorer-controls">
        <button class="hud-hide" data-action="toggle-explorer-panel">HIDE</button>
        <div class="breadcrumbs">CoolCorp　/　Explorer　/　<strong>${state.impactMode ? "Impact analysis" : "Types"}</strong></div>
        <h1>${icon("explorer")} Explorer</h1><p>Explore your data to analyze your organization's Terraform usage.</p>
        ${compact ? compactExplorerControls() : `<label class="field-label">VIEW MODE</label><div class="view-toggle"><button data-display="graph" class="${state.explorerDisplay === "graph" ? "active" : ""}">Graph</button><button data-display="table" class="${state.explorerDisplay === "table" ? "active" : ""}">Table View</button></div><label class="field-label">BROWSE</label><button class="select-control" data-action="toggle-browse">Types, Use cases and Saved views <span>⌄</span></button>${state.browseOpen ? browseMenu() : ""}${state.impactMode ? impactViewControls() : defaultExplorerControls()}`}
      </section>
      <button class="hud-show" data-action="toggle-explorer-panel">VIEW</button>
      ${state.impactMode ? (state.explorerDisplay === "graph" ? topologyCanvas() : impactTable()) : state.explorerQuery ? explorerQueryVisualization() : `<div class="empty-explorer"><div class="empty-icon">⌘</div><strong>Get started.</strong><span>Select a Type or Use case to explore your infrastructure.</span></div>`}
      ${state.modal === "saved-views" ? savedViewsModal() : ""}
      ${state.modal === "save-view" ? saveViewModal() : ""}
    </div>`;
  }

  function defaultExplorerControls() {
    return `<div class="query-builder"><div class="query-builder-heading"><span>QUERY BUILDER</span><button data-action="clear-query">Clear</button></div>
      <div class="condition-row"><strong>WHERE</strong><select><option>Run status</option><option>Provider</option><option>Terraform version</option></select><select><option>is</option><option>contains</option><option>is not</option></select><select><option>Failed checks</option><option>Applied</option><option>Planning</option></select></div>
      <button class="add-condition">＋ Add condition</button>
      <form id="natural-query-form" class="natural-query"><label for="natural-query-input">Or describe what you're looking for</label><div><input id="natural-query-input" placeholder="e.g. production workspaces using AWS 5.x" value="${state.queryDraft ? escapeHtml(state.queryDraft) : ""}"><button>Interpret</button></div></form>
      ${state.queryConditions.length ? interpretedConditions() : ""}
      <button class="run-query" data-action="run-query">Run query</button></div>
      <label class="field-label">TRY THE FOLLOWING QUERIES BASED ON YOUR USAGE.</label>
      <div class="query-list"><button class="query-row" data-query-template="Which workspaces use AWS provider version 5.x?">AWS 5.x workspaces <span>18</span></button><button class="query-row" data-query-template="How many EC2 instances exist across my organization?">EC2 instances by workspace <span>47</span></button><button class="query-row" data-query-template="What resources depend on workspace X?">Workspace dependencies <span>7</span></button><button class="query-row" data-query-template="Show resources using module Z.">Resources using module Z <span>32</span></button></div>
      ${state.explorerQuery ? directReturnedNodes() : ""}`;
  }

  function interpretedConditions() {
    return `<div class="interpreted-query"><span>✦ SUGGESTED BY ADVISOR</span>${state.queryConditions.map((condition, index) => `<div><strong>${index ? "AND" : "WHERE"}</strong><code>${condition}</code></div>`).join("")}<small>Review these conditions before running the query.</small></div>`;
  }

  function directReturnedNodes() {
    const names = ["my-workspace", "prod-payments", "prod-catalog", "staging-web", "analytics-worker"];
    return `<div class="returned-heading"><span>RETURNED NODES</span><strong>${names.length}</strong></div><div class="returned-nodes">${names.map(name => `<button data-node="${name}"><i class="node-dot"></i><span>${name}</span><small>Workspace</small></button>`).join("")}</div>`;
  }

  function compactExplorerControls() {
    const title = state.impactMode ? "RDS module cross-workspace impact" : state.explorerQuery || "Current Explorer query";
    const count = state.impactMode ? "5 workspaces" : "Query results";
    return `<div class="compact-query"><span>ACTIVE QUERY</span><strong>${escapeHtml(title)}</strong><small>${count}</small>${state.queryConditions.length ? `<div>${state.queryConditions.map(item => `<code>${item}</code>`).join("")}</div>` : ""}<button data-action="return-explore">← Back to query and results</button></div>`;
  }

  function explorerQueryVisualization() {
    const queryViews = {
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
    return `<div class="selected-view"><button data-nav="run" aria-label="Clear view">×</button><span>${icon("explorer")}<strong>RDS module cross-workspace impact</strong><small>5 workspaces</small></span><button data-display="table">TABLE VIEW</button></div>
      <div class="impact-actions"><button data-action="save-view">▣ ${state.viewSaved ? "SAVED" : "SAVE"}</button><button data-action="download-view">⇩ DOWNLOAD</button></div>
      <div class="returned-heading"><span>RETURNED NODES</span><strong>5</strong></div>
      <label class="node-search">⌕ <input placeholder="Search nodes"></label>
      <div class="returned-nodes">${data.affectedWorkspaces.map(node => `<button data-node="${node.name}"><i class="node-dot ${node.relation}"></i><span>${node.name}</span><small>${node.resources}</small></button>`).join("")}</div>`;
  }

  function browseMenu() {
    return `<div class="browse-menu"><div><span>TYPES</span><button>Workspaces</button><button>Policy Sets</button><button>Modules</button><button>Providers</button><button>Resources</button><button>Terraform Versions</button><button data-action="saved-views">Saved views <strong>${state.viewSaved ? 21 : 20}</strong></button></div><div><span>PRE-DEFINED VIEWS</span><button>View All Workspaces</button><button>Organized by Project</button><button>Organized by Status</button><button>Workspaces with failed checks</button><button>Drifted Workspaces</button><button>Latest updated workspaces</button></div></div>`;
  }

  function topologyCanvas() {
    const center = data.affectedWorkspaces[0];
    const lines = data.affectedWorkspaces.slice(1).map(node => {
      const x1 = center.x * 10, y1 = center.y * 6.5, x2 = node.x * 10, y2 = node.y * 6.5;
      return `<path class="${node.relation}" d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" marker-end="url(#arrow-${node.relation})"/>`;
    }).join("");
    return `<div class="topology" aria-label="Affected workspace topology"><div class="graph-summary"><strong>Cross-workspace impact</strong><span>5 workspaces</span><span class="risk">2 production databases at risk</span></div><svg class="edges" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow-force" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker><marker id="arrow-dependent" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker></defs>${lines}</svg>${data.affectedWorkspaces.map(node => `<button class="graph-node ${node.relation} ${state.selectedNode === node.name ? "is-focused" : ""}" style="left:${node.x}%;top:${node.y}%" data-node="${node.name}"><span class="node-symbol">${icon("database")}</span><strong>${node.name}</strong><small>${node.resources} resources</small>${node.relation === "force" ? '<i>!</i>' : ""}</button>`).join("")}<div class="graph-tools"><button title="Zoom in">+</button><button title="Zoom out">−</button><button title="Reset zoom">FIT</button><button title="Refresh">↻</button></div><div class="layout-tools"><button class="active">Arc</button><button>Connectors</button><button class="active">Light</button><button>Dark</button></div><div class="legend"><span><i class="workspace-key"></i> Workspace</span><span><i class="selected-key"></i> Selected</span><span><i class="dependent-key"></i> Direct dependent</span><span><i class="force-key"></i> Replacement risk</span></div></div>`;
  }

  function impactTable() {
    return `<div class="explorer-table"><div class="table-topline"><strong>Results: 5 Workspaces found.</strong><div><button data-action="save-view">▣ Save</button><button data-action="download-view">⇩ Download</button></div></div><button class="conditions">Show conditions <span>No conditions applied ⓘ</span></button><table><thead><tr><th>Name</th><th>Relationship</th><th>Resources</th><th>Module</th><th>Risk</th></tr></thead><tbody>${data.affectedWorkspaces.map(node => `<tr><td><strong>${node.name}</strong></td><td>${node.relation === "selected" ? "Selected run" : "Downstream"}</td><td>${node.resources}</td><td>rds v5.1.0</td><td>${node.relation === "force" ? '<span class="risk-text">Replacement</span>' : "Review"}</td></tr>`).join("")}</tbody></table><div class="table-pagination">1–5 of 5 <span>Items per page　10</span></div></div>`;
  }

  function savedViewsModal() {
    return `<div class="modal-backdrop"><section class="explorer-modal"><button class="modal-close" data-action="close-modal">×</button><h2>Saved Views</h2><p>${state.viewSaved ? 21 : 20} saved views available.</p><div class="saved-toolbar"><input placeholder="Search"><select><option>All types</option><option>Workspaces</option><option>Modules</option></select></div><table><thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Last Updated</th></tr></thead><tbody>${state.viewSaved ? '<tr><td><strong>RDS module cross-workspace impact</strong></td><td>Workspaces</td><td>AB</td><td>Just now</td></tr>' : ""}<tr><td>Production workspace health</td><td>Workspaces</td><td>Platform team</td><td>2 days ago</td></tr><tr><td>Outdated module versions</td><td>Modules</td><td>AB</td><td>5 days ago</td></tr></tbody></table></section></div>`;
  }

  function saveViewModal() {
    return `<div class="modal-backdrop"><section class="save-modal"><button class="modal-close" data-action="close-modal">×</button><h2>Save view</h2><p>Save the current filters and graph layout for future investigation.</p><label>Name<input id="view-name" value="RDS module cross-workspace impact"></label><div><button class="secondary" data-action="close-modal">Cancel</button><button class="primary" data-action="confirm-save">Save view</button></div></section></div>`;
  }

  function downloadView() {
    const rows = ["workspace,relationship,resources,module,risk", ...data.affectedWorkspaces.map(node => `${node.name},${node.relation},${node.resources},rds-v5.1.0,${node.relation === "force" ? "replacement" : "review"}`)];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    link.download = "rds-cross-workspace-impact.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function openAdvisor() {
    state.advisorOpen = true;
    if (state.view === "explorer") state.explorerMode = "converse";
    advisor.classList.add("is-open");
    document.body.classList.add("advisor-open");
    document.querySelector("#advisor-toggle span").textContent = "Close Advisor";
    renderMain();
    renderAdvisorPanel();
  }

  function closeAdvisor() {
    state.advisorOpen = false;
    if (state.view === "explorer") state.explorerMode = "explore";
    advisor.classList.remove("is-open");
    document.body.classList.remove("advisor-open");
    document.querySelector("#advisor-toggle span").textContent = "Open Advisor";
    renderMain();
    renderAdvisorPanel();
  }

  function openInspector(nodeName) {
    state.selectedNode = nodeName;
    state.explorerMode = "inspect";
    state.advisorOpen = true;
    advisor.classList.add("is-open", "is-inspector");
    document.body.classList.add("advisor-open");
    document.querySelector("#advisor-toggle span").textContent = "Close details";
    renderMain();
    renderAdvisorPanel();
  }

  function renderAdvisorPanel() {
    const inspector = state.view === "explorer" && state.explorerMode === "inspect";
    advisor.classList.toggle("is-inspector", inspector);
    advisorTitle.textContent = inspector ? "Workspace details" : "Advisor";
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
    const relation = node ? (node.relation === "force" ? "Replacement risk" : node.relation === "selected" ? "Selected result" : "Direct dependent") : "Query result";
    return `<div class="inspector-content"><span class="inspector-type">WORKSPACE</span><h2>${escapeHtml(state.selectedNode || "Workspace")}</h2><p>Selected from the current Explorer result set.</p><dl><dt>Resources</dt><dd>${resources}</dd><dt>Relationship</dt><dd>${relation}</dd><dt>Active query</dt><dd>${state.impactMode ? "RDS impact" : "Current filters"}</dd></dl><div class="inspector-actions"><button data-action="explain-node">✦ Explain this result</button><button data-action="show-node-impact">Show cross-workspace impact</button><button data-action="compare-node">Compare workspaces</button><button data-action="refine-query">Refine current query</button></div><button class="back-results" data-action="return-explore">← Back to results</button></div>`;
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
    state.messages.push({ role: "user", text: question });
    state.messages.push({ role: "advisor", ...response });
    if (state.view === "explorer" && state.advisorJourney === "explorer") {
      state.explorerQuery = question;
      renderMain();
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
    conversation.innerHTML = state.messages.map(message => {
      if (message.role === "user") return `<div class="message user-message"><span>♧</span><p>${escapeHtml(message.text)}</p></div>`;
      const html = state.view === "explorer" && state.impactMode
        ? message.html.replace(
            '<button class="inline-link" data-action="show-impact">View 5 affected workspaces in Explorer →</button>',
            '<div class="current-location"><span>✓ Viewing 5 affected workspaces in Explorer</span><button class="text-link" data-nav="run">← Back to failed run</button></div>'
          )
        : message.html;
      const feedback = message.feedback ? `<div class="feedback"><span>Did this response answer your question?</span><button aria-label="Thumbs up" title="Thumbs up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 10h10.4a2 2 0 0 0 2-1.7l1.3-7A2 2 0 0 0 18.8 9H14l.7-3.4A2.2 2.2 0 0 0 12.5 3L7 10Z"/></svg></button><button aria-label="Thumbs down" title="Thumbs down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H3v11h4Zm0-10h10.4a2 2 0 0 1 2 1.7l1.3 7a2 2 0 0 1-1.9 2.3H14l.7 3.4a2.2 2.2 0 0 1-2.2 2.6L7 14Z"/></svg></button></div>` : "";
      return `<article class="message advisor-message">${html}${message.evidence && message.evidence.length ? `<div class="references"><span>References</span>${message.evidence.map(item => `<a href="#" data-reference>${item}</a>`).join("")}</div>` : ""}${feedback}</article>`;
    }).join("");
    const prompts = state.advisorJourney === "explorer" ? data.explorerPrompts : state.impactMode ? data.impactPrompts : data.suggestedPrompts;
    promptMenu.innerHTML = `<button id="prompt-toggle" class="prompt-toggle" type="button" aria-expanded="${state.promptsOpen}">Suggested prompts <span>${state.promptsOpen ? "⌃" : "⌄"}</span></button><div class="prompt-list" ${state.promptsOpen ? "" : "hidden"}>${prompts.map(prompt => `<button data-prompt="${prompt}">${prompt}</button>`).join("")}</div>`;
    requestAnimationFrame(() => { conversation.scrollTop = conversation.scrollHeight; });
  }

  function updateScope() {
    document.querySelector("#scope").textContent = state.advisorJourney === "explorer" ? "CoolCorp / Explorer" : "CoolCorp / my-workspace";
  }

  function updateNavigation() {
    const activeItem = state.view === "explorer" ? "explorer" : "workspaces";
    document.querySelectorAll("[data-nav-item]").forEach(item => {
      item.classList.toggle("active", item.dataset.navItem === activeItem);
    });
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      const directExplorerEntry = nav.dataset.nav === "explorer";
      setView(nav.dataset.nav, {
        impactMode: false,
        advisorJourney: directExplorerEntry ? "explorer" : "run"
      });
      if (directExplorerEntry) closeAdvisor();
    }

    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "open-initial") { openAdvisor(); initializeAdvisor(); }
    if (action?.dataset.action === "show-impact") { setView("explorer", { impactMode: true }); openAdvisor(); }
    if (action?.dataset.action === "ask-advisor") { openAdvisor(); input.focus(); }
    if (action?.dataset.action === "toggle-browse") { state.browseOpen = !state.browseOpen; renderMain(); }
    if (action?.dataset.action === "toggle-explorer-panel") { state.explorerPanelHidden = !state.explorerPanelHidden; renderMain(); }
    if (action?.dataset.action === "saved-views") { state.modal = "saved-views"; state.browseOpen = false; renderMain(); }
    if (action?.dataset.action === "save-view") { state.modal = "save-view"; renderMain(); }
    if (action?.dataset.action === "confirm-save") { state.viewSaved = true; state.modal = null; renderMain(); }
    if (action?.dataset.action === "download-view") downloadView();
    if (action?.dataset.action === "close-modal") { state.modal = null; renderMain(); }
    if (action?.dataset.action === "clear-node") { state.selectedNode = null; renderMain(); }
    if (action?.dataset.action === "return-explore") { closeAdvisor(); state.selectedNode = null; renderMain(); }
    if (action?.dataset.action === "clear-query") { state.queryDraft = null; state.queryConditions = []; state.explorerQuery = null; renderMain(); }
    if (action?.dataset.action === "run-query") {
      state.explorerQuery = state.queryDraft || "Which workspaces use AWS provider version 5.x?";
      renderMain();
    }
    if (["explain-node", "show-node-impact", "compare-node", "refine-query"].includes(action?.dataset.action)) {
      const questions = {
        "explain-node": `Explain why ${state.selectedNode} is in these results`,
        "show-node-impact": `What is the cross workspace impact of ${state.selectedNode}?`,
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
      state.queryConditions = conditionsForQuery(state.queryDraft);
      renderMain();
    }

    if (event.target.closest("#prompt-toggle")) {
      state.promptsOpen = !state.promptsOpen;
      renderConversation();
    }

    if (event.target.closest("[data-reference]")) event.preventDefault();

    const node = event.target.closest("[data-node]");
    if (node) {
      openInspector(node.dataset.node);
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
    state.queryConditions = conditionsForQuery(state.queryDraft);
    renderMain();
  });

  document.querySelector("#advisor-toggle").addEventListener("click", () => state.advisorOpen ? closeAdvisor() : openAdvisor());
  document.querySelector("#advisor-close").addEventListener("click", closeAdvisor);
  document.querySelector("#nav-collapse").addEventListener("click", () => {
    state.navCollapsed = !state.navCollapsed;
    document.body.classList.toggle("nav-collapsed", state.navCollapsed);
    const toggle = document.querySelector("#nav-collapse");
    toggle.setAttribute("aria-expanded", String(!state.navCollapsed));
    toggle.setAttribute("aria-label", state.navCollapsed ? "Expand navigation" : "Collapse navigation");
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
