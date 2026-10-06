(function () {
// Scripted, curated data. Models the RDS v4.0.0 -> v5.1.0 force-replacement fixture.
// Albus tiers (see ../albus-tiers-demo-plan.md):
//   tier 1 = translate a question into an Explorer query (table + chips, one-line receipt)
//   tier 2 = join sources (Albus-derived view joining Explorer with registry / run history)
//   tier 3 = reason over the results (chat answer referencing table rows)
const RDS_CONSUMERS = "Workspaces using terraform-aws-rds v5.1.0";
const RDS_VERSIONS = "terraform-aws-rds — all published versions";

// Insight text links rows in the table; clicking highlights the row.
const row = (key, label = key) => `<button class="row-link" type="button" data-row-ref="${key}">${label}</button>`;

const versionSources = [
  { label: "Private registry", detail: "CoolCorp/terraform-aws-rds · 6 published versions", freshness: "live" },
  { label: "Explorer usage", detail: "module versions in workspace state", freshness: "last indexed 6h ago" },
  { label: "Run history", detail: "configuration versions per workspace, for “Last used”", freshness: "all retained runs" }
];
const versionGaps = [
  "Callers that source the module from Git instead of the registry (no registry version to match).",
  "Workspaces outside the CoolCorp organization."
];
const versionNextPrompts = [
  "Should we deprecate v5.1.0?",
  "Which RDS versions are deprecated but still in use?",
  "Show blast radius for v5.1.0"
];
// One-line basis shown at the top of tier 2 answers: which sources Albus combined.
const registryBasis = "I compared your private registry with Explorer usage.";

window.PROTOTYPE_DATA = {
  rdsConsumersQuery: RDS_CONSUMERS,
  rdsVersionsQuery: RDS_VERSIONS,
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
  // Albus panel prompts once the run investigation has moved into Explorer (tier 2 / tier 3).
  impactPrompts: [
    "Which RDS module versions are no longer in use?",
    "Should we deprecate v5.1.0?",
    "Show blast radius for v5.1.0",
    "Save as view"
  ],
  // Albus panel prompts for direct Explorer entry.
  explorerPrompts: [
    "View all modules",
    "Drifted workspaces",
    "Which RDS module versions are no longer in use?"
  ],
  // Starting points shown under the "Ask Albus or filter…" bar. `albus: true` = answered by Albus joining other sources.
  explorerStarters: [
    { text: "View all modules" },
    { text: "View all providers" }
  ],
  // What Albus says about each query's results (shown above RETURNED NODES in the Albus panel).
  // Row links select the row in the list and the table/graph.
  resultSummaries: {
    "Drifted workspaces": `<p>This table lists workspaces where the infrastructure currently differs from the Terraform configuration or state recorded by HCP Terraform. The timestamp shows when drift was detected, not necessarily when the underlying change was made.</p><p>I recommend starting with ${row("payments-prod-eu")} because it is a production workspace with the most recent drift detection.</p><p>The results don't yet show whether the drift came from a manual cloud-console change, a state mismatch, or a configuration change. Open a workspace to review the affected resources.</p>`,
    "View all modules": `<p>These are the modules used by at least one workspace in CoolCorp. ${row("terraform-aws-rds")} is the most widely used, at v5.1.0 across three payments workspaces.</p><p>Open a module to see which workspaces use it and at which version.</p>`,
    "View all providers": `<p>These are the providers used across CoolCorp workspaces. ${row("hashicorp/aws")} is used by the most workspaces; three provider versions need review.</p><p>Open a provider to see its version and the workspaces that use it.</p>`,
    "How many EC2 instances exist across my organization?": `<p>CoolCorp has 47 EC2 instances across 14 workspaces. Most production instances run in us-east-1.</p>`,
    "Which workspaces use AWS provider version 5.x?": `<p>18 workspaces use AWS provider 5.x, from v5.61.0 to v5.82.2. ${row("infra-baseline-qa")} is on the oldest 5.x version.</p>`,
    "What resources depend on workspace X?": `<p>7 resources consume remote-state outputs from workspace X, mostly network IDs and security groups. Review them before changing those outputs.</p>`,
    "Production workspaces": `<p>These are the workspaces tagged production across three projects. ${row("payments-prod-us")} has the most resources and a planned run waiting.</p>`,
    [RDS_CONSUMERS]: `<p>Five workspaces use terraform-aws-rds at v5.1.0; two are production (${row("payments-prod-eu")} and ${row("payments-prod-us")}), so the same <code>db_name</code> replacement risk may appear when they run next.</p>`
  },
  // Explorer query model, mirroring HCP Terraform Explorer (atlas app/lib/workspace-explorer.js):
  // pick an object type, then WHERE <column> <operator> <value> AND ... Operators depend on the column type.
  explorerSchema: {
    types: [
      { key: "workspaces", label: "Workspaces" },
      { key: "modules", label: "Modules" },
      { key: "providers", label: "Providers" },
      { key: "resources", label: "Resources" },
      { key: "tf_versions", label: "Terraform versions" }
    ],
    columns: {
      workspaces: [
        { key: "workspaceName", label: "Name", type: "string" },
        { key: "projectName", label: "Project name", type: "string" },
        { key: "currentRunStatus", label: "Run status", type: "string" },
        { key: "currentRunAppliedAt", label: "Current run applied", type: "date" },
        { key: "vcsRepoIdentifier", label: "VCS repo", type: "string" },
        { key: "moduleCount", label: "Module count", type: "number" },
        { key: "modules", label: "Modules", type: "string" },
        { key: "providerCount", label: "Provider count", type: "number" },
        { key: "providers", label: "Providers", type: "string" },
        { key: "workspaceTerraformVersion", label: "Terraform version", type: "string" },
        { key: "drifted", label: "Drifted", type: "boolean" },
        { key: "allChecksSucceeded", label: "Health checks succeeded", type: "boolean" },
        { key: "checksFailed", label: "Health checks failed", type: "number" },
        { key: "resourcesDrifted", label: "Resources drifted", type: "number" },
        { key: "resourceCount", label: "Resource count", type: "number" },
        { key: "tags", label: "Tags", type: "string" },
        { key: "workspaceUpdatedAt", label: "Updated", type: "date" }
      ],
      modules: [
        { key: "name", label: "Name", type: "string" },
        { key: "version", label: "Version", type: "string" },
        { key: "source", label: "Source", type: "string" },
        { key: "workspaceCount", label: "Workspace count", type: "number" },
        { key: "workspaces", label: "Workspaces", type: "string" }
      ],
      providers: [
        { key: "name", label: "Name", type: "string" },
        { key: "version", label: "Version", type: "string" },
        { key: "source", label: "Source", type: "string" },
        { key: "workspaceCount", label: "Workspace count", type: "number" },
        { key: "workspaces", label: "Workspaces", type: "string" }
      ],
      resources: [
        { key: "name", label: "Name", type: "string" },
        { key: "address", label: "Address", type: "string" },
        { key: "workspaceName", label: "Workspace", type: "string" },
        { key: "projectName", label: "Project", type: "string" },
        { key: "moduleName", label: "Module name", type: "string" },
        { key: "providerType", label: "Type", type: "string" },
        { key: "providerName", label: "Provider", type: "string" }
      ],
      tf_versions: [
        { key: "version", label: "Version", type: "string" },
        { key: "workspaceCount", label: "Workspace count", type: "number" },
        { key: "workspaces", label: "Workspaces", type: "string" }
      ]
    },
    operators: {
      string: [
        { key: "is", label: "is" },
        { key: "is-not", label: "is not" },
        { key: "contains", label: "contains" },
        { key: "does-not-contain", label: "does not contain" },
        { key: "is-empty", label: "is empty" },
        { key: "is-not-empty", label: "is not empty" }
      ],
      number: [
        { key: "is", label: "=", badge: "is" },
        { key: "is-not", label: "≠", badge: "is not" },
        { key: "gt", label: ">", badge: "is greater than" },
        { key: "lt", label: "<", badge: "is less than" },
        { key: "gteq", label: ">=", badge: "is greater than or equal to" },
        { key: "lteq", label: "<=", badge: "is less than or equal to" },
        { key: "is-empty", label: "is empty" },
        { key: "is-not-empty", label: "is not empty" }
      ],
      boolean: [
        { key: "is", label: "is" },
        { key: "is-empty", label: "is empty" },
        { key: "is-not-empty", label: "is not empty" }
      ],
      date: [
        { key: "is-before", label: "before" },
        { key: "is-after", label: "after" }
      ]
    }
  },
  // The Explorer query behind each scripted result: object type + WHERE conditions (editable in "Edit conditions").
  // `albus` = a scope Albus adds on top of Explorer (shown as a ✦ chip, not editable in the builder).
  queryDefs: {
    [RDS_CONSUMERS]: {
      type: "modules",
      conditions: [
        { column: "name", operator: "is", value: "terraform-aws-rds" },
        { column: "version", operator: "is", value: "5.1.0" }
      ]
    },
    [RDS_VERSIONS]: {
      type: "modules",
      conditions: [{ column: "name", operator: "is", value: "terraform-aws-rds" }],
      albus: "all published versions (private registry)"
    },
    "View all modules": { type: "modules", conditions: [] },
    "View all providers": { type: "providers", conditions: [] },
    "Drifted workspaces": {
      type: "workspaces",
      conditions: [{ column: "drifted", operator: "is", value: "true" }]
    },
    "How many EC2 instances exist across my organization?": {
      type: "resources",
      conditions: [{ column: "providerType", operator: "is", value: "aws_instance" }]
    },
    "Which workspaces use AWS provider version 5.x?": {
      type: "workspaces",
      conditions: [{ column: "providers", operator: "contains", value: "hashicorp/aws 5." }]
    },
    "What resources depend on workspace X?": {
      type: "resources",
      conditions: [{ column: "address", operator: "contains", value: "terraform_remote_state.workspace_x" }]
    },
    "Production workspaces": {
      type: "workspaces",
      conditions: [{ column: "tags", operator: "contains", value: "production" }]
    }
  },
  // Typing on a results page narrows the current query: each refinement adds one condition and
  // filters the scripted rows. `scope` says which results it applies to; `keep` decides which rows stay.
  refinements: [
    {
      id: "production",
      match: /\b(prod|production)\b/,
      scope: "workspace-results",
      condition: { column: "tags", operator: "contains", value: "production" },
      keep: row => /prod/.test(row.name)
    },
    {
      id: "staging",
      match: /\bstag(e|ing)\b/,
      scope: "workspace-results",
      condition: { column: "tags", operator: "contains", value: "staging" },
      keep: row => /staging/.test(row.name)
    },
    {
      id: "consumers-production",
      match: /\b(prod|production)\b/,
      scope: "rds-consumers",
      condition: { column: "workspaces", operator: "contains", value: "production" },
      keep: row => row.environment === "production"
    }
  ],
  // Albus-derived view (tier 2). Explorer alone only knows versions some workspace uses
  // (visibility-module-version-v2, no registry join). The ✦ columns are computed by Albus.
  // Workspace counts match affectedWorkspaces: v5.1.0 = the 5 consumers (2 production).
  // my-workspace's v5.1.0 run errored before apply, so its state is still on v4.0.0.
  rdsVersions: {
    module: "terraform-aws-rds",
    provenance: {
      workspaces: "Explorer usage · module versions in workspace state · last indexed 6h ago",
      registryStatus: "Albus-computed · Private registry API (CoolCorp/terraform-aws-rds) · live",
      lastUsed: "Albus-computed · run history (latest configuration version referencing this module version)",
      note: "Albus-computed · summary of the columns above plus run-guDS9dmc3dn diagnostics"
    },
    rows: [
      { version: "v3.2.0", workspaces: 2, detail: "legacy-data, sandbox-testing", registryStatus: "Deprecated", status: "deprecated", lastUsed: "3 days ago", note: "Deprecated but still in use" },
      { version: "v4.0.0", workspaces: 14, detail: "incl. my-workspace (current state)", registryStatus: "Published", status: "published", lastUsed: "today", note: "Safe rollback target" },
      { version: "v4.1.0", workspaces: 0, detail: "", registryStatus: "Published", status: "published", lastUsed: "Feb 2026", note: "No longer in use" },
      { version: "v4.2.0", workspaces: 0, detail: "", registryStatus: "Published", status: "published", lastUsed: "Mar 2026", note: "No longer in use" },
      { version: "v5.0.0", workspaces: 0, detail: "", registryStatus: "Published", status: "published", lastUsed: "never", note: "Never adopted" },
      { version: "v5.1.0", workspaces: 5, detail: "2 production", registryStatus: "Published · breaking db_name rename", status: "breaking", lastUsed: "today", note: "The failing version — view blast radius", graph: true }
    ]
  },
  explorerResults: {
    // Every module/provider row is listed, so the table, graph, and Albus node list show the same set.
    "View all modules": {
      count: 12,
      unit: "modules",
      type: "module",
      summary: "12 modules across 12 workspaces",
      nodes: [
        { name: "terraform-aws-rds", detail: "v5.1.0", workspaces: ["payments-prod-eu", "payments-prod-us", "payments-staging"] },
        { name: "vpc-baseline", detail: "v3.4.2", workspaces: ["networking-prod", "platform-staging"] },
        { name: "eks-cluster", detail: "v19.5.1", workspaces: ["analytics-prod", "ml-pipeline-prod"] },
        { name: "s3-secure-bucket", detail: "v2.1.0", workspaces: ["data-warehouse-dev", "analytics-prod", "legacy-data"] },
        { name: "iam-role-baseline", detail: "v1.8.3", workspaces: ["security-prod", "platform-staging"] },
        { name: "cloudwatch-alarms", detail: "v0.9.4", workspaces: ["payments-prod-eu", "payments-prod-us"] },
        { name: "kms-key", detail: "v1.2.0", workspaces: ["security-prod", "payments-prod-eu"] },
        { name: "alb-ingress", detail: "v4.0.1", workspaces: ["payments-prod-us", "networking-prod"] },
        { name: "redis-cluster", detail: "v2.3.0", workspaces: ["payments-staging", "sandbox-testing"] },
        { name: "lambda-function", detail: "v6.0.0", workspaces: ["ml-pipeline-prod", "infra-baseline-qa"] },
        { name: "route53-zone", detail: "v1.5.2", workspaces: ["networking-prod"] },
        { name: "sg-standard", detail: "v3.0.0", workspaces: ["sandbox-testing", "infra-baseline-qa", "data-warehouse-dev"] }
      ]
    },
    "View all providers": {
      count: 12,
      unit: "providers",
      type: "provider",
      summary: "12 providers · 3 versions need review",
      nodes: [
        { name: "hashicorp/aws", detail: "v5.82.2", workspaces: ["payments-prod-eu", "payments-prod-us", "networking-prod"] },
        { name: "hashicorp/kubernetes", detail: "v2.35.1", workspaces: ["analytics-prod", "ml-pipeline-prod"] },
        { name: "hashicorp/vault", detail: "v4.5.0", workspaces: ["platform-staging", "security-prod"] },
        { name: "hashicorp/random", detail: "v3.6.3", workspaces: ["payments-staging", "sandbox-testing"] },
        { name: "hashicorp/tls", detail: "v4.0.6", workspaces: ["security-prod", "networking-prod"] },
        { name: "hashicorp/google", detail: "v6.14.1", workspaces: ["data-warehouse-dev", "analytics-prod"] },
        { name: "hashicorp/azurerm", detail: "v3.117.0", alert: true, review: "A major version behind (v4.x available)", workspaces: ["legacy-data"] },
        { name: "hashicorp/null", detail: "v3.2.3", workspaces: ["infra-baseline-qa", "sandbox-testing"] },
        { name: "hashicorp/helm", detail: "v2.17.0", workspaces: ["ml-pipeline-prod", "platform-staging"] },
        { name: "datadog/datadog", detail: "v3.49.0", workspaces: ["payments-prod-eu", "analytics-prod"] },
        { name: "hashicorp/template", detail: "v2.2.0", alert: true, review: "Deprecated provider; replace with templatefile()", workspaces: ["legacy-data", "infra-baseline-qa"] },
        { name: "cloudflare/cloudflare", detail: "v3.35.0", alert: true, review: "A major version behind (v4.x available)", workspaces: ["networking-prod", "payments-staging"] }
      ]
    },
    "Drifted workspaces": {
      count: 8,
      unit: "workspaces",
      type: "workspace",
      summary: "4 production workspaces require review",
      nodes: [
        { name: "payments-prod-eu", detail: "Drift detected 12m ago", alert: true },
        { name: "payments-prod-us", detail: "Drift detected 24m ago", alert: true },
        { name: "analytics-prod", detail: "Drift detected 1h ago", alert: true },
        { name: "ml-pipeline-prod", detail: "Drift detected 3h ago", alert: true },
        { name: "payments-staging", detail: "Drift detected 35m ago" },
        { name: "platform-staging", detail: "Drift detected 2h ago" },
        { name: "data-warehouse-dev", detail: "Drift detected yesterday" },
        { name: "infra-baseline-qa", detail: "Drift detected yesterday" }
      ]
    },
    "How many EC2 instances exist across my organization?": {
      count: 47,
      unit: "EC2 instances",
      type: "resource",
      summary: "47 EC2 instances across 14 workspaces",
      nodes: [
        { name: "prod-web-01", detail: "m6i.large · us-east-1" },
        { name: "prod-api-02", detail: "m6i.xlarge · us-east-1" },
        { name: "analytics-worker-01", detail: "r6i.2xlarge · us-west-2" },
        { name: "staging-web-01", detail: "t3.large · us-east-1" },
        { name: "qa-runner-03", detail: "c6i.large · us-east-2" },
        { name: "bastion-prod", detail: "t3.small · eu-west-1" }
      ]
    },
    "Which workspaces use AWS provider version 5.x?": {
      count: 18,
      unit: "workspaces",
      type: "workspace",
      summary: "18 workspaces use AWS provider 5.x",
      nodes: [
        { name: "payments-prod-eu", detail: "AWS v5.82.2 · applied" },
        { name: "payments-prod-us", detail: "AWS v5.82.2 · planned" },
        { name: "networking-prod", detail: "AWS v5.79.0 · applied" },
        { name: "analytics-prod", detail: "AWS v5.76.0 · applied" },
        { name: "platform-staging", detail: "AWS v5.68.0 · planned" },
        { name: "infra-baseline-qa", detail: "AWS v5.61.0 · applied" }
      ]
    },
    "What resources depend on workspace X?": {
      count: 7,
      unit: "resources",
      type: "resource",
      summary: "7 resources consume remote-state outputs from workspace X",
      nodes: [
        { name: "prod-api", detail: "Consumes subnet_ids" },
        { name: "payments-db", detail: "Consumes security_group_ids" },
        { name: "catalog-service", detail: "Consumes vpc_id" },
        { name: "analytics-worker", detail: "Consumes private_route_table_ids" },
        { name: "internal-alb", detail: "Consumes private_subnet_ids" },
        { name: "bastion-host", detail: "Consumes public_subnet_ids" }
      ]
    },
    "Production workspaces": {
      count: 6,
      unit: "workspaces",
      type: "workspace",
      summary: "6 production workspaces across three projects",
      nodes: [
        { name: "payments-prod-eu", detail: "Applied · 95 resources" },
        { name: "payments-prod-us", detail: "Planned · 148 resources" },
        { name: "analytics-prod", detail: "Applied · 34 resources" },
        { name: "networking-prod", detail: "Applied · 76 resources" },
        { name: "security-prod", detail: "Applied · 41 resources" },
        { name: "ml-pipeline-prod", detail: "Applied · 63 resources" }
      ]
    }
  },
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
    // Structured answers: {tier, query, basis?, interpretation, sources, gaps, insight, rowRefs, nextPrompts, actions}.
    // The chat never repeats the table; it explains, cites sources, and links rows.
    "Save as view": {
      tier: "action",
      action: "save-view",
      type: "answer",
      html: `<p>Opening <strong>Save view</strong> for the current results. Albus-derived views keep their ✦ badge so others know which columns Albus computed.</p>`,
      evidence: []
    },
    "Which RDS module versions are no longer in use?": {
      tier: 2,
      query: RDS_VERSIONS,
      feedback: true,
      basis: registryBasis,
      interpretation: "I read this as <strong>terraform-aws-rds versions in your private registry with 0 workspace consumers</strong> in Explorer.",
      sources: versionSources,
      gaps: versionGaps,
      insight: `<p><strong>3 of 6 versions are unused:</strong> ${row("v4.1.0")}, ${row("v4.2.0")}, and ${row("v5.0.0")} (never adopted). ${row("v3.2.0")} is deprecated but still used by 2 workspaces. ${row("v5.1.0")} was adopted by 5 (2 production) and contains the <code>db_name</code> rename.</p>`,
      rowRefs: ["v4.1.0", "v4.2.0", "v5.0.0"],
      nextPrompts: versionNextPrompts,
      actions: ["save-view", "download-view"]
    },
    // Previously answered (incorrectly) that a broader Explorer query would find unused modules.
    // Explorer cannot see versions no workspace uses; Albus scopes to the module in context and joins the registry.
    "What modules are no longer being used?": {
      tier: 2,
      query: RDS_VERSIONS,
      feedback: true,
      basis: registryBasis,
      interpretation: "I scoped this to <strong>terraform-aws-rds</strong>, the module you're investigating, and read it as published versions with 0 workspace consumers. Ask about “all modules” to widen it.",
      sources: versionSources,
      gaps: versionGaps,
      insight: `<p><strong>3 of 6 versions are unused:</strong> ${row("v4.1.0")}, ${row("v4.2.0")}, and ${row("v5.0.0")}. ${row("v3.2.0")} is deprecated but still used by 2 workspaces.</p>`,
      rowRefs: ["v4.1.0", "v4.2.0", "v5.0.0"],
      nextPrompts: versionNextPrompts,
      actions: ["save-view", "download-view"]
    },
    "Which RDS versions are deprecated but still in use?": {
      tier: 2,
      query: RDS_VERSIONS,
      feedback: true,
      basis: "I compared deprecation status in your private registry with Explorer usage.",
      interpretation: "I read this as <strong>terraform-aws-rds versions marked deprecated in the registry that at least one workspace still uses</strong>.",
      sources: versionSources,
      gaps: versionGaps,
      insight: `<p><strong>One version:</strong> ${row("v3.2.0")} is deprecated but still used by <strong>legacy-data</strong> and <strong>sandbox-testing</strong>, last run 3 days ago. Neither is production. ${row("v4.0.0")} is the closest safe target for them.</p>`,
      rowRefs: ["v3.2.0"],
      nextPrompts: ["Should we deprecate v5.1.0?", "Which RDS module versions are no longer in use?"],
      actions: ["save-view", "download-view"]
    },
    "When was each RDS version last used?": {
      tier: 2,
      query: RDS_VERSIONS,
      feedback: true,
      basis: "I used run history to find the last run that referenced each version.",
      interpretation: "I read this as <strong>the most recent run, per terraform-aws-rds version, whose configuration referenced that version</strong>.",
      sources: versionSources,
      gaps: ["Runs older than your organization's run retention period.", ...versionGaps],
      insight: `<p>${row("v4.0.0")} and ${row("v5.1.0")} ran today. ${row("v3.2.0")} last ran 3 days ago. ${row("v4.1.0")} (Feb 2026) and ${row("v4.2.0")} (Mar 2026) haven't been used in months, and ${row("v5.0.0")} was never used.</p>`,
      rowRefs: ["v4.1.0", "v4.2.0", "v5.0.0"],
      nextPrompts: versionNextPrompts,
      actions: ["save-view", "download-view"]
    },
    "Should we deprecate v5.1.0?": {
      tier: 3,
      query: RDS_VERSIONS,
      feedback: true,
      interpretation: "I read this as a <strong>recommendation</strong> on v5.1.0's registry status, using the version table and the failing run in my-workspace. Read-only: nothing will be changed.",
      sources: [
        versionSources[0],
        versionSources[1],
        { label: "Run run-guDS9dmc3dn", detail: "plan diagnostics, replace_paths: db_name", freshness: "30 min ago" }
      ],
      gaps: ["Whether each of the 5 consumers would plan cleanly on a fix. That needs a speculative plan in each workspace."],
      insight: `<p><strong>Yes, but publish a fix first.</strong> ${row("v5.1.0")} renames <code>db_name</code>, a force-replacement attribute, so any v4.x caller that upgrades will plan to destroy its database.</p><ol><li>Publish <strong>v5.1.1</strong> that keeps the existing <code>db_name</code> (make it an input; current v5.1.0 callers pass their current name). A <code>moved</code> block can't avoid this: the address doesn't change, the attribute does.</li><li>Deprecate ${row("v5.1.0")} with a pointer to v5.1.1 once its 5 consumers (2 production) plan cleanly on v5.1.1.</li><li>Deprecate ${row("v4.1.0")}, ${row("v4.2.0")}, and ${row("v5.0.0")} now. No workspace uses them.</li><li>Keep ${row("v3.2.0")} deprecated and follow up with its 2 owners.</li></ol>`,
      rowRefs: ["v5.1.0", "v4.1.0", "v4.2.0", "v5.0.0"],
      nextPrompts: ["Show blast radius for v5.1.0", "Which RDS versions are deprecated but still in use?"],
      actions: ["copy-recommendation", "save-view", "download-view"],
      copyText: [
        "Recommendation: terraform-aws-rds v5.1.0",
        "1. Publish v5.1.1 that keeps the existing db_name (make it an input; current v5.1.0 callers pass their current name). A moved block cannot avoid the replacement.",
        "2. Deprecate v5.1.0 (pointer to v5.1.1) once its 5 consumers (2 production) plan cleanly on v5.1.1.",
        "3. Deprecate v4.1.0, v4.2.0, v5.0.0 now (0 consumers).",
        "4. Keep v3.2.0 deprecated; follow up with owners of legacy-data and sandbox-testing.",
        "Sources: private registry (live), Explorer usage (indexed 6h ago), run run-guDS9dmc3dn."
      ].join("\n")
    },
    "Show blast radius for v5.1.0": {
      tier: 3,
      query: RDS_CONSUMERS,
      display: "graph",
      feedback: true,
      interpretation: "I read this as <strong>workspaces that consume terraform-aws-rds v5.1.0</strong> and would be affected by a change to it. Switched the results to the graph.",
      sources: [
        versionSources[1],
        { label: "Workspace tags", detail: "environment", freshness: "live" }
      ],
      gaps: ["Indirect dependents, such as workspaces reading these outputs through remote state, aren't in this view."],
      insight: `<p><strong>5 workspaces consume v5.1.0; 2 are production:</strong> ${row("payments-prod-eu")} and ${row("payments-prod-us")}. my-workspace failed before applying, so its state is still on v4.0.0.</p>`,
      rowRefs: ["payments-prod-eu", "payments-prod-us"],
      nextPrompts: ["Should we deprecate v5.1.0?", "Which RDS module versions are no longer in use?"],
      actions: ["save-view", "download-view"]
    },
    explorerInitial: {
      type: "answer",
      html: `<p>Ask about the results in the table. I'll show what I changed, where the data came from, and what I couldn't check.</p>`,
      evidence: []
    },
    "View all providers": {
      type: "answer",
      html: `<p>You are now viewing <strong>12 providers</strong> used across CoolCorp. Three provider versions need review.</p>`,
      evidence: ["Workspace provider versions"]
    },
    "View all modules": {
      type: "answer",
      html: `<p>You are now viewing <strong>12 modules</strong> used across 12 workspaces.</p>`,
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
})();
