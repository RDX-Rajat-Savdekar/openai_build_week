import { createHmac, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { env } from "../config/env.js";
import { applyFixToBranch } from "../fix/applyFix.js";
import type { CiCdPlugin, Diagnosis, IncomingRequest, NormalizedFailure } from "./types.js";

function octokit(): Octokit {
  if (!env.github.token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }
  return new Octokit({ auth: env.github.token });
}

function verifySignature(req: IncomingRequest): boolean {
  const secret = env.github.webhookSecret;
  if (!secret) return false;

  const signatureHeader = req.headers["x-hub-signature-256"];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) return false;

  const body = typeof req.rawBody === "string" ? Buffer.from(req.rawBody) : req.rawBody;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function logBody(data: unknown): string {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
  return String(data);
}

interface GithubWorkflowRunPayload {
  action?: string;
  workflow_run?: {
    id: number;
    head_branch: string;
    head_sha: string;
    conclusion: string | null;
    logs_url: string;
    pull_requests?: { number: number }[];
    created_at: string;
  };
  repository?: { full_name: string };
}

export async function mergeGithubPullRequest(repo: string, pullNumber: number): Promise<void> {
  const [owner, repoName] = repo.split("/");
  const client = octokit();
  await client.pulls.merge({
    owner,
    repo: repoName,
    pull_number: pullNumber,
    merge_method: "squash",
  });
}

/** Parse `https://github.com/org/repo/pull/123` → 123 */
export function parseGithubPullNumber(prUrl: string | null | undefined): number | null {
  if (!prUrl) return null;
  const match = prUrl.match(/\/pull\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function closeGithubPullRequest(repo: string, pullNumber: number): Promise<void> {
  const [owner, repoName] = repo.split("/");
  await octokit().pulls.update({ owner, repo: repoName, pull_number: pullNumber, state: "closed" });
}

/** Open a revert PR by applying an inverted patch on top of the failure branch. */
export async function revertGithubFix(
  repo: string,
  baseBranch: string,
  diff: string,
  fixId: number,
  reason?: string,
): Promise<{ url: string; number: number }> {
  const inverted = invertUnifiedDiff(diff);
  const branchName = `stitch/revert-${fixId}`;
  await applyFixToBranch({
    repo,
    baseBranch,
    branchName,
    diff: inverted,
    commitMessage: `revert: stitch fix #${fixId}${reason ? ` — ${reason.slice(0, 48)}` : ""}`,
  });

  const [owner, repoName] = repo.split("/");
  const client = octokit();
  const pr = await client.pulls.create({
    owner,
    repo: repoName,
    title: `Revert Stitch fix #${fixId}`,
    head: branchName,
    base: baseBranch,
    body: `Reverts an auto-fix applied by Stitch.\n\n${reason ? `**Reason:** ${reason}\n\n` : ""}_Opened automatically by Stitch._`,
  });
  return { url: pr.data.html_url, number: pr.data.number };
}

function invertUnifiedDiff(diff: string): string {
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++")) return line.replace(/^\+{3}/, "---");
      if (line.startsWith("---")) return line.replace(/^-{3}/, "+++");
      if (line.startsWith("+") && !line.startsWith("+++")) return `-${line.slice(1)}`;
      if (line.startsWith("-") && !line.startsWith("---")) return `+${line.slice(1)}`;
      return line;
    })
    .join("\n");
}

export const githubPlugin: CiCdPlugin = {
  key: "github",
  displayName: "GitHub Actions",

  isConnected() {
    return Boolean(env.github.token && env.github.webhookSecret);
  },

  verifyWebhook(req) {
    return verifySignature(req);
  },

  normalize(payload) {
    const body = payload as GithubWorkflowRunPayload;
    const run = body.workflow_run;
    if (!run || body.action !== "completed" || run.conclusion !== "failure" || !body.repository) {
      return null;
    }

    const failure: NormalizedFailure = {
      platform: "github",
      repo: body.repository.full_name,
      branch: run.head_branch,
      commitSha: run.head_sha,
      runId: String(run.id),
      logsUrl: run.logs_url,
      prNumber: run.pull_requests?.[0]?.number ?? null,
      triggeredAt: run.created_at,
    };
    return failure;
  },

  async fetchLogs(failure) {
    const [owner, repo] = failure.repo.split("/");
    const client = octokit();
    const { data: jobsData } = await client.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: Number(failure.runId),
    });

    const chunks: string[] = [];
    const jobs =
      jobsData.jobs.filter((j) => j.conclusion === "failure" || j.conclusion === "cancelled").length > 0
        ? jobsData.jobs.filter((j) => j.conclusion === "failure" || j.conclusion === "cancelled")
        : jobsData.jobs;

    for (const job of jobs) {
      try {
        const logRes = await client.request("GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs", {
          owner,
          repo,
          job_id: job.id,
        });
        const text = logBody(logRes.data);
        chunks.push(`=== JOB: ${job.name} (${job.conclusion ?? job.status}) ===\n${text}`);
      } catch {
        chunks.push(`=== JOB: ${job.name} — log download unavailable ===\n`);
      }
    }

    const combined = chunks.join("\n\n").trim();
    if (!combined) {
      throw new Error("No job logs available for this workflow run");
    }
    return combined.slice(0, 120_000);
  },

  async fetchFileContents(failure, paths) {
    const [owner, repo] = failure.repo.split("/");
    const client = octokit();
    const results: Record<string, string> = {};

    for (const path of paths) {
      try {
        const response = await client.repos.getContent({
          owner,
          repo,
          path,
          ref: failure.commitSha,
        });
        const data = response.data;
        if (!Array.isArray(data) && "content" in data && typeof data.content === "string") {
          results[path] = Buffer.from(data.content, "base64").toString("utf-8");
        }
      } catch {
        // Skip missing paths — fix generator can still infer from diagnosis.
      }
    }
    return results;
  },

  async openPr(failure, diagnosis, diff) {
    const branchName = `stitch/fix-${failure.runId}`;
    await applyFixToBranch({
      repo: failure.repo,
      baseBranch: failure.branch,
      branchName,
      diff,
      commitMessage: `fix: ${diagnosis.rootCause.slice(0, 72)}`,
    });

    const [owner, repo] = failure.repo.split("/");
    const client = octokit();
    const prConfig = env.pullRequests;
    const diagnosisSection = prConfig.includeDiagnosisInBody
      ? `**Diagnosis**\n\n${diagnosis.explanation}\n\n**Files touched**\n\n${diagnosis.likelyFiles.map((f) => `- \`${f}\``).join("\n")}\n\n`
      : "";
    const pr = await client.pulls.create({
      owner,
      repo,
      title: `Stitch: ${diagnosis.rootCause}`,
      head: branchName,
      base: failure.branch,
      draft: prConfig.openAs === "draft",
      body: `${diagnosisSection}---\n_Opened automatically by Stitch after a failed run on \`${failure.branch}\`._`,
    });

    if (prConfig.labels.length > 0) {
      try {
        await client.issues.addLabels({ owner, repo, issue_number: pr.data.number, labels: prConfig.labels });
      } catch {
        // Labels may not exist in this repo yet — never let a cosmetic label failure block the PR itself.
      }
    }

    return { url: pr.data.html_url, number: pr.data.number };
  },

  async commentOnExisting(failure, diagnosis, diff) {
    if (!failure.prNumber) {
      throw new Error("commentOnExisting called without an existing PR number");
    }
    const [owner, repo] = failure.repo.split("/");
    const client = octokit();

    const comment = await client.issues.createComment({
      owner,
      repo,
      issue_number: failure.prNumber,
      body: `**Stitch diagnosis**\n\n${diagnosis.explanation}\n\n**Suggested fix**\n\n\`\`\`diff\n${diff}\n\`\`\``,
    });

    return { url: comment.data.html_url };
  },
};
