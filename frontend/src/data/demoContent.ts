/** Static demo content ported from plan/stitch-project-dashboard.html */

export const INTEGRATION_CHIPS = [
  { key: "github", label: "GitHub Actions" },
  { key: "gitlab", label: "GitLab CI" },
  { key: "circleci", label: "CircleCI" },
  { key: "jenkins", label: "Jenkins" },
  { key: "bitbucket", label: "Bitbucket" },
  { key: "linear", label: "Linear" },
  { key: "jira", label: "Jira" },
  { key: "asana", label: "Asana" },
  { key: "slack", label: "Slack" },
  { key: "email", label: "Email" },
];

export const REPO_STATUS = [
  { repo: "acme/backend", mode: "Autopilot" },
  { repo: "acme/frontend", mode: "Fix & propose" },
  { repo: "acme/mobile", mode: "Diagnose & suggest" },
  { repo: "acme/infra", mode: "Notify only" },
];

export const BRANCH_ACTIVITY = [
  { pattern: "main", incidents: 41, detail: "79% auto-fixed" },
  { pattern: "feature/*", incidents: 28, detail: "comment-only" },
  { pattern: "release/*", incidents: 6, detail: "audit-only" },
  { pattern: "dev", incidents: 12, detail: "100% auto-merged" },
  { pattern: "hotfix/*", incidents: 2, detail: "autopilot" },
];

export const CONFIDENCE_BREAKDOWN = [
  { label: "High (>90%)", pct: 61, tone: "good" as const },
  { label: "Medium (70–90%)", pct: 28, tone: "warn" as const },
  { label: "Low (<70%)", pct: 11, tone: "critical" as const },
];

export const AI_USAGE = {
  budget: 75,
  spent: 44.5,
  gptCalls: 312,
  gptCost: 18.4,
  codexCalls: 89,
  codexCost: 26.1,
};

export const ISSUE_RECORDS = [
  {
    file: "247-jwt-secret-null-reference.md",
    title: "JWT secret null reference",
    repo: "acme/backend · auth/token.js",
    tags: ["Merged", "87%"],
    summary: "Null reference when JWT_SECRET missing from CI environment.",
    diagnosis: "JWT_SECRET read before guard — missing from CI env config.",
    confidence: 87,
    status: "Merged via PR #312",
    ticket: undefined,
  },
  {
    file: "251-connection-pool-exhaustion.md",
    title: "Connection pool exhaustion",
    repo: "acme/backend · database/connection.js",
    tags: ["Pending", "74%", "JIRA-1190"],
    summary: "Pool exhaustion under checkout load — no acquire timeout.",
    diagnosis: "Retries stack faster than connections release.",
    confidence: 74,
    status: "PR #318 awaiting review",
    ticket: "JIRA-1190",
  },
  {
    file: "256-queue-race-condition.md",
    title: "Queue race condition",
    repo: "acme/payment-service · queue/processor.js",
    tags: ["Escalated", "42%", "LINEAR-482"],
    summary: "Concurrent settle requests double-process under load.",
    diagnosis: "Race in payment queue processor — confidence below threshold.",
    confidence: 42,
    status: "Escalated to @dave",
    ticket: "LINEAR-482",
  },
  {
    file: "239-stale-cache-key-reverted.md",
    title: "Stale cache key (reverted)",
    repo: "acme/frontend · cache/client.js",
    tags: ["Reverted", "91%"],
    summary: "Auto-merged cache key change caused stampede — reverted.",
    diagnosis: "Cache invalidation key too broad for multi-tenant paths.",
    confidence: 91,
    status: "Reverted after merge",
    ticket: undefined,
  },
];

export const AUDIT_ENTRIES = [
  { at: "03:41:02", action: "CI failure detected", actor: "GitHub webhook", outcome: "Triggered" },
  { at: "03:41:05", action: "Logs fetched (2,847 lines)", actor: "Log fetcher", outcome: "Success" },
  { at: "03:41:18", action: "GPT-5.6 diagnosis complete (87%)", actor: "Diagnosis engine", outcome: "Success" },
  { at: "03:41:52", action: "Codex fix generated (3 files)", actor: "Fix generator", outcome: "Success" },
  { at: "03:42:10", action: "Validation passed", actor: "Fix validator", outcome: "Success" },
  { at: "03:42:14", action: "PR #312 opened (draft)", actor: "PR creator", outcome: "Success" },
  { at: "03:42:16", action: "Slack #dev-alerts notified", actor: "Notification dispatcher", outcome: "Success" },
  { at: "03:48:00", action: "@tech-lead approved PR", actor: "Human reviewer", outcome: "Approved" },
  { at: "03:53:11", action: "Merged to main", actor: "GitHub", outcome: "Success" },
  { at: "03:53:45", action: "CI re-run triggered", actor: "GitHub Actions", outcome: "Running" },
  { at: "04:01:02", action: "CI passed — incident resolved", actor: "GitHub Actions", outcome: "Resolved" },
];

