import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { resolveAppOrigin } from "../config/appOrigin.js";
import { bootstrapOrganization, joinOrganizationViaInvite } from "./bootstrap.js";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubProfile, githubOAuthConfigured } from "./github.js";
import { buildClearCookie, buildSessionCookie, createSession, destroySession, parseCookies, sessionCookieName, sessionTtlMsFor } from "./session.js";
import { getInviteByToken } from "../store/appStore.js";

export const authRouter = Router();

const OAUTH_STATE_COOKIE = "stitch_oauth_state";
const OAUTH_INVITE_COOKIE = "stitch_oauth_invite";

function orgSessionTtlMs(org: { preferences?: unknown }): number {
  const security = (org.preferences as Record<string, unknown> | null | undefined)?.security as
    | { sessionTimeoutHours?: number | "never" }
    | undefined;
  return sessionTtlMsFor(security?.sessionTimeoutHours);
}

function publicUser(user: { id: string; email: string; name: string; role: string; organizationId: string }, org: { id: string; name: string; slug: string; plan: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
  };
}

function authRedirect(req: Parameters<typeof resolveAppOrigin>[0], path: string): string {
  return `${resolveAppOrigin(req)}${path.startsWith("/") ? path : `/${path}`}`;
}

function oauthCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearOAuthCookie(name: string): string {
  return `${name}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

authRouter.get("/config", (_req, res) => {
  res.json({ githubOAuth: githubOAuthConfigured() });
});

authRouter.get("/invite/:token", async (req, res) => {
  const invite = await getInviteByToken(req.params.token);
  if (!invite) {
    res.status(404).json({ valid: false });
    return;
  }
  res.json({ valid: true, orgName: invite.organization.name, email: invite.email, role: invite.role });
});

authRouter.post("/signup", async (req, res) => {
  const body = (req.body ?? {}) as { orgName?: string; name?: string; email?: string; password?: string; invite?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const inviteToken = body.invite?.trim();

  if (!name || !email || password.length < 8) {
    res.status(400).json({ error: "Name, email, and an 8+ character password are required" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (inviteToken) {
    const invite = await getInviteByToken(inviteToken);
    if (!invite) {
      res.status(400).json({ error: "This invite link is invalid or has expired" });
      return;
    }

    try {
      const user = await joinOrganizationViaInvite(invite, { email, name, passwordHash });
      const ttlMs = orgSessionTtlMs(user.organization);
      const token = await createSession(user.id, ttlMs);
      res.setHeader("Set-Cookie", buildSessionCookie(token, ttlMs));
      res.status(201).json({ user: publicUser(user, user.organization) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite failed";
      if (message.startsWith("INVITE_EMAIL_MISMATCH:")) {
        res.status(400).json({ error: `This invite was sent to ${message.split(":")[1]} — sign up with that email address` });
        return;
      }
      if (message === "ACCOUNT_EXISTS") {
        res.status(409).json({ error: "An account with that email already exists — sign in instead" });
        return;
      }
      res.status(400).json({ error: message });
    }
    return;
  }

  const orgName = body.orgName?.trim();
  if (!orgName) {
    res.status(400).json({ error: "Organization name is required" });
    return;
  }

  const org = await prisma.$transaction(async (tx) => bootstrapOrganization(tx, orgName, { email, passwordHash, name, role: "Admin" }));

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const ttlMs = orgSessionTtlMs(org);
  const token = await createSession(user.id, ttlMs);
  res.setHeader("Set-Cookie", buildSessionCookie(token, ttlMs));
  res.status(201).json({ user: publicUser(user, org) });
});

authRouter.post("/login", async (req, res) => {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({
      error:
        user && !user.passwordHash
          ? 'This account signed up with GitHub — use "Continue with GitHub" to sign in'
          : "Incorrect email or password",
    });
    return;
  }

  const ttlMs = orgSessionTtlMs(user.organization);
  const token = await createSession(user.id, ttlMs);
  res.setHeader("Set-Cookie", buildSessionCookie(token, ttlMs));
  res.json({ user: publicUser(user, user.organization) });
});

authRouter.post("/logout", async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  await destroySession(cookies[sessionCookieName()]);
  res.setHeader("Set-Cookie", buildClearCookie());
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  if (!req.user || !req.org) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json({ user: publicUser(req.user, req.org) });
});

authRouter.get("/github", (req, res) => {
  if (!githubOAuthConfigured()) {
    res.redirect(authRedirect(req, "/login?error=github_not_configured"));
    return;
  }

  const state = randomBytes(16).toString("hex");
  const invite = typeof req.query.invite === "string" ? req.query.invite.trim() : "";
  const cookies = [oauthCookie(OAUTH_STATE_COOKIE, state, 600)];
  if (invite) cookies.push(oauthCookie(OAUTH_INVITE_COOKIE, encodeURIComponent(invite), 600));
  res.setHeader("Set-Cookie", cookies);
  res.redirect(buildAuthorizeUrl(state));
});

authRouter.get("/github/callback", async (req, res) => {
  const clearCookies = [clearOAuthCookie(OAUTH_STATE_COOKIE), clearOAuthCookie(OAUTH_INVITE_COOKIE)];

  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const cookies = parseCookies(req.headers.cookie);
    if (!code || !state || !cookies[OAUTH_STATE_COOKIE] || cookies[OAUTH_STATE_COOKIE] !== state) {
      res.setHeader("Set-Cookie", clearCookies);
      res.redirect(authRedirect(req, "/login?error=github_oauth_failed"));
      return;
    }

    const inviteToken = cookies[OAUTH_INVITE_COOKIE] ? decodeURIComponent(cookies[OAUTH_INVITE_COOKIE]) : "";
    const accessToken = await exchangeCodeForToken(code);
    const profile = await fetchGithubProfile(accessToken);
    const githubId = String(profile.id);
    const email = profile.email ?? `${profile.login}-${profile.id}@users.noreply.stitch.local`;

    let user = await prisma.user.findUnique({ where: { githubId }, include: { organization: true } });

    if (!user && profile.email && profile.emailVerified) {
      const byEmail = await prisma.user.findUnique({ where: { email: profile.email }, include: { organization: true } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { githubId, githubUsername: profile.login, githubAccessToken: accessToken },
          include: { organization: true },
        });
      }
    }

    if (user) {
      if (user.githubAccessToken !== accessToken || user.githubUsername !== profile.login) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubAccessToken: accessToken, githubUsername: profile.login },
          include: { organization: true },
        });
      }
    } else if (inviteToken) {
      const invite = await getInviteByToken(inviteToken);
      if (!invite) {
        res.setHeader("Set-Cookie", clearCookies);
        res.redirect(authRedirect(req, `/signup?invite=${encodeURIComponent(inviteToken)}&error=invite_invalid`));
        return;
      }

      try {
        user = await joinOrganizationViaInvite(invite, {
          email,
          name: profile.name ?? profile.login,
          githubId,
          githubUsername: profile.login,
          githubAccessToken: accessToken,
        });
      } catch (error) {
        res.setHeader("Set-Cookie", clearCookies);
        const message = error instanceof Error ? error.message : "Invite failed";
        if (message.startsWith("INVITE_EMAIL_MISMATCH:")) {
          res.redirect(
            authRedirect(req, `/signup?invite=${encodeURIComponent(inviteToken)}&error=invite_email_mismatch`),
          );
          return;
        }
        if (message === "ACCOUNT_EXISTS") {
          res.redirect(authRedirect(req, "/login?error=account_exists"));
          return;
        }
        res.redirect(authRedirect(req, "/login?error=github_oauth_failed"));
        return;
      }
    } else {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        res.setHeader("Set-Cookie", clearCookies);
        res.redirect(authRedirect(req, "/login?error=account_exists"));
        return;
      }

      const orgName = profile.name ?? profile.login;
      await prisma.$transaction(async (tx) =>
        bootstrapOrganization(tx, orgName, {
          email,
          name: profile.name ?? profile.login,
          role: "Admin",
          githubId,
          githubUsername: profile.login,
          githubAccessToken: accessToken,
        }),
      );

      user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { organization: true } });
    }

    const ttlMs = orgSessionTtlMs(user.organization);
    const token = await createSession(user.id, ttlMs);
    res.setHeader("Set-Cookie", [...clearCookies, buildSessionCookie(token, ttlMs)]);
    res.redirect(authRedirect(req, "/app/dashboard"));
  } catch (error) {
    console.error("[stitch] GitHub OAuth callback failed:", error instanceof Error ? error.message : error);
    res.setHeader("Set-Cookie", clearCookies);
    res.redirect(authRedirect(req, "/login?error=github_oauth_failed"));
  }
});
