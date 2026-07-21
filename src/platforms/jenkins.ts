import { env } from "../config/env.js";
import type { CiCdPlugin, IncomingRequest, NormalizedFailure } from "./types.js";

// Jenkins has no single standard webhook payload — this assumes a generic
// build-notification plugin (e.g. "Generic Webhook Trigger" or a small
// post-build shell step) posting a normalized JSON body. Adjust the field
// names here to match whatever plugin/script a given Jenkins instance uses.
interface JenkinsWebhookPayload {
  status?: string; // expected: "FAILURE"
  job?: { fullName: string; url: string };
  build?: { number: number; branch: string; commitSha: string; timestamp: string };
}

/**
 * Interface-complete, not live-tested. Jenkins has no fixed webhook schema
 * across installs, so `normalize` documents the assumed shape rather than
 * a verified one — this is the plugin most likely to need adjustment
 * against a real instance before it's demo-ready.
 */
export const jenkinsPlugin: CiCdPlugin = {
  key: "jenkins",
  displayName: "Jenkins",

  isConnected() {
    return Boolean(env.jenkins.baseUrl && env.jenkins.user && env.jenkins.apiToken);
  },

  verifyWebhook(req: IncomingRequest) {
    const secret = env.jenkins.webhookSecret;
    if (!secret) return false;
    const tokenHeader = req.headers["x-jenkins-webhook-secret"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    return token === secret;
  },

  normalize(payload) {
    const body = payload as JenkinsWebhookPayload;
    if (body.status !== "FAILURE" || !body.job || !body.build) {
      return null;
    }

    const failure: NormalizedFailure = {
      platform: "jenkins",
      repo: body.job.fullName,
      branch: body.build.branch,
      commitSha: body.build.commitSha,
      runId: String(body.build.number),
      logsUrl: `${body.job.url}${body.build.number}/console`,
      prNumber: null,
      triggeredAt: body.build.timestamp,
    };
    return failure;
  },

  async fetchLogs() {
    throw new Error("jenkins.fetchLogs: not yet wired to a live Jenkins instance (GET {job}/{build}/consoleText) — TODO before demoing this provider");
  },

  async fetchFileContents() {
    throw new Error("jenkins.fetchFileContents: Jenkins has no repo-contents API — would clone via the job's configured SCM URL — TODO");
  },

  async openPr() {
    throw new Error("jenkins.openPr: Jenkins has no PR API — would delegate to the linked SCM provider (GitHub/GitLab/Bitbucket) — TODO");
  },

  async commentOnExisting() {
    throw new Error("jenkins.commentOnExisting: would delegate to the linked SCM provider — TODO");
  },
};
