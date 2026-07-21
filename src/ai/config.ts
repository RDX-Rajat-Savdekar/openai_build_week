import {
  env,
  setAnthropicKey,
  setCopilotConfig,
  setGeminiKey,
  setOpenAiKey,
  setOpenAiModels,
  setAiProviders,
} from "../config/env.js";
import { defaultModelFor, MODEL_CATALOG, normalizeModelId } from "./catalog.js";
import type { AiPreferences, AiProvider, AiSettingsResponse, AiTestRequest } from "./types.js";

export function migrateLegacyOpenaiPrefs(legacy: Record<string, unknown>): AiPreferences {
  return {
    openai: legacy.apiKey ? { apiKey: String(legacy.apiKey) } : undefined,
    diagnosis: {
      provider: "openai",
      model: normalizeModelId("openai", String(legacy.diagnosisModel ?? ""), defaultModelFor("openai", "diagnosis")),
    },
    fix: {
      provider: "openai",
      model: normalizeModelId("openai", String(legacy.fixModel ?? ""), defaultModelFor("openai", "fix")),
    },
    maxDiffSize: typeof legacy.maxDiffSize === "number" ? legacy.maxDiffSize : 500,
    quotaExceeded: typeof legacy.quotaExceeded === "string" ? legacy.quotaExceeded : "diagnose",
  };
}

export function readAiPreferences(prefs: Record<string, unknown>): AiPreferences {
  const stored = prefs.ai as AiPreferences | undefined;
  if (
    stored &&
    (stored.openai?.apiKey ||
      stored.anthropic?.apiKey ||
      stored.gemini?.apiKey ||
      stored.copilot?.apiKey ||
      stored.diagnosis ||
      stored.fix)
  ) {
    return normalizeAiPreferences(stored);
  }
  const legacy = prefs.openai as Record<string, unknown> | undefined;
  if (legacy && Object.keys(legacy).length > 0) {
    return normalizeAiPreferences(migrateLegacyOpenaiPrefs(legacy));
  }
  return normalizeAiPreferences({});
}

function normalizeAiPreferences(raw: AiPreferences): AiPreferences {
  const diagnosisProvider = raw.diagnosis?.provider ?? "openai";
  const fixProvider = raw.fix?.provider ?? "openai";
  return {
    openai: raw.openai?.apiKey ? { apiKey: raw.openai.apiKey } : raw.openai,
    anthropic: raw.anthropic?.apiKey ? { apiKey: raw.anthropic.apiKey } : raw.anthropic,
    gemini: raw.gemini?.apiKey ? { apiKey: raw.gemini.apiKey } : raw.gemini,
    copilot:
      raw.copilot?.apiKey || raw.copilot?.endpoint || raw.copilot?.deployment
        ? {
            apiKey: raw.copilot.apiKey,
            endpoint: raw.copilot.endpoint,
            deployment: raw.copilot.deployment,
          }
        : raw.copilot,
    diagnosis: {
      provider: diagnosisProvider,
      model: normalizeModelId(diagnosisProvider, raw.diagnosis?.model, defaultModelFor(diagnosisProvider, "diagnosis")),
    },
    fix: {
      provider: fixProvider,
      model: normalizeModelId(fixProvider, raw.fix?.model, defaultModelFor(fixProvider, "fix")),
    },
    maxDiffSize: raw.maxDiffSize ?? 500,
    quotaExceeded: raw.quotaExceeded ?? "diagnose",
  };
}

export function providerKey(prefs: AiPreferences, provider: AiProvider): string | undefined {
  switch (provider) {
    case "anthropic":
      return prefs.anthropic?.apiKey ?? env.anthropicApiKey;
    case "gemini":
      return prefs.gemini?.apiKey ?? env.geminiApiKey;
    case "copilot":
      return prefs.copilot?.apiKey ?? env.copilotApiKey;
    default:
      return prefs.openai?.apiKey ?? env.openaiApiKey;
  }
}

export function isProviderConfigured(prefs: AiPreferences, provider: AiProvider): boolean {
  if (provider === "copilot") {
    const key = providerKey(prefs, provider);
    const endpoint = prefs.copilot?.endpoint ?? env.copilotEndpoint;
    return Boolean(key && endpoint);
  }
  return Boolean(providerKey(prefs, provider));
}

export function isAiConfigured(prefs: AiPreferences): boolean {
  const diagnosis = prefs.diagnosis?.provider ?? "openai";
  const fix = prefs.fix?.provider ?? "openai";
  return isProviderConfigured(prefs, diagnosis) || isProviderConfigured(prefs, fix);
}

/** Seeds process-global env for the current org's AI credentials + model routing. */
export function applyAiConfig(prefs: AiPreferences): void {
  const normalized = normalizeAiPreferences(prefs);
  setOpenAiKey(normalized.openai?.apiKey);
  setAnthropicKey(normalized.anthropic?.apiKey);
  setGeminiKey(normalized.gemini?.apiKey);
  setCopilotConfig({
    apiKey: normalized.copilot?.apiKey,
    endpoint: normalized.copilot?.endpoint,
    deployment: normalized.copilot?.deployment,
  });
  setAiProviders({
    diagnosisProvider: normalized.diagnosis!.provider,
    fixProvider: normalized.fix!.provider,
  });
  setOpenAiModels({
    diagnosisModel: normalized.diagnosis!.model,
    fixModel: normalized.fix!.model,
  });
  env.aiMaxDiffSize = normalized.maxDiffSize ?? 500;
  env.aiQuotaExceeded = normalized.quotaExceeded ?? "diagnose";
}

