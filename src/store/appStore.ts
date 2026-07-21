import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { BUILTIN_ROLES, resolveRoles, sortRoles, type RoleDefinition } from "../permissions.js";

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
import { generateIssueRecordMarkdown, type IssueRecord, type IssueStatus } from "../issues/issueRecord.js";
import { updateEnvSection } from "../config/env.js";
import {
  closeGithubPullRequest,
  mergeGithubPullRequest,
  parseGithubPullNumber,
  revertGithubFix,
} from "../platforms/github.js";
import type { Diagnosis, NormalizedFailure } from "../platforms/types.js";

export interface AuditEntry {
  fixId: number;
  at: string;
  action: string;
  actor: string;
  outcome: string;
}

function parseDiffLines(diffText: string): { ctx?: string; del?: string; add?: string }[] {
  if (!diffText) return [];
  return diffText.split("\n").map((line) => {
    if (line.startsWith("-")) return { del: line };
    if (line.startsWith("+")) return { add: line };
    return { ctx: line };
  });
}

function outcomeBadge(outcome: string): { label: string; cls: string; meter: string } {
  switch (outcome) {
    case "merged":
      return { label: "Merged", cls: "good", meter: "good" };
    case "pending":
      return { label: "Pending review", cls: "warn", meter: "warn" };
    case "escalated":
      return { label: "Escalated", cls: "critical", meter: "critical" };
    case "reverted":
      return { label: "Reverted", cls: "critical", meter: "critical" };
    default:
      return { label: "Diagnose only", cls: "blue", meter: "warn" };
  }
}

function serializeFix<T extends { id: number; repoName: string; diffText: string; outcome: string; createdAt?: Date }>(
  fix: T,
) {
  const badge = outcomeBadge(fix.outcome);
  const { repoName, diffText, createdAt, ...rest } = fix;
  return {
    ...rest,
    repo: repoName,
    at: createdAt?.toISOString?.() ?? new Date().toISOString(),
    diff: parseDiffLines(diffText),
    badgeLabel: badge.label,
    badgeClass: badge.cls,
    meterClass: badge.meter,
  };
}

function serializeIssue(issue: {
  id: number;
  fixId: number;
  slug: string;
  path: string;
  repoLabel: string;
  branch: string;
  title: string;
  status: string;
  confidence: number;
  ticketId: string | null;
  summary: string;
  diagnosis: string;
  markdown: string;
  createdAt?: Date;
}) {
  return {
    id: issue.id,
    fixId: issue.fixId,
    slug: issue.slug,
    path: issue.path,
    repo: issue.repoLabel,
    branch: issue.branch,
    title: issue.title,
    status: issue.status,
    confidence: issue.confidence,
    ticketId: issue.ticketId ?? undefined,
    summary: issue.summary,
    diagnosis: issue.diagnosis,
    markdown: issue.markdown,
    createdAt: issue.createdAt?.toISOString?.(),
  };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "item"
  );
}

// ---------- Idempotency (process-lifetime only, not persisted — see jornal.md) ----------

const processedRuns = new Set<string>();

export function isRunProcessed(platform: string, runId: string): boolean {
  return processedRuns.has(`${platform}:${runId}`);
}

export function markRunProcessed(platform: string, runId: string): void {
  processedRuns.add(`${platform}:${runId}`);
}

// ---------- Fixes ----------

export async function listFixes(organizationId: string) {
  const fixes = await prisma.fix.findMany({ where: { organizationId }, orderBy: { id: "desc" } });
  return fixes.map(serializeFix);
}

export async function getFix(organizationId: string, id: number) {
  const fix = await prisma.fix.findFirst({ where: { id, organizationId } });
  return fix ? serializeFix(fix) : null;
}

export async function addPipelineFix(
  organizationId: string,
  input: {
    failure: { repo: string; branch: string };
    diagnosis: { rootCause: string; explanation: string; likelyFiles: string[] };
    diff: string;
    mode: string;
    outcome: string;
    confidence: number;
    outcomeText: string;
    prUrl?: string;
    ticket?: string;
    author?: string;
  },
) {
  const repo = await prisma.repo.findFirst({ where: { organizationId, fullName: input.failure.repo } });
  const fix = await prisma.fix.create({
    data: {
      organizationId,
      repoId: repo?.id,
      repoName: input.failure.repo,
      branch: input.failure.branch,
      author: input.author ?? "@stitch",
      confidence: input.confidence,
      outcome: input.outcome,
      mode: input.mode,
      rootCause: input.diagnosis.rootCause,
      files: input.diagnosis.likelyFiles,
      diffText: input.diff,
      outcomeText: input.outcomeText,
      ticket: input.ticket,
      prUrl: input.prUrl,
    },
  });
  return serializeFix(fix);
}

