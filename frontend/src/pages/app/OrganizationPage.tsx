import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { TeamPanel } from "@/components/team/TeamPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, inputClass, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type OrgProfile, type OrganizationOverview } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  Building2,
  ChevronRight,
  CreditCard,
  FolderKanban,
  Globe,
  Plug,
  Shield,
  SlidersHorizontal,
  Users,
} from "lucide-react";

type Tab = "overview" | "profile" | "team";

const INDUSTRIES = [
  { value: "saas", label: "Software / SaaS" },
  { value: "fintech", label: "Fintech" },
  { value: "health", label: "Healthcare" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "media", label: "Media & entertainment" },
  { value: "other", label: "Other" },
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-1000", label: "201–1,000" },
  { value: "1000+", label: "1,000+" },
];

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

function orgInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "OR";
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function planTone(plan: string): "accent" | "good" | "neutral" {
  if (plan === "Enterprise") return "good";
  if (plan === "Team") return "accent";
  return "neutral";
}

export function OrganizationPage() {
  const { can, isAdmin, role: myRole } = usePermissions();
  const canManageTeam = can("manage_team");
  const canBilling = can("manage_billing");
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<OrganizationOverview | null>(null);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [workspaceUserId, setWorkspaceUserId] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ws] = await Promise.all([api.organizationOverview(), api.workspace()]);
      setOverview(ov);
      setProfile(ov.profile);
      setWorkspaceUserId(ws.user?.id);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load organization", false);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!profile || !overview) return false;
    const keys: (keyof OrgProfile)[] = [
      "name",
      "domain",
      "industry",
      "companySize",
      "timezone",
      "dateFormat",
      "timeFormat",
      "weekStartsOn",
    ];
    return keys.some((k) => profile[k] !== overview.profile[k]);
  }, [profile, overview]);

  const saveProfile = async () => {
    if (!profile || !canManageTeam) return;
    setSaving(true);
    try {
      const updated = await api.saveOrgProfile(profile);
      setProfile(updated);
      setOverview((prev) => (prev ? { ...prev, profile: updated } : prev));
      toast.show("Organization settings saved");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Save failed", false);
    } finally {
      setSaving(false);
    }
  };

  const stats = overview?.stats;

  if (loading && !overview) {
    return (
      <>
        <PageHeader title="Organization" subtitle="Loading workspace…" />
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-panel-2" />
          ))}
        </div>
        <Card className="h-64 animate-pulse bg-panel-2" />
      </>
    );
  }

  if (!overview || !profile) {
    return <PageHeader title="Organization" subtitle="Unable to load workspace data." />;
  }

  const tabs: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "profile", label: "Profile & locale", icon: Globe },
    { id: "team", label: "Team", icon: Users },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-accent-soft text-lg font-bold text-accent">
            {orgInitials(profile.name)}
          </span>
          <div className="min-w-0">
            <PageHeader
              title={profile.name}
              subtitle={`Workspace slug · ${profile.slug} · Member since ${formatDate(overview.workspace.createdAt)}`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={planTone(overview.workspace.plan)}>{overview.workspace.plan} plan</Badge>
              <Badge tone="outline">Your role · {myRole}</Badge>
              {stats && stats.pendingInvites > 0 && (
                <Badge tone="warn">{stats.pendingInvites} pending invite{stats.pendingInvites !== 1 ? "s" : ""}</Badge>
              )}
            </div>
          </div>
        </div>
        {canManageTeam && tab === "profile" && (
          <Button variant="solid" size="sm" disabled={saving || !dirty} onClick={() => void saveProfile()}>
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        )}
      </div>

      {!canManageTeam && (
        <Callout className="mb-4">
          View-only for org settings — you need “Manage team & roles” to edit profile, locale, or invites. Your role still applies everywhere else in Stitch.
        </Callout>
      )}

      {stats && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Team members", value: stats.members, hint: stats.pendingInvites ? `${stats.pendingInvites} invited` : undefined },
            { label: "Projects", value: stats.userProjects, hint: `${stats.projects} incl. system` },
            { label: "Repositories", value: stats.repos, hint: `${stats.enabledRepos} enabled` },
            { label: "Integrations", value: `${stats.connectedIntegrations}/${stats.totalIntegrations}`, hint: "CI/CD connected" },
          ].map((s) => (
            <Card key={s.label} className="!p-4">
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</div>
              {s.hint && <div className="mt-0.5 text-[11px] text-muted">{s.hint}</div>}
            </Card>
          ))}
        </div>
      )}

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
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,340px)]">
          <div className="space-y-4">
            <Card>
              <CardTitle>Workspace identity</CardTitle>
              <CardSub>How this organization appears across Stitch and in audit exports.</CardSub>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Legal / display name", profile.name],
                  ["URL slug", profile.slug],
                  ["Primary domain", profile.domain || "—"],
                  ["Industry", INDUSTRIES.find((i) => i.value === profile.industry)?.label ?? profile.industry],
                  ["Company size", COMPANY_SIZES.find((s) => s.value === profile.companySize)?.label ?? profile.companySize],
                  ["Locale", `${profile.timezone} · ${profile.dateFormat === "iso" ? "ISO dates" : profile.dateFormat === "dmy" ? "DD/MM" : "MM/DD"} · ${profile.timeFormat}h`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {canManageTeam && (
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setTab("profile")}>
                  Edit profile & locale
                </Button>
              )}
            </Card>

            {canBilling && stats?.fixesThisMonth !== undefined && stats.includedFixes !== undefined && (
              <Card>
                <CardTitle>Plan usage</CardTitle>
                <CardSub>Fixes processed this billing period on your {overview.workspace.plan} plan.</CardSub>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{stats.fixesThisMonth} fixes this month</span>
                    <span className="text-muted">{stats.includedFixes} included</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.min(100, Math.round((stats.fixesThisMonth / stats.includedFixes) * 100))}%` }}
                    />
                  </div>
                </div>
                <Link to="/app/settings?section=billing">
                  <Button variant="ghost" size="sm" className="mt-3">
                    <CreditCard size={14} /> Billing settings
                  </Button>
                </Link>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="!p-0">
              <div className="border-b border-border px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Quick links</div>
              </div>
              <ul className="p-2">
                {[
                  { to: "/app/projects", icon: FolderKanban, label: "Projects", sub: `${stats?.userProjects ?? 0} projects · ${stats?.repos ?? 0} repos` },
                  { to: "/app/settings?section=integrations", icon: Plug, label: "Integrations", sub: `${stats?.connectedIntegrations ?? 0} connected` },
                  { to: "/app/roles", icon: Shield, label: "Roles & permissions", sub: "RBAC matrix" },
                  { to: "/app/settings", icon: SlidersHorizontal, label: "Settings", sub: "Response rules, notifications" },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-panel-2"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                        <item.icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.label}</span>
                        <span className="block text-xs text-muted">{item.sub}</span>
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle className="!text-sm">CI/CD providers</CardTitle>
              <ul className="mt-3 space-y-2">
                {overview.integrations.map((i) => (
                  <li key={i.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{i.displayName}</span>
                    <div className="flex items-center gap-1.5">
                      {i.pipelineReady && i.connected && <Badge tone="good" className="text-[10px]">Live</Badge>}
                      <Badge tone={i.connected ? "good" : "neutral"}>{i.connected ? "Connected" : "Off"}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
              {can("manage_integrations") && (
                <Link to="/app/settings?section=integrations">
                  <Button variant="ghost" size="sm" className="mt-3 w-full">
                    Manage integrations
                  </Button>
                </Link>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Company profile</CardTitle>
            <CardSub>Used in exports, digests, and workspace headers.</CardSub>
            <fieldset disabled={!canManageTeam} className={cn("mt-4 space-y-3", !canManageTeam && "opacity-75")}>
              <Field label="Organization name">
                <input className={inputClass} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </Field>
              <Field label="Primary domain" hint="Optional — used for SSO and email routing in future releases.">
                <input
                  className={inputClass}
                  value={profile.domain}
                  onChange={(e) => setProfile({ ...profile, domain: e.target.value })}
                  placeholder="acme.com"
                />
              </Field>
              <Field label="Industry">
                <select className={selectClass} value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })}>
                  {INDUSTRIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Company size">
                <select className={selectClass} value={profile.companySize} onChange={(e) => setProfile({ ...profile, companySize: e.target.value })}>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </fieldset>
          </Card>

          <Card>
            <CardTitle>Time zone & locale</CardTitle>
            <CardSub>Saved to workspace preferences — timestamps and weekly digests follow these defaults.</CardSub>
            <fieldset disabled={!canManageTeam} className={cn("mt-4 space-y-3", !canManageTeam && "opacity-75")}>
              <Field label="Time zone">
                <select className={selectClass} value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date format">
                <select className={selectClass} value={profile.dateFormat} onChange={(e) => setProfile({ ...profile, dateFormat: e.target.value })}>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="dmy">DD/MM/YYYY</option>
                  <option value="iso">YYYY-MM-DD (ISO)</option>
                </select>
              </Field>
              <Field label="Time format">
                <select className={selectClass} value={profile.timeFormat} onChange={(e) => setProfile({ ...profile, timeFormat: e.target.value })}>
                  <option value="12">12-hour</option>
                  <option value="24">24-hour</option>
                </select>
              </Field>
              <Field label="First day of week">
                <select className={selectClass} value={profile.weekStartsOn} onChange={(e) => setProfile({ ...profile, weekStartsOn: e.target.value })}>
                  <option value="sun">Sunday</option>
                  <option value="mon">Monday</option>
                </select>
              </Field>
            </fieldset>
            {canManageTeam && (
              <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setProfile({ ...overview.profile })}>
                  Reset
                </Button>
                <Button variant="solid" size="sm" disabled={saving || !dirty} onClick={() => void saveProfile()}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardTitle>Workspace identifiers</CardTitle>
            <CardSub>Read-only — used in API calls and webhook routing.</CardSub>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                <div className="text-xs font-bold uppercase text-muted">Workspace ID</div>
                <code className="mt-1 block truncate text-xs">{overview.workspace.id}</code>
              </div>
              <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                <div className="text-xs font-bold uppercase text-muted">Slug</div>
                <code className="mt-1 block text-xs">{overview.workspace.slug}</code>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "team" && (
        <Card className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <CardTitle className="!mb-0">Team members</CardTitle>
              <CardSub className="!mt-1">
                Invite teammates with a role — permissions apply immediately from Roles & permissions.
              </CardSub>
            </div>
            <Link to="/app/roles">
              <Button variant="ghost" size="sm">
                <Shield size={14} /> Roles & permissions
              </Button>
            </Link>
          </div>
          <div className="p-5">
            <TeamPanel currentUserId={workspaceUserId} />
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card className="mt-6 border-critical/30">
          <CardTitle>Danger zone</CardTitle>
          <CardSub>Export workspace data, disconnect all integrations, or delete the organization — Admin only.</CardSub>
          <Link to="/app/settings?section=danger">
            <Button variant="danger" size="sm" className="mt-3">
              Open danger zone in Settings
            </Button>
          </Link>
        </Card>
      )}
    </>
  );
}
