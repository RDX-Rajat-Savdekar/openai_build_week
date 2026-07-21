import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";

const COOKIE_NAME = "stitch_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — matches Settings → Security's default; an org can configure this longer/shorter (or "Never") for real, see sessionTtlMsFor below.
const NEVER_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000; // "Never" expire — 10 years is a practical stand-in for a DB-backed expiresAt column.

/** Settings → Security's real "Session timeout" preference, resolved to a TTL. */
export function sessionTtlMsFor(hoursPref: number | "never" | undefined): number {
  if (hoursPref === "never") return NEVER_TTL_MS;
  if (typeof hoursPref === "number" && hoursPref > 0) return hoursPref * 60 * 60 * 1000;
  return SESSION_TTL_MS;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function buildSessionCookie(token: string, ttlMs: number = SESSION_TTL_MS): string {
  const maxAgeSeconds = Math.floor(ttlMs / 1000);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function createSession(userId: string, ttlMs: number = SESSION_TTL_MS) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function getSessionUser(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { organization: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

export async function listSessionsForUser(userId: string) {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export async function destroyOtherSessions(userId: string, keepToken: string) {
  await prisma.session.deleteMany({ where: { userId, token: { not: keepToken } } });
}
