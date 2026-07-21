import { existsSync } from "node:fs";
import path from "node:path";
import type { Request } from "express";
import { env } from "./env.js";

const frontendDist = path.resolve(process.cwd(), "frontend/dist");
const hasBundledFrontend = existsSync(path.join(frontendDist, "index.html"));

/** Where the browser UI lives — used for OAuth redirects and invite links. */
export function defaultAppOrigin(): string {
  if (env.appOrigin) return env.appOrigin.replace(/\/$/, "");
  if (hasBundledFrontend) return `http://localhost:${env.port}`;
  return "http://localhost:5173";
}

export function resolveAppOrigin(req?: Request): string {
  if (env.appOrigin) return env.appOrigin.replace(/\/$/, "");

  if (req) {
    const xfHost = req.get("x-forwarded-host");
    const xfProto = req.get("x-forwarded-proto") ?? req.protocol;
    if (xfHost) return `${xfProto}://${xfHost}`.replace(/\/$/, "");

    const referer = req.get("referer");
    if (referer) {
      try {
        const u = new URL(referer);
        return `${u.protocol}//${u.host}`.replace(/\/$/, "");
      } catch {
        /* ignore malformed referer */
      }
    }

    const host = req.get("host");
    if (host?.endsWith(":5173")) return `http://${host}`;
  }

  return defaultAppOrigin();
}
