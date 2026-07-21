import { randomBytes, createHash } from "node:crypto";
import { Router, type Response } from "express";
import { applyAiConfig, buildAiSettingsResponse, disconnectProviderPatch, isAiConfigured, mergeAiPreferences, readAiPreferences, resolveTestCredentials, toLegacyOpenaiBlob } from "./ai/config.js";
import { testAiProvider } from "./ai/testConnection.js";
import type { AiPreferences, AiProvider } from "./ai/types.js";
import { STITCH_TEST_REPO } from "./config/testRepo.js";
import { clearEnvSection, env, setOpenAiKey, setOpenAiModels, updateEnvSection, type EnvSection } from "./config/env.js";
import { resolveAppOrigin } from "./config/appOrigin.js";
import { getWorkspaceDashboard } from "./dashboard/workspaceDashboard.js";
import { getWorkspaceInbox } from "./inbox/workspaceInbox.js";
import { TICKETING_PROVIDERS } from "./data/demoData.js";
import { CHANNEL_FIELDS } from "./notify/connectFields.js";
import { allChannels, CHANNELS, notify, sendTestNotification } from "./notify/index.js";
import { getActivity } from "./notify/activityLog.js";
import type { NotificationChannelKey } from "./notify/types.js";
import { CONNECT_FIELDS, LIVE_TESTED_PLATFORMS } from "./platforms/connectFields.js";
import { PLATFORM_CAPABILITIES, PLATFORM_META } from "./platforms/integrationMeta.js";
import { testPlatformConnection } from "./platforms/testConnection.js";
import { pluginFor } from "./platforms/registry.js";
import { PipelineSkippedError } from "./pipeline/errors.js";
import type { PlatformKey } from "./platforms/types.js";
import { resolveGithubToken, syncGithubRepos } from "./platforms/githubSync.js";
import { DEFAULT_BRANCH_RULES, isUiModeLabel, type BranchRule } from "./router/branchRouter.js";
import { TICKETING_CONNECT_FIELDS, LIVE_TESTED_TICKETING } from "./ticketing/connectFields.js";
import { ticketingPluginFor } from "./ticketing/registry.js";
import type { TicketingKey } from "./ticketing/types.js";
import { addSseClient, broadcast, sseCount } from "./realtime/sse.js";
import { getWorkspaceStatus } from "./status/workspaceStatus.js";
import { searchWorkspace } from "./search/workspaceSearch.js";
import type { NormalizedFailure } from "./platforms/types.js";
import { runPipeline } from "./pipeline/runPipeline.js";
import {
  appendAudit,
  approveFix,
  createProject,
  createRepo,
  deleteProject,
  deleteRepo,
  deleteRole,
  createInvite,
  disconnectAllIntegrations,
  ensureUnassignedProject,
  getAiUsage,
  getFix,
  getIntegration,
  getIssue,
  getNotificationChannel,
  getOrganization,
  getOrganizationOverview,
  getOrgRoles,
  getOrgProfile,
  updateOrgProfile,
  getProject,
  getProjectEnriched,
  getTicketingIntegration,
  getUserProfileBundle,
  updateUserAccount,
  updateUserPassword,
  updateUserPersonalPreferences,
  listAudit,
  listFixes,
  listFixSummaries,
  listIntegrations,
  listIssues,
  listNotificationChannels,
  listProjects,
  listRepos,
  listRolesWithCounts,
  listTeam,
  removeMember,
  revertFix,
  revokeInvite,
  updateMemberRole,
  updatePreferences,
  updateProject,
  updateRepo,
  upsertRole,
  upsertIntegration,
  upsertNotificationChannel,
  upsertTicketingIntegration,
} from "./store/appStore.js";
import {
  buildChangelog,
  buildIncidentReport,
  buildWeeklyDigest,
  changelogToMarkdown,
} from "./reports/generators.js";
import {
  deleteStoredReport,
  findReportByShareToken,
  listStoredReports,
  shareStoredReport,
  storeReport,
} from "./store/reportsStore.js";
import { prisma } from "./db/prisma.js";

export const apiRouter = Router();

const PLATFORM_META_LEGACY = PLATFORM_META;

