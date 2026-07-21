import type { AiProvider } from "./types.js";

export const OPENAI_MODELS = [
  { id: "gpt-4o", label: "GPT-4o (recommended)" },
  { id: "gpt-4o-mini", label: "GPT-4o mini (fast, lower cost)" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
] as const;

export const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (recommended)" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (fast)" },
] as const;

export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recommended)" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (fast)" },
] as const;

/** For Copilot / Azure OpenAI the model id is your deployment name. */
export const COPILOT_MODELS = [
  { id: "gpt-4o", label: "gpt-4o deployment" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini deployment" },
  { id: "gpt-4.1", label: "gpt-4.1 deployment" },
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini deployment" },
] as const;

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  copilot: "Microsoft Copilot (Azure OpenAI)",
};

export const MODEL_CATALOG: Record<AiProvider, readonly { id: string; label: string }[]> = {
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  copilot: COPILOT_MODELS,
};

const LEGACY_MODEL_MAP: Record<string, string> = {
  "gpt-5.6": "gpt-4o",
  "gpt-5.6-mini": "gpt-4o-mini",
  "gpt-5": "gpt-4o-mini",
  codex: "gpt-4o",
  "codex-fast": "gpt-4o-mini",
};

export function normalizeModelId(provider: AiProvider, model: string | undefined, fallback: string): string {
  if (!model?.trim()) return fallback;
  const trimmed = model.trim();
  return LEGACY_MODEL_MAP[trimmed] ?? trimmed;
}

export function defaultModelFor(provider: AiProvider, task: "diagnosis" | "fix"): string {
  switch (provider) {
    case "anthropic":
      return task === "fix" ? "claude-sonnet-4-20250514" : "claude-3-5-sonnet-20241022";
    case "gemini":
      return task === "fix" ? "gemini-1.5-pro" : "gemini-2.0-flash";
    case "copilot":
      return task === "fix" ? "gpt-4o" : "gpt-4o-mini";
    default:
      return task === "fix" ? "gpt-4o" : "gpt-4o-mini";
  }
}

export function providerDisplayName(provider: AiProvider): string {
  return AI_PROVIDER_LABELS[provider];
}
