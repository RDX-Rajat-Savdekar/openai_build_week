import { Octokit } from "@octokit/rest";
import { prisma } from "../db/prisma.js";
import { ensureUnassignedProject } from "../store/appStore.js";

export interface SyncedRepo {
  fullName: string;
  private: boolean;
}

/**
 * Real, on-demand fetch of the caller's actual GitHub repos — replaces the
 * seeded demo repos with live data. Not a background poller: no BullMQ/cron
 * exists in this project, and this pass deliberately doesn't add one. Real
 * continuous updates come from the existing GitHub webhook path once a repo
 * has one pointed at this server; this sync is for initial population and a
 * manual "refresh" action.
 */
export async function syncGithubRepos(organizationId: string, token: string): Promise<{ synced: number; repos: SyncedRepo[] }> {
  const client = new Octokit({ auth: token });
  const repos = await client.paginate(client.repos.listForAuthenticatedUser, { per_page: 100, sort: "updated", visibility: "all" });

  const targetProjectId = (await ensureUnassignedProject(organizationId)).id;

  const synced: SyncedRepo[] = [];
  for (const r of repos) {
    await prisma.repo.upsert({
      where: { organizationId_fullName: { organizationId, fullName: r.full_name } },
      update: {},
      create: {
        organizationId,
        projectId: targetProjectId,
        fullName: r.full_name,
        provider: "GitHub",
        mode: "Diagnose & suggest",
        policy: "Default",
        // Newly-synced real repos start disabled — a human should review
        // mode/policy before Stitch can auto-fix a real, non-demo repo.
        enabled: false,
      },
    });
    synced.push({ fullName: r.full_name, private: r.private });
  }

  return { synced: synced.length, repos: synced };
}

/** Token precedence: the org's connected PAT (deliberate, org-wide CI credential)
 * takes priority; the signed-in user's own OAuth token is only a fallback for
 * a brand-new org with no PAT connected yet. */
export async function resolveGithubToken(organizationId: string, user: { githubAccessToken: string | null } | undefined): Promise<string | null> {
  const integration = await prisma.integration.findUnique({ where: { organizationId_key: { organizationId, key: "github" } } });
  const config = (integration?.config as Record<string, string> | undefined) ?? {};
  if (integration?.connected && config.token) return config.token;
  return user?.githubAccessToken ?? null;
}
