import { env } from "../../config/env.js";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; code?: number };
}

export async function geminiChat(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${params.system}\n\n${params.user}` }] }],
      generationConfig: { temperature: params.temperature ?? 0.2 },
    }),
  });

  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API error (${response.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

export async function testGeminiConnection(apiKey: string, model = "gemini-2.0-flash"): Promise<void> {
  await geminiChat({
    apiKey,
    model,
    system: "Reply with exactly: ok",
    user: "ping",
    temperature: 0,
  });
}

export function geminiKeyFromEnv(): string | undefined {
  return env.geminiApiKey;
}
