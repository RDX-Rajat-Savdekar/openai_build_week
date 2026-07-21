import type { ConnectField } from "../platforms/connectFields.js";
import type { NotificationChannelKey } from "./types.js";

export const CHANNEL_FIELDS: Record<NotificationChannelKey, ConnectField[]> = {
  slack: [{ name: "webhookUrl", label: "Incoming webhook URL", type: "password" }],
  email: [
    { name: "smtpHost", label: "SMTP host", type: "text" },
    { name: "smtpPort", label: "SMTP port", type: "text" },
    { name: "smtpUser", label: "SMTP user", type: "text" },
    { name: "smtpPass", label: "SMTP password", type: "password" },
    { name: "from", label: "From address", type: "text" },
    { name: "to", label: "To address", type: "text" },
  ],
};
