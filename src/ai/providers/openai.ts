import OpenAI from "openai";
import { env } from "../../config/env.js";

export async function openAiChat(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey });
  const response = await client.chat.completions.create({
    model: params.model,
    temperature: params.temperature ?? 0.2,
    ...(params.json ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return content;
}

export async function testOpenAiConnection(apiKey: string): Promise<void> {
  const client = new OpenAI({ apiKey });
  await client.models.list();
}

export function openAiKeyFromEnv(): string | undefined {
  return env.openaiApiKey;
}
