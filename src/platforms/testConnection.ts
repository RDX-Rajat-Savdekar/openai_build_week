import { Octokit } from "@octokit/rest";
import type { PlatformKey } from "./types.js";
import { PLATFORM_CAPABILITIES } from "./integrationMeta.js";

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  detail?: string;
}

export async function testPlatformConnection(
  key: PlatformKey,
  config: Record<string, string>,
): Promise<ConnectionTestResult> {
  if (key === "github") {
    const token = config.token?.trim();
    if (!token) {
      return { ok: false, message: "Personal access token is required" };
    }
    try {
      const client = new Octokit({ auth: token });
      const { data } = await client.users.getAuthenticated();
      const scopes = await client.request("GET /user").then(() => "ok").catch(() => null);
      void scopes;
      return {
        ok: true,
        message: `Connected as @${data.login}`,
        detail: data.name ? `${data.name} · token verified with GitHub API` : "Token verified with GitHub API",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "GitHub API rejected this token",
      };
    }
  }

  const caps = PLATFORM_CAPABILITIES[key];
  const required = Object.entries(config).filter(([, v]) => v?.trim());
  if (required.length === 0) {
    return { ok: false, message: "No credentials configured — connect first" };
  }

  return {
    ok: true,
    message: "Credentials saved",
    detail: caps.pipelineReady
      ? "Live API verification is available after pipeline support ships for this provider."
      : "Provider UI is ready — pipeline API calls for this platform are not live-tested yet.",
  };
}
