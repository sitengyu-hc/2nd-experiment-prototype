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
    viewSaved: false
  };

  const main = document.querySelector("#main-content");
  const advisor = document.querySelector("#advisor");
  const conversation = document.querySelector("#conversation");
  const promptMenu = document.querySelector("#prompt-menu");
  const input = document.querySelector("#advisor-input");

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
    return `<div class="explorer-page ${state.explorerPanelHidden ? "panel-hidden" : ""}">
      <section class="explorer-controls">
        <button class="hud-hide" data-action="toggle-explorer-panel">HIDE</button>
        <div class="breadcrumbs">CoolCorp　/　Explorer　/　<strong>${state.impactMode ? "Impact analysis" : "Types"}</strong></div>
        <h1>${icon("explorer")} Explorer</h1><p>Explore your data to analyze your organization's Terraform usage.</p>
        <label class="field-label">VIEW MODE</label>
        <div class="view-toggle"><button data-display="graph" class="${state.explorerDisplay === "graph" ? "active" : ""}">Graph</button><button data-display="table" class="${state.explorerDisplay === "table" ? "active" : ""}">Table View</button></div>
        <label class="field-label">BROWSE</label><button class="select-control" data-action="toggle-browse">Types, Use cases and Saved views <span>⌄</span></button>
        ${state.browseOpen ? browseMenu() : ""}
        ${state.impactMode ? impactViewControls() : defaultExplorerControls()}
      </section>
      <button class="hud-show" data-action="toggle-explorer-panel">VIEW</button>
      ${state.impactMode ? (state.explorerDisplay === "graph" ? topologyCanvas() : impactTable()) : `<div class="empty-explorer"><div class="empty-icon">⌘</div><strong>Get started.</strong><span>Select a Type or Use case to explore your infrastructure.</span></div>`}
      ${state.modal === "saved-views" ? savedViewsModal() : ""}
      ${state.modal === "save-view" ? saveViewModal() : ""}
    </div>`;
  }

  function defaultExplorerControls() {
    return `<button class="explorer-query-link" data-action="ask-advisor">Enter your own query</button>
      <label class="field-label">TRY THE FOLLOWING QUERIES BASED ON YOUR USAGE.</label>
      <div class="query-list"><button class="query-row">Workspaces with failed checks <span>25</span></button><button class="query-row">Policy sets with failures <span>12</span></button><button class="query-row">Top module versions <span>4</span></button><button class="query-row">Providers by workspace count <span>8</span></button><button class="query-row">Resources by type <span>42</span></button><button class="query-row">Top Terraform versions <span>6</span></button></div>`;
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
    const selected = data.affectedWorkspaces.find(node => node.name === state.selectedNode);
    return `<div class="topology" aria-label="Affected workspace topology"><div class="graph-summary"><strong>Cross-workspace impact</strong><span>5 workspaces</span><span class="risk">2 production databases at risk</span></div><svg class="edges" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="arrow-force" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker><marker id="arrow-dependent" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker></defs>${lines}</svg>${data.affectedWorkspaces.map(node => `<button class="graph-node ${node.relation} ${state.selectedNode === node.name ? "is-focused" : ""}" style="left:${node.x}%;top:${node.y}%" data-node="${node.name}"><span class="node-symbol">${icon("database")}</span><strong>${node.name}</strong><small>${node.resources} resources</small>${node.relation === "force" ? '<i>!</i>' : ""}</button>`).join("")}${selected ? nodeDetail(selected) : ""}<div class="graph-tools"><button title="Zoom in">+</button><button title="Zoom out">−</button><button title="Reset zoom">FIT</button><button title="Refresh">↻</button></div><div class="layout-tools"><button class="active">Arc</button><button>Connectors</button><button class="active">Light</button><button>Dark</button></div><div class="legend"><span><i class="workspace-key"></i> Workspace</span><span><i class="selected-key"></i> Selected</span><span><i class="dependent-key"></i> Direct dependent</span><span><i class="force-key"></i> Replacement risk</span></div></div>`;
  }

  function nodeDetail(node) {
    return `<aside class="node-detail"><button data-action="clear-node" aria-label="Close">×</button><span>WORKSPACE</span><h3>${node.name}</h3><dl><dt>Resources</dt><dd>${node.resources}</dd><dt>Relationship</dt><dd>${node.relation === "force" ? "Replacement risk" : node.relation === "selected" ? "Selected run" : "Direct dependent"}</dd><dt>Module</dt><dd>rds v5.1.0</dd></dl><a href="#" data-reference>View resources →</a></aside>`;
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
    advisor.classList.add("is-open");
    document.body.classList.add("advisor-open");
    document.querySelector("#advisor-toggle span").textContent = "Close Advisor";
  }

  function closeAdvisor() {
    state.advisorOpen = false;
    advisor.classList.remove("is-open");
    document.body.classList.remove("advisor-open");
    document.querySelector("#advisor-toggle span").textContent = "Open Advisor";
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
    conversation.innerHTML = state.messages.map(message => {
      if (message.role === "user") return `<div class="message user-message"><span>♧</span><p>${escapeHtml(message.text)}</p></div>`;
      const html = state.view === "explorer" && state.impactMode
        ? message.html.replace(
            '<button class="inline-link" data-action="show-impact">View 5 affected workspaces in Explorer →</button>',
            '<div class="current-location"><span>✓ Viewing 5 affected workspaces in Explorer</span><button class="text-link" data-nav="run">← Back to failed run</button></div>'
          )
        : message.html;
      const feedback = message.feedback ? `<div class="feedback">Did this response answer your question?　<button>Yes</button><button>No</button></div>` : "";
      return `<article class="message advisor-message">${html}${message.evidence && message.evidence.length ? `<div class="references">${message.evidence.map(item => `<a href="#" data-reference>${item}</a>`).join("")}</div>` : ""}${feedback}</article>`;
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

    const display = event.target.closest("[data-display]");
    if (display) { state.explorerDisplay = display.dataset.display; renderMain(); }

    const prompt = event.target.closest("[data-prompt]");
    if (prompt) ask(prompt.dataset.prompt);

    if (event.target.closest("#prompt-toggle")) {
      state.promptsOpen = !state.promptsOpen;
      renderConversation();
    }

    if (event.target.closest("[data-reference]")) event.preventDefault();

    const node = event.target.closest("[data-node]");
    if (node) {
      state.selectedNode = node.dataset.node;
      renderMain();
    }
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
