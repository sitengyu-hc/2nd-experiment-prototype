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
    navCollapsed: false
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
    return `<div class="explorer-page">
      <div class="explorer-controls">
        <div class="breadcrumbs">CoolCorp　/　Explorer　/　<strong>${state.impactMode ? "Impact analysis" : "Types"}</strong></div>
        <h1>${icon("explorer")} Explorer</h1><p>Explore your data to analyze your organization's Terraform usage.</p>
        <label class="field-label">BROWSE</label><button class="select-control">Types, Use cases and Saved views <span>⌄</span></button>
        ${state.impactMode ? '<div class="filter-chip">×　Affected by RDS module v5.1.0　<strong>5</strong></div>' : '<label class="explorer-query">Ask Advisor to query views... <button>➤</button></label>'}
        <label class="field-label">TRY THE FOLLOWING QUERIES BASED ON YOUR USAGE</label>
        <button class="query-row">▤　Drifted Workspaces <span>25</span></button><button class="query-row">▤　Workspaces with failed checks <span>25</span></button><button class="query-row">▤　Policy sets with failures <span>12</span></button><button class="query-row">▤　Top module versions <span>4</span></button>
      </div>
      ${state.impactMode ? topologyCanvas() : `<div class="empty-explorer"><div class="empty-icon">⌘</div><strong>Select a Type or Use case to<br>explore your infrastructure.</strong></div>`}
    </div>`;
  }

  function topologyCanvas() {
    const center = data.affectedWorkspaces[0];
    const lines = data.affectedWorkspaces.slice(1).map(node => `<line x1="${center.x}%" y1="${center.y}%" x2="${node.x}%" y2="${node.y}%"/>`).join("");
    return `<div class="topology" aria-label="Affected workspace topology"><div class="graph-summary"><strong>Potential impact</strong><span>5 workspaces</span><span class="risk">2 production databases at risk</span></div><svg class="edges" aria-hidden="true">${lines}</svg>${data.affectedWorkspaces.map(node => `<button class="graph-node ${node.relation}" style="left:${node.x}%;top:${node.y}%" data-node="${node.name}">${icon("database")}<strong>${node.name}</strong><span>${node.resources} resources</span>${node.relation === "force" ? '<i>!</i>' : ""}</button>`).join("")}<div class="legend"><span><i class="selected-key"></i> Selected run</span><span><i class="dependent-key"></i> Direct dependent</span><span><i class="force-key"></i> Replacement risk</span></div></div>`;
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
    const prompts = state.advisorJourney === "explorer" ? data.explorerPrompts : data.suggestedPrompts;
    promptMenu.innerHTML = `<button id="prompt-toggle" class="prompt-toggle">Suggested prompts <span>⌃</span></button><div class="prompt-list">${prompts.map(prompt => `<button data-prompt="${prompt}">${prompt}</button>`).join("")}</div>`;
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
    }

    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "open-initial") { openAdvisor(); initializeAdvisor(); }
    if (action?.dataset.action === "show-impact") { setView("explorer", { impactMode: true }); openAdvisor(); }

    const prompt = event.target.closest("[data-prompt]");
    if (prompt) ask(prompt.dataset.prompt);

    if (event.target.closest("[data-reference]")) event.preventDefault();

    const node = event.target.closest("[data-node]");
    if (node) {
      document.querySelectorAll(".graph-node").forEach(item => item.classList.remove("is-focused"));
      node.classList.add("is-focused");
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
    toggle.querySelector("span").textContent = state.navCollapsed ? "Expand" : "Collapse";
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
