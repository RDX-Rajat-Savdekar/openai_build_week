import { env } from "../config/env.js";
import type { Diagnosis } from "../platforms/types.js";
import type { AiProvider } from "./types.js";
import { anthropicChat, anthropicKeyFromEnv } from "./providers/anthropic.js";
import { copilotChat, copilotConfigFromEnv } from "./providers/copilot.js";
import { geminiChat, geminiKeyFromEnv } from "./providers/gemini.js";
import { openAiChat, openAiKeyFromEnv } from "./providers/openai.js";

const DIAGNOSIS_SYSTEM =
  'You diagnose CI failures. Respond JSON only: {"rootCause":"one line","explanation":"2-3 sentences","likelyFiles":["path1","path2"]}';

const FIX_SYSTEM =
  "You write minimal unified diffs to fix CI failures. Output ONLY a valid unified diff, no markdown fences.";

function providerReady(provider: AiProvider): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(anthropicKeyFromEnv());
    case "gemini":
      return Boolean(geminiKeyFromEnv());
    case "copilot": {
      const cfg = copilotConfigFromEnv();
      return Boolean(cfg.apiKey && cfg.endpoint);
    }
    default:
      return Boolean(openAiKeyFromEnv());
  }
}

export function isDiagnosisConfigured(): boolean {
  return providerReady(env.diagnosisProvider);
}

export function isFixConfigured(): boolean {
  return providerReady(env.fixProvider);
}

export async function chatForTask(
  task: "diagnosis" | "fix",
  user: string,
  opts?: { json?: boolean; temperature?: number },
): Promise<string> {
  const provider = task === "diagnosis" ? env.diagnosisProvider : env.fixProvider;
  const model = task === "diagnosis" ? env.diagnosisModel : env.fixModel;
  const system = task === "diagnosis" ? DIAGNOSIS_SYSTEM : FIX_SYSTEM;
  const temperature = opts?.temperature ?? (task === "diagnosis" ? 0.2 : 0.1);
  const json = opts?.json ?? task === "diagnosis";

  switch (provider) {
    case "anthropic": {
      const apiKey = anthropicKeyFromEnv();
      if (!apiKey) throw new Error("Anthropic API key not configured");
      return anthropicChat({ apiKey, model, system, user, temperature });
    }
    case "gemini": {
      const apiKey = geminiKeyFromEnv();
      if (!apiKey) throw new Error("Gemini API key not configured");
      const prompt = json ? `${system}\n\nReturn valid JSON only.\n\n${user}` : user;
      return geminiChat({ apiKey, model, system, user: prompt, temperature });
    }
    case "copilot": {
      const cfg = copilotConfigFromEnv();
      if (!cfg.apiKey || !cfg.endpoint) throw new Error("Copilot / Azure OpenAI not configured");
      return copilotChat({
        apiKey: cfg.apiKey,
        endpoint: cfg.endpoint,
        deployment: model,
        system,
        user,
        temperature,
        json,
      });
    }
    default: {
      const apiKey = openAiKeyFromEnv();
      if (!apiKey) throw new Error("OpenAI API key not configured");
      return openAiChat({ apiKey, model, system, user, json, temperature });
    }
  }
}

export function extractDiagnosisJson(text: string): Diagnosis {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON");
  const parsed = JSON.parse(match[0]) as Diagnosis;
  if (!parsed.rootCause || !parsed.likelyFiles?.length) {
    throw new Error("Incomplete diagnosis JSON");
  }
  parsed.explanation ??= parsed.rootCause;
  return parsed;
}

export function normalizeDiff(text: string): string {
  const diff = text.trim();
  if (!diff.includes("---")) throw new Error("Response is not a unified diff");
  return diff.replace(/^```[\w]*\n?|\n?```$/g, "");
}
