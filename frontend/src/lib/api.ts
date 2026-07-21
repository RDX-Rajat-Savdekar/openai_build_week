import type { PermissionKey, PermissionSet } from "@/lib/permissions";

/** Dev: Vite proxies `/api` → :3000, or set VITE_API_BASE=http://localhost:3000/api for direct calls. */
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data;
}

export interface ConnectField {
  name: string;
  label: string;
  type: "text" | "password";
}

export interface PlatformCapabilities {
  pipelineReady: boolean;
  syncRepos: boolean;
  testConnection: boolean;
  webhookPath: string;
}

export interface Integration {
  key: string;
  displayName: string;
  connected: boolean;
  liveTested: boolean;
  pipelineReady: boolean;
  capabilities: PlatformCapabilities;
  fields: ConnectField[];
  icon: string;
  subtitle: string;
  repoCount: number;
  webhookUrl: string;
  configPreview: Record<string, string>;
  updatedAt: string;
}



export interface TicketingIntegration {

  key: string;

  name: string;

  connected: boolean;

  detail: string;

  liveTested: boolean;

  fields: ConnectField[];

}



export interface TicketingPreferences {

  createOn: "esc_only" | "esc_pending" | "every";

  defaultBoard: string;

  autoCloseOnMerge: boolean;

  autoReopenOnRevert: boolean;

  linkInPrDescription: boolean;

  priorityMap: { high: string; medium: string; low: string };

}



export interface AiSettingsResponse {
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  geminiConfigured: boolean;
  copilotConfigured: boolean;
  aiConfigured: boolean;
  diagnosisProvider: "openai" | "anthropic" | "gemini" | "copilot";
  diagnosisModel: string;
  fixProvider: "openai" | "anthropic" | "gemini" | "copilot";
  fixModel: string;
  copilotEndpoint?: string;
  copilotDeployment?: string;
  maxDiffSize: number;
  quotaExceeded: string;
  catalog: {
    openai: { id: string; label: string }[];
    anthropic: { id: string; label: string }[];
    gemini: { id: string; label: string }[];
    copilot: { id: string; label: string }[];
  };
}

export type AiProvider = "openai" | "anthropic" | "gemini" | "copilot";



export type UiModeLabel = "Autopilot" | "Fix & propose" | "Diagnose & suggest" | "Silent audit" | "Notify only";

export interface BranchRule {

  pattern: string;

  mode: UiModeLabel;

}



export interface ResponseBehavior {

  defaultMode: UiModeLabel;

  confidenceFloor: number;

  autoMergeDelay: number;

  requiredApprovers: number;

  maxPrsPerHour: number;

  respectWorkingHours: boolean;

}



export interface RollbackPreferences {
  autoRevertOnRepeatFailure: boolean;
  revertWindowMinutes: number;
  revertRequiresReason: boolean;
}

export interface OrgProfile {
  name: string;
  slug: string;
  plan: string;
  domain: string;
  industry: string;
  companySize: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: string;
}

export interface OrganizationOverview {
  profile: OrgProfile;
  workspace: {
    id: string;
    slug: string;
    plan: string;
    createdAt: string;
  };
  stats: {
    members: number;
    pendingInvites: number;
    projects: number;
    userProjects: number;
    repos: number;
    enabledRepos: number;
    connectedIntegrations: number;
    totalIntegrations: number;
    fixesThisMonth?: number;
    includedFixes?: number;
  };
  integrations: { key: string; displayName: string; connected: boolean; pipelineReady: boolean }[];
}

export interface BillingData {
  plan: string;
  includedFixes: number;
  fixesThisMonth: number;
  overageRate: number;
  usagePercent: number;
  aiUsage: AiUsage;
}



export interface PullRequestPreferences {

  openAs: "draft" | "ready";

  requiredApprovers: number;

  includeDiagnosisInBody: boolean;

  notifyCodeowners: boolean;

  labels: string[];

}



export interface DocumentationPreferences {

  writeFixLogToRepo: boolean;

  writeAuditTrail: boolean;

  autoGenerateChangelog: boolean;

