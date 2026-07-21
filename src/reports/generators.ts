import { prisma } from "../db/prisma.js";

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

export interface IncidentTimelineRow {
  at: string;
  time: string;
  label: string;
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
  timeline: IncidentTimelineRow[];
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

const PATTERN_RULES: { label: string; re: RegExp }[] = [
  { label: "Null references", re: /null reference|undefined|cannot read propert/i },
  { label: "Missing env variables", re: /env|secret|JWT_|process\.env/i },
  { label: "Test timeouts", re: /timeout|timed out|exceeded/i },
  { label: "Connection pool / DB", re: /pool|connection|database/i },
  { label: "Race conditions", re: /race|concurrent|double-/i },
  { label: "Cache issues", re: /cache|stampede|invalidation/i },
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function prRefFromFix(outcomeText: string, prUrl?: string | null): string | undefined {
  const m = outcomeText.match(/PR #(\d+)/i);
  if (m) return `PR #${m[1]}`;
  if (prUrl) {
    const urlMatch = prUrl.match(/\/pull\/(\d+)/);
    if (urlMatch) return `PR #${urlMatch[1]}`;
  }
  return undefined;
}

function severityFromConfidence(confidence: number, outcome: string): IncidentReport["severity"] {
  if (outcome === "escalated") return "high";
  if (confidence >= 85) return "low";
  if (confidence >= 60) return "medium";
  if (confidence >= 40) return "high";
  return "critical";
}

function severityLabel(sev: IncidentReport["severity"]): string {
  switch (sev) {
    case "low":
      return "Low severity";
    case "medium":
      return "Medium severity";
    case "high":
      return "High severity";
    default:
      return "Critical severity";
  }
}

function classifyRootCause(text: string): string | null {
  for (const rule of PATTERN_RULES) {
    if (rule.re.test(text)) return rule.label;
  }
  return null;
}

function incidentId(fixId: number, at: Date): string {
  const d = at.toISOString().slice(0, 10).replace(/-/g, "");
  return `INC-${d.slice(0, 4)}-${d.slice(4)}-${String(fixId).padStart(3, "0")}`;
}

function buildPrevention(rootCause: string, files: string[]): string {
  const hints: string[] = [];
  if (/secret|env|JWT_/i.test(rootCause)) {
    hints.push("add startup secret validation across all services");
    hints.push("add a CI-secret audit to PR checks");
  }
  if (/timeout/i.test(rootCause)) {
    hints.push("review integration-test timeouts and retry policies");
  }
  if (/pool|connection/i.test(rootCause)) {
    hints.push("add pool sizing alerts and connection timeout guards");
  }
  if (/race|concurrent/i.test(rootCause)) {
    hints.push("add advisory locks or idempotency keys on hot paths");
  }
  if (/cache/i.test(rootCause)) {
    hints.push("scope cache keys per tenant and add stampede protection");
  }
  if (files.some((f) => f.includes(".github/") || f.includes("ci.yml"))) {
    hints.push("keep CI workflow env vars in sync with local .env templates");
  }
  if (hints.length === 0) {
    hints.push("add regression tests around the failing code path");
    hints.push("document the failure mode in the team runbook");
  }
  return `Prevention recommendations (GPT-5.6): ${hints.join("; ")}.`;
}

function contributingFactors(rootCause: string, files: string[], mode: string): string[] {
  const factors: string[] = [];
  if (/env|secret/i.test(rootCause)) factors.push("Environment variable missing or misconfigured in CI");
  if (/guard|null|undefined/i.test(rootCause)) factors.push("No guard clause existed for the failing condition");
  if (/timeout/i.test(rootCause)) factors.push("Aggressive timeout or missing retry configuration");
  if (files.some((f) => f.includes(".github/"))) factors.push("CI workflow not updated alongside application changes");
  if (mode === "Autopilot") factors.push("Autopilot merged without extended soak time");
  if (factors.length === 0) factors.push("Failure surfaced in CI before production deploy");
  return factors.slice(0, 4);
}

function serviceHint(repo: string, files: string[]): string {
  const segment = files[0]?.split("/")[0] ?? repo.split("/").pop() ?? repo;
  return `${repo}, ${segment} service`;
}

export async function buildChangelog(organizationId: string): Promise<ChangelogEntry[]> {
  const fixes = await prisma.fix.findMany({
    where: { organizationId, outcome: "merged" },
    orderBy: { createdAt: "desc" },
  });

  const byDate = new Map<string, ChangelogEntry>();

  for (const fix of fixes) {
    const date = formatDate(fix.createdAt.toISOString());
    const entry = byDate.get(date) ?? { date, label: "Auto-patched", fixed: [], ci: [] };

    for (const file of fix.files.length ? fix.files : ["(no files listed)"]) {
      if (file.includes(".github/") || file.includes("ci.yml") || file.includes("workflow")) {
        const ciLine = `${file} — ${fix.rootCause.split(".")[0]}. Fix #${fix.id}.`;
        if (!entry.ci.includes(ciLine)) entry.ci.push(ciLine);
        continue;
      }
      entry.fixed.push({
        fixId: fix.id,
        repo: fix.repoName,
        file,
        summary: fix.rootCause.split(".")[0] ?? fix.rootCause,
        prRef: prRefFromFix(fix.outcomeText, fix.prUrl),
      });
    }

    if (entry.fixed.length === 0 && fix.files.length === 0) {
      entry.fixed.push({
        fixId: fix.id,
        repo: fix.repoName,
        file: fix.repoName,
        summary: fix.rootCause.split(".")[0] ?? fix.rootCause,
        prRef: prRefFromFix(fix.outcomeText, fix.prUrl),
      });
    }

    byDate.set(date, entry);
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function changelogToMarkdown(entries: ChangelogEntry[]): string {
  const lines: string[] = ["# Stitch changelog", ""];
  for (const entry of entries) {
    lines.push(`## ${entry.date} (${entry.label})`, "");
    if (entry.fixed.length) {
      lines.push("### Fixed", "");
      for (const item of entry.fixed) {
        const ref = [`Fix #${item.fixId}`, item.prRef].filter(Boolean).join(" · ");
        lines.push(`- **${item.file}** — ${item.summary}. _${ref}_`);
      }
      lines.push("");
    }
    if (entry.ci.length) {
      lines.push("### CI configuration", "");
      for (const ci of entry.ci) lines.push(`- ${ci}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export async function buildIncidentReport(organizationId: string, fixId: number): Promise<IncidentReport | null> {
  const fix = await prisma.fix.findFirst({ where: { id: fixId, organizationId } });
  if (!fix) return null;

  const audit = await prisma.auditEntry.findMany({
    where: { organizationId, fixId },
    orderBy: { at: "asc" },
  });

  const timeline: IncidentTimelineRow[] =
    audit.length > 0
      ? audit.map((row) => ({ at: row.at.toISOString(), time: formatTime(row.at.toISOString()), label: row.action }))
      : [
          { at: fix.createdAt.toISOString(), time: formatTime(fix.createdAt.toISOString()), label: "CI failure detected" },
          { at: fix.createdAt.toISOString(), time: formatTime(fix.createdAt.toISOString()), label: "Diagnosis and fix generated" },
        ];

  const start = audit[0]?.at ?? fix.createdAt;
  const end = audit.at(-1)?.at ?? fix.createdAt;
  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));

  const humanActors = audit.filter(
    (r) => r.actor.startsWith("@") || r.actor === "Dashboard user" || r.actor.toLowerCase().includes("github"),
  );
  let humanMinutes: number | null = null;
  const mergeRow = audit.find((r) => /merge/i.test(r.action));
  const prRow = audit.find((r) => /PR.*open/i.test(r.action));
  if (prRow && mergeRow) {
    humanMinutes = Math.max(1, Math.round((mergeRow.at.getTime() - prRow.at.getTime()) / 60_000));
  } else if (humanActors.length > 0) {
    humanMinutes = Math.max(1, Math.round(durationMinutes * 0.4));
  }

  const sev = severityFromConfidence(fix.confidence, fix.outcome);
  const resolvedLabel =
    fix.outcome === "merged"
      ? "Resolved autonomously"
      : fix.outcome === "reverted"
        ? "Reverted after merge"
        : fix.outcome === "escalated"
          ? "Escalated to human"
          : "Pending human review";

  const prevention = buildPrevention(fix.rootCause, fix.files);
  const factors = contributingFactors(fix.rootCause, fix.files, fix.mode);
  const id = incidentId(fix.id, fix.createdAt);

  const markdown = [
    `# ${id}`,
    "",
    `**${severityLabel(sev)}** · ${resolvedLabel}`,
    "",
    `Duration ${durationMinutes} min · ${serviceHint(fix.repoName, fix.files)} · Fix #${fix.id}`,
    "",
    "## Timeline",
    "",
    ...timeline.map((t) => `- ${t.time} — ${t.label}`),
    "",
    "## Root cause",
    "",
    fix.rootCause,
    "",
    "## Contributing factors",
    "",
    ...factors.map((f) => `- ${f}`),
    "",
    "> " + prevention,
    "",
    humanMinutes != null ? `Human involvement: ${humanMinutes} minutes (review + merge).` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id,
    fixId: fix.id,
    title: id,
    severity: sev,
    severityLabel: severityLabel(sev),
    resolvedLabel,
    durationMinutes,
    repo: fix.repoName,
    branch: fix.branch,
    serviceHint: serviceHint(fix.repoName, fix.files),
    timeline,
    rootCause: fix.rootCause,
    contributingFactors: factors,
    prevention,
    humanMinutes,
    markdown,
  };
}

export async function buildWeeklyDigest(organizationId: string, days = 7): Promise<WeeklyDigest> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);

  const fixes = await prisma.fix.findMany({
    where: { organizationId, createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: "desc" },
  });

  const issues = await prisma.issueRecord.findMany({
    where: { status: "escalated", fix: { organizationId, createdAt: { gte: start, lte: end } } },
    include: { fix: true },
    orderBy: { createdAt: "desc" },
  });

  const total = fixes.length;
  const merged = fixes.filter((f) => f.outcome === "merged").length;
  const diagnose = fixes.filter((f) => f.outcome === "diagnose" || f.mode === "Diagnose & suggest").length;
  const escalated = fixes.filter((f) => f.outcome === "escalated").length;
  const reverted = fixes.filter((f) => f.outcome === "reverted").length;
  const pending = fixes.filter((f) => f.outcome === "pending").length;

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const patternCounts = new Map<string, number>();
  for (const fix of fixes) {
    const label = classifyRootCause(fix.rootCause) ?? "Other failures";
    patternCounts.set(label, (patternCounts.get(label) ?? 0) + 1);
  }

  const maxCount = Math.max(1, ...patternCounts.values());
  const patterns: FailurePattern[] = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / maxCount) * 100) }));

