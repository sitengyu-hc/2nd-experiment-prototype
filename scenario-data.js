window.PROTOTYPE_DATA = {
  workspace: {
    name: "my-workspace",
    id: "ws-1HkX32P8UKEJ3Lmo",
    organization: "CoolCorp",
    resources: 211,
    terraformVersion: "v1.8.5"
  },
  run: {
    id: "run-guDS9dmc3dn",
    title: "Fix: db_name is the force-replacement trigger, not identifier; update docs",
    status: "Errored",
    actor: "devSecOpsGuru",
    source: "GitHub",
    duration: "Less than a minute",
    address: "module.database.aws_db_instance.this",
    sourceFile: "modules/rds/v5.1.0/main.tf",
    sourceLine: 31,
    replacePath: ["db_name"],
    previousModuleVersion: "v4.0.0",
    currentModuleVersion: "v5.1.0"
  },
  affectedWorkspaces: [
    { name: "my-workspace", resources: 211, relation: "selected", environment: "production", runStatus: "errored", x: 48, y: 50 },
    { name: "payments-prod-eu", resources: 95, relation: "consumer", environment: "production", runStatus: "applied", x: 72, y: 23 },
    { name: "payments-staging", resources: 65, relation: "consumer", environment: "staging", runStatus: "planned", x: 79, y: 51 },
    { name: "analytics-prod", resources: 34, relation: "consumer", environment: "analytics", runStatus: "applied", x: 69, y: 77 },
    { name: "platform-rds", resources: 203, relation: "consumer", environment: "platform", runStatus: "applied", x: 27, y: 74 },
    { name: "payments-prod-us", resources: 148, relation: "consumer", environment: "production", runStatus: "planned", x: 23, y: 26 }
  ],
  suggestedPrompts: [
    "What options do I have to fix this?",
    "What other workspaces are using RDS module v5.1.0?",
    "Who introduced the lifecycle guard?"
  ],
  impactPrompts: [
    "What modules are no longer being used?",
    "When was the last time this module was used?",
    "Save this view"
  ],
  explorerPrompts: [
    "View all modules",
    "View all providers",
    "View all resources",
    "Drifted workspaces"
  ],
  responses: {
    initial: {
      type: "answer",
      feedback: true,
      html: `<p>The plan failed because <code>module.database.aws_db_instance.this</code> is marked for replacement, but its configuration contains <code class="warning-code">lifecycle { prevent_destroy = true }</code>.</p><p>The module upgrade from <strong>v4.0.0</strong> to <strong>v5.1.0</strong> changed <code>db_name</code>. Because that attribute requires replacement, Terraform attempted to destroy and recreate the database. The lifecycle guard stopped the operation before any infrastructure changed.</p><p><strong>Two production workspaces also consume this module.</strong></p><div class="callout warning"><strong>Pause before applying a fix.</strong> This is a production database. Confirm whether the replacement was intended and review module consumers first.</div>`,
      evidence: ["Plan diagnostics", "replace_paths: db_name", "Configuration version diff"]
    },
    "What options do I have to fix this?": {
      type: "answer",
      feedback: true,
      html: `<p>There are three paths, depending on whether the database rename was intended:</p><ol><li><strong>Safest: revert the module upgrade.</strong> Pin the caller to <code>v4.0.0</code>, then run a new plan. This preserves the current database.</li><li><strong>Upgrade without renaming.</strong> Update v5.1.0 so it keeps the existing <code>db_name</code>. Validate the module change with a new plan before rolling it out.</li><li><strong>Perform a controlled replacement.</strong> Only if a new database is intended: create a migration and backup plan, review dependents, then explicitly manage the lifecycle guard. Do not simply remove <code>prevent_destroy</code>.</li></ol><div class="code-card"><div class="code-title">main.tf</div><pre><span class="line">18</span> module "database" {\n<span class="line">19</span> <span class="minus">- source = "./modules/rds/v5.1.0"</span>\n<span class="line">20</span> <span class="plus">+ source = "./modules/rds/v4.0.0"</span>\n<span class="line">21</span> }</pre></div>`,
      evidence: ["Configuration version diff", "Module v4.0.0", "Module v5.1.0"]
    },
    "What other workspaces are using RDS module v5.1.0?": {
      type: "answer",
      feedback: true,
      html: `<p><strong>Five other workspaces are using the RDS module at v5.1.0.</strong></p><p>Two are production workspaces, so the same <code>db_name</code> replacement risk may appear when they run next. The remaining consumers are in staging and analytics environments.</p><p>I can open Explorer with the consuming workspaces so you can review their owners, resources, current run status, and relationships.</p><button class="inline-link" data-action="show-impact">View module consumers in Explorer →</button>`,
      evidence: ["Explorer module inventory", "Module consumers"]
    },
    "How do I avoid destroying the database?": {
      type: "answer",
      feedback: true,
      html: `<p>Keep the existing <code>db_name</code> and preserve <code>prevent_destroy</code>. The lowest-risk immediate action is to revert the module source to v4.0.0, then run a new plan.</p><p>Do not remove the lifecycle guard just to make this plan pass. If the rename is required, treat it as a database migration with backups, validation, and an approved maintenance window.</p>`,
      evidence: ["Terraform lifecycle documentation", "Configuration version diff"]
    },
    "Who introduced the lifecycle guard?": {
      type: "answer",
      html: `<p>The guard first appears in the shared RDS module at <strong>v5.1.0</strong>. This run was triggered by <strong>devSecOpsGuru</strong> after the caller's module source changed from v4.0.0 to v5.1.0.</p><p>The available run data identifies the configuration change, but not the author of the module's internal commit. Open the module version in the registry or its VCS source to confirm ownership.</p>`,
      evidence: ["Run configuration version", "Private registry module metadata"]
    },
    "Save this view": {
      type: "answer",
      html: `<p>Save the current Explorer view and its RDS module version filter so your team can return to this investigation.</p><button class="inline-action" data-action="save-view">Save view</button>`,
      evidence: []
    },
    "What modules are no longer being used?": {
      type: "answer",
      html: `<p>This view is scoped to workspaces using RDS module v5.1.0, so it cannot identify unused modules. Start a new Explorer query across the module inventory to find modules with no current workspace consumers.</p>`,
      evidence: ["Current Explorer query"]
    },
    "When was the last time this module was used?": {
      type: "answer",
      html: `<p>The most recent configuration using RDS module v5.1.0 ran today in <strong>my-workspace</strong>. Select a consumer to review its current run and last-updated details.</p>`,
      evidence: ["Workspace configuration versions", "Current runs"]
    },
    explorerInitial: {
      type: "answer",
      html: `<p>Each operation opens a new session with your current context loaded.</p>`,
      evidence: []
    },
    "View all resources": {
      type: "answer",
      html: `<p>Explorer found <strong>47 managed resources</strong> across the current organization scope.</p>`,
      evidence: ["Explorer resource inventory"]
    },
    "View all providers": {
      type: "answer",
      html: `<p>Explorer found the providers currently used across CoolCorp. You can narrow the results by provider name or version.</p>`,
      evidence: ["Workspace provider versions"]
    },
    "View all modules": {
      type: "answer",
      html: `<p>Explorer found the modules currently used across CoolCorp. Select a module to see its workspace consumers.</p>`,
      evidence: ["Explorer module inventory"]
    },
    "Drifted workspaces": {
      type: "answer",
      html: `<p>You are now viewing <strong>8 workspaces</strong> that are drifted.</p>`,
      evidence: ["Workspace health assessments"]
    },
    "What resources depend on workspace X?": {
      type: "answer",
      html: `<p>Workspace X has <strong>7 direct dependents</strong> across 4 workspaces. They consume its remote-state outputs for network IDs, security groups, and database endpoints.</p><p>Two of those dependents are production workspaces and should be reviewed before changing outputs.</p>`,
      evidence: ["Explorer dependency graph"]
    },
    "What is the cross workspace impact of workspace Y?": {
      type: "answer",
      html: `<p>A change to workspace Y could affect <strong>11 downstream resources in 5 workspaces</strong>.</p><p>The highest-risk path reaches two production services through shared networking outputs. Review the proposed output changes and dependent run triggers before applying.</p>`,
      evidence: ["Explorer dependency graph", "Workspace run triggers"]
    },
    "Show resources using module Z.": {
      type: "answer",
      html: `<p>Module Z is currently instantiated in <strong>32 workspaces</strong>.</p><ul><li><strong>24 workspaces</strong> are using v3.14.2 (Latest)</li><li><strong>8 workspaces</strong> are using v2.9.0 (Outdated)</li></ul><p>I can help you generate a bulk upgrade plan for the 8 outdated workspaces if you'd like to bring them up to date.</p>`,
      evidence: ["Explorer module inventory", "Workspace configurations"]
    }
  }
};