export const CHANGELOG_ENTRIES = [
  {
    date: "2026-07-20",
    label: "Auto-patched",
    fixed: [
      "auth/token.js — resolved a null reference when JWT_SECRET is unset. Added a guard clause with a descriptive error. Fix #247 · PR #312",
      "database/connection.js — fixed connection-pool exhaustion under high load with a timeout + retry configuration. Fix #251 · PR #318",
    ],
    ci: [
      "Added JWT_SECRET to the CI environment definitions.",
      "Increased the integration-test timeout from 5s to 15s.",
    ],
  },
  {
    date: "2026-07-13",
    label: "Auto-patched",
    fixed: [
      "utils/parser.js — guarded an undefined array access when a webhook payload arrives without a pull_requests field. Fix #198 · PR #256",
    ],
    ci: [],
  },
];

export const ORG_MEMBERS = [
  { name: "Rajat Savdekar", role: "Admin", initials: "RS" },
  { name: "Tara Mehta", role: "Developer", initials: "TM" },
  { name: "James Lee", role: "Release Manager", initials: "JL" },
  { name: "Maya Gupta", role: "Product Owner", initials: "MG" },
  { name: "Alex Chen", role: "SRE", initials: "AC" },
  { name: "Sam Rivera", role: "Security & Compliance", initials: "SR" },
];

export const ROLES = [
  { name: "Admin", color: "accent", members: 1, custom: false },
  { name: "Product Owner", color: "good", members: 1, custom: false },
  { name: "Release Manager", color: "warn", members: 1, custom: false },
  { name: "SRE", color: "blue", members: 1, custom: false },
  { name: "Developer", color: "blue", members: 1, custom: false },
  { name: "Security & Compliance", color: "critical", members: 1, custom: false },
  { name: "Billing Manager", color: "neutral", members: 0, custom: false },
  { name: "Viewer", color: "neutral", members: 0, custom: false },
];

export const PERMISSIONS = [
  "Manage integrations & ticketing",
  "Change response modes / branch rules",
  "Approve Autopilot fixes",
  "Revert a merged fix",
  "Manage billing",
  "Manage team & roles",
  "View Audit Trail",
  "Export workspace data",
];

export const PERMISSION_MATRIX: Record<string, boolean[]> = {
  Admin: [true, true, true, true, true, true, true, true],
  "Product Owner": [false, false, true, false, false, false, true, true],
  "Release Manager": [true, true, true, true, false, false, true, false],
  SRE: [true, true, false, true, false, false, true, false],
  Developer: [false, false, true, true, false, false, true, false],
  "Security & Compliance": [false, false, false, false, false, false, true, true],
  "Billing Manager": [false, false, false, false, true, false, true, false],
  Viewer: [false, false, false, false, false, false, true, false],
};

export const SETTINGS_SECTIONS = [
  { id: "models", label: "AI models & API keys" },
  { id: "response", label: "Response behavior" },
  { id: "branches", label: "Branch rules" },
  { id: "rollback", label: "Rollback & safety" },
  { id: "integrations", label: "Integrations" },
  { id: "repos", label: "Repositories" },
  { id: "ticketing", label: "Ticketing" },
  { id: "notifications", label: "Notifications" },
  { id: "docs", label: "Documentation" },
  { id: "prs", label: "Pull requests" },
  { id: "team", label: "Team & access" },
  { id: "security", label: "Security" },
  { id: "billing", label: "Plan & billing" },
  { id: "apikey", label: "API key" },
  { id: "danger", label: "Danger zone" },
];

export const BRANCH_RULES = [
  { pattern: "main / master", mode: "Diagnose & suggest" },
  { pattern: "release/*", mode: "Silent audit" },
  { pattern: "hotfix/*", mode: "Autopilot" },
  { pattern: "feature/*", mode: "Fix & propose" },
  { pattern: "dev / staging", mode: "Autopilot" },
];

export const DEMO_REPOS = [
  { repo: "acme/backend", provider: "GitHub", mode: "Autopilot", policy: "Default", enabled: true, project: "core-platform" },
  { repo: "acme/frontend", provider: "GitHub", mode: "Fix & propose", policy: "Default", enabled: true, project: "core-platform" },
  { repo: "acme/payment-service", provider: "GitLab", mode: "Diagnose & suggest", policy: "Conservative", enabled: true, project: "payments" },
  { repo: "acme/mobile", provider: "GitHub", mode: "Notify only", policy: "Default", enabled: false, project: "infra-mobile" },
  { repo: "acme/infra", provider: "CircleCI", mode: "Silent audit", policy: "Default", enabled: true, project: "infra-mobile" },
];

export const NOTIFICATION_TRIGGERS = [
  "Failure detected",
  "Diagnosis complete",
  "Fix generated",
  "PR opened",
  "Tests passed",
  "Tests failed",
  "Merge completed",
  "Confidence too low",
];

