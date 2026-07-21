import type { PlatformKey } from "./types.js";

export interface PlatformCapabilities {
  /** Full pipeline (logs, PR, merge) is implemented for this provider. */
  pipelineReady: boolean;
  /** UI may offer "Sync repos" (GitHub today). */
  syncRepos: boolean;
  /** UI may offer "Test connection" with a live API call. */
  testConnection: boolean;
  webhookPath: string;
}

export const PLATFORM_CAPABILITIES: Record<PlatformKey, PlatformCapabilities> = {
  github: { pipelineReady: true, syncRepos: true, testConnection: true, webhookPath: "/webhooks/github" },
  gitlab: { pipelineReady: false, syncRepos: false, testConnection: false, webhookPath: "/webhooks/gitlab" },
  circleci: { pipelineReady: false, syncRepos: false, testConnection: false, webhookPath: "/webhooks/circleci" },
  jenkins: { pipelineReady: false, syncRepos: false, testConnection: false, webhookPath: "/webhooks/jenkins" },
  bitbucket: { pipelineReady: false, syncRepos: false, testConnection: false, webhookPath: "/webhooks/bitbucket" },
};

export const PLATFORM_META: Record<PlatformKey, { subtitle: string; icon: string }> = {
  github: { subtitle: "GitHub Actions — workflow_run failures", icon: "github" },
  gitlab: { subtitle: "GitLab CI — pipeline hook failures", icon: "gitlab" },
  circleci: { subtitle: "CircleCI — workflow completed events", icon: "circleci" },
  jenkins: { subtitle: "Jenkins — generic webhook payload", icon: "jenkins" },
  bitbucket: { subtitle: "Bitbucket Pipelines — push & status", icon: "bitbucket" },
};
