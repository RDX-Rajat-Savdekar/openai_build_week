export type NotificationChannelKey = "slack" | "email";

export interface NotificationEvent {
  type: "fix_opened" | "comment_posted" | "diagnosis_failed" | "urgent_release_failure";
  repo: string;
  branch: string;
  summary: string; // one-line, e.g. "Fixed: null pointer in auth.js"
  url: string; // PR or comment link
  urgent: boolean; // true for release/* per the branch router
}

/**
 * Same shape as CiCdPlugin (src/platforms/types.ts) on purpose: a workspace
 * "connects" a channel by populating its config, `enabled` flips to true,
 * and the planned Notifications screen (plan section 8.3) is a thin view
 * over this registry, same as Integrations is over the platform registry.
 */
export interface NotificationChannel {
  key: NotificationChannelKey;
  displayName: string;
  isEnabled(): boolean;
  send(event: NotificationEvent): Promise<void>;
}