function integrationWebhookUrl(req: { protocol: string; get: (h: string) => string | undefined }, path: string): string {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:3000";
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${host}${path}`;
}

function maskConfig(config: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (!v) continue;
    out[k] = v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
  }
  return out;
}

function isPlatformKey(value: string): value is PlatformKey {
  return value in CONNECT_FIELDS;
}

function isChannelKey(value: string): value is NotificationChannelKey {
  return value in CHANNEL_FIELDS;
}

function orgId(req: { org?: { id: string } }): string {
  // requireAuth (mounted in server.ts before apiRouter) guarantees req.org is set.
  return req.org!.id;
}

/** Seeds the shared global env from this org's stored config so plugin/OpenAI
 * calls issued during THIS request see the right credentials. See the longer
 * note in pipeline/runPipeline.ts's applyOrgConfig — same tradeoff, applied
 * here for direct API actions (test-send, OpenAI test) rather than pipeline runs. */
async function seedEnvForOrg(organizationId: string, platform?: PlatformKey) {
  if (platform) {
    const integration = await prisma.integration.findUnique({ where: { organizationId_key: { organizationId, key: platform } } });
    if (integration?.config && Object.keys(integration.config as object).length > 0) {
      updateEnvSection(platform as EnvSection, integration.config as Record<string, string>);
    }
  }
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  applyAiConfig(readAiPreferences(prefs));
  return org;
}

// --- Integrations ---

apiRouter.get("/integrations", async (req, res) => {
  const organizationId = orgId(req);
  const [rows, repos] = await Promise.all([listIntegrations(organizationId), listRepos(organizationId)]);
  res.json(
    rows.map((row) => {
      const key = row.key as PlatformKey;
      const caps = PLATFORM_CAPABILITIES[key];
      const config = (row.config as Record<string, string>) ?? {};
      return {
        key,
        displayName: pluginFor(key).displayName,
        connected: row.connected,
        liveTested: LIVE_TESTED_PLATFORMS.includes(key),
        pipelineReady: caps.pipelineReady,
        capabilities: caps,
        fields: CONNECT_FIELDS[key],
        icon: PLATFORM_META_LEGACY[key].icon,
        subtitle: PLATFORM_META_LEGACY[key].subtitle,
        repoCount: repos.filter((r) => r.provider.toLowerCase() === key || (key === "github" && r.provider === "GitHub")).length,
        webhookUrl: integrationWebhookUrl(req, caps.webhookPath),
        configPreview: row.connected ? maskConfig(config) : {},
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  );
});

apiRouter.post("/integrations/:key/connect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isPlatformKey(key)) {
    res.status(404).json({ error: `unknown platform: ${key}` });
    return;
  }

  const allowedFields = new Set(CONNECT_FIELDS[key].map((f) => f.name));
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, string> = {};
  for (const [field, value] of Object.entries(body)) {
    if (allowedFields.has(field) && typeof value === "string" && value.length > 0) {
      patch[field] = value;
    }
  }

  const requiredFields = CONNECT_FIELDS[key].map((f) => f.name);
  const connected = requiredFields.every((f) => Boolean(patch[f]));

  await upsertIntegration(organizationId, key, { connected, config: patch });
  updateEnvSection(key as EnvSection, patch);
  if (connected) {
    broadcast("integration", { key, connected: true });
  }
  res.json({ key, connected });
});

apiRouter.post("/integrations/:key/disconnect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isPlatformKey(key)) {
    res.status(404).json({ error: `unknown platform: ${key}` });
    return;
  }
  await upsertIntegration(organizationId, key, { connected: false, config: {} });
  clearEnvSection(key as EnvSection);
  broadcast("integration", { key, connected: false });
  res.json({ key, connected: false });
});

async function runGithubSync(req: { org?: { id: string }; user?: { githubAccessToken: string | null } }, res: Response) {
  const organizationId = orgId(req);
  const token = await resolveGithubToken(organizationId, req.user);
  if (!token) {
    res.status(400).json({ error: "Connect a GitHub personal access token, or sign in with GitHub, before syncing repos" });
    return;
  }
  try {
    const result = await syncGithubRepos(organizationId, token);
    broadcast("activity", getActivity()[0]);
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "GitHub sync failed" });
  }
}

apiRouter.post("/integrations/github/sync", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  await runGithubSync(req, res);
});

apiRouter.post("/integrations/:key/sync", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const { key } = req.params;
  if (!isPlatformKey(key)) {
    res.status(404).json({ error: `unknown platform: ${key}` });
    return;
  }
  if (!PLATFORM_CAPABILITIES[key].syncRepos) {
    res.status(400).json({ error: `${pluginFor(key).displayName} repo sync is not available yet` });
    return;
  }
  if (key === "github") {
    await runGithubSync(req, res);
    return;
  }
  res.status(501).json({ error: "Repo sync not implemented for this provider" });
});

apiRouter.post("/integrations/:key/test", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isPlatformKey(key)) {
    res.status(404).json({ error: `unknown platform: ${key}` });
    return;
  }

  await seedEnvForOrg(organizationId, key);
  const integration = await getIntegration(organizationId, key);
  const config = (integration?.config as Record<string, string>) ?? {};
  const body = (req.body ?? {}) as Record<string, string>;
  const merged = { ...config, ...Object.fromEntries(Object.entries(body).filter(([, v]) => typeof v === "string" && v.trim())) };

  const result = await testPlatformConnection(key, merged);
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// --- Notifications ---

apiRouter.get("/notifications", async (req, res) => {
  const organizationId = orgId(req);
  const rows = await listNotificationChannels(organizationId);
  res.json(
    rows.map((row) => {
      const key = row.key as NotificationChannelKey;
      const config = row.config as Record<string, string>;
      const requiredFields = CHANNEL_FIELDS[key].map((f) => f.name);
      const configured = requiredFields.every((f) => Boolean(config[f]));
      return {
        key,
        displayName: CHANNELS[key].displayName,
        configured,
        workspaceEnabled: row.enabled,
        fields: CHANNEL_FIELDS[key],
        icon: key,
      };
    }),
  );
});

apiRouter.post("/notifications/:key", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isChannelKey(key)) {
    res.status(404).json({ error: `unknown channel: ${key}` });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const allowedFields = new Set(CHANNEL_FIELDS[key].map((f) => f.name));
  const patch: Record<string, string> = {};
  for (const [field, value] of Object.entries(body)) {
    if (allowedFields.has(field) && typeof value === "string" && value.length > 0) {
      patch[field] = field === "smtpPort" ? String(Number(value) || 587) : value;
    }
  }

  const existing = await getNotificationChannel(organizationId, key);
  const config = { ...((existing?.config as Record<string, string>) ?? {}), ...patch };
  const enabled = typeof body.enabled === "boolean" ? body.enabled : (existing?.enabled ?? false);

  await upsertNotificationChannel(organizationId, key, { enabled, config });
  if (Object.keys(patch).length > 0) updateEnvSection(key as EnvSection, config);

  const requiredFields = CHANNEL_FIELDS[key].map((f) => f.name);
  const configured = requiredFields.every((f) => Boolean(config[f]));
  res.json({ key, configured, workspaceEnabled: enabled });
});

apiRouter.post("/notifications/:key/test", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isChannelKey(key)) {
    res.status(404).json({ error: `unknown channel: ${key}` });
    return;
  }
  const channelRow = await getNotificationChannel(organizationId, key);
  const config = (channelRow?.config as Record<string, string>) ?? {};
  updateEnvSection(key as EnvSection, config);

  if (!CHANNELS[key].isEnabled()) {
    res.status(400).json({ error: `${key} is not configured yet` });
    return;
  }

  const result = await sendTestNotification(key);
  if (result.ok) {
    broadcast("activity", getActivity()[0]);
  }
  res.status(result.ok ? 200 : 502).json(result);
});

// --- Activity ---

apiRouter.get("/activity", (_req, res) => {
  res.json(getActivity());
});

apiRouter.get("/search", async (req, res) => {
  const organizationId = orgId(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 12;
  const limit = Number.isFinite(limitRaw) ? Math.min(24, Math.max(1, limitRaw)) : 12;
  res.json(await searchWorkspace(organizationId, q, limit));
});

apiRouter.get("/inbox", async (req, res) => {
  const organizationId = orgId(req);
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 20;
  const limit = Number.isFinite(limitRaw) ? Math.min(40, Math.max(1, limitRaw)) : 20;
  res.json(await getWorkspaceInbox(organizationId, limit));
});

// --- Dashboard ---

apiRouter.get("/dashboard", async (req, res) => {
  const organizationId = orgId(req);
  const projectId = typeof req.query.project === "string" ? req.query.project : undefined;
  const daysRaw = typeof req.query.days === "string" ? Number(req.query.days) : 30;
  const days = [7, 30, 90].includes(daysRaw) ? daysRaw : 30;
  res.json(await getWorkspaceDashboard(organizationId, { projectId, days }));
});

// --- Fix log ---

apiRouter.get("/fixes", async (req, res) => {
  res.json(await listFixes(orgId(req)));
});

apiRouter.get("/fixes/:id", async (req, res) => {
  const fix = await getFix(orgId(req), Number(req.params.id));
  if (!fix) {
    res.status(404).json({ error: "Fix not found" });
    return;
  }
  res.json(fix);
});

apiRouter.post("/fixes/:id/approve", async (req, res) => {
  if (!(await requirePermission(req, res, "approve_autopilot"))) return;
  const organizationId = orgId(req);
  const id = Number(req.params.id);
  try {
    const fix = await approveFix(organizationId, id);
    if (!fix) {
      res.status(404).json({ error: "Fix not found" });
      return;
    }
    broadcast("activity", getActivity()[0]);
    res.json(fix);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Approve failed" });
  }
});

apiRouter.post("/fixes/:id/revert", async (req, res) => {
  if (!(await requirePermission(req, res, "revert_fix"))) return;
  const organizationId = orgId(req);
  const id = Number(req.params.id);
  const body = (req.body ?? {}) as { reason?: string };

  const rollbackOrg = await getOrganization(organizationId);
  const rollbackPrefs = ((rollbackOrg.preferences as Record<string, unknown>)?.rollback as { revertRequiresReason?: boolean } | undefined) ?? {};
  if (rollbackPrefs.revertRequiresReason && !body.reason?.trim()) {
    res.status(400).json({ error: "A reason is required to revert this fix" });
    return;
  }

  try {
    const fix = await revertFix(organizationId, id, body.reason);
    if (!fix) {
      res.status(404).json({ error: "Fix not found" });
      return;
    }

    if (fix.ticket && !fix.ticket.endsWith("-SIM")) {
      const org = await getOrganization(organizationId);
      const prefs = (org.preferences as Record<string, unknown>) ?? {};
      const ticketingPrefs = (prefs.ticketing as { autoReopenOnRevert?: boolean } | undefined) ?? {};
      if (ticketingPrefs.autoReopenOnRevert !== false) {
        const jiraIntegration = await getTicketingIntegration(organizationId, "jira");
        if (jiraIntegration?.connected) {
          ticketingPluginFor("jira")
            ?.updateTicketStatus(jiraIntegration.config as Record<string, string>, fix.ticket, "reopened")
            .catch(() => {});
        }
      }
    }

    await notify({
      type: "diagnosis_failed",
      repo: fix.repo,
      branch: fix.branch,
      summary: `Fix #${id} reverted`,
      url: fix.prUrl ?? "",
      urgent: false,
    });
    broadcast("activity", getActivity()[0]);
    res.json(fix);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Revert failed" });
  }
});