/** Most recent auto-merged fix for this repo+branch still inside the auto-revert window — used to power real auto-revert-on-repeat-failure (Settings → Rollback & safety). */
export async function findRecentMergedFix(organizationId: string, repoName: string, branch: string, sinceMs: number) {
  return prisma.fix.findFirst({
    where: { organizationId, repoName, branch, outcome: "merged", createdAt: { gte: new Date(Date.now() - sinceMs) } },
    orderBy: { createdAt: "desc" },
  });
}

export async function approveFix(organizationId: string, id: number) {
  const fix = await prisma.fix.findFirst({ where: { id, organizationId } });
  if (!fix) return null;
  if (fix.outcome !== "pending") {
    throw new Error("Only pending fixes can be approved");
  }

  const integration = await getIntegration(organizationId, "github");
  const prNumber = parseGithubPullNumber(fix.prUrl);
  if (integration?.connected && prNumber && !fix.prUrl?.includes("/pull/demo-")) {
    updateEnvSection("github", (integration.config as Record<string, string>) ?? {});
    try {
      await mergeGithubPullRequest(fix.repoName, prNumber);
    } catch (err) {
      throw new Error(`GitHub merge failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const outcomeText = `Approved — ${fix.outcomeText}`;
  const updated = await prisma.fix.update({ where: { id }, data: { outcome: "merged", outcomeText } });

  const issue = await prisma.issueRecord.findUnique({ where: { fixId: id } });
  if (issue) {
    await prisma.issueRecord.update({ where: { fixId: id }, data: { status: "merged" } });
  }

  await appendAudit(organizationId, { fixId: id, action: "Fix approved", actor: "Dashboard user", outcome: "Merged" });
  return serializeFix(updated);
}

export async function revertFix(organizationId: string, id: number, reason?: string) {
  const fix = await prisma.fix.findFirst({ where: { id, organizationId } });
  if (!fix) return null;
  if (fix.outcome !== "merged") {
    throw new Error("Only merged fixes can be reverted");
  }

  const integration = await getIntegration(organizationId, "github");
  const prNumber = parseGithubPullNumber(fix.prUrl);
  let githubNote = "";
  if (integration?.connected && prNumber && !fix.prUrl?.includes("/pull/demo-") && fix.diffText.trim()) {
    updateEnvSection("github", (integration.config as Record<string, string>) ?? {});
    try {
      const pr = await revertGithubFix(fix.repoName, fix.branch, fix.diffText, id, reason);
      githubNote = ` Revert PR #${pr.number} opened.`;
    } catch (err) {
      if (prNumber) {
        try {
          await closeGithubPullRequest(fix.repoName, prNumber);
          githubNote = " Original PR closed on GitHub.";
        } catch {
          githubNote = ` GitHub revert failed: ${err instanceof Error ? err.message : "unknown"}.`;
        }
      }
    }
  }

  const outcomeText = `Reverted${reason ? `: ${reason}` : ""}${githubNote} — ${fix.outcomeText}`;
  const updated = await prisma.fix.update({ where: { id }, data: { outcome: "reverted", outcomeText } });

  const issue = await prisma.issueRecord.findUnique({ where: { fixId: id } });
  if (issue) {
    await prisma.issueRecord.update({
      where: { fixId: id },
      data: { status: "reverted", markdown: `${issue.markdown}\n\n## Revert\n\nReverted at ${new Date().toISOString()}${reason ? `: ${reason}` : ""}\n` },
    });
  }

  await appendAudit(organizationId, { fixId: id, action: "Fix reverted", actor: "Dashboard user", outcome: "Reverted" });
  return serializeFix(updated);
}

export function mapIssueStatus(outcome: string): IssueStatus {
  switch (outcome) {
    case "merged":
      return "merged";
    case "pending":
      return "pending_review";
    case "escalated":
      return "escalated";
    case "reverted":
      return "reverted";
    default:
      return "open";
  }
}

// ---------- Issue records ----------

export async function listIssues(organizationId: string) {
  const issues = await prisma.issueRecord.findMany({
    where: { fix: { organizationId } },
    orderBy: { id: "desc" },
  });
  return issues.map(serializeIssue);
}

export async function getIssue(organizationId: string, id: number) {
  const issue = await prisma.issueRecord.findFirst({ where: { id, fix: { organizationId } } });
  return issue ? serializeIssue(issue) : null;
}

export async function upsertIssue(
  organizationId: string,
  fixId: number,
  failure: NormalizedFailure,
  diagnosis: Diagnosis,
  diff: string,
  status: IssueStatus,
  confidence: number,
  ticketId?: string,
) {
  const fix = await prisma.fix.findFirst({ where: { id: fixId, organizationId } });
  if (!fix) throw new Error(`Fix ${fixId} not found in organization`);

  const full = generateIssueRecordMarkdown(fixId, failure, diagnosis, diff, status, confidence, ticketId);
  return prisma.issueRecord.upsert({
    where: { fixId },
    update: {
      status,
      confidence,
      ticketId,
      summary: diagnosis.rootCause,
      diagnosis: diagnosis.explanation,
      markdown: full.markdown,
      title: full.title,
    },
    create: {
      fixId,
      slug: full.slug,
      path: full.path,
      repoLabel: failure.repo,
      branch: failure.branch,
      title: full.title,
      status,
      confidence,
      ticketId,
      summary: diagnosis.rootCause,
      diagnosis: diagnosis.explanation,
      markdown: full.markdown,
    },
  });
}

// ---------- Audit ----------

export async function listAudit(organizationId: string, fixId?: number) {
  const rows = await prisma.auditEntry.findMany({
    where: { organizationId, ...(fixId != null ? { fixId } : {}) },
    orderBy: { at: "asc" },
  });
  return rows.map((row) => ({
    fixId: row.fixId,
    at: row.at.toISOString(),
    action: row.action,
    actor: row.actor,
    outcome: row.outcome,
  }));
}

export async function listFixSummaries(organizationId: string) {
  const fixes = await prisma.fix.findMany({
    where: { organizationId },
    orderBy: { id: "desc" },
    select: { id: true, repoName: true, branch: true, outcome: true, createdAt: true },
  });
  return fixes.map((f) => ({
    id: f.id,
    repo: f.repoName,
    branch: f.branch,
    outcome: f.outcome,
    at: f.createdAt.toISOString(),
  }));
}

export async function appendAudit(organizationId: string, entry: Omit<AuditEntry, "at"> & { at?: string }) {
  return prisma.auditEntry.create({
    data: {
      organizationId,
      fixId: entry.fixId,
      action: entry.action,
      actor: entry.actor,
      outcome: entry.outcome,
      ...(entry.at ? { at: new Date(entry.at) } : {}),
    },
  });
}

// ---------- AI usage ----------

export async function getAiUsage(organizationId: string) {
  const usage = await prisma.aiUsage.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },
  });
  return usage;
}

