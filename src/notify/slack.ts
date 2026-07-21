import { env } from "../config/env.js";
import type { NotificationChannel, NotificationEvent } from "./types.js";

function messageFor(event: NotificationEvent): string {
  const prefix = event.urgent ? ":rotating_light: " : "";
  return `${prefix}*${event.repo}* (\`${event.branch}\`) — ${event.summary}\n<${event.url}|View>`;
}

export const slackChannel: NotificationChannel = {
  key: "slack",
  displayName: "Slack",

  isEnabled() {
    return Boolean(env.slack.webhookUrl);
  },

  async send(event: NotificationEvent) {
    if (!env.slack.webhookUrl) {
      throw new Error("SLACK_WEBHOOK_URL is not configured");
    }

    const response = await fetch(env.slack.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: messageFor(event) }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook responded with ${response.status}`);
    }
  },
};
