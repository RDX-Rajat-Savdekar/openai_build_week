import { jiraProvider } from "./jira.js";
import type { TicketingKey, TicketingProvider } from "./types.js";

/** Only Jira is a real, live-tested provider right now — see plan section 3. */
export const TICKETING_PLUGINS: Partial<Record<TicketingKey, TicketingProvider>> = {
  jira: jiraProvider,
};

export function ticketingPluginFor(key: string): TicketingProvider | undefined {
  return TICKETING_PLUGINS[key as TicketingKey];
}