export const ROADMAP = [
  {
    title: "Security & access control",
    items: [
      { p: "Later", t: "Real RBAC enforcement", n: "Role checks on every /api/* route" },
      { p: "Later", t: "Auth (SSO/OAuth, sessions)", n: "GitHub OAuth first provider" },
      { p: "Later", t: "API key scoping", n: "Per-scope tokens" },
      { p: "Next", t: "Secrets encrypted at rest", n: "Before persistence lands" },
      { p: "Later", t: "Webhook secret rotation", n: "Rotate/expire flow" },
      { p: "Later", t: "Audit-trail tamper-evidence", n: "Hash-chaining or append-only store" },
      { p: "Later", t: "Multi-tenant isolation", n: "Workspace-scoped data" },
    ],
  },
  {
    title: "Core product features",
    items: [
      { p: "Later", t: "Onboarding / first-run flow", n: "Connect your first repo wizard" },
      { p: "Later", t: "Dry-run / simulate mode", n: "Preview without acting" },
      { p: "Next", t: "Manual trigger", n: "Diagnose this now" },
      { p: "Later", t: "Regression test generation", n: "Codex writes the test too" },
      { p: "Next", t: "Dedup / noise control", n: "Suppress repeated root causes" },
      { p: "Later", t: "Snooze / mute", n: "Pause repo during deploy freeze" },
      { p: "Later", t: "Per-repo custom instructions", n: "Never touch payments/" },
      { p: "Future", t: "Monorepo support", n: "Modes per path" },
      { p: "Future", t: "Proactive scans", n: "Scan for brittle patterns" },
      { p: "Future", t: "Learning loop", n: "👍/👎 adjusts confidence" },
    ],
  },
  {
    title: "Reliability & engineering hardening",
    items: [
      { p: "Now", t: "Webhook idempotency", n: "Dedupe on platform + runId" },
      { p: "Next", t: "Rate limiting", n: "Abuse protection on webhooks" },
      { p: "Later", t: "Job queue", n: "BullMQ instead of inline async" },
      { p: "Later", t: "Dead-letter / retry", n: "Retry failed pipeline runs" },
      { p: "Later", t: "Observability on Stitch", n: "Logs/metrics/tracing" },
    ],
  },
  {
    title: "Testing & quality",
    items: [
      { p: "Now", t: "Unit tests", n: "branchRouter, notify, normalize()" },
      { p: "Next", t: "Integration test sandbox", n: "Full webhook → PR loop in CI" },
      { p: "Future", t: "Load test webhooks", n: "Only with real traffic" },
    ],
  },
  {
    title: "Compliance & enterprise",
    items: [
      { p: "Later", t: "Data retention controls", n: "Before real customer data" },
      { p: "Future", t: "Self-hosted option", n: "On-prem for enterprise" },
      { p: "Later", t: "Terms / privacy pages", n: "Needed for launch" },
      { p: "Future", t: "SOC2-style audit export", n: "After tamper-evidence" },
    ],
  },
  {
    title: "Billing & monetization",
    items: [
      { p: "Future", t: "Billing page", n: "Team plan badge today" },
      { p: "Future", t: "Usage-based pricing", n: "Tied to Codex/GPT spend" },
      { p: "Future", t: "Plan-tier gating", n: "Repos, modes per tier" },
    ],
  },
  {
    title: "Integration depth",
    items: [
      { p: "Later", t: "Outbound webhook HMAC", n: "Sign what Stitch sends" },
      { p: "Next", t: "Notification retry", n: "Backoff on failed sends" },
      { p: "Later", t: "GitHub Check Run", n: "Native check status" },
      { p: "Future", t: "ChatOps slash commands", n: "/stitch approve 247" },
    ],
  },
  {
    title: "Hackathon submission",
    items: [
      { p: "Now", t: "diagnose() + generateFix() + validator", n: "Blocking MVP path" },
      { p: "Now", t: "Hosted live demo", n: "Judges need clickable instance" },
      { p: "Next", t: "Standalone landing page", n: "Mockup done; needs hosting" },
    ],
  },
  {
    title: "Long-term differentiators",
    items: [
      { p: "Future", t: "Cross-repo pattern detection", n: "Same bug across repos" },
      { p: "Future", t: "Stitch reliability score", n: "Trust signal per repo" },
      { p: "Future", t: "VS Code extension", n: "Browse .stitch/issues inline" },
    ],
  },
];

export const EXTRA_FIX = {
  id: 239,
  repo: "acme/frontend",
  branch: "main",
  author: "@priya",
  at: "2026-07-19T14:22:00Z",
  confidence: 91,
  outcome: "reverted",
  mode: "Autopilot",
  rootCause: "Stale cache key in cache/client.js — invalidation scope too broad, caused cache stampede after auto-merge.",
  files: ["cache/client.js"],
  diff: [
    { ctx: "  const cacheKey = (tenant, path) => {" },
    { del: "-   return `cache:${path}`" },
    { add: "+   return `cache:${tenant}:${path}`" },
    { ctx: "  }" },
  ],
  outcomeText: "Auto-merged, then reverted — cache stampede detected in production metrics.",
  badgeLabel: "Reverted",
  badgeClass: "critical",
  meterClass: "good",
};
