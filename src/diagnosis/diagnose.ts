import { env } from "../config/env.js";
import { chatForTask, extractDiagnosisJson, isDiagnosisConfigured } from "../ai/router.js";
import type { Diagnosis } from "../platforms/types.js";

const DEMO_DIAGNOSIS: Diagnosis = {
  rootCause: "Missing environment variable JWT_SECRET causes jwt.verify() to throw at auth/token.js:47.",
  explanation:
    "The CI run failed because the test suite hits the auth middleware before JWT_SECRET is injected. The fix is to guard the env read or add the secret to the workflow env block.",
  likelyFiles: ["auth/token.js", ".github/workflows/ci.yml"],
};

/**
 * Multi-provider diagnosis — OpenAI or Anthropic (Claude) when configured, demo otherwise.
 */
export async function diagnose(logs: string): Promise<Diagnosis> {
  if (!isDiagnosisConfigured()) {
    return { ...DEMO_DIAGNOSIS, explanation: `[demo mode] ${DEMO_DIAGNOSIS.explanation}` };
  }

  try {
    const content = await chatForTask(
      "diagnosis",
      `CI logs:\n\n${logs.slice(0, 12000)}`,
      { json: env.diagnosisProvider === "openai", temperature: 0.2 },
    );
    return extractDiagnosisJson(content);
  } catch (error) {
    console.warn("[stitch] diagnosis API failed — using demo fallback:", error instanceof Error ? error.message : error);
    return { ...DEMO_DIAGNOSIS, explanation: `[demo fallback] ${DEMO_DIAGNOSIS.explanation}` };
  }
}
