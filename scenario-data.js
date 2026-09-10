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
    { name: "my-workspace", resources: 211, relation: "selected", x: 69, y: 52 },
    { name: "prod-payments", resources: 95, relation: "force", x: 86, y: 30 },
    { name: "prod-catalog", resources: 65, relation: "force", x: 86, y: 70 },
    { name: "staging-web", resources: 34, relation: "dependent", x: 60, y: 29 },
    { name: "analytics-worker", resources: 203, relation: "dependent", x: 60, y: 72 }
  ],
  suggestedPrompts: [
    "What options do I have to fix this?",
    "What is the potential blast radius?",
    "How do I avoid destroying the database?",
    "Who introduced the lifecycle guard?"
  ],
  explorerPrompts: [
    "How many EC2 instances exist across my organization?",
    "Which workspaces use AWS provider version 5.x?",
    "What resources depend on workspace X?",
    "What is the blast radius of workspace Y?",
    "Show resources using module Z."
  ],
  responses: {
    initial: {
      type: "answer",
      feedback: true,
      html: `<p>The plan failed because <code>module.database.aws_db_instance.this</code> is marked for replacement, but its configuration contains <code class="warning-code">lifecycle { prevent_destroy = true }</code>.</p><p>The module upgrade from <strong>v4.0.0</strong> to <strong>v5.1.0</strong> changed <code>db_name</code>. Because that attribute requires replacement, Terraform attempted to destroy and recreate the database. The lifecycle guard stopped the operation before any infrastructure changed.</p><div class="callout warning"><strong>Pause before applying a fix.</strong> This is a production database. Confirm whether the replacement was intended and review affected workspaces first.</div>`,
      evidence: ["Plan diagnostics", "replace_paths: db_name", "Configuration version diff"]
    },
    "What options do I have to fix this?": {
      type: "answer",
      feedback: true,
      html: `<p>There are three paths, depending on whether the database rename was intended:</p><ol><li><strong>Safest: revert the module upgrade.</strong> Pin the caller to <code>v4.0.0</code>, then run a new plan. This preserves the current database.</li><li><strong>Upgrade without renaming.</strong> Update v5.1.0 so it keeps the existing <code>db_name</code>. Validate the module change with a new plan before rolling it out.</li><li><strong>Perform a controlled replacement.</strong> Only if a new database is intended: create a migration and backup plan, review dependents, then explicitly manage the lifecycle guard. Do not simply remove <code>prevent_destroy</code>.</li></ol><div class="code-card"><div class="code-title">main.tf</div><pre><span class="line">18</span> module "database" {\n<span class="line">19</span> <span class="minus">- source = "./modules/rds/v5.1.0"</span>\n<span class="line">20</span> <span class="plus">+ source = "./modules/rds/v4.0.0"</span>\n<span class="line">21</span> }</pre></div>`,
      evidence: ["Configuration version diff", "Module v4.0.0", "Module v5.1.0"]
    },
    "What is the potential blast radius?": {
      type: "answer",
      feedback: true,
      html: `<p><strong>Five workspaces consume the changed database module version or have a direct dependency on one of those workspaces.</strong></p><p>No additional runs have been triggered. These configurations are passive until their next plan, unless a workspace has an explicit run trigger.</p><p>The two production consumers are the highest risk because their next plan could propose the same database replacement.</p><button class="inline-link" data-action="show-impact">View 5 affected workspaces in Explorer →</button>`,
      evidence: ["Explorer dependency graph", "Module consumers", "Run triggers"]
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
    explorerInitial: {
      type: "answer",
      html: `<p>I can help you analyze your infrastructure data. Try selecting a predefined query from the Explorer canvas, or ask me a question directly.</p>`,
      evidence: []
    },
    "How many EC2 instances exist across my organization?": {
      type: "answer",
      html: `<p>There are <strong>47 EC2 instances</strong> managed across 14 workspaces in CoolCorp.</p><ul><li><strong>31</strong> are running in production workspaces</li><li><strong>12</strong> are in staging or development</li><li><strong>4</strong> are currently stopped</li></ul>`,
      evidence: ["Explorer resource inventory"]
    },
    "Which workspaces use AWS provider version 5.x?": {
      type: "answer",
      html: `<p><strong>18 workspaces</strong> currently use an AWS provider version in the 5.x series. Twelve use the organization's preferred version, while six are on older 5.x releases.</p><p>You can narrow this view by project, environment, or exact provider version.</p>`,
      evidence: ["Workspace provider versions"]
    },
    "What resources depend on workspace X?": {
      type: "answer",
      html: `<p>Workspace X has <strong>7 direct dependents</strong> across 4 workspaces. They consume its remote-state outputs for network IDs, security groups, and database endpoints.</p><p>Two of those dependents are production workspaces and should be reviewed before changing outputs.</p>`,
      evidence: ["Explorer dependency graph"]
    },
    "What is the blast radius of workspace Y?": {
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
