/** Demo / seed data for dashboard, fix log, status — in-memory, merges with live activity. */

import type { IssueRecord } from "../issues/issueRecord.js";

export interface FixRecord {
  id: number;
  repo: string;
  branch: string;
  author: string;
  at: string;
  confidence: number;
  outcome: "merged" | "pending" | "escalated" | "reverted" | "diagnose";
  mode: string;
  rootCause: string;
  files: string[];
  diff: { ctx?: string; del?: string; add?: string }[];
  outcomeText: string;
  ticket?: string;
}

export const SEED_FIXES: FixRecord[] = [
  {
    id: 247,
    repo: "acme/backend",
    branch: "main",
    author: "@rajat",
    at: "2026-07-20T03:42:00Z",
    confidence: 87,
    outcome: "merged",
    mode: "Autopilot",
    rootCause:
      "Null reference in auth/token.js:47. JWT_SECRET is read before it's guaranteed to exist — missing from the CI environment config.",
    files: ["auth/token.js", ".github/workflows/ci.yml"],
    diff: [
      { ctx: "  export function verifyToken(token) {" },
      { del: "-   return jwt.verify(token, process.env.JWT_SECRET)" },
      { add: "+   if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing')" },
      { add: "+   return jwt.verify(token, process.env.JWT_SECRET)" },
      { ctx: "  }" },
    ],
    outcomeText: "PR #312 opened as draft, reviewer @tech-lead assigned. Merged 11 minutes after open — CI green on next run.",
  },
  {
    id: 251,
    repo: "acme/backend",
    branch: "feature/checkout-v2",
    author: "@maria",
    at: "2026-07-20T01:05:00Z",
    confidence: 74,
    outcome: "pending",
    mode: "Fix & propose",
    rootCause:
      "Connection pool exhaustion in database/connection.js — no timeout configured, retries stack faster than connections release.",
    files: ["database/connection.js"],
    diff: [
      { ctx: "  const pool = createPool({" },
      { del: "-   max: 10" },
      { add: "+   max: 10," },
      { add: "+   acquireTimeoutMillis: 5000," },
      { add: "+   idleTimeoutMillis: 30000" },
      { ctx: "  })" },
    ],
    outcomeText: "PR #318 opened as draft — waiting on human review (Fix & Propose mode never auto-merges).",
    ticket: "JIRA-1190",
  },
  {
    id: 256,
    repo: "acme/payment-service",
    branch: "main",
    author: "@dave",
    at: "2026-07-20T04:58:00Z",
    confidence: 42,
    outcome: "escalated",
    mode: "Diagnose & suggest",
    rootCause: "Race condition in payment/settle.js — concurrent requests double-settle under load.",
    files: ["payment/settle.js"],
    diff: [{ ctx: "  // Stitch suggested an advisory lock — human review required" }],
    outcomeText: "Escalated — confidence below threshold. Ticket LINEAR-482 created for @dave.",
    ticket: "LINEAR-482",
  },
  {
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
  },
];

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  defaultMode: string;
  createdAt: string;
}

export const PROJECTS_SEED: Project[] = [
  {
    id: "stitch-live-test",
    name: "Stitch Live Test",
    slug: "stitch-live-test",
    description: "Real GitHub repo for submission demo — branch rules exercise every Stitch trust level.",
    defaultMode: "Autopilot",
    createdAt: "2026-07-21T12:00:00Z",
  },
  {
    id: "core-platform",
    name: "Core Platform",
    slug: "core-platform",
    description: "The main backend and web app — highest CI volume, autopilot on main.",
    defaultMode: "Autopilot",
    createdAt: "2026-06-02T09:00:00Z",
  },
  {
    id: "payments",
    name: "Payments",
    slug: "payments",
    description: "Payment processing services — conservative by policy, human review required.",
    defaultMode: "Diagnose & suggest",
    createdAt: "2026-06-14T11:30:00Z",
  },
  {
    id: "infra-mobile",
    name: "Infrastructure & Mobile",
    slug: "infra-mobile",
    description: "Infra tooling and the mobile client — lower CI volume, notify-only by default.",
    defaultMode: "Notify only",
    createdAt: "2026-06-20T15:10:00Z",
  },
];

export interface DemoRepoConfig {
  repo: string;
  provider: string;
  mode: string;
  policy: string;
  enabled: boolean;
  project: string;
}

export const DEMO_REPOS_CONFIG: DemoRepoConfig[] = [
  {
    repo: "Khushalsarode/stitch-test-flow-repo",
    provider: "GitHub",
    mode: "Autopilot",
    policy: "Default",
    enabled: true,
    project: "stitch-live-test",
  },
  { repo: "acme/backend", provider: "GitHub", mode: "Autopilot", policy: "Default", enabled: true, project: "core-platform" },
  { repo: "acme/frontend", provider: "GitHub", mode: "Fix & propose", policy: "Default", enabled: true, project: "core-platform" },
  { repo: "acme/payment-service", provider: "GitLab", mode: "Diagnose & suggest", policy: "Conservative", enabled: true, project: "payments" },
  { repo: "acme/mobile", provider: "GitHub", mode: "Notify only", policy: "Default", enabled: false, project: "infra-mobile" },
  { repo: "acme/infra", provider: "CircleCI", mode: "Silent audit", policy: "Default", enabled: true, project: "infra-mobile" },
];

export const DEMO_CI_LOGS = `Run npm test
FAIL auth/token.test.js
  CI must provide JWT_SECRET for auth
    AssertionError: JWT_SECRET must be set in CI
      at TestContext.<anonymous> (auth/token.test.js)
Test Suites: 1 failed, 0 passed
`;