export async function bumpAiUsage(organizationId: string, kind: "diagnosis" | "fix") {
  const usage = await getAiUsage(organizationId);
  const patch =
    kind === "diagnosis"
      ? { gptCalls: usage.gptCalls + 1, gptCost: Number((usage.gptCost + 0.06).toFixed(2)) }
      : { codexCalls: usage.codexCalls + 1, codexCost: Number((usage.codexCost + 0.29).toFixed(2)) };
  const updated = await prisma.aiUsage.update({ where: { organizationId }, data: patch });
  await prisma.aiUsage.update({
    where: { organizationId },
    data: { spent: Number((updated.gptCost + updated.codexCost).toFixed(2)) },
  });
}

// ---------- Repos ----------

export async function listRepos(organizationId: string, projectId?: string) {
  return prisma.repo.findMany({ where: { organizationId, ...(projectId ? { projectId } : {}) }, orderBy: { fullName: "asc" } });
}

export async function findRepoByFullName(organizationId: string, fullName: string) {
  return prisma.repo.findFirst({
    where: { organizationId, fullName },
    include: { project: true },
  });
}

/** Resolves which organization owns a repo, for unauthenticated webhook routing. */
export async function findOrganizationByRepo(fullName: string) {
  const repo = await prisma.repo.findFirst({ where: { fullName }, include: { organization: true } });
  return repo?.organization ?? null;
}

