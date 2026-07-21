import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/FormControls";
import {
  ConfidenceChart,
  OutcomeRing,
  UsageMeter,
  WeeklyActivityChart,
} from "@/components/dashboard/DashboardCharts";
import { usePermissions } from "@/context/PermissionsContext";
import { api, subscribeEvents, type DashboardData, type Project } from "@/lib/api";
import { useCountUp } from "@/hooks/useAnimations";
import { useToast } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import {
  ArrowRight,
  FileText,
  GitBranch,
  MessageSquare,
  Play,
  RefreshCw,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react";

const DEFAULT_SPARK = [8, 10, 9, 13, 12, 16, 15, 18, 17, 20, 22];

function feedTimeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toneDot(tone: string) {
  return cn(
    "h-2 w-2 shrink-0 rounded-full",
    tone === "good" && "bg-good",
    tone === "warn" && "bg-warn animate-pulse",
    tone === "critical" && "bg-critical animate-pulse",
    tone === "neutral" && "bg-muted",
  );
}

const STITCH_TEST_REPO = "Khushalsarode/stitch-test-flow-repo";

export function DashboardPage() {
  const { can } = usePermissions();
  const canSimulate = can("manage_response_rules");
  const canAudit = can("view_audit_trail");
  const { show: toast } = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState("");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [githubLive, setGithubLive] = useState(false);
  const [liveBump, setLiveBump] = useState(0);

  useEffect(() => {
    api.integrations().then((rows) => setGithubLive(rows.some((r) => r.key === "github" && r.connected))).catch(() => {});
  }, []);

  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setData(
        await api.dashboard({
          project: project || undefined,
          days: Number(period) || 30,
        }),
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load dashboard", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, project, toast]);

  loadRef.current = () => {
    void load(true);
  };

  useEffect(() => {
    api.projects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeEvents({
      onActivity: () => {
        setLiveBump((n) => n + 1);
        loadRef.current();
      },
      onPipeline: (payload) => {
        setLiveBump((n) => n + 1);
        loadRef.current();
        toast(`Pipeline complete — Fix #${payload.fixId} (${payload.action})`);
      },
    });
    return unsub;
  }, [toast]);

  const stats = data?.stats;
  const spark = data?.sparklines;
  const success = useCountUp(stats?.successRate ?? 0, Boolean(stats), 0);
  const hours = useCountUp(stats?.hoursSaved ?? 0, Boolean(stats), 1);
  const incidents = useCountUp(stats?.totalIncidents ?? 0, Boolean(stats), 0);
  const ai = data?.aiUsage;
  const budgetPct = ai ? Math.min(100, Math.round((ai.spent / ai.budget) * 100)) : 0;

  const demoRepo =
    data?.repoStatus?.find((r) => r.repo === STITCH_TEST_REPO && r.enabled !== false)?.repo ??
    data?.repoStatus?.find((r) => r.enabled !== false)?.repo ??
    data?.repoStatus?.[0]?.repo ??
    STITCH_TEST_REPO;

  const simulate = async (branch: string, opts?: { prNumber?: number; liveGitHub?: boolean }) => {
    setSimulating(true);
    try {
      const result = await api.simulateFailure({
        repo: demoRepo,
        branch,
        prNumber: opts?.prNumber,
        liveGitHub: opts?.liveGitHub,
      });
      const suffix = result.prUrl && !result.prUrl.includes("/pull/demo-") ? " · real PR opened" : "";
      toast(`Fix #${result.fixId} — ${result.action} (${result.mode})${suffix}`);
      await load(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Simulation failed", false);
    } finally {
      setSimulating(false);
    }
  };

  const liveFeed = data?.liveFeed ?? [];

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Loading workspace metrics…" />
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-panel-2" />
          ))}
        </div>
        <Card className="h-64 animate-pulse bg-panel-2" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live system health across every connected repository — synced with Fix Log, Issues, Audit, and Reports."
        actions={
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/20 bg-accent-soft/20">
        <div className="text-sm">
          <span className="font-semibold">Autonomous loop active</span>
          <span className="text-muted"> — pipeline events update this view in real time via SSE.</span>
          {data?.checkedAt && (
            <span className="ml-2 text-xs text-muted">
              Updated {new Date(data.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/fix-log">
            <Button variant="ghost" size="sm">
              <Sparkles size={14} /> Fix log
            </Button>
          </Link>
          <Link to="/app/issues">
            <Button variant="ghost" size="sm">
              <FileText size={14} /> Issues
            </Button>
          </Link>
          {canAudit && (
            <Link to="/app/audit">
              <Button variant="ghost" size="sm">
                <Shield size={14} /> Audit
              </Button>
            </Link>
          )}
          <Link to="/app/status">
            <Button variant="ghost" size="sm">
              Status <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-sm font-semibold"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-sm font-semibold"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {canSimulate && (
        <Card className="mb-4 border border-dashed border-accent/35 bg-gradient-to-br from-accent-soft/40 to-panel animate-slide-up">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-lg">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="accent">Pipeline demo</Badge>
                <CardTitle className="!mb-0">Try the autonomous loop</CardTitle>
              </div>
              <CardSub className="!mb-0">
                Run the full pipeline on{" "}
                <code className="rounded bg-code-bg px-1">{demoRepo}</code> — branch rules apply per branch.
                {demoRepo.includes("stitch-test-flow") && (
                  <>
                    {" "}
                    <a
                      href={`https://github.com/${demoRepo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      GitHub repo
                    </a>
                    {" · "}
                    open feature PR first for comment demo (<code className="rounded bg-code-bg px-1">npm run testrepo:open-pr</code>).
                  </>
                )}
              </CardSub>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              disabled={simulating}
              onClick={() => simulate("main")}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-good/40 hover:bg-good-soft/30 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-good-soft text-good">
                  <Play size={16} />
                </span>
                <span className="font-bold">Main · sandbox</span>
              </div>
              <p className="text-sm text-muted">
                Failed run on <code className="rounded bg-code-bg px-1">main</code> — Autopilot path with demo PR URL when GitHub is offline.
              </p>
            </button>
            <button
              type="button"
              disabled={simulating || !githubLive}
              onClick={() => simulate("main", { liveGitHub: true })}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/30 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <GitBranch size={16} />
                </span>
                <span className="font-bold">Main · live PR</span>
              </div>
              <p className="text-sm text-muted">
                {githubLive
                  ? "Real PR on GitHub — patch pushes to stitch/fix-* branch."
                  : "Connect GitHub in Integrations to enable live PRs."}
              </p>
            </button>
            <button
              type="button"
              disabled={simulating}
              onClick={() => simulate("release/v1.0")}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-warn/40 hover:bg-warn-soft/30 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn-soft text-warn">
                  <Shield size={16} />
                </span>
                <span className="font-bold">Release · pending</span>
              </div>
              <p className="text-sm text-muted">
                <code className="rounded bg-code-bg px-1">release/v1.0</code> — Fix &amp; propose → Approve in Fix Log.
              </p>
            </button>
            <button
              type="button"
              disabled={simulating}
              onClick={() => simulate("feature/checkout-v2", { prNumber: 1 })}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-warn/40 hover:bg-warn-soft/30 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn-soft text-warn">
                  <MessageSquare size={16} />
                </span>
                <span className="font-bold">Feature · comment</span>
              </div>
              <p className="text-sm text-muted">
                <code className="rounded bg-code-bg px-1">feature/checkout-v2</code> — Diagnose &amp; suggest (PR #1 comment).
              </p>
            </button>
            <button
              type="button"
              disabled={simulating || !githubLive}
              onClick={() => simulate("dev", { liveGitHub: true })}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-good/40 hover:bg-good-soft/30 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-good-soft text-good">
                  <Sparkles size={16} />
                </span>
                <span className="font-bold">Dev · auto-merge</span>
              </div>
              <p className="text-sm text-muted">
                <code className="rounded bg-code-bg px-1">dev</code> branch — live PR + auto-merge when GitHub allows.
              </p>
            </button>
            <button
              type="button"
              disabled={simulating || !githubLive}
              onClick={() => simulate("hotfix/auth-guard", { liveGitHub: true })}
              className="hover-lift group rounded-stitch border border-border bg-panel p-4 text-left transition-colors hover:border-critical/30 hover:bg-critical-soft/20 disabled:opacity-60"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-critical-soft text-critical">
                  <GitBranch size={16} />
                </span>
                <span className="font-bold">Hotfix · live PR</span>
              </div>
              <p className="text-sm text-muted">
                <code className="rounded bg-code-bg px-1">hotfix/auth-guard</code> — urgent Autopilot path on hotfix branch.
              </p>
            </button>
          </div>
          {simulating && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent">
              <RefreshCw size={14} className="animate-spin" /> Running pipeline on {demoRepo}…
            </p>
          )}
        </Card>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          index={0}
          label="Success rate"
          value={`${success}%`}
          delta={`${(stats?.successDelta ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(stats?.successDelta ?? 0)}%`}
          deltaPositive={(stats?.successDelta ?? 0) >= 0}
          spark={spark?.success ?? DEFAULT_SPARK}
        />
        <StatTile
          index={1}
          label="Avg. time to fix"
          value={stats?.avgTimeToFix ?? "—"}
          delta={`${(stats?.avgTimeDelta ?? 0) <= 0 ? "▼" : "▲"} ${Math.abs(stats?.avgTimeDelta ?? 0)}s`}
          deltaPositive={(stats?.avgTimeDelta ?? 0) <= 0}
          spark={spark?.timeToFix ?? DEFAULT_SPARK}
        />
        <StatTile
          index={2}
          label="Developer time saved"
          value={`${hours}h`}
          delta={`${(stats?.hoursDelta ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(stats?.hoursDelta ?? 0)}h`}
          deltaPositive={(stats?.hoursDelta ?? 0) >= 0}
          spark={spark?.hoursSaved ?? DEFAULT_SPARK}
        />
        <StatTile
          index={3}
          label="Total incidents"
          value={incidents}
          delta={`${(stats?.incidentsDelta ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(stats?.incidentsDelta ?? 0)}`}
          deltaPositive={(stats?.incidentsDelta ?? 0) <= 0}
          spark={spark?.incidents ?? DEFAULT_SPARK}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_220px]">
        <Card className="animate-slide-up" style={{ animationDelay: "280ms", animationFillMode: "backwards" }}>
          <CardTitle>Weekly activity</CardTitle>
          <CardSub>Fixes per day by outcome — last 7 days{project ? " (project scope)" : ""}.</CardSub>
          {data?.weeklyActivity && <WeeklyActivityChart data={data.weeklyActivity} />}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-xs font-semibold text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-good" />
              Auto-fixed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-warn" />
              Pending / diagnose-only
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-critical" />
              Escalated / reverted
            </span>
          </div>
        </Card>
        <Card
          className="flex flex-col items-center justify-center animate-slide-up"
          style={{ animationDelay: "320ms", animationFillMode: "backwards" }}
        >
          <CardTitle className="w-full text-center">Success snapshot</CardTitle>
          <OutcomeRing successRate={stats?.successRate ?? 0} total={stats?.totalIncidents ?? 0} />
          <CardSub className="!mb-0 mt-2 text-center">Merged fixes vs total incidents</CardSub>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex justify-between">
            <CardTitle className="!mb-0">Needs your attention</CardTitle>
            <Badge tone={stats?.attentionOpen ? "critical" : "good"}>{stats?.attentionOpen ?? 0} open</Badge>
          </div>
          <CardSub>Escalations and pending reviews — linked to Issue Records and Fix Log.</CardSub>
          {(data?.attention ?? []).length === 0 ? (
            <CardSub className="!mb-0 mt-3">Nothing needs attention right now.</CardSub>
          ) : (
            data!.attention.map((a) => (
              <div key={a.fixId} className="flex flex-wrap items-start gap-3 border-b border-border py-3 last:border-0">
                <span className={cn("mt-1 h-2 w-2 flex-none rounded-full animate-pulse-dot", a.level === "critical" ? "bg-critical" : "bg-warn")} />
                <div className="min-w-0 flex-1 text-sm">
                  <b>{a.repo}</b> · <code className="rounded bg-code-bg px-1">{a.branch}</code>
                  <div className="text-muted">{a.summary}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{a.ago} · {a.assignee}</span>
                    <Badge tone="accent">{a.ticket}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link to={`/app/fix-log?fixId=${a.fixId}`}>
                    <Button variant="ghost" size="sm">
                      Fix
                    </Button>
                  </Link>
                  <Link to={`/app/issues?fixId=${a.fixId}`}>
                    <Button variant="ghost" size="sm">
                      Issue
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <CardTitle className="!mb-0">Live incident feed</CardTitle>
            <Badge tone="good" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse-dot" />
              Live
            </Badge>
          </div>
          <CardSub>SSE + fix pipeline — refreshes automatically ({liveBump > 0 ? `${liveBump} events this session` : "listening"})</CardSub>
          <div className="mt-3 space-y-1">
            {liveFeed.length === 0 ? (
              <CardSub className="!mb-0">No incidents yet. Simulate a failure or connect a CI webhook.</CardSub>
            ) : (
              liveFeed.map((item, i) => (
                <div
                  key={item.id}
                  className="flex animate-slide-in-left items-start justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className={cn("mt-1.5", toneDot(item.tone))} />
                    <span>
                      <b>{item.repo}</b> · <code className="rounded bg-code-bg px-1 text-xs">{item.branch}</code>
                      <span className="text-text-2"> — {item.summary}</span>
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted">{feedTimeAgo(item.at)}</span>
                    {item.fixId != null && (
                      <Link to={`/app/fix-log?fixId=${item.fixId}`} className="text-xs font-semibold text-accent">
                        #{item.fixId}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {(data?.recentFixes?.length ?? 0) > 0 && (
        <Card className="mb-4">
          <CardTitle>Recent fixes</CardTitle>
          <CardSub>Jump straight into the documentation trail for any incident.</CardSub>
          <div className="mt-3 flex flex-wrap gap-2">
            {data!.recentFixes!.map((f) => (
              <Link
                key={f.id}
                to={`/app/fix-log?fixId=${f.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm transition-colors hover:border-accent/40"
              >
                <ScrollText size={14} className="text-accent" />
                <span className="font-bold text-accent">#{f.id}</span>
                <span className="text-muted">{f.repo}</span>
                <Badge tone={f.outcome === "merged" ? "good" : f.outcome === "escalated" ? "critical" : "warn"}>
                  {f.badgeLabel}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Repository status</CardTitle>
          <CardSub>Response mode per repo{project ? " in this project" : ""}.</CardSub>
          <div className="mt-3 space-y-2">
            {(data?.repoStatus ?? []).length === 0 ? (
              <CardSub className="!mb-0">No repos in scope — sync from Integrations or Projects.</CardSub>
            ) : (
              data!.repoStatus!.map((r) => (
                <div
                  key={r.repo}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                    r.enabled === false ? "border-border/60 opacity-60" : "border-border",
                  )}
                >
                  <span className="font-semibold">{r.repo}</span>
                  <ModeBadge mode={r.mode} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <GitBranch size={16} className="text-accent" /> Branch activity
          </CardTitle>
          <CardSub>Incidents grouped by branch pattern — from live fix data.</CardSub>
          <div className="mt-3 space-y-2">
            {(data?.branchActivity ?? []).length === 0 ? (
              <CardSub className="!mb-0">No branch activity in this period.</CardSub>
            ) : (
              data!.branchActivity!.map((b) => (
                <div key={b.pattern} className="flex justify-between gap-2 text-sm">
                  <code className="rounded bg-code-bg px-1.5">{b.pattern}</code>
                  <span className="text-muted">
                    {b.incidents} incidents · {b.detail}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Confidence breakdown</CardTitle>
          <CardSub>Across all fixes in the selected period.</CardSub>
          {data?.confidenceBreakdown && data.confidenceBreakdown.length > 0 && (
            <ConfidenceChart slices={data.confidenceBreakdown} />
          )}
        </Card>
      </div>

      <Card className="animate-slide-up" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <CardTitle>Codex & GPT-5.6 usage</CardTitle>
          <span className="text-lg font-bold text-accent">${(ai?.spent ?? 0).toFixed(2)}</span>
        </div>
        <UsageMeter
          pct={budgetPct}
          label={`${budgetPct}% of $${ai?.budget ?? 75} monthly budget — same meter as Billing`}
        />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="font-bold">GPT-5.6 diagnosis</div>
            <div className="text-muted">
              {ai?.gptCalls ?? 0} calls · ${(ai?.gptCost ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="font-bold">Codex fix generation</div>
            <div className="text-muted">
              {ai?.codexCalls ?? 0} calls · ${(ai?.codexCost ?? 0).toFixed(2)}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