export function buildAiSettingsResponse(prefs: AiPreferences): AiSettingsResponse {
  const normalized = normalizeAiPreferences(prefs);
  return {
    openaiConfigured: isProviderConfigured(normalized, "openai"),
    anthropicConfigured: isProviderConfigured(normalized, "anthropic"),
    geminiConfigured: isProviderConfigured(normalized, "gemini"),
    copilotConfigured: isProviderConfigured(normalized, "copilot"),
    aiConfigured: isAiConfigured(normalized),
    diagnosisProvider: normalized.diagnosis!.provider,
    diagnosisModel: normalized.diagnosis!.model,
    fixProvider: normalized.fix!.provider,
    fixModel: normalized.fix!.model,
    copilotEndpoint: normalized.copilot?.endpoint ?? env.copilotEndpoint,
    copilotDeployment: normalized.copilot?.deployment ?? env.copilotDeployment,
    maxDiffSize: normalized.maxDiffSize ?? 500,
    quotaExceeded: normalized.quotaExceeded ?? "diagnose",
    catalog: {
      openai: MODEL_CATALOG.openai.map((m) => ({ id: m.id, label: m.label })),
      anthropic: MODEL_CATALOG.anthropic.map((m) => ({ id: m.id, label: m.label })),
      gemini: MODEL_CATALOG.gemini.map((m) => ({ id: m.id, label: m.label })),
      copilot: MODEL_CATALOG.copilot.map((m) => ({ id: m.id, label: m.label })),
    },
  };
}

export function mergeAiPreferences(existing: AiPreferences, patch: Partial<AiPreferences>): AiPreferences {
  return normalizeAiPreferences({
    openai: patch.openai !== undefined ? { ...existing.openai, ...patch.openai } : existing.openai,
    anthropic: patch.anthropic !== undefined ? { ...existing.anthropic, ...patch.anthropic } : existing.anthropic,
    gemini: patch.gemini !== undefined ? { ...existing.gemini, ...patch.gemini } : existing.gemini,
    copilot: patch.copilot !== undefined ? { ...existing.copilot, ...patch.copilot } : existing.copilot,
    diagnosis: patch.diagnosis
      ? ({ ...existing.diagnosis, ...patch.diagnosis } as AiPreferences["diagnosis"])
      : existing.diagnosis,
    fix: patch.fix ? ({ ...existing.fix, ...patch.fix } as AiPreferences["fix"]) : existing.fix,
    maxDiffSize: patch.maxDiffSize ?? existing.maxDiffSize,
    quotaExceeded: patch.quotaExceeded ?? existing.quotaExceeded,
  });
}

/** Resolve credentials for a live connection test (unsaved form values win over stored/env). */
export function resolveTestCredentials(
  provider: AiProvider,
  prefs: AiPreferences,
  body: AiTestRequest,
): { apiKey?: string; model?: string; endpoint?: string; deployment?: string } {
  const normalized = normalizeAiPreferences(prefs);
  switch (provider) {
    case "anthropic":
      return {
        apiKey: body.apiKey?.trim() || normalized.anthropic?.apiKey || env.anthropicApiKey,
        model: body.model,
      };
    case "gemini":
      return {
        apiKey: body.apiKey?.trim() || normalized.gemini?.apiKey || env.geminiApiKey,
        model: body.model ?? "gemini-2.0-flash",
      };
    case "copilot":
      return {
        apiKey: body.apiKey?.trim() || normalized.copilot?.apiKey || env.copilotApiKey,
        endpoint: body.endpoint?.trim() || normalized.copilot?.endpoint || env.copilotEndpoint,
        deployment:
          body.deployment?.trim() ||
          body.model?.trim() ||
          normalized.copilot?.deployment ||
          env.copilotDeployment ||
          "gpt-4o-mini",
      };
    default:
      return {
        apiKey: body.apiKey?.trim() || normalized.openai?.apiKey || env.openaiApiKey,
        model: body.model,
      };
  }
}

/** Keep legacy openai blob in sync for older clients. */
export function toLegacyOpenaiBlob(ai: AiPreferences): Record<string, string | number> {
  const normalized = normalizeAiPreferences(ai);
  const blob: Record<string, string | number> = {
    diagnosisModel: normalized.diagnosis!.model,
    fixModel: normalized.fix!.model,
    maxDiffSize: normalized.maxDiffSize ?? 500,
    quotaExceeded: normalized.quotaExceeded ?? "diagnose",
  };
  if (normalized.openai?.apiKey) blob.apiKey = normalized.openai.apiKey;
  return blob;
}

export function disconnectProviderPatch(provider: AiProvider): Partial<AiPreferences> {
  switch (provider) {
    case "anthropic":
      return { anthropic: {} };
    case "gemini":
      return { gemini: {} };
    case "copilot":
      return { copilot: {} };
    default:
      return { openai: {} };
  }
}
