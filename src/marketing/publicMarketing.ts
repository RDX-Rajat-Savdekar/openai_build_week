import { env } from "../config/env.js";
import { getActivity } from "../notify/activityLog.js";
import { PLATFORM_CAPABILITIES, PLATFORM_META } from "../platforms/integrationMeta.js";
import { LIVE_TESTED_PLATFORMS } from "../platforms/connectFields.js";
import { pluginFor } from "../platforms/registry.js";
import { prisma } from "../db/prisma.js";

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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function categorizeRootCause(rootCause: string): string {
  const r = rootCause.toLowerCase();
  if (r.includes("null") || r.includes("undefined") || r.includes("reference")) return "Null / reference errors";
  if (r.includes("env") || r.includes("variable") || r.includes("secret")) return "Missing env / config";
  if (r.includes("timeout") || r.includes("timed out")) return "Test timeouts";
  if (r.includes("pool") || r.includes("connection") || r.includes("socket")) return "Connection / pool leaks";
  if (r.includes("type") || r.includes("syntax")) return "Type / syntax errors";
  return "Logic & regression";
}

function outcomeTone(outcome: string): PublicMarketingData["liveFeed"][0]["tone"] {
  if (outcome === "merged") return "good";
  if (outcome === "escalated" || outcome === "reverted") return "critical";
  if (outcome === "pending") return "warn";
  return "neutral";
}

export async function getPublicMarketingData(): Promise<PublicMarketingData> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [fixes, auditRows, orgCount, repoCount, mergedCount] = await Promise.all([
    prisma.fix.findMany({ orderBy: { createdAt: "desc" }, take: 120 }),
    prisma.auditEntry.findMany({ orderBy: { at: "asc" } }),
    prisma.organization.count(),
    prisma.repo.count({ where: { enabled: true } }),
    prisma.fix.count({ where: { outcome: "merged" } }),
  ]);

  const fixesToday = fixes.filter((f) => f.createdAt >= dayStart).length;
  const merged = fixes.filter((f) => f.outcome === "merged");
  const successRate = fixes.length ? Math.round((merged.length / fixes.length) * 100) : 74;

  const auditMap = new Map<number, { first: Date; last: Date }>();
  for (const row of auditRows) {
    const cur = auditMap.get(row.fixId);
    if (!cur) auditMap.set(row.fixId, { first: row.at, last: row.at });
    else {
      if (row.at < cur.first) cur.first = row.at;
      if (row.at > cur.last) cur.last = row.at;
    }
  }

  let totalSeconds = 0;
  let durationCount = 0;
  for (const fix of merged) {
    const audit = auditMap.get(fix.id);
    if (audit) {
      totalSeconds += Math.max(30, (audit.last.getTime() - audit.first.getTime()) / 1000);
      durationCount++;
    }
  }
  const avgSeconds = durationCount > 0 ? totalSeconds / durationCount : 134;
  const avgTimeToFix = formatDuration(avgSeconds);

  const manualMinutesPerFix = 45;
  const autoMinutesPerFix = avgSeconds / 60;
  const hoursSaved = Number(((mergedCount * (manualMinutesPerFix - autoMinutesPerFix)) / 60).toFixed(1));

  const categoryCounts = new Map<string, number>();
  for (const fix of fixes) {
    const cat = categorizeRootCause(fix.rootCause);
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }
  const catTotal = Math.max(1, [...categoryCounts.values()].reduce((a, b) => a + b, 0));
  const failureCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({
      label,
      pct: Math.round((count / catTotal) * 100),
      tone: (label.includes("Null") || label.includes("env") ? "good" : label.includes("timeout") ? "warn" : "critical") as
        | "good"
        | "warn"
        | "critical",
    }));

  const fixFeed = fixes.slice(0, 6).map((f) => ({
    id: `fix:${f.id}`,
    at: f.createdAt.toISOString(),
    ago: timeAgo(f.createdAt.toISOString()),
    repo: f.repoName,
    branch: f.branch,
    summary:
      f.outcome === "merged"
        ? `Fixed — ${f.rootCause.split(".")[0] ?? "merged"}`
        : f.outcome === "escalated"
          ? `Escalated — ${f.rootCause.split(".")[0] ?? "needs review"}`
          : f.outcomeText.split(".")[0] ?? f.rootCause.split(".")[0] ?? "Pipeline event",
    tone: outcomeTone(f.outcome),
  }));

  const activityFeed = getActivity().slice(0, 4).map((a) => ({
    id: `activity:${a.id}`,
    at: a.at,
    ago: timeAgo(a.at),
    repo: a.event.repo,
    branch: a.event.branch,
    summary: a.event.summary,
    tone: (a.event.urgent ? "critical" : a.event.type === "fix_opened" ? "warn" : "good") as
      | "good"
      | "warn"
      | "critical"
      | "neutral",
  }));

  const liveFeed = [...activityFeed, ...fixFeed]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const openaiConfigured = Boolean(env.openaiApiKey || env.anthropicApiKey);
  const githubOAuth = Boolean(env.githubOAuth.clientId && env.githubOAuth.clientSecret);
  const githubConnected = pluginFor("github").isConnected();
  const status: PublicMarketingData["platform"]["status"] =
    openaiConfigured && githubConnected ? "operational" : openaiConfigured || githubOAuth ? "degraded" : "degraded";
  const statusLabel =
    status === "operational"
      ? "All systems operational"
      : openaiConfigured
        ? "Platform online — connect CI to go live"
        : "Demo mode — add OpenAI or Claude key for full pipeline";

  const integrations = (Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map((key) => ({
    key,
    label: key === "github" ? "GitHub Actions" : key.charAt(0).toUpperCase() + key.slice(1),
    status: (PLATFORM_CAPABILITIES[key].pipelineReady
      ? "live"
      : LIVE_TESTED_PLATFORMS.includes(key as (typeof LIVE_TESTED_PLATFORMS)[number])
        ? "ready"
        : "planned") as "live" | "ready" | "planned",
  }));

  return {
    checkedAt: now.toISOString(),
    platform: {
      status,
      statusLabel,
      openaiConfigured,
      githubOAuth,
    },
    metrics: {
      successRate,
      avgTimeToFix,
      avgTimeSeconds: Math.round(avgSeconds),
      hoursSaved,
      totalFixes: fixes.length,
      mergedFixes: mergedCount,
      workspaces: Math.max(orgCount, 1),
      connectedRepos: repoCount,
      fixesToday,
      autoFixRateModel: 74,
    },
    liveFeed,
    failureCategories,
    integrations,
    marketContext: {
      industryMedianRestoreMinutes: 60,
      typicalManualFixMinutes: 45,
      doraEliteRestoreMinutes: 15,
      source: "DORA State of DevOps · Google Cloud, 2024 — median time to restore service",
    },
  };
}