export async function isRepoEnabled(organizationId: string, fullName: string): Promise<boolean> {
  const repo = await prisma.repo.findFirst({ where: { organizationId, fullName }, select: { enabled: true } });
  if (!repo) return true;
  return repo.enabled;
}

export async function createRepo(organizationId: string, input: { fullName: string; provider: string; mode: string; projectId: string }) {
  return prisma.repo.create({
    data: {
      organizationId,
      projectId: input.projectId,
      fullName: input.fullName,
      provider: input.provider,
      mode: input.mode,
      policy: "Default",
      enabled: true,
    },
  });
}

export async function deleteRepo(organizationId: string, fullName: string) {
  const repo = await prisma.repo.findFirst({ where: { organizationId, fullName } });
  if (!repo) return false;
  const fixCount = await prisma.fix.count({ where: { repoId: repo.id } });
  if (fixCount > 0) {
    throw new Error(`Cannot remove ${fullName} — ${fixCount} fix record(s) exist. Disable the repo instead.`);
  }
  await prisma.repo.delete({ where: { id: repo.id } });
  return true;
}

export async function updateRepo(organizationId: string, fullName: string, patch: { enabled?: boolean; mode?: string; project?: string }) {
  const repo = await prisma.repo.findFirst({ where: { organizationId, fullName } });
  if (!repo) return null;
  if (patch.project) {
    const project = await prisma.project.findFirst({ where: { id: patch.project, organizationId } });
    if (!project) throw new Error(`Unknown project: ${patch.project}`);
  }
  const updated = await prisma.repo.update({
    where: { id: repo.id },
    data: {
      enabled: patch.enabled ?? undefined,
      mode: patch.mode ?? undefined,
      projectId: patch.project ?? undefined,
    },
  });
  return { ...updated, project: updated.projectId };
}

// ---------- Projects ----------

export async function ensureUnassignedProject(organizationId: string) {
  const existing = await prisma.project.findUnique({ where: { organizationId_slug: { organizationId, slug: "unassigned" } } });
  if (existing) return existing;
  return prisma.project.create({
    data: { organizationId, name: "Unassigned", slug: "unassigned", description: "Repos not yet assigned to a project.", defaultMode: "Notify only" },
  });
}

export async function listProjects(organizationId: string) {
  const projects = await prisma.project.findMany({ where: { organizationId }, include: { repos: true }, orderBy: { createdAt: "asc" } });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    defaultMode: p.defaultMode,
    createdAt: p.createdAt.toISOString(),
    repoCount: p.repos.length,
    repos: p.repos.map((r) => r.fullName),
  }));
}

export async function getProject(organizationId: string, id: string) {
  return prisma.project.findFirst({ where: { id, organizationId } });
}

export async function getProjectEnriched(organizationId: string, id: string) {
  const p = await prisma.project.findFirst({ where: { id, organizationId }, include: { repos: true } });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    defaultMode: p.defaultMode,
    createdAt: p.createdAt.toISOString(),
    repoCount: p.repos.length,
    repos: p.repos.map((r) => r.fullName).sort(),
  };
}

export async function createProject(organizationId: string, input: { name: string; description?: string; defaultMode?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Project name is required");
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let n = 2;
  while (await prisma.project.findUnique({ where: { organizationId_slug: { organizationId, slug } } })) {
    slug = `${baseSlug}-${n++}`;
  }
  const project = await prisma.project.create({
    data: {
      organizationId,
      name,
      slug,
      description: input.description?.trim() ?? "",
      defaultMode: input.defaultMode ?? "Diagnose & suggest",
    },
  });
  await appendAudit(organizationId, { fixId: 0, action: "Project created", actor: "Dashboard user", outcome: project.name });
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    defaultMode: project.defaultMode,
    createdAt: project.createdAt.toISOString(),
    repoCount: 0,
    repos: [] as string[],
  };
}

export async function updateProject(organizationId: string, id: string, patch: { name?: string; description?: string; defaultMode?: string }) {
  const project = await getProject(organizationId, id);
  if (!project) return null;
  return prisma.project.update({ where: { id }, data: patch });
}

export async function deleteProject(organizationId: string, id: string) {
  const project = await getProject(organizationId, id);
  if (!project) return false;
  if (project.slug === "unassigned") throw new Error("Cannot delete the Unassigned project");

  const totalProjects = await prisma.project.count({ where: { organizationId } });
  if (totalProjects <= 1) throw new Error("Cannot delete the last remaining project");

  const fallback = await ensureUnassignedProject(organizationId);
  await prisma.repo.updateMany({ where: { organizationId, projectId: id }, data: { projectId: fallback.id } });
  await prisma.project.delete({ where: { id } });
  await appendAudit(organizationId, { fixId: 0, action: "Project deleted", actor: "Dashboard user", outcome: project.name });
  return true;
}

