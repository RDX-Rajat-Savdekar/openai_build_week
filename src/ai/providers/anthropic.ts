import { env } from "../../config/env.js";

interface AnthropicMessageResponse {
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
  message?: string;
}

function anthropicErrorMessage(data: AnthropicMessageResponse, status: number): string {
  return data.error?.message ?? data.message ?? `Anthropic API error (${status})`;
}

export async function anthropicChat(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.2,
      system: params.system,
      messages: [{ role: "user", content: params.user }],
    }),
  });

  const data = (await response.json()) as AnthropicMessageResponse;
  if (!response.ok) {
    throw new Error(anthropicErrorMessage(data, response.status));
  }

  const text = data.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text) throw new Error("Empty Anthropic response");
  return text;
}

/** Always use Haiku for connection tests — fast, cheap, widely available. */
export async function testAnthropicConnection(apiKey: string): Promise<void> {
  const text = await anthropicChat({
    apiKey,
    model: "claude-3-5-haiku-20241022",
    system: "Reply with exactly the word: ok",
    user: "ping",
    maxTokens: 32,
    temperature: 0,
  });
  if (!text.toLowerCase().includes("ok")) {
    throw new Error(`Unexpected Anthropic test response: ${text.slice(0, 80)}`);
  }
}

export function anthropicKeyFromEnv(): string | undefined {
  return env.anthropicApiKey;
}
