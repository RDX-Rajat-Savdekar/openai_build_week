import type { TicketingKey } from "./types.js";

export interface ConnectField {
  name: string;
  label: string;
  type: "text" | "password";
}

/** Only Jira has a real connect form — Linear/Asana/GitHub Issues stay demo-labeled (see plan). */
export const TICKETING_CONNECT_FIELDS: Partial<Record<TicketingKey, ConnectField[]>> = {
  jira: [
    { name: "siteUrl", label: "Jira site URL", type: "text" },
    { name: "email", label: "Account email", type: "text" },
    { name: "apiToken", label: "API token", type: "password" },
    { name: "projectKey", label: "Project key", type: "text" },
  ],
};

export const LIVE_TESTED_TICKETING: TicketingKey[] = ["jira"];
