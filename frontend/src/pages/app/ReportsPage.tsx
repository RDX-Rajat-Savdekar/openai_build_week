import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import {
  api,
  type IncidentReport,
  type ReportsOverview,
  type StoredReport,
  type WeeklyDigest,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Share2,
  Trash2,
} from "lucide-react";

type Tab = "incident" | "digest" | "stored";

const SEV_TONE: Record<IncidentReport["severity"], "good" | "warn" | "critical" | "neutral"> = {
  low: "good",
  medium: "warn",
  high: "critical",
  critical: "critical",
};

function downloadText(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DigestView({ digest }: { digest: WeeklyDigest }) {
  const segments = [
    { label: "Auto-fixed", pct: digest.autoFixedPct, tone: "var(--good)" },
    { label: "Diagnose only", pct: digest.diagnoseOnlyPct, tone: "var(--warn)" },
    { label: "Escalated", pct: digest.escalatedPct, tone: "var(--critical)" },
  ].filter((s) => s.pct > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{digest.title}</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold">{digest.totalFailures}</div>
            <CardSub className="!mb-0">failures</CardSub>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-good">
              {digest.autoFixed} · {digest.autoFixedPct}%
            </div>
            <CardSub className="!mb-0">auto-fixed</CardSub>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-warn">
              {digest.diagnoseOnly} · {digest.diagnoseOnlyPct}%
            </div>
            <CardSub className="!mb-0">diagnose only</CardSub>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <div className="text-2xl font-bold text-critical">
              {digest.escalated} · {digest.escalatedPct}%
            </div>
            <CardSub className="!mb-0">escalated</CardSub>
          </div>
        </div>
        {segments.length > 0 && (
          <div className="mt-4 flex h-7 overflow-hidden rounded-lg text-xs font-bold text-white">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center justify-center" style={{ flex: s.pct, background: s.tone }}>
                {s.pct}%
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Top failure patterns</CardTitle>
        {digest.patterns.length === 0 ? (
          <CardSub className="!mb-0 mt-2">No failure patterns in this period.</CardSub>
        ) : (
          <div className="mt-3 space-y-2.5">
            {digest.patterns.map((p) => (
              <div key={p.label} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 font-semibold">{p.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-code-bg">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
                </span>
                <span className="w-6 text-right font-bold text-muted">{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Escalations needing attention</CardTitle>
        {digest.escalations.length === 0 ? (
          <CardSub className="!mb-0 mt-2">None this week — nice work.</CardSub>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-text-2">
            {digest.escalations.map((e) => (
              <li key={e.fixId}>
                <Link to={`/app/issues?fixId=${e.fixId}`} className="font-semibold text-accent">
                  {e.title}
                </Link>{" "}
                ({e.repo}) — {e.summary}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Callout>{digest.recommendation}</Callout>
    </div>
  );
}

function IncidentView({ report }: { report: IncidentReport }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CardTitle className="!mb-0">{report.title}</CardTitle>
        <Badge tone={SEV_TONE[report.severity]}>{report.severityLabel}</Badge>
        <Badge tone="good">{report.resolvedLabel}</Badge>
      </div>
      <CardSub>
        {report.durationMinutes != null ? `${report.durationMinutes} min · ` : ""}
        {report.serviceHint} · Fix #{report.fixId}
      </CardSub>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section>
          <h4 className="text-xs font-bold uppercase text-muted">Timeline</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {report.timeline.map((row) => (
              <li key={row.at + row.label}>
                <span className="font-mono text-muted">{row.time}</span> — {row.label}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase text-muted">Root cause</h4>
          <p className="mt-2 text-sm">{report.rootCause}</p>
        </section>
        <section className="md:col-span-2">
          <h4 className="text-xs font-bold uppercase text-muted">Contributing factors</h4>
          <ul className="mt-2 list-inside list-disc text-sm text-text-2">
            {report.contributingFactors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
        <section className="md:col-span-2">
          <Callout>
            <b>{report.prevention}</b>
          </Callout>
        </section>
      </div>
      {report.humanMinutes != null && (
        <p className="mt-4 text-sm text-muted">Human involvement: {report.humanMinutes} minutes (review + merge)</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link to={`/app/fix-log?fixId=${report.fixId}`}>
          <Button variant="ghost" size="sm">
            Fix log
          </Button>
        </Link>
        <Link to={`/app/issues?fixId=${report.fixId}`}>
          <Button variant="ghost" size="sm">
            <FileText size={14} /> Issue record
          </Button>
        </Link>
        <Link to={`/app/audit?fixId=${report.fixId}`}>
          <Button variant="ghost" size="sm">
            Audit trail
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function ReportsPage() {
  const { can } = usePermissions();
  const canExport = can("export_data");
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = (searchParams.get("tab") as Tab) || "incident";
  const initialFixId = searchParams.get("fixId") ? Number(searchParams.get("fixId")) : null;

  const [tab, setTab] = useState<Tab>(initialTab === "digest" || initialTab === "stored" ? initialTab : "incident");
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [incidentFixId, setIncidentFixId] = useState<number | null>(initialFixId);
  const [incident, setIncident] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await api.reportsOverview();
      setOverview(data);
      setIncidentFixId((prev) => {
        const fromUrl = initialFixId && data.incidentFixes.some((f) => f.id === initialFixId) ? initialFixId : null;
        if (fromUrl) return fromUrl;
        if (prev && data.incidentFixes.some((f) => f.id === prev)) return prev;
        return data.incidentFixes[0]?.id ?? null;
      });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load reports", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialFixId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (incidentFixId == null) {
      setIncident(null);
      return;
    }
    api.incidentReport(incidentFixId).then(setIncident).catch(console.error);
    if (tab === "incident") {
      setSearchParams({ tab, fixId: String(incidentFixId) }, { replace: true });
    }
  }, [incidentFixId, tab, setSearchParams]);

  const activeMarkdown = useMemo(() => {
    if (tab === "digest") return overview?.digest.markdown ?? "";
    if (tab === "incident") return incident?.markdown ?? "";
    return "";
  }, [tab, overview, incident]);

  const copyActive = () => {
    if (!activeMarkdown) return;
    navigator.clipboard.writeText(activeMarkdown).then(() => toast.show("Report copied"));
  };

  const downloadActive = () => {
    if (!activeMarkdown) return;
    const name =
      tab === "digest"
        ? `weekly-digest-${overview?.digest.periodEnd ?? "report"}.md`
        : `incident-${incident?.id ?? "report"}.md`;
    downloadText(name, activeMarkdown);
    toast.show("Download started");
  };

  const storeActive = async () => {
    if (!canExport) return;
    setBusy("store");
    try {
      if (tab === "incident" && incidentFixId != null) {
        const stored = await api.storeReport({ type: "incident", fixId: incidentFixId });
        toast.show(`Stored ${stored.title}`);
      } else if (tab === "digest") {
        const stored = await api.storeReport({ type: "digest" });
        toast.show(`Stored ${stored.title}`);
      }
      await load(true);
      setTab("stored");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Store failed", false);
    } finally {
      setBusy(null);
    }
  };

  const shareStored = async (report: StoredReport) => {
    if (!canExport) return;
    setBusy(report.id);
    try {
      const { shareUrl } = await api.shareReport(report.id);
      await navigator.clipboard.writeText(shareUrl);
      toast.show("Share link copied");
      await load(true);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Share failed", false);
    } finally {
      setBusy(null);
    }
  };

  const deleteStored = async (id: string) => {
    if (!canExport || !window.confirm("Delete this stored report?")) return;
    setBusy(id);
    try {
      await api.deleteReport(id);
      toast.show("Report deleted");
      await load(true);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusy(null);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    const params: Record<string, string> = { tab: next };
    if (next === "incident" && incidentFixId != null) params.fixId = String(incidentFixId);
    setSearchParams(params, { replace: true });
  };

  if (loading && !overview) {
    return (
      <>
        <PageHeader title="Reports" subtitle="Loading post-mortems and digests…" />
        <Card className="h-64 animate-pulse bg-panel-2" />
      </>
    );
  }

  const stored = overview?.stored ?? [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Auto-generated post-mortems and weekly digests — store, export, and share."
        actions={
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["incident", "Incident reports"],
            ["digest", "Weekly digest"],
            ["stored", `Stored (${stored.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold transition-colors",
              tab === key ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-accent-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "incident" || tab === "digest") && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tab === "incident" && overview && overview.incidentFixes.length > 0 && (
            <Field label="Incident">
              <select
                className={selectClass}
                value={incidentFixId ?? ""}
                onChange={(e) => setIncidentFixId(Number(e.target.value))}
              >
                {overview.incidentFixes.map((f) => (
                  <option key={f.id} value={f.id}>
                    Fix #{f.id} · {f.repo} · {f.branch}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="ml-auto flex flex-wrap gap-2 self-end">
            <Button variant="ghost" size="sm" onClick={copyActive} disabled={!activeMarkdown}>
              <Copy size={14} /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadActive} disabled={!activeMarkdown}>
              <Download size={14} /> Download
            </Button>
            {canExport && (
              <Button variant="solid" size="sm" onClick={storeActive} disabled={!activeMarkdown || busy === "store"}>
                <BarChart3 size={14} /> Store snapshot
              </Button>
            )}
          </div>
        </div>
      )}

      {tab === "incident" &&
        (incident ? (
          <IncidentView report={incident} />
        ) : (
          <Card>
            <CardSub className="!mb-0">No fixes available to generate an incident report.</CardSub>
          </Card>
        ))}

      {tab === "digest" && overview && <DigestView digest={overview.digest} />}

      {tab === "stored" && (
        <div className="space-y-3">
          {stored.length === 0 ? (
            <Card>
              <CardSub className="!mb-0">
                No stored reports yet. Generate an incident report or weekly digest, then use <b>Store snapshot</b> — or store from{" "}
                <Link to="/app/changelog" className="text-accent">
                  Changelog
                </Link>
                .
              </CardSub>
            </Card>
          ) : (
            stored.map((report) => (
              <Card key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="!mb-0">{report.title}</CardTitle>
                      <Badge tone="accent">{report.type}</Badge>
                      {report.shareToken && <Badge tone="good">Shared</Badge>}
                    </div>
                    <CardSub className="!mb-0 mt-1">
                      Stored {new Date(report.createdAt).toLocaleString()}
                      {report.fixId ? ` · Fix #${report.fixId}` : ""}
                    </CardSub>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(report.markdown).then(() => toast.show("Copied"));
                      }}
                    >
                      <Copy size={14} /> Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadText(`${report.id}.md`, report.markdown)}
                    >
                      <Download size={14} /> Download
                    </Button>
                    {canExport && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => shareStored(report)} disabled={busy === report.id}>
                          <Share2 size={14} /> {report.shareToken ? "Copy link" : "Share"}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteStored(report.id)} disabled={busy === report.id}>
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-code-bg p-3 text-xs whitespace-pre-wrap">
                  {report.markdown.slice(0, 1200)}
                  {report.markdown.length > 1200 ? "\n…" : ""}
                </pre>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  );
}
