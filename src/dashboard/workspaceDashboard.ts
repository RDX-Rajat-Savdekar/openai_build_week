import { getActivity } from "../notify/activityLog.js";
import { getAiUsage, listRepos } from "../store/appStore.js";
import { prisma } from "../db/prisma.js";

export interface DashboardAttentionItem {
  fixId: number;
  repo: string;
  branch: string;
  summary: string;
  ago: string;
  assignee: string;
  ticket: string;
  level: "warn" | "critical";
}

export interface DashboardLiveFeedItem {
  id: string;
  at: string;
  repo: string;
  branch: string;
  summary: string;
  tone: "good" | "warn" | "critical" | "neutral";
  fixId?: number;
}

export interface DashboardBranchRow {
  pattern: string;
  incidents: number;
  detail: string;
}

export interface DashboardConfidenceSlice {
  label: string;
  pct: number;
  tone: "good" | "warn" | "critical";
}

export interface WorkspaceDashboard {
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
  sparklines: {
    success: number[];
    timeToFix: number[];
    hoursSaved: number[];
    incidents: number[];
  };
  weeklyActivity: { day: string; good: number; warn: number; critical: number }[];
  attention: DashboardAttentionItem[];
  liveFeed: DashboardLiveFeedItem[];
  branchActivity: DashboardBranchRow[];
  confidenceBreakdown: DashboardConfidenceSlice[];
  recentFixes: { id: number; repo: string; branch: string; outcome: string; confidence: number; badgeLabel: string }[];
  aiUsage: Awaited<ReturnType<typeof getAiUsage>>;
  repoStatus: { repo: string; mode: string; enabled: boolean }[];
  checkedAt: string;
  periodDays: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeAgo(iso: string | Date): string {
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

function branchPattern(branch: string): string {
  if (branch === "main" || branch === "master") return "main";
  if (branch.startsWith("feature/")) return "feature/*";
  if (branch.startsWith("release/")) return "release/*";
  if (branch.startsWith("hotfix/")) return "hotfix/*";
  if (branch === "dev" || branch === "develop") return "dev";
  return branch.includes("/") ? `${branch.split("/")[0]}/*` : branch;
}

function outcomeTone(outcome: string): DashboardLiveFeedItem["tone"] {
  if (outcome === "merged") return "good";
  if (outcome === "escalated" || outcome === "reverted") return "critical";
  if (outcome === "pending") return "warn";
  return "neutral";
}

function fixSummary(fix: { outcome: string; rootCause: string; outcomeText: string; confidence: number }): string {
  if (fix.outcome === "merged") {
    const pr = fix.outcomeText.match(/PR #(\d+)/i);
    return pr ? `Fixed — ${pr[0]} merged` : fix.rootCause.split(".")[0] ?? "Merged";
  }
  if (fix.outcome === "escalated") return `Escalated (${fix.confidence}% confidence)`;
  if (fix.outcome === "pending") return fix.outcomeText.split(".")[0] ?? "Pending review";
  if (fix.outcome === "reverted") return "Reverted after merge";
  return fix.rootCause.split(".")[0] ?? "Diagnose only";
}

function badgeLabel(outcome: string): string {
  switch (outcome) {
    case "merged":
      return "Merged";
    case "pending":
      return "Pending review";
    case "escalated":
      return "Escalated";
    case "reverted":
      return "Reverted";
    default:
      return "Diagnose only";
  }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sparkFromDaily(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(1, ...values);
  return values.map((v) => Math.round((v / max) * 20) + 2);
}

export async function getWorkspaceDashboard(
  organizationId: string,
  opts: { projectId?: string; days?: number } = {},
): Promise<WorkspaceDashboard> {
  const periodDays = opts.days && opts.days > 0 ? opts.days : 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 86_400_000);
  const prevStart = new Date(periodStart.getTime() - periodDays * 86_400_000);

  const repos = await listRepos(organizationId, opts.projectId);
  const repoNames = opts.projectId ? new Set(repos.map((r) => r.fullName)) : null;

  const fixWhere = {
    organizationId,
    createdAt: { gte: periodStart },
    ...(repoNames?.size ? { repoName: { in: [...repoNames] } } : {}),
  };
  const prevFixWhere = {
    organizationId,
    createdAt: { gte: prevStart, lt: periodStart },
    ...(repoNames?.size ? { repoName: { in: [...repoNames] } } : {}),
  };

  const [fixes, prevFixes, aiUsage, auditByFix] = await Promise.all([
    prisma.fix.findMany({
      where: fixWhere,
      orderBy: { createdAt: "desc" },
    }),
    prisma.fix.findMany({
      where: prevFixWhere,
    }),
    getAiUsage(organizationId),
    prisma.auditEntry.findMany({
      where: { organizationId },
      orderBy: { at: "asc" },
    }),
  ]);

  const auditMap = new Map<number, { first: Date; last: Date }>();
  for (const row of auditByFix) {
    const cur = auditMap.get(row.fixId);
    if (!cur) auditMap.set(row.fixId, { first: row.at, last: row.at });
    else {
      if (row.at < cur.first) cur.first = row.at;
      if (row.at > cur.last) cur.last = row.at;
    }
  }

  const merged = fixes.filter((f) => f.outcome === "merged");
  const prevMerged = prevFixes.filter((f) => f.outcome === "merged");
  const successRate = fixes.length ? Math.round((merged.length / fixes.length) * 100) : 0;
  const prevSuccessRate = prevFixes.length ? Math.round((prevMerged.length / prevFixes.length) * 100) : successRate;

  let totalFixSeconds = 0;
  let fixDurationCount = 0;
  for (const fix of merged) {
    const audit = auditMap.get(fix.id);
    if (audit) {
      totalFixSeconds += Math.max(30, (audit.last.getTime() - audit.first.getTime()) / 1000);
      fixDurationCount++;
    }
  }
  const avgSeconds = fixDurationCount > 0 ? totalFixSeconds / fixDurationCount : 134;
  const avgTimeToFix = formatDuration(avgSeconds);

  const manualMinutesPerFix = 45;
  const autoMinutesPerFix = avgSeconds / 60;
  const hoursSaved = Number(((merged.length * (manualMinutesPerFix - autoMinutesPerFix)) / 60).toFixed(1));
  const prevHoursSaved = Number(
    ((prevMerged.length * (manualMinutesPerFix - autoMinutesPerFix)) / 60).toFixed(1),
  );

  const attentionFixes = fixes
    .filter((f) => f.outcome === "escalated" || f.outcome === "pending")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const attention: DashboardAttentionItem[] = attentionFixes.slice(0, 8).map((f) => ({
    fixId: f.id,
    repo: f.repoName,
    branch: f.branch,
    summary:
      f.outcome === "escalated"
        ? `${f.rootCause.split(".")[0] ?? "Escalated"} — confidence ${f.confidence}%`
        : f.outcomeText.split(".")[0] ?? "Pending review",
    ago: timeAgo(f.createdAt),
    assignee: f.author,
    ticket: f.ticket ?? `FIX-${f.id}`,
    level: f.outcome === "escalated" ? "critical" : "warn",
  }));

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weeklyActivity = DAY_LABELS.map((day) => ({ day, good: 0, warn: 0, critical: 0 }));
  for (const fix of fixes) {
    if (fix.createdAt < weekStart) continue;
    const idx = fix.createdAt.getDay();
    const bucket = weeklyActivity[idx]!;
    if (fix.outcome === "merged") bucket.good++;
    else if (fix.outcome === "escalated" || fix.outcome === "reverted") bucket.critical++;
    else bucket.warn++;
  }
  const orderedWeek = [...weeklyActivity.slice(1), weeklyActivity[0]!];

  const branchCounts = new Map<string, { total: number; merged: number }>();
  for (const fix of fixes) {
    const pattern = branchPattern(fix.branch);
    const cur = branchCounts.get(pattern) ?? { total: 0, merged: 0 };
    cur.total++;
    if (fix.outcome === "merged") cur.merged++;
    branchCounts.set(pattern, cur);
  }
  const branchActivity: DashboardBranchRow[] = Array.from(branchCounts.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([pattern, { total, merged: m }]) => ({
      pattern,
      incidents: total,
      detail: total ? `${Math.round((m / total) * 100)}% auto-fixed` : "no incidents",
    }));

  const high = fixes.filter((f) => f.confidence >= 80).length;
  const mid = fixes.filter((f) => f.confidence >= 50 && f.confidence < 80).length;
  const low = fixes.filter((f) => f.confidence < 50).length;
  const confTotal = Math.max(1, high + mid + low);
  const confidenceBreakdown: DashboardConfidenceSlice[] = [
    { label: "High (≥80%)", pct: Math.round((high / confTotal) * 100), tone: "good" as const },
    { label: "Medium (50–79%)", pct: Math.round((mid / confTotal) * 100), tone: "warn" as const },
    { label: "Low (<50%)", pct: Math.round((low / confTotal) * 100), tone: "critical" as const },
  ].filter((c) => c.pct > 0);

  const fixFeed: DashboardLiveFeedItem[] = fixes.slice(0, 12).map((f) => ({
    id: `fix-${f.id}`,
    at: f.createdAt.toISOString(),
    repo: f.repoName,
    branch: f.branch,
    summary: fixSummary(f),
    tone: outcomeTone(f.outcome),
    fixId: f.id,
  }));

  const activityFeed: DashboardLiveFeedItem[] = getActivity()
    .filter((a) => !repoNames?.size || repoNames.has(a.event.repo))
    .slice(0, 8)
    .map((a) => ({
      id: `act-${a.id}`,
      at: a.at,
      repo: a.event.repo,
      branch: a.event.branch,
      summary: a.event.summary,
      tone: a.event.urgent ? "critical" : ("good" as const),
    }));

  const liveFeed = [...activityFeed, ...fixFeed]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);

  const dailySuccess: number[] = [];
  const dailyIncidents: number[] = [];
  const dailyHours: number[] = [];
  const dailyTime: number[] = [];
  for (let i = 10; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayFixes = fixes.filter((f) => dayKey(f.createdAt) === key);
    const dayMerged = dayFixes.filter((f) => f.outcome === "merged");
    dailyIncidents.push(dayFixes.length);
    dailySuccess.push(dayFixes.length ? Math.round((dayMerged.length / dayFixes.length) * 100) : 0);
    dailyHours.push(Number(((dayMerged.length * (manualMinutesPerFix - autoMinutesPerFix)) / 60).toFixed(1)));
    dailyTime.push(dayMerged.length ? avgSeconds : 0);
  }

  return {
    stats: {
      successRate,
      successDelta: successRate - prevSuccessRate,
      avgTimeToFix,
      avgTimeDelta: -Math.round((avgSeconds - 152) / 1),
      hoursSaved: Math.max(0, hoursSaved),
      hoursDelta: Number((hoursSaved - prevHoursSaved).toFixed(1)),
      totalIncidents: fixes.length,
      incidentsDelta: fixes.length - prevFixes.length,
      attentionOpen: attentionFixes.length,
    },
    sparklines: {
      success: sparkFromDaily(dailySuccess),
      timeToFix: sparkFromDaily(dailyTime.map((t) => (t ? 200 - t : 0))),
      hoursSaved: sparkFromDaily(dailyHours),
      incidents: sparkFromDaily(dailyIncidents),
    },
    weeklyActivity: orderedWeek,
    attention,
    liveFeed,
    branchActivity,
    confidenceBreakdown:
      confidenceBreakdown.length > 0
        ? confidenceBreakdown
        : [{ label: "No fixes yet", pct: 100, tone: "good" as const }],
    recentFixes: fixes.slice(0, 6).map((f) => ({
      id: f.id,
      repo: f.repoName,
      branch: f.branch,
      outcome: f.outcome,
      confidence: f.confidence,
      badgeLabel: badgeLabel(f.outcome),
    })),
    aiUsage,
    repoStatus: repos.map((r) => ({ repo: r.fullName, mode: r.mode, enabled: r.enabled })),
    checkedAt: now.toISOString(),
    periodDays,
  };
}
