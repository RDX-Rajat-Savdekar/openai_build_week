import { TICKETING_PROVIDERS } from "../data/demoData.js";
import { LIVE_TESTED_PLATFORMS } from "../platforms/connectFields.js";
import { LIVE_TESTED_TICKETING } from "../ticketing/connectFields.js";
import { PLATFORM_CAPABILITIES, PLATFORM_META } from "../platforms/integrationMeta.js";
import { pluginFor } from "../platforms/registry.js";
import type { PlatformKey } from "../platforms/types.js";
import type { TicketingKey } from "../ticketing/types.js";
import {
  getTicketingIntegration,
  listIntegrations,
  listNotificationChannels,
  listRepos,
} from "../store/appStore.js";
import { prisma } from "../db/prisma.js";

export type StatusLevel = "operational" | "degraded" | "down" | "standby" | "not_connected";

export interface WorkspaceStatusComponent {
  key: string;
  name: string;
  group: "core" | "ci" | "ticketing" | "notifications";
  status: StatusLevel;
  uptime: number;
  latencyMs: number;
  detail: string;
  connected: boolean;
  pipelineReady?: boolean;
  liveTested?: boolean;
  webhookUrl?: string;
  icon?: string;
}

export interface WorkspaceIncident {
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

export interface WorkspaceStatus {
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
  components: WorkspaceStatusComponent[];
  incidents: WorkspaceIncident[];
  primaryCi: { key: string; name: string; connected: boolean; status: StatusLevel; pipelineReady: boolean } | null;
}

function ciStatus(
  connected: boolean,
  pipelineReady: boolean,
  openaiConfigured: boolean,
  isPrimary: boolean,
): StatusLevel {
  if (!connected) return isPrimary ? "not_connected" : "not_connected";
  if (pipelineReady && openaiConfigured) return "operational";
  if (pipelineReady && !openaiConfigured) return "degraded";
  return "standby";
}

function worstLevel(levels: StatusLevel[]): "operational" | "degraded" | "down" {
  const rank: Record<StatusLevel, number> = {
    operational: 0,
    standby: 1,
    degraded: 2,
    not_connected: 3,
    down: 4,
  };
  const worst = levels.reduce((max, l) => (rank[l] > rank[max] ? l : max), "operational" as StatusLevel);
  if (worst === "down" || worst === "not_connected") return worst === "down" ? "down" : "degraded";
  if (worst === "degraded" || worst === "standby") return "degraded";
  return "operational";
}

const INCIDENT_AUDIT_ACTIONS = new Set([
  "Auto-revert (repeat failure)",
  "All integrations disconnected",
  "Validation failed",
  "API key regenerated",
]);

async function buildWorkspaceIncidents(organizationId: string): Promise<WorkspaceIncident[]> {
  const [fixes, auditRows, issues] = await Promise.all([
    prisma.fix.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.auditEntry.findMany({ where: { organizationId }, orderBy: { at: "desc" }, take: 80 }),
    prisma.issueRecord.findMany({
      where: {
        status: { in: ["escalated", "pending_review"] },
        fix: { organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const incidents: WorkspaceIncident[] = [];
  const seenFixIds = new Set<number>();

  for (const fix of fixes) {
    seenFixIds.add(fix.id);
    const base = {
      fixId: fix.id,
      repo: fix.repoName,
      branch: fix.branch,
      at: fix.createdAt.toISOString(),
      category: "fix" as const,
    };

    switch (fix.outcome) {
      case "escalated":
        incidents.push({
          ...base,
          id: `fix-${fix.id}-escalated`,
          title: `Fix escalated · ${fix.repoName}`,
          resolved: false,
          severity: "warning",
          summary: `${fix.branch} · ${fix.mode} · ${fix.rootCause.slice(0, 120)}${fix.rootCause.length > 120 ? "…" : ""}`,
        });
        break;
      case "reverted":
        incidents.push({
          ...base,
          id: `fix-${fix.id}-reverted`,
          title: `Fix reverted · ${fix.repoName}`,
          resolved: true,
          severity: "warning",
          summary: fix.outcomeText || `${fix.branch} · fix #${fix.id} rolled back`,
        });
        break;
      case "pending":
        incidents.push({
          ...base,
          id: `fix-${fix.id}-pending`,
          title: `PR awaiting review · ${fix.repoName}`,
          resolved: false,
          severity: "info",
          summary: `${fix.branch} · ${fix.mode} · confidence ${fix.confidence}%`,
        });
        break;
      case "merged":
        incidents.push({
          ...base,
          id: `fix-${fix.id}-merged`,
          title: `Fix merged · ${fix.repoName}`,
          resolved: true,
          severity: "info",
          summary: fix.outcomeText || `${fix.branch} · ${fix.mode} · auto-resolved`,
        });
        break;
      case "diagnose":
        incidents.push({
          ...base,
          id: `fix-${fix.id}-diagnose`,
          title: `Diagnosis only · ${fix.repoName}`,
          resolved: true,
          severity: "info",
          summary: `${fix.branch} · ${fix.rootCause.slice(0, 100)}${fix.rootCause.length > 100 ? "…" : ""}`,
        });
        break;
      default:
        break;
    }
  }

  for (const issue of issues) {
    if (seenFixIds.has(issue.fixId)) continue;
    incidents.push({
      id: `issue-${issue.fixId}`,
      fixId: issue.fixId,
      repo: issue.repoLabel,
      branch: issue.branch,
      at: issue.createdAt.toISOString(),
      category: "fix",
      title: `${issue.status === "escalated" ? "Issue escalated" : "Review pending"} · ${issue.repoLabel}`,
      resolved: issue.status !== "escalated" && issue.status !== "pending_review",
      severity: issue.status === "escalated" ? "warning" : "info",
      summary: issue.title,
    });
  }

  for (const row of auditRows) {
    if (!INCIDENT_AUDIT_ACTIONS.has(row.action)) continue;
    if (row.fixId > 0 && seenFixIds.has(row.fixId) && row.action === "Auto-revert (repeat failure)") continue;

    const category =
      row.action === "All integrations disconnected" ? "integration" : row.action === "API key regenerated" ? "security" : "pipeline";

    incidents.push({
      id: `audit-${row.id}`,
      fixId: row.fixId > 0 ? row.fixId : undefined,
      at: row.at.toISOString(),
      category,
      title: row.action,
      resolved: true,
      severity: row.action === "All integrations disconnected" ? "critical" : row.action === "Validation failed" ? "warning" : "info",
      summary: `${row.actor} · ${row.outcome}${row.fixId > 0 ? ` · fix #${row.fixId}` : ""}`,
    });
  }

  incidents.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return incidents.slice(0, 50);
}

export async function getWorkspaceStatus(
  organizationId: string,
  options: { openaiConfigured: boolean; webhookUrl: (path: string) => string; sseClients: number },
): Promise<WorkspaceStatus> {
  const [integrations, repos, notificationRows, incidents] = await Promise.all([
    listIntegrations(organizationId),
    listRepos(organizationId),
    listNotificationChannels(organizationId),
    buildWorkspaceIncidents(organizationId),
  ]);

  const enabledRepos = repos.filter((r) => r.enabled).length;
  const components: WorkspaceStatusComponent[] = [];

  components.push(
    {
      key: "webhook-receiver",
      name: "Webhook receiver",
      group: "core",
      status: "operational",
      uptime: 99.98,
      latencyMs: 12,
      detail: "Accepts CI failure payloads on /webhooks/:platform",
      connected: true,
    },
    {
      key: "dashboard-api",
      name: "Dashboard & API",
      group: "core",
      status: "operational",
      uptime: 99.99,
      latencyMs: 45,
      detail: "Authenticated REST + SSE activity stream",
      connected: true,
    },
    {
      key: "gpt-diagnosis",
      name: "GPT-5.6 diagnosis API",
      group: "core",
      status: options.openaiConfigured ? "operational" : "degraded",
      uptime: options.openaiConfigured ? 99.91 : 95,
      latencyMs: 840,
      detail: options.openaiConfigured ? "OpenAI key configured for this workspace" : "Connect OpenAI in Settings → Models",
      connected: options.openaiConfigured,
    },
    {
      key: "codex-fix",
      name: "Codex fix-generation API",
      group: "core",
      status: options.openaiConfigured ? "operational" : "degraded",
      uptime: options.openaiConfigured ? 99.88 : 94,
      latencyMs: 1200,
      detail: options.openaiConfigured ? "Patch generation available when pipeline runs" : "Requires OpenAI API key",
      connected: options.openaiConfigured,
    },
  );

  const notificationsConfigured = notificationRows.filter((row) => {
    const config = row.config as Record<string, string>;
    const required = row.key === "slack" ? ["webhookUrl"] : ["host", "user", "pass"];
    return row.enabled && required.every((f) => Boolean(config[f]));
  }).length;

  components.push({
    key: "notification-dispatcher",
    name: "Notification dispatcher",
    group: "core",
    status: notificationsConfigured > 0 ? "operational" : "degraded",
    uptime: notificationsConfigured > 0 ? 99.95 : 97,
    latencyMs: 180,
    detail:
      notificationsConfigured > 0
        ? `${notificationsConfigured} channel(s) enabled`
        : "No notification channels enabled — configure in Settings",
    connected: notificationsConfigured > 0,
  });

  let primaryCi: WorkspaceStatus["primaryCi"] = null;
  let connectedCi = 0;

  for (const row of integrations) {
    const key = row.key as PlatformKey;
    const caps = PLATFORM_CAPABILITIES[key];
    const meta = PLATFORM_META[key];
    const isPrimary = key === "github";
    if (row.connected) connectedCi++;
    const status = ciStatus(row.connected, caps.pipelineReady, options.openaiConfigured, isPrimary);
    const detail = !row.connected
      ? "Not connected — add credentials in Settings → Integrations"
      : caps.pipelineReady && options.openaiConfigured
        ? "Live pipeline — webhooks + diagnosis + fix generation"
        : caps.pipelineReady && !options.openaiConfigured
          ? "Connected — OpenAI key required for auto-fix"
          : "Credentials saved — pipeline API not live-tested yet";

    if (isPrimary) {
      primaryCi = {
        key,
        name: pluginFor(key).displayName,
        connected: row.connected,
        status,
        pipelineReady: caps.pipelineReady,
      };
    }

    components.push({
      key,
      name: `${pluginFor(key).displayName} integration`,
      group: "ci",
      status,
      uptime: row.connected ? (caps.pipelineReady ? 99.9 : 99.5) : 0,
      latencyMs: key === "github" ? 95 : 150,
      detail,
      connected: row.connected,
      pipelineReady: caps.pipelineReady,
      liveTested: LIVE_TESTED_PLATFORMS.includes(key),
      webhookUrl: options.webhookUrl(caps.webhookPath),
      icon: meta.icon,
    });
  }

  for (const provider of TICKETING_PROVIDERS) {
    const key = provider.key as TicketingKey;
    const row = key === "jira" ? await getTicketingIntegration(organizationId, key) : null;
    const connected = Boolean(row?.connected);
    const liveTested = LIVE_TESTED_TICKETING.includes(key);
    components.push({
      key,
      name: `${provider.name} sync`,
      group: "ticketing",
      status: connected ? (liveTested ? "operational" : "standby") : "not_connected",
      uptime: connected ? 99.8 : 0,
      latencyMs: 420,
      detail: connected ? "Ticket create/update wired for fix outcomes" : provider.detail,
      connected,
      liveTested,
      pipelineReady: liveTested,
    });
  }

  for (const row of notificationRows) {
    const config = row.config as Record<string, string>;
    const required = row.key === "slack" ? ["webhookUrl"] : ["host", "user", "pass"];
    const configured = required.every((f) => Boolean(config[f]));
    components.push({
      key: row.key,
      name: row.key === "slack" ? "Slack notifications" : "Email notifications",
      group: "notifications",
      status: row.enabled && configured ? "operational" : configured ? "standby" : "not_connected",
      uptime: row.enabled && configured ? 99.9 : 0,
      latencyMs: row.key === "slack" ? 120 : 200,
      detail:
        row.enabled && configured
          ? "Delivering fix and escalation events"
          : configured
            ? "Configured but disabled in workspace"
            : "Not configured — Settings → Notifications",
      connected: configured,
      icon: row.key,
    });
  }

  const operationalComponents = components.filter((c) => c.status === "operational");
  const overallUptime =
    operationalComponents.length === 0
      ? 0
      : operationalComponents.reduce((sum, c) => sum + c.uptime, 0) / operationalComponents.length;

  const bannerLevel = worstLevel(components.map((c) => c.status));
  const banner =
    bannerLevel === "operational"
      ? "All monitored systems operational"
      : bannerLevel === "degraded"
        ? "Some systems need attention"
        : "Critical path not fully connected";

  const openIncidents = incidents.filter((i) => !i.resolved).length;
  const resolvedIncidents = incidents.filter((i) => i.resolved).length;

  return {
    banner,
    bannerLevel,
    checkedAt: new Date().toISOString(),
    stats: {
      overallUptime: Math.round(overallUptime * 100) / 100,
      connectedCi,
      totalCi: integrations.length,
      enabledRepos,
      totalRepos: repos.length,
      openaiConfigured: options.openaiConfigured,
      notificationsConfigured,
      liveListeners: options.sseClients,
      openIncidents,
      resolvedIncidents,
    },
    components,
    incidents,
    primaryCi,
  };
}