export const SEED_AUDIT_FIX_247 = [
  { action: "CI failure detected", actor: "GitHub webhook", outcome: "Triggered" },
  { action: "Logs fetched (2,847 lines)", actor: "Log fetcher", outcome: "Success" },
  { action: "GPT-5.6 diagnosis complete (87%)", actor: "Diagnosis engine", outcome: "Success" },
  { action: "Codex fix generated (3 files)", actor: "Fix generator", outcome: "Success" },
  { action: "Validation passed", actor: "Fix validator", outcome: "Success" },
  { action: "PR #312 opened (draft)", actor: "PR creator", outcome: "Success" },
  { action: "Merged to main", actor: "GitHub", outcome: "Resolved" },
];

export const SEED_ISSUE_RECORDS: IssueRecord[] = [
  {
    id: 247,
    slug: "jwt-secret-null-reference",
    path: ".stitch/issues/247-jwt-secret-null-reference.md",
    repo: "acme/backend · auth/token.js",
    branch: "main",
    title: "JWT secret null reference",
    status: "merged",
    confidence: 87,
    summary: "Null reference when JWT_SECRET missing from CI environment.",
    diagnosis: "JWT_SECRET read before guard — missing from CI env config.",
    fixId: 247,
    markdown: "",
  },
  {
    id: 251,
    slug: "connection-pool-exhaustion",
    path: ".stitch/issues/251-connection-pool-exhaustion.md",
    repo: "acme/backend · database/connection.js",
    branch: "feature/checkout-v2",
    title: "Connection pool exhaustion",
    status: "pending_review",
    confidence: 74,
    ticketId: "JIRA-1190",
    summary: "Pool exhaustion under checkout load — no acquire timeout.",
    diagnosis: "Retries stack faster than connections release.",
    fixId: 251,
    markdown: "",
  },
  {
    id: 256,
    slug: "queue-race-condition",
    path: ".stitch/issues/256-queue-race-condition.md",
    repo: "acme/payment-service · queue/processor.js",
    branch: "main",
    title: "Queue race condition",
    status: "escalated",
    confidence: 42,
    ticketId: "LINEAR-482",
    summary: "Concurrent settle requests double-process under load.",
    diagnosis: "Race in payment queue processor — confidence below threshold.",
    fixId: 256,
    markdown: "",
  },
  {
    id: 239,
    slug: "stale-cache-key-reverted",
    path: ".stitch/issues/239-stale-cache-key-reverted.md",
    repo: "acme/frontend · cache/client.js",
    branch: "main",
    title: "Stale cache key (reverted)",
    status: "reverted",
    confidence: 91,
    summary: "Auto-merged cache key change caused stampede — reverted.",
    diagnosis: "Cache invalidation key too broad for multi-tenant paths.",
    fixId: 239,
    markdown: "",
  },
];

export interface StatusComponent {
  name: string;
  group: "core" | "connectors";
  status: "operational" | "degraded" | "down";
  uptime: number;
  latencyMs: number;
}

export const STATUS_COMPONENTS: StatusComponent[] = [
  { name: "Webhook receiver", group: "core", status: "operational", uptime: 99.98, latencyMs: 12 },
  { name: "GPT-5.6 diagnosis API", group: "core", status: "operational", uptime: 99.91, latencyMs: 840 },
  { name: "Codex fix-generation API", group: "core", status: "operational", uptime: 99.88, latencyMs: 1200 },
  { name: "Dashboard & API", group: "core", status: "operational", uptime: 99.99, latencyMs: 45 },
  { name: "Notification dispatcher", group: "core", status: "operational", uptime: 99.95, latencyMs: 180 },
  { name: "GitHub webhook delivery", group: "connectors", status: "operational", uptime: 99.97, latencyMs: 95 },
  { name: "GitLab webhook delivery", group: "connectors", status: "operational", uptime: 99.9, latencyMs: 110 },
  { name: "CircleCI webhook delivery", group: "connectors", status: "degraded", uptime: 98.2, latencyMs: 220 },
  { name: "Linear sync", group: "connectors", status: "operational", uptime: 99.85, latencyMs: 310 },
  { name: "Jira sync", group: "connectors", status: "operational", uptime: 99.8, latencyMs: 420 },
];

export function dashboardStats(activityCount: number) {
  return {
    successRate: 74,
    successDelta: 4,
    avgTimeToFix: "2m 14s",
    avgTimeDelta: -18,
    hoursSaved: 26.4,
    hoursDelta: 3.1,
    totalIncidents: 89 + activityCount,
    incidentsDelta: 12,
    attentionOpen: 2,
  };
}

/**
 * Only `connected`/`detail` for non-Jira keys here matter — Jira's row is
 * always replaced with its real, live database state in `GET /api/ticketing`
 * (src/api.ts). Linear/Asana/GitHub Issues have no real connect flow yet, so
 * they must never claim `connected: true` — that would be a fake status,
 * exactly the kind of thing this project's honesty convention exists to avoid.
 */
export const TICKETING_PROVIDERS = [
  { key: "linear", name: "Linear", connected: false, detail: "Not available yet — reference only" },
  { key: "jira", name: "Jira", connected: false, detail: "Create a ticket per failure" },
  { key: "asana", name: "Asana", connected: false, detail: "Not available yet — reference only" },
  { key: "github_issues", name: "GitHub Issues", connected: false, detail: "Not available yet — reference only" },
];