  incidentReports: boolean;

  weeklyDigest: "mon" | "fri" | "off";

  retentionDays: number;

  exportFormats: { markdown: boolean; json: boolean; pdf: boolean };

}



export interface SecurityPreferences {

  requireApprovalForAutopilotOnMain: boolean;

  sessionTimeoutHours: number | "never";

  ipAllowlist: string;

}



export interface RoleDefinition {
  name: string;
  custom: boolean;
  members: number;
  color?: string;
  description?: string;
  permissions: Record<PermissionKey, boolean>;
}

export interface TeamMember {

  id: string;

  name: string;

  email: string;

  role: string;

  createdAt: string;

}



export interface PendingInvite {

  id: string;

  email: string | null;

  role: string;

  createdAt: string;

  expiresAt: string;

  expired: boolean;

}



export interface TeamData {

  members: TeamMember[];

  pendingInvites: PendingInvite[];

}



export interface NotificationChannel {

  key: string;

  displayName: string;

  configured: boolean;

  workspaceEnabled: boolean;

  fields: ConnectField[];

  icon: string;

}



export interface AiUsage {

  budget: number;

  spent: number;

  gptCalls: number;

  gptCost: number;

  codexCalls: number;

  codexCost: number;

}



export interface DashboardData {

  stats: {

    successRate: number;

    successDelta: number;

    avgTimeToFix: string;

    avgTimeDelta: number;

    hoursSaved: number;

    hoursDelta: number;

    totalIncidents: number;

    incidentsDelta: number;

    attentionOpen: number;

  };

  sparklines?: {
    success: number[];
    timeToFix: number[];
    hoursSaved: number[];
    incidents: number[];
  };

  weeklyActivity: { day: string; good: number; warn: number; critical: number }[];

  attention: {

    fixId: number;

    repo: string;

    branch: string;

    summary: string;

    ago: string;

    assignee: string;

    ticket: string;

    level: string;

  }[];

  liveFeed?: {
    id: string;
    at: string;
    repo: string;
    branch: string;
    summary: string;
    tone: "good" | "warn" | "critical" | "neutral";
    fixId?: number;
  }[];

  /** @deprecated use liveFeed */
  liveFeedPool?: string[];

  branchActivity?: { pattern: string; incidents: number; detail: string }[];

  confidenceBreakdown?: { label: string; pct: number; tone: "good" | "warn" | "critical" }[];

  recentFixes?: { id: number; repo: string; branch: string; outcome: string; confidence: number; badgeLabel: string }[];

  checkedAt?: string;

  periodDays?: number;

  aiUsage?: AiUsage;

  repoStatus?: { repo: string; mode: string; enabled?: boolean }[];

}



export interface FixRecord {

  id: number;

  repo: string;

  branch: string;

  author: string;

  at: string;

  confidence: number;

  outcome: string;

  mode: string;

  rootCause: string;

  files: string[];

  diff: { ctx?: string; del?: string; add?: string }[];

  outcomeText: string;

  ticket?: string;

  badgeLabel: string;

  badgeClass: string;

  meterClass: string;

  prUrl?: string;

}



export interface IssueRecord {

  id: number;

  slug: string;

  path: string;

  repo: string;

  branch: string;

  title: string;

  status: string;

  confidence: number;

  ticketId?: string;

  summary: string;

  diagnosis: string;

  markdown: string;

  fixId: number;

}



export interface AuditEntry {

  fixId: number;

  at: string;

  action: string;

  actor: string;

  outcome: string;

}

export interface FixSummary {
  id: number;
  repo: string;
  branch: string;
  outcome: string;
  at: string;
}

export interface ChangelogItem {
  fixId: number;
  repo: string;
  file: string;
  summary: string;
  prRef?: string;
}

export interface ChangelogEntry {
  date: string;
  label: string;
  fixed: ChangelogItem[];
  ci: string[];
}

export interface ChangelogData {
  entries: ChangelogEntry[];
  markdown: string;
  generatedAt: string;
}

