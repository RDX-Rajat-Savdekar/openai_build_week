import type { AiProvider } from "./types.js";
import { testAnthropicConnection } from "./providers/anthropic.js";
import { testCopilotConnection } from "./providers/copilot.js";
import { testGeminiConnection } from "./providers/gemini.js";
import { testOpenAiConnection } from "./providers/openai.js";

export async function testAiProvider(
  provider: AiProvider,
  creds: { apiKey: string; model?: string; endpoint?: string; deployment?: string },
): Promise<{ ok: true; message: string }> {
  switch (provider) {
    case "anthropic":
      await testAnthropicConnection(creds.apiKey);
      return { ok: true, message: "Anthropic (Claude) connection verified" };
    case "gemini":
      await testGeminiConnection(creds.apiKey, creds.model ?? "gemini-2.0-flash");
      return { ok: true, message: "Google Gemini connection verified" };
    case "copilot": {
      if (!creds.endpoint?.trim()) throw new Error("Azure OpenAI endpoint is required (e.g. https://your-resource.openai.azure.com)");
      if (!creds.deployment?.trim()) throw new Error("Azure deployment name is required");
      await testCopilotConnection({
        apiKey: creds.apiKey,
        endpoint: creds.endpoint,
        deployment: creds.deployment,
      });
      return { ok: true, message: "Microsoft Copilot (Azure OpenAI) connection verified" };
    }
    default:
      await testOpenAiConnection(creds.apiKey);
      return { ok: true, message: "OpenAI connection verified" };
  }
}