// --- Issue records ---

apiRouter.get("/issues", async (req, res) => {
  res.json(await listIssues(orgId(req)));
});

apiRouter.get("/issues/:id", async (req, res) => {
  const issue = await getIssue(orgId(req), Number(req.params.id));
  if (!issue) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.json(issue);
});

// --- Audit trail ---

apiRouter.get("/audit", async (req, res) => {
  if (!(await requirePermission(req, res, "view_audit_trail"))) return;
  const fixId = req.query.fixId ? Number(req.query.fixId) : undefined;
  res.json(await listAudit(orgId(req), fixId));
});

apiRouter.get("/audit/fixes", async (req, res) => {
  if (!(await requirePermission(req, res, "view_audit_trail"))) return;
  res.json(await listFixSummaries(orgId(req)));
});

// --- Changelog ---

apiRouter.get("/changelog", async (req, res) => {
  const organizationId = orgId(req);
  const entries = await buildChangelog(organizationId);
  const markdown = changelogToMarkdown(entries);
  res.json({ entries, markdown, generatedAt: new Date().toISOString() });
});

// --- Reports ---

apiRouter.get("/reports", async (req, res) => {
  const organizationId = orgId(req);
  const [stored, digest] = await Promise.all([listStoredReports(organizationId), buildWeeklyDigest(organizationId)]);
  const fixes = await listFixSummaries(organizationId);
  res.json({ stored, digest, incidentFixes: fixes, generatedAt: new Date().toISOString() });
});

apiRouter.get("/reports/incident/:fixId", async (req, res) => {
  const fixId = Number(req.params.fixId);
  if (!Number.isFinite(fixId)) {
    res.status(400).json({ error: "Invalid fix id" });
    return;
  }
  const report = await buildIncidentReport(orgId(req), fixId);
  if (!report) {
    res.status(404).json({ error: "Fix not found" });
    return;
  }
  res.json(report);
});

apiRouter.get("/reports/digest", async (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 7;
  res.json(await buildWeeklyDigest(orgId(req), Number.isFinite(days) ? days : 7));
});

