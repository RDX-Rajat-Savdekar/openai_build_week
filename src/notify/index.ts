import { demoWorkspace } from "../config/workspace.js";
import { recordActivity } from "./activityLog.js";
import { emailChannel } from "./email.js";
import { slackChannel } from "./slack.js";
import type { NotificationChannel, NotificationChannelKey, NotificationEvent } from "./types.js";

export const CHANNELS: Record<NotificationChannelKey, NotificationChannel> = {
  slack: slackChannel,
  email: emailChannel,
};

export function allChannels(): NotificationChannel[] {
  return Object.values(CHANNELS);
}

export interface NotifyResult {
  sent: NotificationChannelKey[];
  skipped: NotificationChannelKey[];
  failed: { channel: NotificationChannelKey; error: string }[];
}

/**
 * Dispatches to every channel the workspace has enabled (plan section 8.3)
 * AND that is actually configured (isEnabled()). A channel toggled on in
 * workspace preferences but missing its config/secrets is skipped. Each
 * channel is sent independently — one channel failing (e.g. a bad SMTP
 * password) does not stop the others from firing, and every dispatch is
 * recorded to the activity log (plan section 8.4) regardless of outcome.
 */
export async function notify(event: NotificationEvent): Promise<NotifyResult> {
  const result: NotifyResult = { sent: [], skipped: [], failed: [] };

  for (const channel of allChannels()) {
    const workspaceWantsIt = demoWorkspace.notificationChannels[channel.key];
    if (!workspaceWantsIt || !channel.isEnabled()) {
      result.skipped.push(channel.key);
      continue;
    }
    try {
      await channel.send(event);
      result.sent.push(channel.key);
    } catch (error) {
      result.failed.push({ channel: channel.key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  recordActivity({ event, ...result });
  return result;
}

/**
 * Sends one channel directly, bypassing the workspace-enabled check —
 * this backs the Notifications screen's "Send test" button (plan section
 * 8.3), which should work as soon as a channel is configured, even before
 * the user has flipped the workspace toggle on.
 */
export async function sendTestNotification(key: NotificationChannelKey): Promise<{ ok: boolean; error?: string }> {
  const channel = CHANNELS[key];
  const event: NotificationEvent = {
    type: "fix_opened",
    repo: demoWorkspace.repos[0]?.fullName ?? "your-org/demo-repo",
    branch: "main",
    summary: "Test notification from Stitch",
    url: "https://github.com",
    urgent: false,
  };

  try {
    await channel.send(event);
    recordActivity({ event, sent: [key], skipped: [], failed: [] });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordActivity({ event, sent: [], skipped: [], failed: [{ channel: key, error: message }] });
    return { ok: false, error: message };
  }
}
