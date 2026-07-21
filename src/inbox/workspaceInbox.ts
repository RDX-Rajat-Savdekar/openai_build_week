import { getActivity } from "../notify/activityLog.js";
import { prisma } from "../db/prisma.js";

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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityLevel(type: string, urgent: boolean): InboxNotification["level"] {
  if (urgent || type === "diagnosis_failed" || type === "urgent_release_failure") return "critical";
  if (type === "fix_opened") return "warn";
  return "info";
}

function activityAction(event: { type: string; url: string }, fixId?: number): InboxNotification["action"] {
  if (fixId != null) {
    if (event.type === "diagnosis_failed" || event.type === "urgent_release_failure") {
      return { label: "Review", href: `/app/issues?fixId=${fixId}` };
    }
    return { label: "View fix", href: `/app/fix-log?fixId=${fixId}` };
  }
  if (event.url) return { label: "Open link", href: event.url };
  return { label: "View activity", href: "/app/audit" };
}

export async function getWorkspaceInbox(organizationId: string, limit = 20): Promise<{
  notifications: InboxNotification[];
  unreadCount: number;
  checkedAt: string;
}> {
  const notifications: InboxNotification[] = [];
  const seen = new Set<string>();

  const attentionFixes = await prisma.fix.findMany({
    where: { organizationId, outcome: { in: ["escalated", "pending"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  for (const fix of attentionFixes) {
    const id = `attention:${fix.id}`;
    seen.add(id);
    notifications.push({
      id,
      at: fix.createdAt.toISOString(),
      ago: timeAgo(fix.createdAt.toISOString()),
      repo: fix.repoName,
      branch: fix.branch,
      body:
        fix.outcome === "escalated"
          ? `Escalated — ${fix.rootCause.split(".")[0] ?? "needs review"}, confidence ${fix.confidence}%.`
          : fix.outcomeText.split(".")[0] ?? "PR waiting on your approval before it can merge.",
      badge: fix.ticket ?? `FIX-${fix.id}`,
      level: fix.outcome === "escalated" ? "critical" : "warn",
      action:
        fix.outcome === "pending"
          ? { label: "Review fix", href: `/app/fix-log?fixId=${fix.id}` }
          : { label: "Open issue", href: `/app/issues?fixId=${fix.id}` },
      kind: "attention",
    });
  }

  const recentMerged = await prisma.fix.findMany({
    where: {
      organizationId,
      outcome: "merged",
      createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  for (const fix of recentMerged) {
    const id = `success:${fix.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const pr = fix.outcomeText.match(/PR #(\d+)/i);
    notifications.push({
      id,
      at: fix.createdAt.toISOString(),
      ago: timeAgo(fix.createdAt.toISOString()),
      repo: fix.repoName,
      branch: fix.branch,
      body: pr
        ? `Fixed — ${pr[0]} merged automatically. CI green on the next run.`
        : `Fixed — ${fix.rootCause.split(".")[0] ?? "merged"}.`,
      badge: fix.ticket ?? undefined,
      level: "info",
      action: { label: "View fix", href: `/app/fix-log?fixId=${fix.id}` },
      kind: "success",
    });
  }

  for (const entry of getActivity()) {
    const id = `activity:${entry.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const fixMatch = entry.event.summary.match(/Fix #(\d+)/i);
    const fixId = fixMatch ? Number(fixMatch[1]) : undefined;
    notifications.push({
      id,
      at: entry.at,
      ago: timeAgo(entry.at),
      repo: entry.event.repo,
      branch: entry.event.branch,
      body: entry.event.summary,
      level: activityLevel(entry.event.type, entry.event.urgent),
      action: activityAction(entry.event, fixId),
      kind: "activity",
    });
    if (notifications.length >= limit + 5) break;
  }

  notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const sliced = notifications.slice(0, limit);

  return {
    notifications: sliced,
    unreadCount: sliced.filter((n) => n.level !== "info" || n.kind === "attention").length,
    checkedAt: new Date().toISOString(),
  };
}