// ---------- Integrations (CI/CD provider connections) ----------

export async function listIntegrations(organizationId: string) {
  const keys = ["github", "gitlab", "circleci", "jenkins", "bitbucket"];
  const rows = await prisma.integration.findMany({ where: { organizationId } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const key of keys) {
    if (!byKey.has(key)) {
      const created = await prisma.integration.create({ data: { organizationId, key, connected: false, config: {} } });
      byKey.set(key, created);
    }
  }
  return keys.map((key) => byKey.get(key)!);
}

export async function getIntegration(organizationId: string, key: string) {
  return prisma.integration.findUnique({ where: { organizationId_key: { organizationId, key } } });
}

export async function upsertIntegration(organizationId: string, key: string, patch: { connected?: boolean; config?: Record<string, unknown> }) {
  return prisma.integration.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { connected: patch.connected, config: toJson(patch.config) },
    create: { organizationId, key, connected: patch.connected ?? false, config: toJson(patch.config) ?? {} },
  });
}

export async function disconnectAllIntegrations(organizationId: string) {
  await prisma.integration.updateMany({ where: { organizationId }, data: { connected: false, config: {} } });
}

// ---------- Ticketing integrations (reuses the same Integration table, different key family) ----------

/** Only "jira" is ever persisted/created here — Linear/Asana/GitHub Issues stay static demo
 * entries on the frontend (see plan section 3), so they're deliberately not seeded as rows. */
export async function getTicketingIntegration(organizationId: string, key: string) {
  return prisma.integration.findUnique({ where: { organizationId_key: { organizationId, key } } });
}

export async function upsertTicketingIntegration(organizationId: string, key: string, patch: { connected?: boolean; config?: Record<string, unknown> }) {
  return prisma.integration.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { connected: patch.connected, config: toJson(patch.config) },
    create: { organizationId, key, connected: patch.connected ?? false, config: toJson(patch.config) ?? {} },
  });
}

// ---------- Notification channels ----------

export async function listNotificationChannels(organizationId: string) {
  const keys = ["slack", "email"];
  const rows = await prisma.notificationChannelConfig.findMany({ where: { organizationId } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const key of keys) {
    if (!byKey.has(key)) {
      const created = await prisma.notificationChannelConfig.create({ data: { organizationId, key, enabled: false, config: {} } });
      byKey.set(key, created);
    }
  }
  return keys.map((key) => byKey.get(key)!);
}

export async function getNotificationChannel(organizationId: string, key: string) {
  return prisma.notificationChannelConfig.findUnique({ where: { organizationId_key: { organizationId, key } } });
}

export async function upsertNotificationChannel(organizationId: string, key: string, patch: { enabled?: boolean; config?: Record<string, unknown> }) {
  return prisma.notificationChannelConfig.upsert({
    where: { organizationId_key: { organizationId, key } },
    update: { enabled: patch.enabled, config: toJson(patch.config) },
    create: { organizationId, key, enabled: patch.enabled ?? false, config: toJson(patch.config) ?? {} },
  });
}

// ---------- Organization / settings ----------

export async function getOrganization(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
}

export async function updatePreferences(organizationId: string, patch: Record<string, unknown>) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const merged = { ...(org.preferences as Record<string, unknown>), ...patch };
  return prisma.organization.update({ where: { id: organizationId }, data: { preferences: toJson(merged) } });
}

// ---------- Team & access (real, email-free invite links) ----------

export async function listTeam(organizationId: string) {
  const [members, invites] = await Promise.all([
    prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({ where: { organizationId, usedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const now = new Date();
  return {
    members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, createdAt: m.createdAt })),
    pendingInvites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      expired: i.expiresAt < now,
    })),
  };
}

export async function createInvite(organizationId: string, invitedBy: string, input: { email?: string; role?: string }) {
  const token = randomBytes(20).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return prisma.invite.create({
    data: { organizationId, token, email: input.email || null, role: input.role ?? "Developer", invitedBy, expiresAt },
  });
}

