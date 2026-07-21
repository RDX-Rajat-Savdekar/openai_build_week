import { env } from "../config/env.js";
import type { CiCdPlugin, IncomingRequest, NormalizedFailure } from "./types.js";

// Bitbucket Pipelines "repo:push" + build-status webhook shape (subset), see:
// https://support.atlassian.com/bitbucket-cloud/docs/event-payloads/
interface BitbucketWebhookPayload {
  repository?: { full_name: string };
  commit_status?: {
    state: string; // expected: "FAILED"
    commit: { hash: string };
    url: string;
    created_on: string;
  };
  push?: { changes?: { new?: { name: string } }[] };
}

/**
 * Interface-complete, not live-tested. Implemented against Bitbucket's
 * documented `repo:push` + build-status payloads; provider API calls are
 * TODOs pending real App Password credentials and a live pipeline to test
 * against.
 */
export const bitbucketPlugin: CiCdPlugin = {
  key: "bitbucket",
  displayName: "Bitbucket Pipelines",

  isConnected() {
    return Boolean(env.bitbucket.username && env.bitbucket.appPassword && env.bitbucket.webhookSecret);
  },

  verifyWebhook(req: IncomingRequest) {
    const secret = env.bitbucket.webhookSecret;
    if (!secret) return false;
    const tokenHeader = req.headers["x-bitbucket-webhook-secret"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    return token === secret;
  },

  normalize(payload) {
    const body = payload as BitbucketWebhookPayload;
    const status = body.commit_status;
    const branch = body.push?.changes?.[0]?.new?.name;
    if (!status || status.state !== "FAILED" || !body.repository || !branch) {
      return null;
    }

    const failure: NormalizedFailure = {
      platform: "bitbucket",
      repo: body.repository.full_name,
      branch,
      commitSha: status.commit.hash,
      runId: status.commit.hash,
      logsUrl: status.url,
      prNumber: null,
      triggeredAt: status.created_on,
    };
    return failure;
  },

  async fetchLogs() {
    throw new Error("bitbucket.fetchLogs: not yet wired to a live Bitbucket API — TODO before demoing this provider");
  },

  async fetchFileContents() {
    throw new Error("bitbucket.fetchFileContents: not yet wired to a live Bitbucket API — TODO before demoing this provider");
  },

  async openPr() {
    throw new Error("bitbucket.openPr: not yet wired to a live Bitbucket API (pull requests) — TODO before demoing this provider");
  },

  async commentOnExisting() {
    throw new Error("bitbucket.commentOnExisting: not yet wired to a live Bitbucket API — TODO before demoing this provider");
  },
};
