import type { Diagnosis, NormalizedFailure } from "../platforms/types.js";

export type TicketingKey = "jira" | "linear" | "asana" | "github_issues";

export type TicketStatus = "in_progress" | "done" | "reopened";

/**
 * Unlike CiCdPlugin (src/platforms/types.ts), which reads its per-org config
 * from the shared global `env` object, every method here takes `config`
 * explicitly. This is new code with no legacy call sites to preserve, so it's
 * written the way the CI/CD plugins' config plumbing arguably should have
 * been from the start — no global mutation, no per-request re-seeding.
 */
export interface TicketingProvider {
  key: TicketingKey;
  displayName: string;

  isConnected(config: Record<string, string>): boolean;

  testConnection(config: Record<string, string>): Promise<{ ok: boolean; error?: string }>;

  createTicket(
    config: Record<string, string>,
    failure: NormalizedFailure,
    diagnosis: Diagnosis,
    issueSlug: string,
  ): Promise<{ ticketId: string; url: string }>;

  /** Best-effort: callers must never let a failure here surface as a pipeline/API error. */
  updateTicketStatus(config: Record<string, string>, ticketId: string, status: TicketStatus): Promise<void>;
}