export async function revokeInvite(organizationId: string, id: string) {
  const invite = await prisma.invite.findFirst({ where: { id, organizationId } });
  if (!invite) return false;
  await prisma.invite.delete({ where: { id } });
  return true;
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token }, include: { organization: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

export async function markInviteUsed(id: string) {
  await prisma.invite.update({ where: { id }, data: { usedAt: new Date() } });
}

export async function updateMemberRole(organizationId: string, userId: string, role: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) return null;
  return prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function removeMember(organizationId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
  if (!user) return false;
  const total = await prisma.user.count({ where: { organizationId } });
  if (total <= 1) throw new Error("Cannot remove the last member of a workspace");
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

// ---------- Roles & permissions (real, stored in Organization.preferences.roles) ----------

export async function listRolesWithCounts(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const orgRoles = (org.preferences as Record<string, unknown> | null)?.roles as Record<string, RoleDefinition> | undefined;
  const roles = resolveRoles(orgRoles);

  const members = await prisma.user.findMany({ where: { organizationId }, select: { role: true } });
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.role, (counts.get(m.role) ?? 0) + 1);

  return sortRoles(
    Object.values(roles).map((r) => ({ ...r, members: counts.get(r.name) ?? 0 })),
  );
}

export async function upsertRole(
  organizationId: string,
  name: string,
  permissions: Record<string, boolean>,
  color?: string,
) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const orgRoles = (prefs.roles as Record<string, RoleDefinition>) ?? {};
  const existing = orgRoles[name];
  const updated: Record<string, RoleDefinition> = {
    ...orgRoles,
    [name]: {
      name,
      permissions: permissions as RoleDefinition["permissions"],
      custom: !(name in BUILTIN_ROLES),
      color: color ?? existing?.color ?? BUILTIN_ROLES[name]?.color,
      description: existing?.description ?? BUILTIN_ROLES[name]?.description,
    },
  };
  await prisma.organization.update({ where: { id: organizationId }, data: { preferences: toJson({ ...prefs, roles: updated }) } });
  return updated[name];
}

export async function deleteRole(organizationId: string, name: string) {
  if (name in BUILTIN_ROLES) throw new Error("Built-in roles can't be deleted");
  const inUse = await prisma.user.count({ where: { organizationId, role: name } });
  if (inUse > 0) throw new Error(`${inUse} member(s) still have this role — reassign them first`);

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const orgRoles = { ...((prefs.roles as Record<string, unknown>) ?? {}) };
  delete orgRoles[name];
  await prisma.organization.update({ where: { id: organizationId }, data: { preferences: toJson({ ...prefs, roles: orgRoles }) } });
}

export async function getOrgRoles(organizationId: string): Promise<Record<string, RoleDefinition>> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const orgRoles = (org.preferences as Record<string, unknown> | null)?.roles as Record<string, RoleDefinition> | undefined;
  return resolveRoles(orgRoles);
}

export interface OrgProfile {
  domain: string;
  industry: string;
  companySize: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: string;
}

const DEFAULT_ORG_PROFILE: OrgProfile = {
  domain: "",
  industry: "saas",
  companySize: "11-50",
  timezone: "America/Los_Angeles",
  dateFormat: "mdy",
  timeFormat: "12",
  weekStartsOn: "sun",
};

export async function getOrgProfile(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const stored = (prefs.orgProfile as Partial<OrgProfile> | undefined) ?? {};
  return {
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    ...DEFAULT_ORG_PROFILE,
    ...stored,
  };
}

export async function updateOrgProfile(organizationId: string, patch: Partial<OrgProfile & { name?: string }>) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.orgProfile as Partial<OrgProfile> | undefined) ?? {};
  const { name, ...profileFields } = patch;
  const orgProfile = { ...DEFAULT_ORG_PROFILE, ...existing, ...profileFields };
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...(name?.trim() ? { name: name.trim() } : {}),
      preferences: toJson({ ...prefs, orgProfile }),
    },
  });
  return getOrgProfile(organizationId);
}

export interface OrganizationOverview {
  profile: Awaited<ReturnType<typeof getOrgProfile>>;
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

export async function getOrganizationOverview(organizationId: string, options?: { includeBilling?: boolean }) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const [projects, repos, integrations, members, pendingInvites, profile] = await Promise.all([
    listProjects(organizationId),
    listRepos(organizationId),
    listIntegrations(organizationId),
    prisma.user.count({ where: { organizationId } }),
    prisma.invite.count({ where: { organizationId, usedAt: null, expiresAt: { gt: new Date() } } }),
    getOrgProfile(organizationId),
  ]);