apiRouter.post("/reports", async (req, res) => {
  if (!(await requirePermission(req, res, "export_data"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as {
    type?: "incident" | "digest" | "changelog";
    fixId?: number;
    title?: string;
  };
  if (!body.type) {
    res.status(400).json({ error: "Report type is required" });
    return;
  }

  if (body.type === "incident") {
    if (!body.fixId) {
      res.status(400).json({ error: "fixId is required for incident reports" });
      return;
    }
    const incident = await buildIncidentReport(organizationId, body.fixId);
    if (!incident) {
      res.status(404).json({ error: "Fix not found" });
      return;
    }
    const stored = await storeReport(organizationId, {
      type: "incident",
      title: body.title ?? incident.title,
      markdown: incident.markdown,
      fixId: body.fixId,
    });
    res.status(201).json(stored);
    return;
  }

  if (body.type === "digest") {
    const digest = await buildWeeklyDigest(organizationId);
    const stored = await storeReport(organizationId, {
      type: "digest",
      title: body.title ?? digest.title,
      markdown: digest.markdown,
      periodStart: digest.periodStart,
      periodEnd: digest.periodEnd,
    });
    res.status(201).json(stored);
    return;
  }

  const entries = await buildChangelog(organizationId);
  const markdown = changelogToMarkdown(entries);
  const stored = await storeReport(organizationId, {
    type: "changelog",
    title: body.title ?? `Changelog — ${new Date().toISOString().slice(0, 10)}`,
    markdown,
  });
  res.status(201).json(stored);
});

apiRouter.post("/reports/:id/share", async (req, res) => {
  if (!(await requirePermission(req, res, "export_data"))) return;
  const report = await shareStoredReport(orgId(req), req.params.id);
  if (!report?.shareToken) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost:3000";
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const apiBase = `${proto}://${host}`;
  res.json({
    token: report.shareToken,
    shareUrl: `${apiBase}/api/reports/share/${report.shareToken}`,
    sharedAt: report.sharedAt,
  });
});

apiRouter.get("/reports/share/:token", async (req, res) => {
  const hit = await findReportByShareToken(req.params.token);
  if (!hit) {
    res.status(404).json({ error: "Shared report not found or link expired" });
    return;
  }
  res.json({ report: hit.report, readOnly: true });
});

apiRouter.delete("/reports/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "export_data"))) return;
  const deleted = await deleteStoredReport(orgId(req), req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({ deleted: true });
});

// --- Repositories (settings) ---

apiRouter.get("/repos", async (req, res) => {
  const projectId = typeof req.query.project === "string" ? req.query.project : undefined;
  const repos = await listRepos(orgId(req), projectId);
  res.json(repos.map((r) => ({ repo: r.fullName, provider: r.provider, mode: r.mode, policy: r.policy, enabled: r.enabled, project: r.projectId })));
});

apiRouter.post("/repos", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { repo?: string; provider?: string; mode?: string; project?: string };
  if (!body.repo?.trim()) {
    res.status(400).json({ error: "Repository name is required" });
    return;
  }
  let projectId = body.project;
  if (!projectId) {
    const unassigned = await ensureUnassignedProject(organizationId);
    projectId = unassigned.id;
  }
  if (!projectId) {
    res.status(400).json({ error: "No project available — create a project first" });
    return;
  }
  try {
    const repo = await createRepo(organizationId, {
      fullName: body.repo.trim(),
      provider: body.provider ?? "GitHub",
      mode: body.mode ?? "Diagnose & suggest",
      projectId,
    });
    res.status(201).json({ repo: repo.fullName, provider: repo.provider, mode: repo.mode, policy: repo.policy, enabled: repo.enabled, project: repo.projectId });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Create failed" });
  }
});

apiRouter.patch("/repos/:name", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const name = decodeURIComponent(req.params.name);
  const body = (req.body ?? {}) as { enabled?: boolean; mode?: string; project?: string };
  try {
    const updated = await updateRepo(orgId(req), name, body);
    if (!updated) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }
    res.json({ repo: updated.fullName, provider: updated.provider, mode: updated.mode, policy: updated.policy, enabled: updated.enabled, project: updated.projectId });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

apiRouter.delete("/repos/:name", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const name = decodeURIComponent(req.params.name);
  try {
    const ok = await deleteRepo(orgId(req), name);
    if (!ok) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
  }
});

// --- Projects ---

apiRouter.get("/projects", async (req, res) => {
  res.json(await listProjects(orgId(req)));
});

apiRouter.get("/projects/:id", async (req, res) => {
  const project = await getProjectEnriched(orgId(req), req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

apiRouter.post("/projects", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { name?: string; description?: string; defaultMode?: string };
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }
  try {
    const project = await createProject(organizationId, { name, description: body.description, defaultMode: body.defaultMode });
    broadcast("activity", getActivity()[0]);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Create failed" });
  }
});

apiRouter.patch("/projects/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const body = (req.body ?? {}) as { name?: string; description?: string; defaultMode?: string };
  const updated = await updateProject(orgId(req), req.params.id, body);
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const enriched = await getProjectEnriched(orgId(req), req.params.id);
  res.json(enriched ?? updated);
});

apiRouter.delete("/projects/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  try {
    const ok = await deleteProject(orgId(req), req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
  }
});

// --- Demo: simulate CI failure (MVP without live webhook) ---

apiRouter.post("/demo/simulate", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { repo?: string; branch?: string; prNumber?: number; liveGitHub?: boolean };
  const repo = body.repo ?? STITCH_TEST_REPO;
  const branch = body.branch ?? "main";
  const liveGitHub = Boolean(body.liveGitHub);
  const runId = `sim-${Date.now()}`;

  const failure: NormalizedFailure = {
    platform: "github",
    repo,
    branch,
    commitSha: "demo000",
    runId,
    logsUrl: `https://github.com/${repo}/actions/runs/${runId}`,
    prNumber: body.prNumber ?? (branch.startsWith("feature/") ? 318 : null),
    triggeredAt: new Date().toISOString(),
  };

  try {
    const result = await runPipeline(organizationId, pluginFor("github"), failure, {
      simulate: !liveGitHub,
      liveGitHub,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof PipelineSkippedError) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Simulation failed" });
  }
});

// --- Status ---

apiRouter.get("/status", async (req, res) => {
  const organizationId = orgId(req);
  const org = await seedEnvForOrg(organizationId);
  const ai = readAiPreferences((org.preferences as Record<string, unknown>) ?? {});
  const aiConfigured = isAiConfigured(ai);
  const status = await getWorkspaceStatus(organizationId, {
    openaiConfigured: aiConfigured,
    webhookUrl: (path) => integrationWebhookUrl(req, path),
    sseClients: sseCount(),
  });
  res.json(status);
});

// --- Ticketing ---

function isTicketingConnectKey(value: string): value is TicketingKey {
  return value in TICKETING_CONNECT_FIELDS;
}

apiRouter.get("/ticketing", async (req, res) => {
  const organizationId = orgId(req);
  const rows = await Promise.all(
    TICKETING_PROVIDERS.map(async (demo) => {
      const key = demo.key as TicketingKey;
      if (!isTicketingConnectKey(key)) {
        return { ...demo, liveTested: false, fields: [] as { name: string; label: string; type: string }[] };
      }
      const row = await getTicketingIntegration(organizationId, key);
      const config = (row?.config as Record<string, string>) ?? {};
      return {
        key,
        name: demo.name,
        connected: Boolean(row?.connected),
        detail: row?.connected ? `Project: ${config.projectKey ?? "?"}` : demo.detail,
        liveTested: LIVE_TESTED_TICKETING.includes(key),
        fields: TICKETING_CONNECT_FIELDS[key] ?? [],
      };
    }),
  );
  res.json(rows);
});

apiRouter.post("/ticketing/:key/connect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isTicketingConnectKey(key)) {
    res.status(404).json({ error: `unknown or unsupported ticketing provider: ${key}` });
    return;
  }
  const fields = TICKETING_CONNECT_FIELDS[key] ?? [];
  const allowedFields = new Set(fields.map((f) => f.name));
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Record<string, string> = {};
  for (const [field, value] of Object.entries(body)) {
    if (allowedFields.has(field) && typeof value === "string" && value.length > 0) {
      patch[field] = value;
    }
  }

  const connected = fields.every((f) => Boolean(patch[f.name]));
  await upsertTicketingIntegration(organizationId, key, { connected, config: patch });
  if (connected) broadcast("integration", { key, connected: true });
  res.json({ key, connected });
});

