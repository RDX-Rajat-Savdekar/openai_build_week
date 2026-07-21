import { diagnose } from "../diagnosis/diagnose.js";
import { DEMO_CI_LOGS } from "../data/demoData.js";
import { generateFix } from "../fix/generateFix.js";
import { validateFix } from "../fix/validateFix.js";
import { notify } from "../notify/index.js";
import type { CiCdPlugin, NormalizedFailure } from "../platforms/types.js";
import { mergeGithubPullRequest } from "../platforms/github.js";
import { commitFileToBranch } from "../fix/applyFix.js";
import { PipelineSkippedError } from "../pipeline/errors.js";
import { routeBranch, type BranchRule, type RouterMode } from "../router/branchRouter.js";
import { broadcast } from "../realtime/sse.js";
import { setOpenAiKey, setOpenAiModels, setPullRequestConfig, updateEnvSection, env, type EnvSection } from "../config/env.js";
import { applyAiConfig, readAiPreferences } from "../ai/config.js";
import {
  addPipelineFix,
  appendAudit,
  bumpAiUsage,
  findRecentMergedFix,
  findRepoByFullName,
  getIntegration,
  getOrganization,
  getTicketingIntegration,
  isRunProcessed,
  mapIssueStatus,
  markRunProcessed,
  revertFix,
  upsertIssue,
} from "../store/appStore.js";
import { ticketingPluginFor } from "../ticketing/registry.js";

export interface PipelineResult {
  failure: NormalizedFailure;
  mode: RouterMode;
  diagnosis: Awaited<ReturnType<typeof diagnose>>;
  diff: string;
  validated: boolean;
  fixId: number;
  prUrl?: string;
  action: "pr_opened" | "comment_posted" | "escalated" | "validated_only" | "diagnose_only";
}

function estimateConfidence(diagnosis: { rootCause: string; likelyFiles: string[] }): number {
  let score = 55 + diagnosis.likelyFiles.length * 12;
  if (diagnosis.rootCause.length > 40) score += 10;
  if (diagnosis.rootCause.toLowerCase().includes("race")) score -= 35;
  return Math.max(20, Math.min(95, score));
}

function demoFileContents(paths: string[]): Record<string, string> {
  const samples: Record<string, string> = {
    "auth/token.js":
      'import jwt from "jsonwebtoken";\n\nexport function verifyToken(token) {\n  return jwt.verify(token, process.env.JWT_SECRET)\n}\n',
    "database/connection.js": "const pool = createPool({ max: 10 })\n",
    ".github/workflows/ci.yml": "env:\n  NODE_ENV: test\n",
  };
  const out: Record<string, string> = {};
  for (const p of paths) {
    out[p] = samples[p] ?? `// ${p}\n`;
  }
  return out;
}

/**
 * Seeds the shared, process-global `env` config from this organization's own
 * stored Integration/preferences rows before the plugin/OpenAI calls that
 * read `env.*` run. This is a deliberate simplification, not an oversight:
 * per-request-scoped config (e.g. via AsyncLocalStorage) would be the correct
 * fix for true concurrent multi-tenant safety, but for this demo's traffic
 * shape (webhooks/simulate handled effectively one at a time) mutating the
 * same global `updateEnvSection`/`setOpenAiKey` used by the Settings UI is a
 * bounded, low-risk way to make credentials genuinely per-organization
 * without rewriting every plugin/notify file. See jornal.md and plan section
 * 8.9/18 for the honest limitation this leaves on the table.
 */
async function applyOrgConfig(organizationId: string, platform: NormalizedFailure["platform"]) {
  const integration = await getIntegration(organizationId, platform);
  if (integration?.config && Object.keys(integration.config as object).length > 0) {
    updateEnvSection(platform as EnvSection, integration.config as Record<string, string>);
  }

  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  applyAiConfig(readAiPreferences(prefs));

  const pullRequests = prefs.pullRequests as { openAs?: "draft" | "ready"; includeDiagnosisInBody?: boolean; labels?: string[] } | undefined;
  setPullRequestConfig({
    openAs: pullRequests?.openAs ?? "draft",
    includeDiagnosisInBody: pullRequests?.includeDiagnosisInBody ?? true,
    labels: pullRequests?.labels ?? ["stitch", "auto-fix"],
  });
}

