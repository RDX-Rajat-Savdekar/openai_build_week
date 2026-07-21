import type { PlatformKey } from "./types.js";

export interface ConnectField {
  name: string;
  label: string;
  type: "text" | "password";
}

/**
 * Drives the Integrations screen's connect form generically — one place
 * that knows "GitHub needs a token + webhook secret, Jenkins needs a base
 * URL + user + API token + webhook secret" so the frontend doesn't
 * hardcode five separate forms.
 */
export const CONNECT_FIELDS: Record<PlatformKey, ConnectField[]> = {
  github: [
    { name: "token", label: "Personal access token", type: "password" },
    { name: "webhookSecret", label: "Webhook secret", type: "password" },
  ],
  gitlab: [
    { name: "token", label: "Access token", type: "password" },
    { name: "webhookSecret", label: "Webhook secret token", type: "password" },
  ],
  circleci: [
    { name: "token", label: "API token", type: "password" },
    { name: "webhookSecret", label: "Webhook signing secret", type: "password" },
  ],
  jenkins: [
    { name: "baseUrl", label: "Jenkins base URL", type: "text" },
    { name: "user", label: "User", type: "text" },
    { name: "apiToken", label: "API token", type: "password" },
    { name: "webhookSecret", label: "Webhook secret", type: "password" },
  ],
  bitbucket: [
    { name: "username", label: "Username", type: "text" },
    { name: "appPassword", label: "App password", type: "password" },
    { name: "webhookSecret", label: "Webhook secret", type: "password" },
  ],
};

/** Only GitHub has real, live-tested API calls behind it — see plan section 5. */
export const LIVE_TESTED_PLATFORMS: PlatformKey[] = ["github"];