export interface IncidentReport {
  id: string;
  fixId: number;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  severityLabel: string;
  resolvedLabel: string;
  durationMinutes: number | null;
  repo: string;
  branch: string;
  serviceHint: string;
  timeline: { at: string; time: string; label: string }[];
  rootCause: string;
  contributingFactors: string[];
  prevention: string;
  humanMinutes: number | null;
  markdown: string;
}

export interface FailurePattern {
  label: string;
  count: number;
  pct: number;
}

export interface WeeklyDigest {
  periodStart: string;
  periodEnd: string;
  title: string;
  totalFailures: number;
  autoFixed: number;
  autoFixedPct: number;
  diagnoseOnly: number;
  diagnoseOnlyPct: number;
  escalated: number;
  escalatedPct: number;
  reverted: number;
  revertedPct: number;
  pending: number;
  patterns: FailurePattern[];
  escalations: { fixId: number; title: string; repo: string; summary: string }[];
  recommendation: string;
  markdown: string;
}

export interface StoredReport {
  id: string;
  type: "incident" | "digest" | "changelog";
  title: string;
  createdAt: string;
  fixId?: number;
  periodStart?: string;
  periodEnd?: string;
  markdown: string;
  shareToken?: string;
  sharedAt?: string;
}

export interface ReportsOverview {
  stored: StoredReport[];
  digest: WeeklyDigest;
  incidentFixes: FixSummary[];
  generatedAt: string;
}



export interface DemoRepo {

  repo: string;

  provider: string;

  mode: string;

  policy: string;

  enabled: boolean;

  project: string;

}



export interface Project {

  id: string;

  name: string;

  slug: string;

  description: string;

  defaultMode: string;

  createdAt: string;

  repoCount: number;

  repos: string[];

}



export interface StatusIncident {
  id: string;
  title: string;
  at: string;
  resolved: boolean;
  summary: string;
  severity: "critical" | "warning" | "info";
  category: "fix" | "pipeline" | "integration" | "security";
  fixId?: number;
  repo?: string;
  branch?: string;
}

export interface StatusData {
  banner: string;
  bannerLevel: "operational" | "degraded" | "down";
  checkedAt: string;
  stats: {
    overallUptime: number;
    connectedCi: number;
    totalCi: number;
    enabledRepos: number;
    totalRepos: number;
    openaiConfigured: boolean;
    notificationsConfigured: number;
    liveListeners: number;
    openIncidents: number;
    resolvedIncidents: number;
  };
  components: {
    key: string;
    name: string;
    group: "core" | "ci" | "ticketing" | "notifications";
    status: "operational" | "degraded" | "down" | "standby" | "not_connected";
    uptime: number;
    latencyMs: number;
    detail: string;
    connected: boolean;
    pipelineReady?: boolean;
    liveTested?: boolean;
    webhookUrl?: string;
    icon?: string;
  }[];
  incidents: StatusIncident[];
  primaryCi: { key: string; name: string; connected: boolean; status: string; pipelineReady: boolean } | null;
}



export interface ActivityEntry {

  id: number;

  at: string;

  event: { type: string; repo: string; branch: string; summary: string; url: string };

}



export interface SearchResult {
  id: string;
  type: "fix" | "issue" | "repo" | "project" | "page";
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  tone?: "good" | "warn" | "critical" | "neutral";
}

export interface InboxNotification {
  id: string;
  at: string;
  ago: string;
  repo: string;
  branch: string;
  body: string;
  badge?: string;
  level: "info" | "warn" | "critical";
  action: { label: string; href: string };
  kind: "attention" | "activity" | "success";
}

export interface InboxData {
  notifications: InboxNotification[];
  unreadCount: number;
  checkedAt: string;
}

