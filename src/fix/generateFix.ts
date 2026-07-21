import { chatForTask, isFixConfigured, normalizeDiff } from "../ai/router.js";
import type { Diagnosis } from "../platforms/types.js";

const DEMO_DIFF = `--- a/auth/token.js
+++ b/auth/token.js
@@ -1,6 +1,7 @@
 import jwt from "jsonwebtoken";
 
 export function verifyToken(token) {
+  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing')
   return jwt.verify(token, process.env.JWT_SECRET)
 }
`;

/**
 * Multi-provider fix generation — separate from diagnosis; OpenAI or Claude when configured.
 */
export async function generateFix(diagnosis: Diagnosis, fileContents: Record<string, string>): Promise<string> {
  if (!isFixConfigured()) {
    return DEMO_DIFF;
  }

  const filesBlock = Object.entries(fileContents)
    .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 4000)}`)
    .join("\n\n");

  try {
    const content = await chatForTask(
      "fix",
      `Root cause: ${diagnosis.rootCause}\n\nFiles:\n${filesBlock || "(no files provided — infer from diagnosis)"}`,
      { temperature: 0.1 },
    );
    return normalizeDiff(content);
  } catch (error) {
    console.warn("[stitch] fix generation API failed — using demo fallback:", error instanceof Error ? error.message : error);
    return DEMO_DIFF;
  }
}