apiRouter.post("/ticketing/:key/disconnect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isTicketingConnectKey(key)) {
    res.status(404).json({ error: `unknown or unsupported ticketing provider: ${key}` });
    return;
  }
  await upsertTicketingIntegration(organizationId, key, { connected: false, config: {} });
  broadcast("integration", { key, connected: false });
  res.json({ key, connected: false });
});

apiRouter.post("/ticketing/:key/test", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const { key } = req.params;
  if (!isTicketingConnectKey(key)) {
    res.status(404).json({ error: `unknown or unsupported ticketing provider: ${key}` });
    return;
  }
  const provider = ticketingPluginFor(key);
  const row = await getTicketingIntegration(organizationId, key);
  const config = (row?.config as Record<string, string>) ?? {};
  if (!provider) {
    res.status(400).json({ ok: false, error: "Provider not implemented" });
    return;
  }
  const result = await provider.testConnection(config);
  res.json(result);
});

const DEFAULT_TICKETING_PREFS = {
  createOn: "esc_pending",
  defaultBoard: "ENG",
  autoCloseOnMerge: true,
  autoReopenOnRevert: true,
  linkInPrDescription: true,
  priorityMap: { high: "low", medium: "medium", low: "high" },
};

apiRouter.get("/settings/ticketing", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_TICKETING_PREFS, ...((prefs.ticketing as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/ticketing", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.ticketing as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const ticketing = { ...existing, ...body };
  await updatePreferences(organizationId, { ticketing });
  res.json(ticketing);
});

// --- Settings ---

apiRouter.get("/settings", async (req, res) => {
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const ai = readAiPreferences(prefs);
  const response = buildAiSettingsResponse(ai);
  res.json({
    ...response,
    // Legacy fields consumed by older UI paths
    openaiConfigured: response.openaiConfigured,
    diagnosisModel: response.diagnosisModel,
    fixModel: response.fixModel,
  });
});

apiRouter.get("/settings/ai-models", async (req, res) => {
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json(buildAiSettingsResponse(readAiPreferences(prefs)));
});

apiRouter.post("/settings/ai-models", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as {
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
  };

  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = readAiPreferences(prefs);

  const copilotPatch =
    body.copilotApiKey?.trim() || body.copilotEndpoint?.trim() || body.copilotDeployment?.trim()
      ? {
          apiKey: body.copilotApiKey?.trim() || existing.copilot?.apiKey,
          endpoint: body.copilotEndpoint?.trim() || existing.copilot?.endpoint,
          deployment: body.copilotDeployment?.trim() || existing.copilot?.deployment,
        }
      : undefined;

  const patch: Partial<AiPreferences> = {
    openai: body.openaiApiKey?.trim() ? { apiKey: body.openaiApiKey.trim() } : undefined,
    anthropic: body.anthropicApiKey?.trim() ? { apiKey: body.anthropicApiKey.trim() } : undefined,
    gemini: body.geminiApiKey?.trim() ? { apiKey: body.geminiApiKey.trim() } : undefined,
    copilot: copilotPatch,
    diagnosis:
      body.diagnosisProvider || body.diagnosisModel
        ? {
            provider: body.diagnosisProvider ?? existing.diagnosis?.provider ?? "openai",
            model: body.diagnosisModel ?? existing.diagnosis?.model ?? "gpt-4o-mini",
          }
        : undefined,
    fix:
      body.fixProvider || body.fixModel
        ? {
            provider: body.fixProvider ?? existing.fix?.provider ?? "openai",
            model: body.fixModel ?? existing.fix?.model ?? "gpt-4o",
          }
        : undefined,
    maxDiffSize: typeof body.maxDiffSize === "number" ? body.maxDiffSize : undefined,
    quotaExceeded: body.quotaExceeded?.trim() ? body.quotaExceeded.trim() : undefined,
  };

  const merged = mergeAiPreferences(existing, patch);
  await updatePreferences(organizationId, { ai: merged, openai: toLegacyOpenaiBlob(merged) });
  applyAiConfig(merged);
  res.json(buildAiSettingsResponse(merged));
});

apiRouter.post("/settings/ai-models/disconnect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { provider?: AiProvider };
  const provider = body.provider ?? "openai";
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = readAiPreferences(prefs);
  const merged = mergeAiPreferences(existing, disconnectProviderPatch(provider));
  await updatePreferences(organizationId, { ai: merged, openai: toLegacyOpenaiBlob(merged) });
  applyAiConfig(merged);
  res.json(buildAiSettingsResponse(merged));
});

