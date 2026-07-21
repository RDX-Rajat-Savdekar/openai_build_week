export type AiProvider = "openai" | "anthropic" | "gemini" | "copilot";

export interface AiModelChoice {
  provider: AiProvider;
  model: string;
}

export interface AiProviderKeys {
  apiKey?: string;
}

/** Microsoft Copilot stack — Azure OpenAI (endpoint + deployment + key). */
export interface CopilotKeys {
  apiKey?: string;
  endpoint?: string;
  deployment?: string;
}

export interface AiPreferences {
  openai?: AiProviderKeys;
  anthropic?: AiProviderKeys;
  gemini?: AiProviderKeys;
  copilot?: CopilotKeys;
  diagnosis?: AiModelChoice;
  fix?: AiModelChoice;
  maxDiffSize?: number;
  quotaExceeded?: "diagnose" | "queue" | "skip" | string;
}

export interface AiSettingsResponse {
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  geminiConfigured: boolean;
  copilotConfigured: boolean;
  aiConfigured: boolean;
  diagnosisProvider: AiProvider;
  diagnosisModel: string;
  fixProvider: AiProvider;
  fixModel: string;
  copilotEndpoint?: string;
  copilotDeployment?: string;
  maxDiffSize: number;
  quotaExceeded: string;
  catalog: Record<AiProvider, { id: string; label: string }[]>;
}

export interface AiTestRequest {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  deployment?: string;
}