export interface PublicMarketingData {
  checkedAt: string;
  platform: {
    status: "operational" | "degraded" | "down";
    statusLabel: string;
    openaiConfigured: boolean;
    githubOAuth: boolean;
  };
  metrics: {
    successRate: number;
    avgTimeToFix: string;
    avgTimeSeconds: number;
    hoursSaved: number;
    totalFixes: number;
    mergedFixes: number;
    workspaces: number;
    connectedRepos: number;
    fixesToday: number;
    autoFixRateModel: number;
  };
  liveFeed: {
    id: string;
    at: string;
    ago: string;
    repo: string;
    branch: string;
    summary: string;
    tone: "good" | "warn" | "critical" | "neutral";
  }[];
  failureCategories: { label: string; pct: number; tone: "good" | "warn" | "critical" }[];
  integrations: { key: string; label: string; status: "live" | "ready" | "planned" }[];
  marketContext: {
    industryMedianRestoreMinutes: number;
    typicalManualFixMinutes: number;
    doraEliteRestoreMinutes: number;
    source: string;
  };
}



export interface SimulateResult {

  fixId: number;

  mode: string;

  action: string;

  prUrl?: string;

  diagnosis: { rootCause: string; explanation: string };

}



export const api = {

  integrations: () => request<Integration[]>("/integrations"),

  connectIntegration: (key: string, body: Record<string, string>) =>

    request<{ key: string; connected: boolean }>(`/integrations/${key}/connect`, { method: "POST", body: JSON.stringify(body) }),

  disconnectIntegration: (key: string) =>

    request(`/integrations/${key}/disconnect`, { method: "POST", body: "{}" }),

  syncGithubIntegration: () =>
    request<{ synced: number; repos: { fullName: string; private: boolean }[] }>("/integrations/github/sync", { method: "POST", body: "{}" }),

  syncIntegration: (key: string) =>
    request<{ synced: number; repos: { fullName: string; private: boolean }[] }>(`/integrations/${encodeURIComponent(key)}/sync`, {
      method: "POST",
      body: "{}",
    }),

  testIntegration: (key: string, body?: Record<string, string>) =>
    request<{ ok: boolean; message?: string; detail?: string; error?: string }>(`/integrations/${encodeURIComponent(key)}/test`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  notifications: () => request<NotificationChannel[]>("/notifications"),

  saveNotification: (key: string, body: Record<string, unknown>) =>

    request(`/notifications/${key}`, { method: "POST", body: JSON.stringify(body) }),

  testNotification: (key: string) =>

    request<{ ok: boolean; error?: string }>(`/notifications/${key}/test`, { method: "POST", body: "{}" }),

  dashboard: (opts?: { project?: string; days?: number }) => {
    const q = new URLSearchParams();
    if (opts?.project) q.set("project", opts.project);
    if (opts?.days) q.set("days", String(opts.days));
    const qs = q.toString();
    return request<DashboardData>(`/dashboard${qs ? `?${qs}` : ""}`);
  },

  fixes: () => request<FixRecord[]>("/fixes"),

  revertFix: (id: number, reason?: string) =>

    request<FixRecord>(`/fixes/${id}/revert`, { method: "POST", body: JSON.stringify({ reason }) }),

  approveFix: (id: number) =>
    request<FixRecord>(`/fixes/${id}/approve`, { method: "POST", body: "{}" }),

  issues: () => request<IssueRecord[]>("/issues"),

  issue: (id: number) => request<IssueRecord>(`/issues/${id}`),

  audit: (fixId?: number) => request<AuditEntry[]>(`/audit${fixId != null ? `?fixId=${fixId}` : ""}`),

  auditFixes: () => request<FixSummary[]>("/audit/fixes"),

  changelog: () => request<ChangelogData>("/changelog"),

  reportsOverview: () => request<ReportsOverview>("/reports"),

  incidentReport: (fixId: number) => request<IncidentReport>(`/reports/incident/${fixId}`),

  weeklyDigest: (days?: number) => request<WeeklyDigest>(`/reports/digest${days ? `?days=${days}` : ""}`),

  storeReport: (body: { type: "incident" | "digest" | "changelog"; fixId?: number; title?: string }) =>
    request<StoredReport>("/reports", { method: "POST", body: JSON.stringify(body) }),

  shareReport: (id: string) =>
    request<{ token: string; shareUrl: string; sharedAt?: string }>(`/reports/${encodeURIComponent(id)}/share`, {
      method: "POST",
      body: "{}",
    }),

  deleteReport: (id: string) =>
    request<{ deleted: boolean }>(`/reports/${encodeURIComponent(id)}`, { method: "DELETE" }),

  repos: (projectId?: string) => request<DemoRepo[]>(`/repos${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`),

  updateRepo: (name: string, body: { enabled?: boolean; mode?: string; project?: string }) =>

    request<DemoRepo>(`/repos/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify(body) }),

  projects: () => request<Project[]>("/projects"),

  createProject: (body: { name: string; description?: string; defaultMode?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),

  updateProject: (id: string, body: { name?: string; description?: string; defaultMode?: string }) =>
    request<Project>(`/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteProject: (id: string) =>
    request<{ deleted: boolean }>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" }),

  simulateFailure: (body: { repo?: string; branch?: string; prNumber?: number; liveGitHub?: boolean }) =>

    request<SimulateResult>("/demo/simulate", { method: "POST", body: JSON.stringify(body) }),

  status: () => request<StatusData>("/status"),

  activity: () => request<ActivityEntry[]>("/activity"),

  search: (q = "", limit = 12) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (limit !== 12) params.set("limit", String(limit));
    const qs = params.toString();
    return request<{ query: string; results: SearchResult[] }>(`/search${qs ? `?${qs}` : ""}`);
  },

  inbox: (limit = 20) =>
    request<InboxData>(`/inbox${limit !== 20 ? `?limit=${limit}` : ""}`),

  publicMarketing: () => request<PublicMarketingData>("/public/marketing"),

  contact: (body: { name: string; email: string; topic?: string; message: string }) =>
    request<{ ok: boolean; receivedAt: string }>("/public/contact", { method: "POST", body: JSON.stringify(body) }),

  settings: () =>
    request<AiSettingsResponse>("/settings"),

  aiModels: () => request<AiSettingsResponse>("/settings/ai-models"),

  saveAiModels: (body: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
    copilotApiKey?: string;
    copilotEndpoint?: string;
    copilotDeployment?: string;
    diagnosisProvider?: AiProvider;
    diagnosisModel?: string;
    fixProvider?: AiProvider;
    fixModel?: string;
    maxDiffSize?: number;
    quotaExceeded?: string;
  }) =>
    request<AiSettingsResponse>("/settings/ai-models", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  disconnectAiProvider: (provider: AiProvider) =>
    request<AiSettingsResponse>("/settings/ai-models/disconnect", {
      method: "POST",
      body: JSON.stringify({ provider }),
    }),

  testAiProvider: (
    provider: AiProvider,
    opts?: { apiKey?: string; model?: string; endpoint?: string; deployment?: string },
  ) =>
    request<{ ok: boolean; message?: string; error?: string }>("/settings/ai-models/test", {
      method: "POST",
      body: JSON.stringify({ provider, ...opts }),
    }),

  saveOpenAi: (body: {
    apiKey?: string;
    diagnosisModel?: string;
    fixModel?: string;
    maxDiffSize?: number;
    quotaExceeded?: string;
  }) =>
    request<{
      openaiConfigured: boolean;
      diagnosisModel: string;
      fixModel: string;
      maxDiffSize: number;
      quotaExceeded: string;
    }>("/settings/openai", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  disconnectOpenAi: () =>
    request<{ openaiConfigured: boolean }>("/settings/openai/disconnect", { method: "POST", body: "{}" }),

  testOpenAi: () =>
    request<{ ok: boolean; message?: string; error?: string }>("/settings/openai/test", { method: "POST", body: "{}" }),

  workspace: () =>
    request<{ id: string; name: string; plan: string; projectCount: number; orgName: string; user: { id: string; name: string; email: string; role: string } | null }>("/workspace"),

  team: () => request<TeamData>("/team"),

  inviteTeamMember: (body: { email?: string; role?: string }) =>
    request<{ id: string; url: string; email: string | null; role: string; expiresAt: string }>("/team/invite", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revokeInvite: (id: string) => request<{ revoked: boolean }>(`/team/invite/${id}`, { method: "DELETE" }),

  updateMemberRole: (id: string, role: string) =>
    request<TeamMember>(`/team/members/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),

  removeMember: (id: string) => request<{ removed: boolean }>(`/team/members/${id}`, { method: "DELETE" }),

  myPermissions: () =>
    request<{ role: string; permissions: PermissionSet; labels: { key: PermissionKey; label: string }[] }>(
      "/me/permissions",
    ),

  roles: () => request<RoleDefinition[]>("/roles"),

  createRole: (body: { name: string; permissions?: Record<string, boolean>; color?: string }) =>
    request<RoleDefinition>("/roles", { method: "POST", body: JSON.stringify(body) }),

  updateRole: (name: string, body: { permissions?: Record<string, boolean>; color?: string }) =>
    request<RoleDefinition>(`/roles/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteRole: (name: string) =>
    request<{ deleted: boolean }>(`/roles/${encodeURIComponent(name)}`, { method: "DELETE" }),

  ticketing: () =>
    request<TicketingIntegration[]>("/ticketing"),

  connectTicketing: (key: string, body: Record<string, string>) =>
    request<{ key: string; connected: boolean }>(`/ticketing/${key}/connect`, { method: "POST", body: JSON.stringify(body) }),

  disconnectTicketing: (key: string) =>
    request<{ key: string; connected: boolean }>(`/ticketing/${key}/disconnect`, { method: "POST", body: "{}" }),

  testTicketing: (key: string) =>
    request<{ ok: boolean; error?: string }>(`/ticketing/${key}/test`, { method: "POST", body: "{}" }),

  ticketingPreferences: () => request<TicketingPreferences>("/settings/ticketing"),

  saveTicketingPreferences: (patch: Partial<TicketingPreferences>) =>
    request<TicketingPreferences>("/settings/ticketing", { method: "POST", body: JSON.stringify(patch) }),

  preferences: () => request<Record<string, unknown>>("/settings/preferences"),

  savePreferences: (patch: Record<string, unknown>) =>
    request<Record<string, unknown>>("/settings/preferences", { method: "PATCH", body: JSON.stringify(patch) }),

  branchRules: () => request<{ rules: BranchRule[]; customized: boolean }>("/settings/branch-rules"),

  saveBranchRules: (rules: BranchRule[]) =>
    request<{ rules: BranchRule[]; customized: boolean }>("/settings/branch-rules", { method: "POST", body: JSON.stringify({ rules }) }),

  responseBehavior: () => request<ResponseBehavior>("/settings/response-behavior"),

  saveResponseBehavior: (patch: Partial<ResponseBehavior>) =>
    request<ResponseBehavior>("/settings/response-behavior", { method: "POST", body: JSON.stringify(patch) }),

  rollbackPrefs: () => request<RollbackPreferences>("/settings/rollback"),

  saveRollbackPrefs: (patch: Partial<RollbackPreferences>) =>
    request<RollbackPreferences>("/settings/rollback", { method: "POST", body: JSON.stringify(patch) }),

  pullRequestPrefs: () => request<PullRequestPreferences>("/settings/pull-requests"),

  savePullRequestPrefs: (patch: Partial<PullRequestPreferences>) =>
    request<PullRequestPreferences>("/settings/pull-requests", { method: "POST", body: JSON.stringify(patch) }),

  documentationPrefs: () => request<DocumentationPreferences>("/settings/documentation"),

  saveDocumentationPrefs: (patch: Partial<DocumentationPreferences>) =>
    request<DocumentationPreferences>("/settings/documentation", { method: "POST", body: JSON.stringify(patch) }),

  securityPrefs: () => request<SecurityPreferences>("/settings/security"),

  saveSecurityPrefs: (patch: Partial<SecurityPreferences>) =>
    request<SecurityPreferences>("/settings/security", { method: "POST", body: JSON.stringify(patch) }),

  apiKey: () => request<{ preview: string | null }>("/settings/api-key"),

  regenerateApiKey: () =>
    request<{ key: string; preview: string }>("/settings/api-key/regenerate", { method: "POST", body: "{}" }),

  createRepo: (body: { repo: string; provider?: string; mode?: string; project?: string }) =>
    request<DemoRepo>("/repos", { method: "POST", body: JSON.stringify(body) }),

  deleteRepo: (name: string) =>
    request<{ deleted: boolean }>(`/repos/${encodeURIComponent(name)}`, { method: "DELETE" }),

  disconnectAllIntegrations: () =>
    request<{ ok: boolean }>("/danger/disconnect-all", { method: "POST", body: "{}" }),

  exportWorkspaceData: () => request<Record<string, unknown>>("/danger/export"),

  deleteWorkspace: () => request<{ deleted: boolean }>("/organization", { method: "DELETE" }),

  orgProfile: () => request<OrgProfile>("/organization/profile"),

  organizationOverview: () => request<OrganizationOverview>("/organization/overview"),

  saveOrgProfile: (patch: Partial<OrgProfile>) =>
    request<OrgProfile>("/organization/profile", { method: "PATCH", body: JSON.stringify(patch) }),

  billing: () => request<BillingData>("/settings/billing"),

  myProfile: () => request<UserProfile>("/me/profile"),

  saveMyProfile: (patch: { name?: string; email?: string }) =>
    request<UserProfile>("/me/profile", { method: "PATCH", body: JSON.stringify(patch) }),

  changeMyPassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/me/password", { method: "PATCH", body: JSON.stringify(body) }),

  saveMyPreferences: (patch: Partial<UserPersonalPreferences>) =>
    request<UserPersonalPreferences>("/me/preferences", { method: "PATCH", body: JSON.stringify(patch) }),

  revokeOtherSessions: () =>
    request<{ ok: boolean; sessions: UserProfile["sessions"] }>("/me/sessions/others", { method: "DELETE" }),
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization: { id: string; name: string; slug: string; plan: string };
}

export interface UserPersonalPreferences {
  timezone: "org" | string;
  dateFormat: "org" | "mdy" | "dmy" | "iso";
  language: string;
  notifyEscalation: boolean;
  notifyReview: boolean;
  notifyDigest: boolean;
}

export interface UserProfile {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    githubUsername: string | null;
    authMethod: "password" | "github" | "both";
    hasPassword: boolean;
  };
  organization: { id: string; name: string; slug: string; plan: string };
  orgLocale: { timezone: string; dateFormat: string; timeFormat: string };
  preferences: UserPersonalPreferences;
  sessions: { id: string; createdAt: string; expiresAt: string; current: boolean }[];
}

export const auth = {
  config: () => request<{ githubOAuth: boolean }>("/auth/config"),

  signup: (body: { orgName?: string; name: string; email: string; password: string; invite?: string }) =>
    request<{ user: AuthUser }>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" }),

  me: () => request<{ user: AuthUser }>("/auth/me"),

  invite: (token: string) => request<{ valid: boolean; orgName: string; email: string | null; role: string }>(`/auth/invite/${token}`),

  /** Full-page redirect — must not use fetch (OAuth + Set-Cookie flow). */
  githubLoginUrl: (invite?: string) => {
    const q = invite ? `?invite=${encodeURIComponent(invite)}` : "";
    if (BASE.startsWith("http")) {
      const u = new URL(BASE);
      return `${u.origin}/api/auth/github${q}`;
    }
    return `/api/auth/github${q}`;
  },
};



export function subscribeEvents(handlers: {
  onActivity?: (entry: ActivityEntry) => void;
  onPipeline?: (data: { fixId: number; repo: string; branch: string; action: string }) => void;
}): () => void {
  const es = new EventSource(`${BASE}/events`, { withCredentials: true });
  if (handlers.onActivity) {

    es.addEventListener("activity", (ev) => {

      handlers.onActivity!(JSON.parse((ev as MessageEvent).data) as ActivityEntry);

    });

  }

  if (handlers.onPipeline) {

    es.addEventListener("pipeline", (ev) => {

      handlers.onPipeline!(JSON.parse((ev as MessageEvent).data));

    });

  }

  return () => es.close();

}