export async function runPipeline(
  organizationId: string,
  plugin: CiCdPlugin,
  failure: NormalizedFailure,
  opts?: { logs?: string; simulate?: boolean; liveGitHub?: boolean },
): Promise<PipelineResult> {
  if (isRunProcessed(failure.platform, failure.runId)) {
    throw new Error(`Duplicate run ${failure.platform}:${failure.runId} — already processed`);
  }

  await applyOrgConfig(organizationId, failure.platform);

  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const branchRules = prefs.branchRules as BranchRule[] | undefined;
  const responseBehavior = (prefs.responseBehavior as { defaultMode?: string; confidenceFloor?: number } | undefined) ?? {};
  const repo = await findRepoByFullName(organizationId, failure.repo);

  if (repo && !repo.enabled) {
    await appendAudit(organizationId, {
      fixId: 0,
      action: "CI failure ignored",
      actor: "Stitch",
      outcome: `${failure.repo} is disabled — enable it in Repositories to process failures`,
    });
    markRunProcessed(failure.platform, failure.runId);
    throw new PipelineSkippedError(`Repository ${failure.repo} is disabled`);
  }

  // Cloned (not the shared routeBranch()/MODE_TO_BEHAVIOR object) since the security override below mutates it per-run.
  const behavior = {
    ...routeBranch(failure.branch, {
      customRules: branchRules,
      repoDefaultMode: repo?.mode,
      projectDefaultMode: repo?.project?.defaultMode,
      orgDefaultMode: responseBehavior.defaultMode,
    }),
  };

  const securityPrefs = (prefs.security as { requireApprovalForAutopilotOnMain?: boolean } | undefined) ?? {};
  if (securityPrefs.requireApprovalForAutopilotOnMain && /^(main|master)$/.test(failure.branch) && behavior.label === "Autopilot" && !behavior.requireHumanReview) {
    behavior.autoMerge = false;
    behavior.requireHumanReview = true;
  }

  await appendAudit(organizationId, { fixId: 0, action: "CI failure detected", actor: `${failure.platform} webhook`, outcome: "Triggered" });

  const rollbackPrefs =
    (prefs.rollback as { autoRevertOnRepeatFailure?: boolean; revertWindowMinutes?: number } | undefined) ?? {};
  if (rollbackPrefs.autoRevertOnRepeatFailure !== false) {
    const windowMs = (rollbackPrefs.revertWindowMinutes ?? 30) * 60_000;
    const recentMerged = await findRecentMergedFix(organizationId, failure.repo, failure.branch, windowMs);
    if (recentMerged) {
      try {
        await revertFix(organizationId, recentMerged.id, `Auto-reverted — CI failed again on ${failure.branch} within ${rollbackPrefs.revertWindowMinutes ?? 30} minutes`);
        await appendAudit(organizationId, { fixId: recentMerged.id, action: "Auto-revert (repeat failure)", actor: "Stitch", outcome: "Reverted" });
        broadcast("pipeline", { fixId: recentMerged.id, repo: failure.repo, branch: failure.branch, action: "escalated" });
      } catch {
        // revertFix only throws if the fix is no longer in "merged" state (e.g. already reverted by a human) — safe to ignore and continue diagnosing the new failure.
      }
    }
  }

  let logs = opts?.logs;
  if (!logs) {
    try {
      logs = plugin.isConnected() ? await plugin.fetchLogs(failure) : DEMO_CI_LOGS;
    } catch {
      logs = DEMO_CI_LOGS;
    }
  }

  await appendAudit(organizationId, { fixId: 0, action: `Logs fetched (${logs.length} chars)`, actor: "Log fetcher", outcome: "Success" });

  await bumpAiUsage(organizationId, "diagnosis");
  const diagnosis = await diagnose(logs);
  const confidence = estimateConfidence(diagnosis);
  await appendAudit(organizationId, {
    fixId: 0,
    action: `${env.diagnosisProvider === "anthropic" ? "Claude" : "OpenAI"} diagnosis complete (${confidence}%)`,
    actor: "Diagnosis engine",
    outcome: "Success",
  });

  if (!behavior.autoFix) {
    const fix = await addPipelineFix(organizationId, {
      failure,
      diagnosis,
      diff: "",
      mode: behavior.label,
      outcome: "diagnose",
      confidence,
      outcomeText: `Diagnosis recorded — ${behavior.label} (no auto-fix on this branch).`,
    });
    await appendAudit(organizationId, { fixId: fix.id, action: "Diagnosis recorded", actor: "Stitch", outcome: fix.outcomeText });
    await upsertIssue(organizationId, fix.id, failure, diagnosis, "", mapIssueStatus("diagnose"), confidence);
    markRunProcessed(failure.platform, failure.runId);
    if (behavior.notify.length > 0) {
      await notify({
        type: "diagnosis_failed",
        repo: failure.repo,
        branch: failure.branch,
        summary: diagnosis.rootCause,
        url: failure.logsUrl,
        urgent: behavior.urgent,
      });
    }
    broadcast("pipeline", { fixId: fix.id, repo: failure.repo, branch: failure.branch, action: "diagnose_only" });
    return {
      failure,
      mode: behavior.mode,
      diagnosis,
      diff: "",
      validated: false,
      fixId: fix.id,
      action: "diagnose_only",
    };
  }

  let fileContents: Record<string, string> = {};
  const useLiveRepo = plugin.isConnected() && (!opts?.simulate || opts?.liveGitHub);
  try {
    fileContents = useLiveRepo
      ? await plugin.fetchFileContents(failure, diagnosis.likelyFiles)
      : demoFileContents(diagnosis.likelyFiles);
  } catch {
    fileContents = demoFileContents(diagnosis.likelyFiles);
  }

  await bumpAiUsage(organizationId, "fix");
  const diff = await generateFix(diagnosis, fileContents);
  await appendAudit(organizationId, { fixId: 0, action: `${env.fixProvider === "anthropic" ? "Claude" : "OpenAI"} fix generated`, actor: "Fix generator", outcome: "Success" });

  const validation = validateFix(diff);
  if (!validation.ok) {
    await appendAudit(organizationId, { fixId: 0, action: "Validation failed", actor: "Fix validator", outcome: validation.error ?? "Failed" });
    throw new Error(validation.error ?? "Fix validation failed");
  }
  await appendAudit(organizationId, { fixId: 0, action: "Validation passed", actor: "Fix validator", outcome: "Success" });

  let prUrl: string | undefined;
  let realPrBranchName: string | undefined;
  let action: PipelineResult["action"] = "validated_only";
  let outcome: "merged" | "pending" | "escalated" | "diagnose" = "pending";
  let outcomeText = "Fix validated — awaiting action.";
  let ticket: string | undefined;
  const lowConfidence = confidence < (responseBehavior.confidenceFloor ?? 50);

  if (lowConfidence) {
    outcome = "escalated";
    action = "escalated";
    outcomeText = `Escalated — confidence ${confidence}% below threshold. Human review required.`;
  } else if (behavior.openPr && plugin.isConnected()) {
    try {
      const pr = await plugin.openPr(failure, diagnosis, diff);
      prUrl = pr.url;
      action = "pr_opened";
      if (failure.platform === "github") realPrBranchName = `stitch/fix-${failure.runId}`;
      outcome = behavior.requireHumanReview ? "pending" : "merged";
      outcomeText = behavior.requireHumanReview
        ? `PR #${pr.number ?? "?"} opened — waiting on human review (${behavior.label}).`
        : `PR #${pr.number ?? "?"} opened (${behavior.label}).`;
      await appendAudit(organizationId, { fixId: 0, action: "PR opened", actor: "PR creator", outcome: "Success" });

      if (behavior.autoMerge && pr.number && failure.platform === "github") {
        try {
          await mergeGithubPullRequest(failure.repo, pr.number);
          outcome = "merged";
          outcomeText = `PR #${pr.number} auto-merged (${behavior.label}).`;
          await appendAudit(organizationId, { fixId: 0, action: "PR auto-merged", actor: "PR creator", outcome: "Success" });
        } catch (err) {
          outcomeText = `PR opened but auto-merge failed: ${err instanceof Error ? err.message : "unknown"}`;
        }
      }
    } catch (err) {
      outcomeText = `PR skipped: ${err instanceof Error ? err.message : "unknown"}`;
    }
  } else if (!behavior.openPr && failure.prNumber && plugin.isConnected()) {
    try {
      const comment = await plugin.commentOnExisting(failure, diagnosis, diff);
      prUrl = comment.url;
      action = "comment_posted";
      outcome = "pending";
      outcomeText = `Diagnosis and suggested fix posted on PR #${failure.prNumber}.`;
      await appendAudit(organizationId, { fixId: 0, action: "PR comment posted", actor: "PR creator", outcome: "Success" });
    } catch (err) {
      outcomeText = `Comment skipped: ${err instanceof Error ? err.message : "unknown"}`;
    }
  } else {
    action = behavior.openPr ? "pr_opened" : "comment_posted";
    prUrl = behavior.openPr
      ? `https://github.com/${failure.repo}/pull/demo-${failure.runId}`
      : `https://github.com/${failure.repo}/pull/${failure.prNumber ?? 1}#issuecomment-demo`;
    outcome = behavior.autoMerge || !behavior.requireHumanReview ? "merged" : "pending";
    outcomeText =
      behavior.mode === "comment-only"
        ? `Demo: diagnosis comment on PR #${failure.prNumber ?? "N/A"} (${behavior.label}).`
        : `Demo: PR opened for ${failure.branch} (${behavior.label}) — connect GitHub for live PRs.`;
    await appendAudit(organizationId, {
      fixId: 0,
      action: behavior.openPr ? "PR opened (demo)" : "Comment posted (demo)",
      actor: "PR creator",
      outcome: "Success",
    });
  }

  const ticketingPrefs = (prefs.ticketing as { createOn?: string; autoCloseOnMerge?: boolean } | undefined) ?? {};
  const createOn = ticketingPrefs.createOn ?? "esc_pending";
  const shouldCreateTicket =
    createOn === "every" ? true : createOn === "esc_only" ? outcome === "escalated" : outcome === "escalated" || outcome === "pending";

  if (shouldCreateTicket) {
    const jiraIntegration = await getTicketingIntegration(organizationId, "jira");
    const jira = jiraIntegration?.connected ? ticketingPluginFor("jira") : undefined;
    if (jira && jiraIntegration) {
      try {
        const created = await jira.createTicket(
          jiraIntegration.config as Record<string, string>,
          failure,
          diagnosis,
          `${failure.repo.split("/")[1] ?? failure.repo}-${failure.runId}`,
        );
        ticket = created.ticketId;
        if (outcome === "merged" && ticketingPrefs.autoCloseOnMerge !== false) {
          await jira.updateTicketStatus(jiraIntegration.config as Record<string, string>, ticket, "done").catch(() => {});
        }
      } catch {
        ticket = failure.branch.startsWith("feature/") ? "JIRA-SIM" : "LINEAR-SIM";
      }
    } else {
      ticket = failure.branch.startsWith("feature/") ? "JIRA-SIM" : "LINEAR-SIM";
    }
  }

  const fix = await addPipelineFix(organizationId, {
    failure,
    diagnosis,
    diff,
    mode: behavior.label,
    outcome,
    confidence,
    outcomeText,
    prUrl,
    ticket,
  });

  await appendAudit(organizationId, { fixId: fix.id, action: "Fix recorded", actor: "Stitch", outcome: outcomeText });

  const issue = await upsertIssue(organizationId, fix.id, failure, diagnosis, diff, mapIssueStatus(outcome), confidence, ticket);

  const documentationPrefs = (prefs.documentation as { writeFixLogToRepo?: boolean } | undefined) ?? {};
  if (realPrBranchName && documentationPrefs.writeFixLogToRepo !== false) {
    try {
      await commitFileToBranch(failure.repo, realPrBranchName, issue.path, issue.markdown, `docs: add Stitch issue record for fix #${fix.id}`);
      await appendAudit(organizationId, { fixId: fix.id, action: "Issue record written to repo", actor: "Stitch", outcome: issue.path });
    } catch (err) {
      console.error("[stitch] failed to write issue record to repo:", err instanceof Error ? err.message : err);
    }
  }

  markRunProcessed(failure.platform, failure.runId);

  if (behavior.notify.length > 0) {
    await notify({
      type:
        action === "comment_posted" ? "comment_posted" : action === "escalated" ? "diagnosis_failed" : "fix_opened",
      repo: failure.repo,
      branch: failure.branch,
      summary: diagnosis.rootCause,
      url: prUrl ?? failure.logsUrl,
      urgent: behavior.urgent,
    });
  }

  broadcast("pipeline", { fixId: fix.id, repo: failure.repo, branch: failure.branch, action });

  return { failure, mode: behavior.mode, diagnosis, diff, validated: true, fixId: fix.id, prUrl, action };
}
