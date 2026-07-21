import { env } from "../../config/env.js";

interface AzureChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; code?: string };
}

export async function copilotChat(params: {
  apiKey: string;
  endpoint: string;
  deployment: string;
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const base = params.endpoint.replace(/\/$/, "");
  const url = `${base}/openai/deployments/${encodeURIComponent(params.deployment)}/chat/completions?api-version=2024-08-01-preview`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": params.apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: params.temperature ?? 0.2,
      max_tokens: 4096,
      ...(params.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const data = (await response.json()) as AzureChatResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Azure OpenAI error (${response.status})`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty Copilot / Azure OpenAI response");
  return content;
}

export async function testCopilotConnection(params: {
  apiKey: string;
  endpoint: string;
  deployment: string;
}): Promise<void> {
  await copilotChat({
    apiKey: params.apiKey,
    endpoint: params.endpoint,
    deployment: params.deployment,
    system: "Reply with exactly: ok",
    user: "ping",
    temperature: 0,
  });
}

export function copilotConfigFromEnv(): { apiKey?: string; endpoint?: string; deployment?: string } {
  return {
    apiKey: env.copilotApiKey,
    endpoint: env.copilotEndpoint,
    deployment: env.copilotDeployment,
  };
}
