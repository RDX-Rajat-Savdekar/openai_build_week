import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { UptimeBars } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type StatusData, type StatusIncident } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  Plug,
  RefreshCw,
  Server,
  Ticket,
  Zap,
} from "lucide-react";

type Tab = "overview" | "pipeline" | "integrations" | "incidents";
type IncidentFilter = "all" | "open" | "resolved";

const SEVERITY_TONE: Record<StatusIncident["severity"], "good" | "warn" | "critical" | "neutral"> = {
  critical: "critical",
  warning: "warn",
  info: "neutral",
};

const CATEGORY_LABEL: Record<StatusIncident["category"], string> = {
  fix: "Fix",
  pipeline: "Pipeline",
  integration: "Integration",
  security: "Security",
};

const STATUS_TONE: Record<string, "good" | "warn" | "critical" | "neutral" | "outline"> = {
  operational: "good",
  degraded: "warn",
  down: "critical",
  standby: "outline",
  not_connected: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  standby: "Standby",
  not_connected: "Not connected",
};

function formatChecked(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "just now";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatIncidentAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "operational" && "bg-good",
        status === "degraded" && "bg-warn animate-pulse",
        status === "down" && "bg-critical animate-pulse",
        status === "standby" && "bg-muted",
        status === "not_connected" && "bg-border",
      )}
    />
  );
}

