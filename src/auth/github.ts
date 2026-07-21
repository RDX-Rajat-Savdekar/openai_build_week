import { env } from "../config/env.js";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPES = "read:user user:email repo workflow";

export function githubOAuthConfigured(): boolean {
  return Boolean(env.githubOAuth.clientId && env.githubOAuth.clientSecret);
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", env.githubOAuth.clientId ?? "");
  url.searchParams.set("redirect_uri", env.githubOAuth.callbackUrl);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.githubOAuth.clientId,
      client_secret: env.githubOAuth.clientSecret,
      code,
      redirect_uri: env.githubOAuth.callbackUrl,
    }),
  });
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!body.access_token) throw new Error(body.error_description ?? body.error ?? "No access token returned");
  return body.access_token;
}

export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
}

async function githubApi(path: string, accessToken: string) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status}`);
  return res.json();
}

export async function fetchGithubProfile(accessToken: string): Promise<GithubProfile> {
  const user = (await githubApi("/user", accessToken)) as { id: number; login: string; name: string | null; email: string | null };

  if (user.email) {
    // The `/user` email is only populated if the user made it public; GitHub
    // doesn't tell us verification status on that endpoint, so treat a
    // publicly-set email as verified (it went through GitHub's own signup
    // verification to be settable at all) but still prefer the explicit
    // primary-verified entry from /user/emails when available.
    try {
      const emails = (await githubApi("/user/emails", accessToken)) as { email: string; primary: boolean; verified: boolean }[];
      const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.email === user.email);
      if (primary) {
        return { id: user.id, login: user.login, name: user.name, email: primary.email, emailVerified: primary.verified };
      }
    } catch {
      // /user/emails needs the user:email scope; fall through to the public email, treated as verified.
    }
    return { id: user.id, login: user.login, name: user.name, email: user.email, emailVerified: true };
  }

  return { id: user.id, login: user.login, name: user.name, email: null, emailVerified: false };
}
