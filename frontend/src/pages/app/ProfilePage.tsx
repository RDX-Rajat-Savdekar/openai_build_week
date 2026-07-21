import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, Toggle, inputClass, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { useTheme } from "@/context/ThemeProvider";
import { usePermissions } from "@/context/PermissionsContext";
import { api, auth, type UserPersonalPreferences, type UserProfile } from "@/lib/api";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "@/lib/permissions";
import { BUILTIN_ROLE_COLORS } from "@/lib/roles";
import { cn } from "@/lib/cn";
import {
  Building2,
  Github,
  KeyRound,
  Monitor,
  Moon,
  Shield,
  Sun,
  User,
  Bell,
  LogOut,
  Laptop,
} from "lucide-react";

type Tab = "overview" | "account" | "preferences" | "security";

const TIMEZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

const LANGUAGES = [
  { value: "en-us", label: "English (US)" },
  { value: "en-gb", label: "English (UK)" },
  { value: "hi", label: "Hindi" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
];

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function authMethodLabel(method: UserProfile["user"]["authMethod"]) {
  if (method === "both") return "Email + GitHub";
  if (method === "github") return "GitHub OAuth";
  return "Email & password";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { role, permissions, can } = usePermissions();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState<UserPersonalPreferences | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.myProfile();
      setProfile(data);
      setName(data.user.name);
      setEmail(data.user.email);
      setPrefs(data.preferences);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load profile", false);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountDirty = profile && (name !== profile.user.name || email !== profile.user.email);
  const prefsDirty = profile && prefs && JSON.stringify(prefs) !== JSON.stringify(profile.preferences);

  const enabledPermissions = useMemo(() => {
    if (!permissions) return [];
    return PERMISSION_KEYS.filter((k) => can(k)).map((k) => PERMISSION_LABELS[k]);
  }, [permissions, can]);

  const saveAccount = async () => {
    if (!profile || !accountDirty) return;
    setSavingAccount(true);
    try {
      const updated = await api.saveMyProfile({ name: name.trim(), email: email.trim() });
      setProfile(updated);
      setName(updated.user.name);
      setEmail(updated.user.email);
      toast.show("Account updated");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setSavingAccount(false);
    }
  };

  const savePreferences = async () => {
    if (!prefs || !prefsDirty) return;
    setSavingPrefs(true);
    try {
      const updated = await api.saveMyPreferences(prefs);
      setPrefs(updated);
      setProfile((prev) => (prev ? { ...prev, preferences: updated } : prev));
      toast.show("Preferences saved");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setSavingPrefs(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.show("New passwords don't match", false);
      return;
    }
    setChangingPassword(true);
    try {
      await api.changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.show("Password updated");
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Password update failed", false);
    } finally {
      setChangingPassword(false);
    }
  };

  const revokeOthers = async () => {
    if (!confirm("Sign out all other devices? You'll stay signed in here.")) return;
    setRevokingSessions(true);
    try {
      const result = await api.revokeOtherSessions();
      setProfile((prev) => (prev ? { ...prev, sessions: result.sessions } : prev));
      toast.show("Other sessions signed out");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Could not revoke sessions", false);
    } finally {
      setRevokingSessions(false);
    }
  };

  const signOut = async () => {
    await auth.logout();
    navigate("/login");
  };

  if (loading && !profile) {
    return (
      <>
        <PageHeader title="Profile" subtitle="Loading account…" />
        <Card className="mb-4 h-24 animate-pulse bg-panel-2" />
        <Card className="h-64 animate-pulse bg-panel-2" />
      </>
    );
  }

  if (!profile || !prefs) {
    return <PageHeader title="Profile" subtitle="Unable to load your account." />;
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "account", label: "Account", icon: KeyRound },
    { id: "preferences", label: "Preferences", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
  ];

  const otherSessions = profile.sessions.filter((s) => !s.current);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: BUILTIN_ROLE_COLORS[profile.user.role] ?? "#6153e0" }}
          >
            {initialsOf(profile.user.name)}
          </span>
          <div className="min-w-0">
            <PageHeader
              title={profile.user.name}
              subtitle={`${profile.user.email} · ${profile.organization.name}`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{profile.user.role}</Badge>
              <Badge tone="outline">{authMethodLabel(profile.user.authMethod)}</Badge>
              {profile.user.githubUsername && (
                <Badge tone="neutral">
                  <Github size={12} /> @{profile.user.githubUsername}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut size={14} /> Sign out
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Member since", value: formatDate(profile.user.createdAt) },
          { label: "Workspace", value: profile.organization.slug },
          { label: "Active sessions", value: profile.sessions.length },
          { label: "Permissions", value: enabledPermissions.length },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-lg font-bold tabular-nums truncate">{s.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors -mb-px",
                active ? "border-accent text-accent" : "border-transparent text-muted hover:text-text-2",
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,320px)]">
          <div className="space-y-4">
            <Card>
              <CardTitle>Your access</CardTitle>
              <CardSub>
                Role <strong>{role}</strong> in {profile.organization.name} — assigned by your workspace admin.
              </CardSub>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {enabledPermissions.length === 0 ? (
                  <Badge tone="neutral">View-only access</Badge>
                ) : (
                  enabledPermissions.map((label) => (
                    <Badge key={label} tone="good" className="text-[10px]">
                      {label}
                    </Badge>
                  ))
                )}
              </div>
              <Link to="/app/roles">
                <Button variant="ghost" size="sm" className="mt-3">
                  View full permission matrix
                </Button>
              </Link>
            </Card>

            <Card>
              <CardTitle>Locale</CardTitle>
              <CardSub>
                Personal overrides apply on top of org defaults from{" "}
                <Link to="/app/organization" className="font-semibold text-accent">
                  Organization
                </Link>
                .
              </CardSub>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Time zone</dt>
                  <dd className="mt-0.5 font-medium">
                    {prefs.timezone === "org" ? `Org default (${profile.orgLocale.timezone})` : prefs.timezone.replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Date format</dt>
                  <dd className="mt-0.5 font-medium">
                    {prefs.dateFormat === "org"
                      ? `Org default (${profile.orgLocale.dateFormat})`
                      : prefs.dateFormat.toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Language</dt>
                  <dd className="mt-0.5 font-medium">{LANGUAGES.find((l) => l.value === prefs.language)?.label ?? prefs.language}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-muted">Theme</dt>
                  <dd className="mt-0.5 font-medium capitalize">{theme}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="!p-0">
              <div className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted">Quick links</div>
              <ul className="p-2">
                {[
                  { to: "/app/organization", icon: Building2, label: "Organization", sub: profile.organization.name },
                  { to: "/app/roles", icon: Shield, label: "Roles & permissions", sub: `${profile.user.role} role` },
                  { to: "/app/settings", icon: Laptop, label: "Workspace settings", sub: "Integrations & rules" },
                ].map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-panel-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                        <item.icon size={16} />
                      </span>
                      <span>
                        <span className="block font-semibold">{item.label}</span>
                        <span className="block text-xs text-muted">{item.sub}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle className="!text-sm">Sign-in method</CardTitle>
              <p className="mt-2 text-sm text-muted">{authMethodLabel(profile.user.authMethod)}</p>
              {profile.user.githubUsername && (
                <p className="mt-1 text-xs text-muted">GitHub @{profile.user.githubUsername} linked for OAuth and repo sync fallback.</p>
              )}
              {!profile.user.hasPassword && profile.user.authMethod === "github" && (
                <Callout className="!mt-3">Password sign-in is not set up — use GitHub to sign in.</Callout>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "account" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Profile details</CardTitle>
            <CardSub>Your name and email are visible to teammates in Organization → Team.</CardSub>
            <div className="mt-4 space-y-3">
              <Field label="Full name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email">
                <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" disabled={!accountDirty} onClick={() => { setName(profile.user.name); setEmail(profile.user.email); }}>
                  Reset
                </Button>
                <Button variant="solid" size="sm" disabled={savingAccount || !accountDirty} onClick={() => void saveAccount()}>
                  {savingAccount ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Password</CardTitle>
            {profile.user.hasPassword ? (
              <>
                <CardSub>Change the password you use to sign in with email.</CardSub>
                <form onSubmit={updatePassword} className="mt-4 space-y-3">
                  <Field label="Current password">
                    <input type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                  </Field>
                  <Field label="New password" hint="At least 8 characters.">
                    <input type="password" className={inputClass} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                  <Field label="Confirm new password">
                    <input type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                  <Button type="submit" variant="solid" size="sm" disabled={changingPassword || !currentPassword || !newPassword}>
                    {changingPassword ? "Updating…" : "Update password"}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <CardSub>This account signs in with GitHub — no local password is stored.</CardSub>
                <Callout className="!mt-3">
                  To use email/password sign-in, contact your admin or create a password flow via GitHub account linking (future).
                </Callout>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === "preferences" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Appearance</CardTitle>
            <CardSub>Theme is stored on this device and applies across marketing and the app.</CardSub>
            <div className="mt-4 flex gap-2">
              {(
                [
                  ["light", Sun],
                  ["dark", Moon],
                  ["system", Monitor],
                ] as const
              ).map(([t, Icon]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-bold capitalize transition-colors",
                    theme === t ? "border-accent bg-accent-soft text-accent" : "border-border text-text-2 hover:border-accent/40",
                  )}
                >
                  <Icon size={18} />
                  {t}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Locale overrides</CardTitle>
            <CardSub>Choose org defaults or override for your personal view.</CardSub>
            <div className="mt-4 space-y-3">
              <Field label="Time zone">
                <select className={selectClass} value={prefs.timezone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}>
                  <option value="org">Org default ({profile.orgLocale.timezone.replace(/_/g, " ")})</option>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date format">
                <select className={selectClass} value={prefs.dateFormat} onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as UserPersonalPreferences["dateFormat"] })}>
                  <option value="org">Org default</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="dmy">DD/MM/YYYY</option>
                  <option value="iso">YYYY-MM-DD (ISO)</option>
                </select>
              </Field>
              <Field label="Language">
                <select className={selectClass} value={prefs.language} onChange={(e) => setPrefs({ ...prefs, language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle>Personal notifications</CardTitle>
            <CardSub>Which events Stitch should notify you about (stored per user in your workspace).</CardSub>
            <div className="mt-4 space-y-3">
              <Toggle checked={prefs.notifyEscalation} label="Email when a fix is escalated" onChange={(v) => setPrefs({ ...prefs, notifyEscalation: v })} />
              <Toggle checked={prefs.notifyReview} label="Email when assigned a PR review" onChange={(v) => setPrefs({ ...prefs, notifyReview: v })} />
              <Toggle checked={prefs.notifyDigest} label="Weekly activity digest" onChange={(v) => setPrefs({ ...prefs, notifyDigest: v })} />
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm" disabled={!prefsDirty} onClick={() => setPrefs({ ...profile.preferences })}>
                Reset
              </Button>
              <Button variant="solid" size="sm" disabled={savingPrefs || !prefsDirty} onClick={() => void savePreferences()}>
                {savingPrefs ? "Saving…" : "Save preferences"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardTitle>Active sessions</CardTitle>
            <CardSub>Database-backed sessions for this account. Org security policy controls timeout in Settings → Security.</CardSub>
            <div className="mt-4 divide-y divide-border rounded-lg border border-border">
              {profile.sessions.length === 0 ? (
                <p className="p-4 text-sm text-muted">No active sessions.</p>
              ) : (
                profile.sessions.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold">Web session</div>
                      <div className="text-xs text-muted">
                        Started {formatDateTime(s.createdAt)} · Expires {formatDateTime(s.expiresAt)}
                      </div>
                    </div>
                    {s.current ? <Badge tone="good">This device</Badge> : <Badge tone="neutral">Other device</Badge>}
                  </div>
                ))
              )}
            </div>
            {otherSessions.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-3" disabled={revokingSessions} onClick={() => void revokeOthers()}>
                {revokingSessions ? "Signing out…" : `Sign out ${otherSessions.length} other session${otherSessions.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </Card>

          <Card>
            <CardTitle>Account security</CardTitle>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Auth method</dt>
                <dd className="font-medium">{authMethodLabel(profile.user.authMethod)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">User ID</dt>
                <dd className="font-mono text-xs">{profile.user.id}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardTitle>Sign out</CardTitle>
            <CardSub>End your session on this device.</CardSub>
            <Button variant="danger" size="sm" className="mt-3" onClick={() => void signOut()}>
              <LogOut size={14} /> Sign out
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
