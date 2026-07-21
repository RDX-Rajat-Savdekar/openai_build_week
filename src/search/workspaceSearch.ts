import { prisma } from "../db/prisma.js";

export interface SearchResult {
  id: string;
  type: "fix" | "issue" | "repo" | "project" | "page";
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  tone?: "good" | "warn" | "critical" | "neutral";
}

const NAV_PAGES: { title: string; href: string; keywords: string[] }[] = [
  { title: "Dashboard", href: "/app/dashboard", keywords: ["dashboard", "home", "metrics", "overview"] },
  { title: "Fix log", href: "/app/fix-log", keywords: ["fix", "fixes", "log", "pipeline", "pr"] },
  { title: "Issue records", href: "/app/issues", keywords: ["issue", "issues", "records", "ticket"] },
  { title: "Audit trail", href: "/app/audit", keywords: ["audit", "trail", "history", "timeline"] },
  { title: "Status", href: "/app/status", keywords: ["status", "health", "integrations", "uptime"] },
  { title: "Changelog", href: "/app/changelog", keywords: ["changelog", "release", "notes"] },
  { title: "Reports", href: "/app/reports", keywords: ["reports", "digest", "incident"] },
  { title: "Settings", href: "/app/settings", keywords: ["settings", "config", "integrations", "rules"] },
  { title: "Projects", href: "/app/projects", keywords: ["projects", "repos", "repositories"] },
  { title: "Organization", href: "/app/organization", keywords: ["organization", "org", "team", "billing"] },
];

function outcomeBadge(outcome: string): string {
  switch (outcome) {
    case "merged":
      return "Merged";
    case "pending":
      return "Pending";
    case "escalated":
      return "Escalated";
    case "reverted":
      return "Reverted";
    default:
      return "Diagnose";
  }
}

function outcomeTone(outcome: string): SearchResult["tone"] {
  if (outcome === "merged") return "good";
  if (outcome === "escalated" || outcome === "reverted") return "critical";
  if (outcome === "pending") return "warn";
  return "neutral";
}

function matches(haystack: string, q: string): boolean {
  return haystack.toLowerCase().includes(q);
}

export async function searchWorkspace(
  organizationId: string,
  query: string,
  limit = 12,
): Promise<{ query: string; results: SearchResult[] }> {
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  if (!q) {
    const recentFixes = await prisma.fix.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const fix of recentFixes) {
      results.push({
        id: `fix:${fix.id}`,
        type: "fix",
        title: `Fix #${fix.id} · ${fix.repoName}`,
        subtitle: `${fix.branch} · ${fix.rootCause.split(".")[0] ?? fix.outcome}`,
        href: `/app/fix-log?fixId=${fix.id}`,
        badge: outcomeBadge(fix.outcome),
        tone: outcomeTone(fix.outcome),
      });
    }
    for (const page of NAV_PAGES.slice(0, 5)) {
      results.push({
        id: `page:${page.href}`,
        type: "page",
        title: page.title,
        subtitle: "Navigate",
        href: page.href,
        tone: "neutral",
      });
    }
    return { query: q, results: results.slice(0, limit) };
  }

  const [fixes, issues, repos, projects] = await Promise.all([
    prisma.fix.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.issueRecord.findMany({
      where: { fix: { organizationId } },
      orderBy: { id: "desc" },
      take: 40,
      include: { fix: { select: { id: true } } },
    }),
    prisma.repo.findMany({ where: { organizationId }, orderBy: { fullName: "asc" } }),
    prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
  ]);

  for (const fix of fixes) {
    const blob = `${fix.id} ${fix.repoName} ${fix.branch} ${fix.rootCause} ${fix.ticket ?? ""} ${fix.outcome}`;
    if (!matches(blob, q)) continue;
    results.push({
      id: `fix:${fix.id}`,
      type: "fix",
      title: `Fix #${fix.id} · ${fix.repoName}`,
      subtitle: `${fix.branch} · ${fix.rootCause.split(".")[0] ?? fix.outcome}`,
      href: `/app/fix-log?fixId=${fix.id}`,
      badge: outcomeBadge(fix.outcome),
      tone: outcomeTone(fix.outcome),
    });
    if (results.length >= limit) break;
  }

  if (results.length < limit) {
    for (const issue of issues) {
      const blob = `${issue.id} ${issue.title} ${issue.summary} ${issue.ticketId ?? ""} ${issue.repoLabel} ${issue.branch}`;
      if (!matches(blob, q)) continue;
      results.push({
        id: `issue:${issue.id}`,
        type: "issue",
        title: issue.title,
        subtitle: `${issue.repoLabel} · ${issue.branch}`,
        href: `/app/issues?fixId=${issue.fix.id}`,
        badge: issue.ticketId ?? `ISS-${issue.id}`,
        tone: issue.status === "merged" ? "good" : issue.status === "escalated" ? "critical" : "warn",
      });
      if (results.length >= limit) break;
    }
  }

  if (results.length < limit) {
    for (const repo of repos) {
      if (!matches(repo.fullName, q)) continue;
      results.push({
        id: `repo:${repo.id}`,
        type: "repo",
        title: repo.fullName,
        subtitle: `${repo.mode} · ${repo.enabled ? "enabled" : "disabled"}`,
        href: `/app/projects`,
        badge: repo.enabled ? "Active" : "Off",
        tone: repo.enabled ? "good" : "neutral",
      });
      if (results.length >= limit) break;
    }
  }

  if (results.length < limit) {
    for (const project of projects) {
      const blob = `${project.name} ${project.slug} ${project.description ?? ""}`;
      if (!matches(blob, q)) continue;
      results.push({
        id: `project:${project.id}`,
        type: "project",
        title: project.name,
        subtitle: project.description ?? "Project",
        href: `/app/projects`,
        tone: "neutral",
      });
      if (results.length >= limit) break;
    }
  }

  if (results.length < limit) {
    for (const page of NAV_PAGES) {
      const blob = `${page.title} ${page.keywords.join(" ")}`;
      if (!matches(blob, q)) continue;
      results.push({
        id: `page:${page.href}`,
        type: "page",
        title: page.title,
        subtitle: "Navigate",
        href: page.href,
        tone: "neutral",
      });
      if (results.length >= limit) break;
    }
  }

  return { query: q, results: results.slice(0, limit) };
}
