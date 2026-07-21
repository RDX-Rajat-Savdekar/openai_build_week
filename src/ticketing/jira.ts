import type { TicketingProvider, TicketStatus } from "./types.js";

const REQUIRED_FIELDS = ["siteUrl", "email", "apiToken", "projectKey"] as const;

function baseUrl(config: Record<string, string>): string {
  return (config.siteUrl ?? "").replace(/\/+$/, "");
}

function authHeader(config: Record<string, string>): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

async function jiraFetch(config: Record<string, string>, path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl(config)}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(config),
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

/** Jira Cloud REST v3 requires description in Atlassian Document Format, not plain text. */
function adfParagraph(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n\n").map((para) => ({
      type: "paragraph",
      content: [{ type: "text", text: para }],
    })),
  };
}

const DONE_NAMES = ["done", "closed", "resolve"];
const IN_PROGRESS_NAMES = ["in progress", "start"];
const REOPEN_NAMES = ["reopen", "to do", "open", "backlog"];

const STATUS_MATCHERS: Record<TicketStatus, string[]> = {
  done: DONE_NAMES,
  in_progress: IN_PROGRESS_NAMES,
  reopened: REOPEN_NAMES,
};

export const jiraProvider: TicketingProvider = {
  key: "jira",
  displayName: "Jira",

  isConnected(config) {
    return REQUIRED_FIELDS.every((f) => Boolean(config[f]));
  },

  async testConnection(config) {
    if (!jiraProvider.isConnected(config)) {
      return { ok: false, error: "Site URL, email, API token, and project key are all required" };
    }
    try {
      const res = await jiraFetch(config, "/rest/api/3/myself");
      if (!res.ok) {
        return { ok: false, error: `Jira responded with ${res.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Jira connection failed" };
    }
  },

  async createTicket(config, failure, diagnosis, issueSlug) {
    const summary = `[Stitch] ${diagnosis.rootCause}`.slice(0, 250);
    const description = adfParagraph(
      `${diagnosis.explanation}\n\nRepo: ${failure.repo}\nBranch: ${failure.branch}\nRun: ${failure.logsUrl}\nIssue: ${issueSlug}`,
    );

    const res = await jiraFetch(config, "/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify({
        fields: {
          project: { key: config.projectKey },
          summary,
          description,
          issuetype: { name: "Bug" },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira issue creation failed: ${res.status} ${body}`.trim());
    }

    const body = (await res.json()) as { key: string };
    return { ticketId: body.key, url: `${baseUrl(config)}/browse/${body.key}` };
  },

  async updateTicketStatus(config, ticketId, status) {
    try {
      const res = await jiraFetch(config, `/rest/api/3/issue/${encodeURIComponent(ticketId)}/transitions`);
      if (!res.ok) return;
      const body = (await res.json()) as { transitions: { id: string; name: string }[] };
      const wanted = STATUS_MATCHERS[status];
      const match = body.transitions.find((t) => wanted.some((w) => t.name.toLowerCase().includes(w)));
      if (!match) return;

      await jiraFetch(config, `/rest/api/3/issue/${encodeURIComponent(ticketId)}/transitions`, {
        method: "POST",
        body: JSON.stringify({ transition: { id: match.id } }),
      });
    } catch (error) {
      console.error(`[stitch] Jira transition failed for ${ticketId}:`, error instanceof Error ? error.message : error);
    }
  },
};
