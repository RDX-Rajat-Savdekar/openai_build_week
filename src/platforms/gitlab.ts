import { env } from "../config/env.js";
import type { CiCdPlugin, IncomingRequest, NormalizedFailure } from "./types.js";

// GitLab Pipeline Hook payload shape (subset), see:
// https://docs.gitlab.com/ee/user/project/integrations/webhook_events.html#pipeline-events
interface GitlabPipelineHookPayload {
  object_kind?: string;
  object_attributes?: {
    id: number;
    ref: string;
    sha: string;
    status: string;
    created_at: string;
  };
  project?: { path_with_namespace: string };
  merge_request?: { iid: number };
}

/**
 * Interface-complete, not live-tested. `verifyWebhook` and `normalize` are
 * implemented against GitLab's documented payload shape but have not been
 * run against a real GitLab instance before the submission deadline —
 * treat them as "should work," not "verified." The provider API calls
 * (`fetchLogs`, `fetchFileContents`, `openPr`, `commentOnExisting`) are
 * explicit TODOs pending real API testing (@gitbeaker or direct REST).
 */
export const gitlabPlugin: CiCdPlugin = {
  key: "gitlab",
  displayName: "GitLab CI",

  isConnected() {
    return Boolean(env.gitlab.token && env.gitlab.webhookSecret);
  },

  verifyWebhook(req: IncomingRequest) {
    const secret = env.gitlab.webhookSecret;
    if (!secret) return false;
    const tokenHeader = req.headers["x-gitlab-token"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    return token === secret;
  },

  normalize(payload) {
    const body = payload as GitlabPipelineHookPayload;
    const pipeline = body.object_attributes;
    if (body.object_kind !== "pipeline" || !pipeline || pipeline.status !== "failed" || !body.project) {
      return null;
    }

    const failure: NormalizedFailure = {
      platform: "gitlab",
      repo: body.project.path_with_namespace,
      branch: pipeline.ref,
      commitSha: pipeline.sha,
      runId: String(pipeline.id),
      logsUrl: `https://gitlab.com/${body.project.path_with_namespace}/-/pipelines/${pipeline.id}`,
      prNumber: body.merge_request?.iid ?? null,
      triggeredAt: pipeline.created_at,
    };
    return failure;
  },

  async fetchLogs() {
    throw new Error("gitlab.fetchLogs: not yet wired to a live GitLab API — TODO before demoing this provider");
  },

  async fetchFileContents() {
    throw new Error("gitlab.fetchFileContents: not yet wired to a live GitLab API — TODO before demoing this provider");
  },

  async openPr() {
    throw new Error("gitlab.openPr: not yet wired to a live GitLab API (merge requests) — TODO before demoing this provider");
  },

  async commentOnExisting() {
    throw new Error("gitlab.commentOnExisting: not yet wired to a live GitLab API — TODO before demoing this provider");
  },
};