  const topPattern = patterns[0]?.label ?? "failures";
  const recommendation = `Recommendation: ${topPattern.toLowerCase()} ${topPattern === "Other failures" ? "are" : "is"} your #1 failure type this week. Consider tightening guard rails and adding targeted tests — Codex can apply bulk hardening once enabled in Settings.`;

  const periodStart = start.toISOString().slice(0, 10);
  const periodEnd = end.toISOString().slice(0, 10);
  const title = `Weekly digest — ${periodStart} to ${periodEnd}`;

  const escalations = issues.map((i) => ({
    fixId: i.fixId,
    title: i.title,
    repo: i.repoLabel.split(" · ")[0] ?? i.repoLabel,
    summary: i.summary,
  }));

  const markdown = [
    `# ${title}`,
    "",
    `- Failures: ${total}`,
    `- Auto-fixed: ${merged} (${pct(merged)}%)`,
    `- Diagnose only: ${diagnose} (${pct(diagnose)}%)`,
    `- Escalated: ${escalated} (${pct(escalated)}%)`,
    `- Reverted: ${reverted} (${pct(reverted)}%)`,
    "",
    "## Top failure patterns",
    "",
    ...patterns.map((p) => `- ${p.label}: ${p.count}`),
    "",
    "## Escalations needing attention",
    "",
    ...(escalations.length ? escalations.map((e) => `- ${e.title} (${e.repo}) — ${e.summary}`) : ["- None this week"]),
    "",
    recommendation,
  ].join("\n");

  return {
    periodStart,
    periodEnd,
    title,
    totalFailures: total,
    autoFixed: merged,
    autoFixedPct: pct(merged),
    diagnoseOnly: diagnose,
    diagnoseOnlyPct: pct(diagnose),
    escalated,
    escalatedPct: pct(escalated),
    reverted,
    revertedPct: pct(reverted),
    pending,
    patterns,
    escalations,
    recommendation,
    markdown,
  };
}