apiRouter.post("/settings/ai-models/test", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as {
    provider?: AiProvider;
    apiKey?: string;
    model?: string;
    endpoint?: string;
    deployment?: string;
  };
  await seedEnvForOrg(organizationId);
  const org = await getOrganization(organizationId);
  const ai = readAiPreferences((org.preferences as Record<string, unknown>) ?? {});
  applyAiConfig(ai);

  const provider = body.provider ?? ai.diagnosis?.provider ?? "openai";
  const creds = resolveTestCredentials(provider, ai, { provider, ...body });

  if (!creds.apiKey) {
    res.status(400).json({ ok: false, error: `${provider} API key not set — paste a key or save one first` });
    return;
  }
  if (provider === "copilot" && !creds.endpoint) {
    res.status(400).json({ ok: false, error: "Azure OpenAI endpoint required — paste endpoint or save Copilot settings first" });
    return;
  }
  try {
    const result = await testAiProvider(provider, {
      apiKey: creds.apiKey,
      model: creds.model,
      endpoint: creds.endpoint,
      deployment: creds.deployment,
    });
    res.json(result);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : `${provider} test failed` });
  }
});

apiRouter.post("/settings/openai", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as {
    apiKey?: string;
    diagnosisModel?: string;
    fixModel?: string;
    maxDiffSize?: number;
    quotaExceeded?: string;
  };
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = readAiPreferences(prefs);
  const merged = mergeAiPreferences(existing, {
    openai: body.apiKey?.trim() ? { apiKey: body.apiKey.trim() } : existing.openai,
    diagnosis: {
      provider: "openai",
      model: body.diagnosisModel ?? existing.diagnosis?.model ?? "gpt-4o-mini",
    },
    fix: {
      provider: "openai",
      model: body.fixModel ?? existing.fix?.model ?? "gpt-4o",
    },
    maxDiffSize: typeof body.maxDiffSize === "number" ? body.maxDiffSize : existing.maxDiffSize,
    quotaExceeded: body.quotaExceeded ?? existing.quotaExceeded,
  });
  await updatePreferences(organizationId, { ai: merged, openai: toLegacyOpenaiBlob(merged) });
  applyAiConfig(merged);
  const response = buildAiSettingsResponse(merged);
  res.json({
    openaiConfigured: response.openaiConfigured,
    diagnosisModel: response.diagnosisModel,
    fixModel: response.fixModel,
    maxDiffSize: response.maxDiffSize,
    quotaExceeded: response.quotaExceeded,
  });
});

apiRouter.post("/settings/openai/disconnect", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const existing = readAiPreferences((org.preferences as Record<string, unknown>) ?? {});
  const merged = mergeAiPreferences(existing, { openai: {} });
  await updatePreferences(organizationId, { ai: merged, openai: toLegacyOpenaiBlob(merged) });
  applyAiConfig(merged);
  res.json({ openaiConfigured: false });
});

apiRouter.post("/settings/openai/test", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const organizationId = orgId(req);
  await seedEnvForOrg(organizationId);
  if (!env.openaiApiKey) {
    res.status(400).json({ ok: false, error: "OpenAI API key not set" });
    return;
  }
  try {
    const result = await testAiProvider("openai", { apiKey: env.openaiApiKey });
    res.json(result);
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "OpenAI test failed",
    });
  }
});

apiRouter.get("/settings/preferences", async (req, res) => {
  // Gated, not just the writes below: this blob includes settings/openai's plaintext apiKey.
  if (!(await requirePermission(req, res, "manage_integrations"))) return;
  const org = await getOrganization(orgId(req));
  res.json(org.preferences ?? {});
});

apiRouter.patch("/settings/preferences", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const org = await updatePreferences(orgId(req), body);
  res.json(org.preferences ?? {});
});

// --- Branch rules + Response behavior (real pipeline-affecting preferences — see router/branchRouter.ts) ---

apiRouter.get("/settings/branch-rules", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const rules = (prefs.branchRules as BranchRule[] | undefined) ?? DEFAULT_BRANCH_RULES;
  res.json({ rules, customized: Boolean(prefs.branchRules) });
});

apiRouter.post("/settings/branch-rules", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { rules?: { pattern?: string; mode?: string }[] };
  const rules: BranchRule[] = (body.rules ?? [])
    .filter((r) => r.pattern?.trim() && r.mode && isUiModeLabel(r.mode))
    .map((r) => ({ pattern: r.pattern!.trim(), mode: r.mode as BranchRule["mode"] }));
  await updatePreferences(organizationId, { branchRules: rules });
  res.json({ rules, customized: true });
});

const DEFAULT_RESPONSE_BEHAVIOR = {
  defaultMode: "Diagnose & suggest",
  confidenceFloor: 50,
  autoMergeDelay: 15,
  requiredApprovers: 0,
  maxPrsPerHour: 10,
  respectWorkingHours: false,
};

