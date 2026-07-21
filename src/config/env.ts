import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

const DEFAULT_EMAIL = {
  smtpHost: undefined as string | undefined,
  smtpPort: 587,
  smtpUser: undefined as string | undefined,
  smtpPass: undefined as string | undefined,
  from: undefined as string | undefined,
  to: undefined as string | undefined,
};

const port = Number(optional("PORT") ?? 3000);
const hasBundledFrontend = existsSync(path.join(process.cwd(), "frontend/dist/index.html"));
const defaultUiOrigin =
  optional("APP_ORIGIN") ?? optional("FRONTEND_URL") ?? (hasBundledFrontend ? `http://localhost:${port}` : "http://localhost:5173");

export const env = {
  port,

  /** Browser UI origin — OAuth redirects and invite links. Defaults to :5173 in dev split, :PORT when SPA is bundled. */
  appOrigin: optional("APP_ORIGIN") ?? optional("FRONTEND_URL"),

  /** Server-level OAuth App identity — one per deployment, not per-org (unlike everything below). */
  githubOAuth: {
    clientId: optional("GITHUB_CLIENT_ID"),
    clientSecret: optional("GITHUB_CLIENT_SECRET"),
    callbackUrl: optional("GITHUB_OAUTH_CALLBACK_URL") ?? `${defaultUiOrigin}/api/auth/github/callback`,
  },

  openaiApiKey: optional("OPENAI_API_KEY"),
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  geminiApiKey: optional("GEMINI_API_KEY"),
  copilotApiKey: optional("AZURE_OPENAI_API_KEY"),
  copilotEndpoint: optional("AZURE_OPENAI_ENDPOINT"),
  copilotDeployment: optional("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4o-mini",

  /** Mutable at runtime via Settings UI (falls back to .env on startup). */
  diagnosisProvider:
    (optional("AI_DIAGNOSIS_PROVIDER") as "openai" | "anthropic" | "gemini" | "copilot" | undefined) ?? "openai",
  fixProvider: (optional("AI_FIX_PROVIDER") as "openai" | "anthropic" | "gemini" | "copilot" | undefined) ?? "openai",
  diagnosisModel: optional("OPENAI_DIAGNOSIS_MODEL") ?? "gpt-4o-mini",
  fixModel: optional("OPENAI_FIX_MODEL") ?? "gpt-4o-mini",
  aiMaxDiffSize: 500,
  aiQuotaExceeded: "diagnose" as string,

  github: {
    token: optional("GITHUB_TOKEN"),
    webhookSecret: optional("GITHUB_WEBHOOK_SECRET"),
  },
  gitlab: {
    token: optional("GITLAB_TOKEN"),
    webhookSecret: optional("GITLAB_WEBHOOK_SECRET"),
  },
  circleci: {
    token: optional("CIRCLECI_TOKEN"),
    webhookSecret: optional("CIRCLECI_WEBHOOK_SECRET"),
  },
  jenkins: {
    baseUrl: optional("JENKINS_BASE_URL"),
    user: optional("JENKINS_USER"),
    apiToken: optional("JENKINS_API_TOKEN"),
    webhookSecret: optional("JENKINS_WEBHOOK_SECRET"),
  },
  bitbucket: {
    username: optional("BITBUCKET_USERNAME"),
    appPassword: optional("BITBUCKET_APP_PASSWORD"),
    webhookSecret: optional("BITBUCKET_WEBHOOK_SECRET"),
  },

  slack: {
    webhookUrl: optional("SLACK_WEBHOOK_URL"),
  },
  email: { ...DEFAULT_EMAIL },

  /** Mutable per-org PR settings, seeded right before each openPr() call — see runPipeline.ts's applyOrgConfig. */
  pullRequests: {
    openAs: "draft" as "draft" | "ready",
    includeDiagnosisInBody: true,
    labels: ["stitch", "auto-fix"] as string[],
  },
};

export type EnvSection = "github" | "gitlab" | "circleci" | "jenkins" | "bitbucket" | "slack" | "email";

/**
 * Every plugin/channel reads its config off `env.<section>.*` at call time
 * (never destructured at import time), so mutating these nested objects in
 * place is enough to make the Integrations/Notifications "Connect" forms
 * take effect immediately — no restart, no separate config store to keep
 * in sync. This is in-memory only: it does not touch `.env` on disk and
 * resets on restart, which is the right tradeoff for a demo (never persist
 * pasted tokens to a file this session doesn't own) but is explicitly not
 * how a real multi-tenant SaaS would store per-workspace secrets.
 */
export function updateEnvSection<K extends EnvSection>(section: K, patch: Partial<(typeof env)[K]>): void {
  Object.assign(env[section], patch);
}

export function clearEnvSection(section: EnvSection): void {
  if (section === "email") {
    Object.assign(env.email, DEFAULT_EMAIL);
    return;
  }
  for (const key of Object.keys(env[section]) as (keyof (typeof env)[EnvSection])[]) {
    (env[section] as Record<string, unknown>)[key as string] = undefined;
  }
}

export function setOpenAiKey(apiKey: string | undefined): void {
  env.openaiApiKey = apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export function setAnthropicKey(apiKey: string | undefined): void {
  env.anthropicApiKey = apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export function setGeminiKey(apiKey: string | undefined): void {
  env.geminiApiKey = apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export function setCopilotConfig(patch: {
  apiKey?: string;
  endpoint?: string;
  deployment?: string;
}): void {
  if (patch.apiKey !== undefined) {
    env.copilotApiKey = patch.apiKey && patch.apiKey.length > 0 ? patch.apiKey : undefined;
  }
  if (patch.endpoint !== undefined) {
    env.copilotEndpoint = patch.endpoint && patch.endpoint.length > 0 ? patch.endpoint : undefined;
  }
  if (patch.deployment !== undefined) {
    env.copilotDeployment = patch.deployment && patch.deployment.length > 0 ? patch.deployment : "gpt-4o-mini";
  }
}

export function setOpenAiModels(patch: { diagnosisModel?: string; fixModel?: string }): void {
  if (patch.diagnosisModel?.trim()) env.diagnosisModel = patch.diagnosisModel.trim();
  if (patch.fixModel?.trim()) env.fixModel = patch.fixModel.trim();
}

export function setAiProviders(patch: {
  diagnosisProvider?: "openai" | "anthropic" | "gemini" | "copilot";
  fixProvider?: "openai" | "anthropic" | "gemini" | "copilot";
}): void {
  if (patch.diagnosisProvider) env.diagnosisProvider = patch.diagnosisProvider;
  if (patch.fixProvider) env.fixProvider = patch.fixProvider;
}

export function setPullRequestConfig(patch: Partial<typeof env.pullRequests>): void {
  Object.assign(env.pullRequests, patch);
}
