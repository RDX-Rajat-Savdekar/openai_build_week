import type { NextFunction, Request, Response } from "express";
import type { Organization, User } from "@prisma/client";
import { getSessionUser, parseCookies, sessionCookieName } from "./session.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      org?: Organization;
      sessionToken?: string;
    }
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[sessionCookieName()];
  const user = await getSessionUser(token);
  if (user) {
    req.user = user;
    req.org = user.organization;
    req.sessionToken = token;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.org) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  next();
}