export function StatusPage() {
  const { can } = usePermissions();
  const canIntegrations = can("manage_integrations");
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [incidentFilter, setIncidentFilter] = useState<IncidentFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<StatusData | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setData(await api.status());
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load status", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredIncidents = useMemo(() => {
    if (!data) return [];
    if (incidentFilter === "open") return data.incidents.filter((i) => !i.resolved);
    if (incidentFilter === "resolved") return data.incidents.filter((i) => i.resolved);
    return data.incidents;
  }, [data, incidentFilter]);

  const byGroup = useMemo(() => {
    if (!data) return { core: [], ci: [], ticketing: [], notifications: [] };
    return {
      core: data.components.filter((c) => c.group === "core"),
      ci: data.components.filter((c) => c.group === "ci"),
      ticketing: data.components.filter((c) => c.group === "ticketing"),
      notifications: data.components.filter((c) => c.group === "notifications"),
    };
  }, [data]);

  const copyWebhook = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Webhook URL copied");
    } catch {
      toast.show("Copy failed", false);
    }
  };

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Status" subtitle="Loading workspace health…" />
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-panel-2" />
          ))}
        </div>
        <Card className="h-64 animate-pulse bg-panel-2" />
      </>
    );
  }

  if (!data) {
    return <PageHeader title="Status" subtitle="Unable to load status data." />;
  }

  const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "pipeline", label: "Pipeline", icon: Server },
    { id: "integrations", label: "Integrations", icon: Plug },
    { id: "incidents", label: "Incidents", icon: AlertTriangle },
  ];

  const renderComponentRow = (c: StatusData["components"][0], showUptime = false) => (
    <div key={c.key} className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {c.icon ? (
            <BrandIcon name={c.icon} alt={c.name} className="mt-0.5 shrink-0" />
          ) : (
            <StatusDot status={c.status} />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-sm">
              {!c.icon && <StatusDot status={c.status} />}
              {c.name}
              {c.pipelineReady && c.connected && (
                <Badge tone="good" className="text-[10px]">
                  <Zap size={10} /> Live
                </Badge>
              )}
              {c.liveTested === false && c.group === "ci" && (
                <Badge tone="outline" className="text-[10px]">
                  Stubbed
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted">{c.detail}</p>
            {c.webhookUrl && (
              <div className="mt-2 flex items-center gap-2">
                <code className="max-w-[280px] truncate text-[10px] text-text-2">{c.webhookUrl}</code>
                <Button variant="ghost" size="sm" className="!px-1.5 !py-0.5" onClick={() => void copyWebhook(c.webhookUrl!)}>
                  <Copy size={11} />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
          {showUptime && c.connected && (
            <div className="mt-1 text-xs text-muted tabular-nums">
              {c.uptime.toFixed(2)}% · {c.latencyMs}ms
            </div>
          )}
        </div>
      </div>
      {showUptime && c.uptime > 0 && (
        <div className="mt-2">
          <UptimeBars uptime={c.uptime} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Status"
          subtitle="Workspace health — CI integrations, pipeline stages, and notification paths for your org."
        />
        <Button variant="ghost" size="sm" onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      <Card
        className={cn(
          "mb-5 border",
          data.bannerLevel === "operational" && "border-good/30 bg-good-soft/20",
          data.bannerLevel === "degraded" && "border-warn/30 bg-warn-soft/20",
          data.bannerLevel === "down" && "border-critical/30 bg-critical-soft/20",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {data.bannerLevel === "operational" ? (
              <CheckCircle2 size={18} className="text-good" />
            ) : (
              <AlertTriangle size={18} className="text-warn" />
            )}
            <span className="font-bold">{data.banner}</span>
            <Badge tone={STATUS_TONE[data.bannerLevel] ?? "neutral"}>{STATUS_LABEL[data.bannerLevel]}</Badge>
          </div>
          <span className="text-xs text-muted">Checked {formatChecked(data.checkedAt)}</span>
        </div>
        {data.primaryCi && !data.primaryCi.connected && (
          <Callout className="!mt-3">
            <b>GitHub</b> is the primary live integration — connect it under{" "}
            {canIntegrations ? (
              <Link to="/app/settings?section=integrations" className="font-semibold text-accent">
                Settings → Integrations
              </Link>
            ) : (
              "Settings → Integrations"
            )}{" "}
            to receive CI failures and run the fix pipeline.
          </Callout>
        )}
        {data.primaryCi?.connected && !data.stats.openaiConfigured && (
          <Callout className="!mt-3">
            GitHub is connected but <b>no AI provider is configured</b> — diagnosis and fix generation will use demo fallbacks until you add an API key in Settings → Models (OpenAI, Claude, Gemini, or Copilot).
          </Callout>
        )}
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Overall uptime", value: `${data.stats.overallUptime.toFixed(2)}%` },
          { label: "Open incidents", value: data.stats.openIncidents },
          { label: "CI connected", value: `${data.stats.connectedCi}/${data.stats.totalCi}` },
          { label: "Repos enabled", value: `${data.stats.enabledRepos}/${data.stats.totalRepos}` },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors -mb-px",
                tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-text-2",
              )}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Core pipeline</CardTitle>
            <CardSub>Webhook → diagnosis → fix → PR — shared across all CI providers.</CardSub>
            <div className="mt-3 space-y-2">{byGroup.core.map((c) => renderComponentRow(c, true))}</div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle className="!text-sm">Primary CI — GitHub</CardTitle>
              {data.primaryCi ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{data.primaryCi.name}</div>
                    <p className="text-xs text-muted">
                      {data.primaryCi.pipelineReady ? "Full pipeline live for demo" : "Pipeline pending"}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[data.primaryCi.status] ?? "neutral"}>
                    {STATUS_LABEL[data.primaryCi.status]}
                  </Badge>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No primary CI configured.</p>
              )}
              {canIntegrations && (
                <Link to="/app/settings?section=integrations">
                  <Button variant="ghost" size="sm" className="mt-3">
                    Manage integrations
                  </Button>
                </Link>
              )}
            </Card>

            <Card>
              <CardTitle className="!text-sm">Quick paths</CardTitle>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  <Link to="/app/settings?section=integrations" className="font-semibold text-accent">
                    CI/CD integrations
                  </Link>{" "}
                  — connect providers & webhooks
                </li>
                <li>
                  <Link to="/app/settings?section=models" className="font-semibold text-accent">
                    AI models
                  </Link>{" "}
                  — {data.stats.openaiConfigured ? "configured" : "add an AI provider key for live fixes"}
                </li>
                <li>
                  <Link to="/app/settings?section=notifications" className="font-semibold text-accent">
                    Notifications
                  </Link>{" "}
                  — {data.stats.notificationsConfigured} channel(s) active
                </li>
                <li>
                  <Link to="/app/projects" className="font-semibold text-accent">
                    Projects
                  </Link>{" "}
                  — {data.stats.enabledRepos} repo(s) enabled for Stitch
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "pipeline" && (
        <Card>
          <CardTitle>Pipeline stages</CardTitle>
          <CardSub>Measured latencies from the demo baseline — OpenAI state reflects your workspace key.</CardSub>
          <div className="mt-4 space-y-2">{byGroup.core.map((c) => renderComponentRow(c, true))}</div>
        </Card>
      )}

      {tab === "integrations" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>
              <Plug size={16} className="inline mr-1.5" /> CI/CD providers
            </CardTitle>
            <CardSub>Status reflects your org&apos;s connected integrations — same data as Settings → Integrations.</CardSub>
            <div className="mt-3 space-y-2">{byGroup.ci.map((c) => renderComponentRow(c))}</div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle>
                <Ticket size={16} className="inline mr-1.5" /> Ticketing
              </CardTitle>
              <div className="mt-3 space-y-2">{byGroup.ticketing.map((c) => renderComponentRow(c))}</div>
            </Card>

            <Card>
              <CardTitle>
                <Bell size={16} className="inline mr-1.5" /> Notifications
              </CardTitle>
              <div className="mt-3 space-y-2">{byGroup.notifications.map((c) => renderComponentRow(c))}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === "incidents" && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <CardTitle className="!mb-0">Incident history</CardTitle>
              <CardSub className="!mt-1">
                Live from your workspace — fix outcomes, open reviews, pipeline events, and audit trail entries.
              </CardSub>
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
              {(["all", "open", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setIncidentFilter(f)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-bold capitalize transition-colors",
                    incidentFilter === f ? "bg-accent-soft text-accent" : "text-muted hover:text-text-2",
                  )}
                >
                  {f}
                  {f === "open" && data.stats.openIncidents > 0 ? ` (${data.stats.openIncidents})` : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 divide-y divide-border">
            {filteredIncidents.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted">
                  {incidentFilter === "all"
                    ? "No incidents yet — run a demo simulation or connect GitHub to start receiving CI failures."
                    : `No ${incidentFilter} incidents.`}
                </p>
                {incidentFilter === "all" && (
                  <div className="mt-4 flex justify-center gap-2">
                    <Link to="/app/dashboard">
                      <Button variant="ghost" size="sm">Go to Dashboard</Button>
                    </Link>
                    <Link to="/app/settings?section=integrations">
                      <Button variant="solid" size="sm">Connect integrations</Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              filteredIncidents.map((inc) => (
                <div key={inc.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{inc.title}</span>
                        {inc.fixId != null && (
                          <Link to="/app/fix-log" className="text-xs font-bold text-accent hover:underline">
                            Fix #{inc.fixId}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">{inc.summary}</p>
                      <p className="mt-1 text-xs text-muted">
                        {formatIncidentAt(inc.at)}
                        {inc.repo && inc.branch ? ` · ${inc.repo} @ ${inc.branch}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge tone={inc.resolved ? "good" : "warn"}>{inc.resolved ? "Resolved" : "Open"}</Badge>
                      <div className="flex gap-1">
                        <Badge tone={SEVERITY_TONE[inc.severity]} className="text-[10px] capitalize">
                          {inc.severity}
                        </Badge>
                        <Badge tone="outline" className="text-[10px]">
                          {CATEGORY_LABEL[inc.category]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </>
  );
}