apiRouter.get("/settings/response-behavior", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_RESPONSE_BEHAVIOR, ...((prefs.responseBehavior as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/response-behavior", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.responseBehavior as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const responseBehavior = { ...DEFAULT_RESPONSE_BEHAVIOR, ...existing, ...body };
  await updatePreferences(organizationId, { responseBehavior });
  res.json(responseBehavior);
});

// "Who can revert" used to live here as a standalone admin/admin+dev toggle; it's now
// superseded by the real per-role "Revert a merged fix" permission in Roles & Permissions
// (Settings -> Team & access -> Roles), which is strictly more expressive (N roles, not 2).
const DEFAULT_ROLLBACK_PREFS = {
  autoRevertOnRepeatFailure: true,
  revertWindowMinutes: 30,
  revertRequiresReason: false,
};

apiRouter.get("/settings/rollback", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_ROLLBACK_PREFS, ...((prefs.rollback as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/rollback", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.rollback as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rollback = { ...DEFAULT_ROLLBACK_PREFS, ...existing, ...body };
  await updatePreferences(organizationId, { rollback });
  res.json(rollback);
});

const DEFAULT_PR_PREFS = {
  openAs: "draft" as "draft" | "ready",
  requiredApprovers: 1,
  includeDiagnosisInBody: true,
  notifyCodeowners: true,
  labels: ["stitch", "auto-fix"] as string[],
};

apiRouter.get("/settings/pull-requests", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_PR_PREFS, ...((prefs.pullRequests as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/pull-requests", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.pullRequests as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const pullRequests = { ...DEFAULT_PR_PREFS, ...existing, ...body };
  await updatePreferences(organizationId, { pullRequests });
  res.json(pullRequests);
});

const DEFAULT_DOCUMENTATION_PREFS = {
  writeFixLogToRepo: true,
  writeAuditTrail: true,
  autoGenerateChangelog: false,
  incidentReports: false,
  weeklyDigest: "mon" as "mon" | "fri" | "off",
  retentionDays: 90,
  exportFormats: { markdown: true, json: true, pdf: false },
};

apiRouter.get("/settings/documentation", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_DOCUMENTATION_PREFS, ...((prefs.documentation as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/documentation", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_response_rules"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.documentation as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const documentation = { ...DEFAULT_DOCUMENTATION_PREFS, ...existing, ...body };
  await updatePreferences(organizationId, { documentation });
  res.json(documentation);
});

const DEFAULT_SECURITY_PREFS = {
  requireApprovalForAutopilotOnMain: false,
  sessionTimeoutHours: 8 as number | "never",
  ipAllowlist: "",
};

apiRouter.get("/settings/security", async (req, res) => {
  const org = await getOrganization(orgId(req));
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  res.json({ ...DEFAULT_SECURITY_PREFS, ...((prefs.security as Record<string, unknown>) ?? {}) });
});

apiRouter.post("/settings/security", async (req, res) => {
  // Admin-only regardless of custom permission grants — security policy (session
  // timeout, approval gates) is deliberately not delegable via the permission matrix.
  if (!requireAdminOnly(req, res)) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const existing = (prefs.security as Record<string, unknown>) ?? {};
  const body = (req.body ?? {}) as Record<string, unknown>;
  const security = { ...DEFAULT_SECURITY_PREFS, ...existing, ...body };
  await updatePreferences(organizationId, { security });
  res.json(security);
});

apiRouter.get("/settings/api-key", async (req, res) => {
  if (!requireAdminOnly(req, res)) return;
  const org = await getOrganization(orgId(req));
  res.json({ preview: org.apiKeyPreview ?? null });
});

apiRouter.post("/settings/api-key/regenerate", async (req, res) => {
  if (!requireAdminOnly(req, res)) return;
  const organizationId = orgId(req);
  const key = `sk-stch-${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const preview = `sk-stch-••••${key.slice(-4)}`;
  await prisma.organization.update({ where: { id: organizationId }, data: { apiKeyHash: hash, apiKeyPreview: preview } });
  await appendAudit(organizationId, { fixId: 0, action: "API key regenerated", actor: "Dashboard user", outcome: preview });
  res.json({ key, preview });
});

// --- Danger zone ---

apiRouter.post("/danger/disconnect-all", async (req, res) => {
  if (!requireAdminOnly(req, res)) return;
  const organizationId = orgId(req);
  await disconnectAllIntegrations(organizationId);
  await appendAudit(organizationId, { fixId: 0, action: "All integrations disconnected", actor: "Dashboard user", outcome: "Danger zone" });
  res.json({ ok: true });
});

apiRouter.get("/danger/export", async (req, res) => {
  if (!(await requirePermission(req, res, "export_data"))) return;
  const organizationId = orgId(req);
  const [org, projects, repos, fixes, issues, audit] = await Promise.all([
    getOrganization(organizationId),
    listProjects(organizationId),
    listRepos(organizationId),
    listFixes(organizationId),
    listIssues(organizationId),
    listAudit(organizationId),
  ]);
  res.setHeader("Content-Disposition", `attachment; filename="stitch-export-${org.slug}.json"`);
  res.json({ exportedAt: new Date().toISOString(), organization: { name: org.name, slug: org.slug }, projects, repos, fixes, issues, audit });
});

apiRouter.delete("/organization", async (req, res) => {
  if (!requireAdminOnly(req, res)) return;
  const organizationId = orgId(req);
  await appendAudit(organizationId, { fixId: 0, action: "Workspace deleted", actor: "Dashboard user", outcome: "Danger zone" });
  await prisma.organization.delete({ where: { id: organizationId } });
  res.json({ deleted: true });
});

// --- Organization profile (real, stored in preferences.orgProfile) ---

apiRouter.get("/organization/overview", async (req, res) => {
  const organizationId = orgId(req);
  const orgRoles = await getOrgRoles(organizationId);
  const perms = getUserPermissions(orgRoles, req.user?.role ?? "Viewer");
  res.json(await getOrganizationOverview(organizationId, { includeBilling: Boolean(perms.manage_billing) }));
});

apiRouter.get("/organization/profile", async (req, res) => {
  res.json(await getOrgProfile(orgId(req)));
});

apiRouter.patch("/organization/profile", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const body = (req.body ?? {}) as Partial<{
    name: string;
    domain: string;
    industry: string;
    companySize: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    weekStartsOn: string;
  }>;
  res.json(await updateOrgProfile(orgId(req), body));
});

// --- Billing (plan + usage from real DB rows) ---

apiRouter.get("/settings/billing", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_billing"))) return;
  const organizationId = orgId(req);
  const org = await getOrganization(organizationId);
  const usage = await getAiUsage(organizationId);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const fixesThisMonth = await prisma.fix.count({
    where: { organizationId, createdAt: { gte: monthStart } },
  });
  const includedFixes = org.plan === "Enterprise" ? 500 : org.plan === "Team" ? 200 : 50;
  res.json({
    plan: org.plan,
    includedFixes,
    fixesThisMonth,
    overageRate: 0.35,
    usagePercent: Math.min(100, Math.round((fixesThisMonth / includedFixes) * 100)),
    aiUsage: usage,
  });
});

// --- Workspace ---

apiRouter.get("/workspace", async (req, res) => {
  const organizationId = orgId(req);
  const [org, projects] = await Promise.all([getOrganization(organizationId), listProjects(organizationId)]);
  res.json({
    id: org.id,
    name: org.slug,
    plan: org.plan,
    orgName: org.name,
    projectCount: projects.length,
    user: req.user ? { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } : null,
  });
});

// --- Team & access (real, email-free invite links) ---

/** Reserved for the handful of actions that must always be Admin-only regardless of
 * a workspace's own Roles & Permissions configuration (deleting the whole org,
 * disconnecting every integration at once) — deliberately not part of the
 * editable permission matrix, since these are too destructive to be configurable. */
function requireAdminOnly(req: { user?: { role: string } }, res: Response): boolean {
  if (req.user?.role !== "Admin") {
    res.status(403).json({ error: "Only Admins can do this" });
    return false;
  }
  return true;
}

/** The real permission check behind Settings -> Roles & permissions — every
 * gated route below calls this instead of a hardcoded role name, so editing a
 * role's permissions in that UI immediately changes what that role can do here. */
async function requirePermission(req: { org?: { id: string }; user?: { role: string } }, res: Response, permission: PermissionKey): Promise<boolean> {
  const organizationId = req.org!.id;
  const orgRoles = await getOrgRoles(organizationId);
  if (!roleHasPermission(orgRoles, req.user?.role ?? "", permission)) {
    const label = PERMISSIONS.find((p) => p.key === permission)?.label ?? permission;
    res.status(403).json({ error: `Your role doesn't have the "${label}" permission` });
    return false;
  }
  return true;
}

apiRouter.get("/me/permissions", async (req, res) => {
  const organizationId = orgId(req);
  const orgRoles = await getOrgRoles(organizationId);
  const role = req.user!.role;
  res.json({
    role,
    permissions: getUserPermissions(orgRoles, role),
    labels: PERMISSIONS,
  });
});

apiRouter.get("/me/profile", async (req, res) => {
  res.json(await getUserProfileBundle(orgId(req), req.user!.id, req.sessionToken));
});

apiRouter.patch("/me/profile", async (req, res) => {
  const body = (req.body ?? {}) as { name?: string; email?: string };
  try {
    await updateUserAccount(req.user!.id, body);
    res.json(await getUserProfileBundle(orgId(req), req.user!.id, req.sessionToken));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
  }
});

apiRouter.patch("/me/password", async (req, res) => {
  const body = (req.body ?? {}) as { currentPassword?: string; newPassword?: string };
  if (!body.currentPassword || !body.newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }
  try {
    await updateUserPassword(req.user!.id, body.currentPassword, body.newPassword);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Password update failed" });
  }
});

apiRouter.patch("/me/preferences", async (req, res) => {
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as Partial<import("./store/appStore.js").UserPersonalPreferences>;
  const updated = await updateUserPersonalPreferences(organizationId, req.user!.id, body);
  res.json(updated);
});

apiRouter.delete("/me/sessions/others", async (req, res) => {
  const token = req.sessionToken;
  if (!token) {
    res.status(400).json({ error: "No active session" });
    return;
  }
  const { destroyOtherSessions } = await import("./auth/session.js");
  await destroyOtherSessions(req.user!.id, token);
  res.json({ ok: true, sessions: (await getUserProfileBundle(orgId(req), req.user!.id, token)).sessions });
});

apiRouter.get("/roles", async (req, res) => {
  res.json(await listRolesWithCounts(orgId(req)));
});

apiRouter.post("/roles", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { name?: string; permissions?: Record<string, boolean>; color?: string };
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }
  const orgRoles = await getOrgRoles(organizationId);
  if (orgRoles[name]) {
    res.status(409).json({ error: `A role named "${name}" already exists` });
    return;
  }
  const permissions = Object.fromEntries(PERMISSIONS.map((p) => [p.key, Boolean(body.permissions?.[p.key])]));
  const role = await upsertRole(organizationId, name, permissions, body.color?.trim());
  res.status(201).json(role);
});

apiRouter.patch("/roles/:name", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const name = decodeURIComponent(req.params.name);
  if (name === "Admin") {
    res.status(400).json({ error: "The Admin role always has every permission and can't be edited" });
    return;
  }
  const organizationId = orgId(req);
  const orgRoles = await getOrgRoles(organizationId);
  const existing = orgRoles[name];
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  const body = (req.body ?? {}) as { permissions?: Record<string, boolean>; color?: string };
  const permissions = { ...existing.permissions, ...(body.permissions ?? {}) };
  const role = await upsertRole(organizationId, name, permissions, body.color?.trim());
  res.json(role);
});

apiRouter.delete("/roles/:name", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  try {
    await deleteRole(orgId(req), decodeURIComponent(req.params.name));
    res.json({ deleted: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Delete failed" });
  }
});

apiRouter.get("/team", async (req, res) => {
  res.json(await listTeam(orgId(req)));
});

apiRouter.post("/team/invite", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { email?: string; role?: string };
  const orgRoles = await getOrgRoles(organizationId);
  const role = body.role && orgRoles[body.role] ? body.role : "Developer";
  const invite = await createInvite(organizationId, req.user!.id, { email: body.email?.trim(), role });
  const origin = resolveAppOrigin(req);
  res.status(201).json({
    id: invite.id,
    url: `${origin}/signup?invite=${invite.token}`,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
});

apiRouter.delete("/team/invite/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const ok = await revokeInvite(orgId(req), req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  res.json({ revoked: true });
});

apiRouter.patch("/team/members/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  const organizationId = orgId(req);
  const body = (req.body ?? {}) as { role?: string };
  const orgRoles = await getOrgRoles(organizationId);
  if (!body.role || !orgRoles[body.role]) {
    res.status(400).json({ error: `role must be one of: ${Object.keys(orgRoles).join(", ")}` });
    return;
  }

  const member = await prisma.user.findFirst({ where: { id: req.params.id, organizationId } });
  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (member.role === "Admin" && body.role !== "Admin") {
    const adminCount = await prisma.user.count({ where: { organizationId, role: "Admin" } });
    if (adminCount <= 1) {
      res.status(400).json({ error: "Can't demote the last Admin — promote someone else first" });
      return;
    }
  }

  const updated = await updateMemberRole(organizationId, req.params.id, body.role);
  if (!updated) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
});

apiRouter.delete("/team/members/:id", async (req, res) => {
  if (!(await requirePermission(req, res, "manage_team"))) return;
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: "You can't remove yourself — have another Admin do it" });
    return;
  }
  try {
    const ok = await removeMember(orgId(req), req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json({ removed: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Remove failed" });
  }
});

// --- SSE ---

apiRouter.get("/events", (req, res) => {
  addSseClient(res);
});

// Re-export broadcast for pipeline use
export { broadcast };
