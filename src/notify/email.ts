import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import type { NotificationChannel, NotificationEvent } from "./types.js";

function isConfigured(): boolean {
  return Boolean(env.email.smtpHost && env.email.smtpUser && env.email.smtpPass && env.email.from && env.email.to);
}

function subjectFor(event: NotificationEvent): string {
  const prefix = event.urgent ? "[URGENT] " : "";
  return `${prefix}Stitch — ${event.repo} (${event.branch}): ${event.summary}`;
}

function htmlFor(event: NotificationEvent): string {
  return `
    <p><strong>${event.repo}</strong> (<code>${event.branch}</code>)</p>
    <p>${event.summary}</p>
    <p><a href="${event.url}">${event.url}</a></p>
  `;
}

export const emailChannel: NotificationChannel = {
  key: "email",
  displayName: "Email",

  isEnabled() {
    return isConfigured();
  },

  async send(event: NotificationEvent) {
    if (!isConfigured()) {
      throw new Error("Email channel is not fully configured — see EMAIL_* vars in .env.example");
    }

    const transporter = nodemailer.createTransport({
      host: env.email.smtpHost,
      port: env.email.smtpPort,
      secure: env.email.smtpPort === 465,
      auth: { user: env.email.smtpUser, pass: env.email.smtpPass },
    });

    await transporter.sendMail({
      from: env.email.from,
      to: env.email.to,
      subject: subjectFor(event),
      html: htmlFor(event),
    });
  },
};
