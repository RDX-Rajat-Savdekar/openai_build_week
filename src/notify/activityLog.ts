import type { NotificationChannelKey, NotificationEvent } from "./types.js";
import { broadcast } from "../realtime/sse.js";

export interface ActivityEntry {
  id: number;
  at: string; // ISO timestamp
  event: NotificationEvent;
  sent: NotificationChannelKey[];
  skipped: NotificationChannelKey[];
  failed: { channel: NotificationChannelKey; error: string }[];
}

/**
 * In-memory only (see the same tradeoff note in config/env.ts) — this is
 * what the Activity screen (plan section 8.4) reads. A real workspace
 * would persist this; for the demo it's enough to prove every webhook that
 * comes in produces a visible, timestamped record.
 */
const log: ActivityEntry[] = [];
let nextId = 1;

export function recordActivity(entry: Omit<ActivityEntry, "id" | "at">): ActivityEntry {
  const full: ActivityEntry = { id: nextId++, at: new Date().toISOString(), ...entry };
  log.unshift(full); // newest first
  if (log.length > 200) log.length = 200;
  broadcast("activity", full);
  return full;
}

export function getActivity(): ActivityEntry[] {
  return log;
}