  const { pluginFor } = await import("../platforms/registry.js");
  const { PLATFORM_CAPABILITIES } = await import("../platforms/integrationMeta.js");
  type PlatformKey = import("../platforms/types.js").PlatformKey;

  const stats = {
    members,
    pendingInvites,
    projects: projects.length,
    userProjects: projects.filter((p) => p.slug !== "unassigned").length,
    repos: repos.length,
    enabledRepos: repos.filter((r) => r.enabled).length,
    connectedIntegrations: integrations.filter((i) => i.connected).length,
    totalIntegrations: integrations.length,
  };

  if (options?.includeBilling) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const fixesThisMonth = await prisma.fix.count({ where: { organizationId, createdAt: { gte: monthStart } } });
    const includedFixes = org.plan === "Enterprise" ? 500 : org.plan === "Team" ? 200 : 50;
    Object.assign(stats, { fixesThisMonth, includedFixes });
  }

  return {
    profile,
    workspace: {
      id: org.id,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt.toISOString(),
    },
    stats,
    integrations: integrations.map((row) => {
      const key = row.key as PlatformKey;
      return {
        key,
        displayName: pluginFor(key).displayName,
        connected: row.connected,
        pipelineReady: PLATFORM_CAPABILITIES[key]?.pipelineReady ?? false,
      };
    }),
  } satisfies OrganizationOverview;
}

// ---------- User profile (personal prefs in org.preferences.userPreferences[userId]) ----------

export interface UserPersonalPreferences {
  timezone: "org" | string;
  dateFormat: "org" | "mdy" | "dmy" | "iso";
  language: string;
  notifyEscalation: boolean;
  notifyReview: boolean;
  notifyDigest: boolean;
}

const DEFAULT_USER_PREFERENCES: UserPersonalPreferences = {
  timezone: "org",
  dateFormat: "org",
  language: "en-us",
  notifyEscalation: true,
  notifyReview: true,
  notifyDigest: false,
};

function readUserPreferences(prefs: Record<string, unknown>, userId: string): UserPersonalPreferences {
  const all = (prefs.userPreferences as Record<string, Partial<UserPersonalPreferences>> | undefined) ?? {};
  return { ...DEFAULT_USER_PREFERENCES, ...all[userId] };
}

export async function getUserPersonalPreferences(organizationId: string, userId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  return readUserPreferences(prefs, userId);
}

export async function updateUserPersonalPreferences(
  organizationId: string,
  userId: string,
  patch: Partial<UserPersonalPreferences>,
) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const all = { ...((prefs.userPreferences as Record<string, UserPersonalPreferences>) ?? {}) };
  all[userId] = { ...readUserPreferences(prefs, userId), ...patch };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { preferences: toJson({ ...prefs, userPreferences: all }) },
  });
  return readUserPreferences({ ...prefs, userPreferences: all }, userId);
}

export async function updateUserAccount(userId: string, patch: { name?: string; email?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const name = patch.name?.trim();
  const email = patch.email?.trim().toLowerCase();
  if (email && email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new Error("That email is already in use");
  }
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
  });
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new Error("This account uses GitHub sign-in — set a password via GitHub account settings");
  const bcrypt = await import("bcryptjs");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new Error("Current password is incorrect");
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function getUserProfileBundle(
  organizationId: string,
  userId: string,
  currentSessionToken?: string,
) {
  const { listSessionsForUser } = await import("../auth/session.js");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { organization: true } });
  const orgProfile = await getOrgProfile(organizationId);
  const preferences = await getUserPersonalPreferences(organizationId, userId);
  const sessions = await listSessionsForUser(userId);
  const hasPassword = Boolean(user.passwordHash);
  const hasGithub = Boolean(user.githubId);
  const authMethod = hasPassword && hasGithub ? "both" : hasGithub ? "github" : "password";

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      githubUsername: user.githubUsername,
      authMethod,
      hasPassword,
    },
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
      plan: user.organization.plan,
    },
    orgLocale: {
      timezone: orgProfile.timezone,
      dateFormat: orgProfile.dateFormat,
      timeFormat: orgProfile.timeFormat,
    },
    preferences,
    sessions: sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: Boolean(currentSessionToken && s.token === currentSessionToken),
    })),
  };
}
