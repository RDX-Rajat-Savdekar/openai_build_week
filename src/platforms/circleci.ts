import { env } from "../config/env.js";
import type { CiCdPlugin, IncomingRequest, NormalizedFailure } from "./types.js";

// CircleCI webhook payload shape (subset), see:
// https://circleci.com/docs/webhooks/
interface CircleciWebhookPayload {
  type?: string;
  pipeline?: { id: string; vcs?: { branch: string; revision: string } };
  workflow?: { id: string; status: string; created_at: string };
  project?: { slug: string }; // "gh/org/repo"
}

/**
 * Interface-complete, not live-tested. Same status as the GitLab plugin —
 * shape implemented against CircleCI's documented webhook schema, provider
 * API calls are TODOs pending real credentials/testing.
 */
export const circleciPlugin: CiCdPlugin = {
  key: "circleci",
  displayName: "CircleCI",

  isConnected() {
    return Boolean(env.circleci.token && env.circleci.webhookSecret);
  },

  verifyWebhook(req: IncomingRequest) {
    // CircleCI signs webhooks with an HMAC in the `circleci-signature` header
    // (v1=<hex>). Full HMAC verification is a TODO pending a real webhook
    // to test the signing secret against; the interface is real so this
    // slots in without touching any other module once it's implemented.
    const secret = env.circleci.webhookSecret;
    const sigHeader = req.headers["circleci-signature"];
    return Boolean(secret && sigHeader);
  },

  normalize(payload) {
    const body = payload as CircleciWebhookPayload;
    const workflow = body.workflow;
    if (body.type !== "workflow-completed" || !workflow || workflow.status !== "failed" || !body.project || !body.pipeline?.vcs) {
      return null;
    }

    const failure: NormalizedFailure = {
      platform: "circleci",
      repo: body.project.slug.replace(/^gh\//, ""),
      branch: body.pipeline.vcs.branch,
      commitSha: body.pipeline.vcs.revision,
      runId: workflow.id,
      logsUrl: `https://app.circleci.com/pipelines/workflows/${workflow.id}`,
      prNumber: null, // CircleCI payloads don't carry a PR number directly
      triggeredAt: workflow.created_at,
    };
    return failure;
  },

  async fetchLogs() {
    throw new Error("circleci.fetchLogs: not yet wired to a live CircleCI API — TODO before demoing this provider");
  },

  async fetchFileContents() {
    throw new Error("circleci.fetchFileContents: not yet wired (CircleCI has no repo-contents API — would delegate to the linked VCS provider) — TODO");
  },

  async openPr() {
    throw new Error("circleci.openPr: CircleCI has no PR API — would delegate to the linked VCS provider (GitHub/GitLab) — TODO");
  },

  async commentOnExisting() {
    throw new Error("circleci.commentOnExisting: would delegate to the linked VCS provider — TODO");
  },
};
