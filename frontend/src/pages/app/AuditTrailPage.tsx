import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Field, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { api, type AuditEntry, type FixSummary } from "@/lib/api";
import { Copy, Download, FileText, RefreshCw, ScrollText } from "lucide-react";

function initials(actor: string): string {
  if (actor.toLowerCase().includes("github")) return "GH";
  if (actor.startsWith("@")) {
    const segs = actor.slice(1).split("-");
    if (segs.length >= 2) return `${segs[0]![0]}${segs[1]![0]}`.toUpperCase();
    return actor.slice(1, 3).toUpperCase();
  }
  const words = actor.split(" ").filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return actor.slice(0, 2).toUpperCase();
}

function isHuman(actor: string): boolean {
  return actor.startsWith("@") || actor.toLowerCase().includes("github") || actor === "Dashboard user";
}

function OutcomeCell({ outcome }: { outcome: string }) {
  const lower = outcome.toLowerCase();
  if (!outcome || outcome === "—" || outcome === "-") {
    return <span className="text-muted">—</span>;
  }
  if (["success", "resolved", "approved", "passed", "merged"].some((w) => lower.includes(w))) {
    return <Badge tone="good">{outcome}</Badge>;
  }
  if (["fail", "error"].some((w) => lower.includes(w))) {
    return <Badge tone="critical">{outcome}</Badge>;
  }
  if (!outcome.includes(" ") && outcome.length < 24) {
    return <code className="rounded bg-code-bg px-1.5 py-0.5 text-xs">{outcome}</code>;
  }
  return <span className="text-text-2">{outcome}</span>;
}

function formatTs(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function auditToMarkdown(fix: FixSummary | undefined, entries: AuditEntry[]) {
  const lines = [
    `# Audit trail — Fix #${fix?.id ?? entries[0]?.fixId ?? "?"}`,
    "",
    fix ? `**${fix.repo}** · \`${fix.branch}\` · ${fix.outcome}` : "",
    "",
    "| Timestamp | Action | Actor | Outcome |",
    "| --- | --- | --- | --- |",
    ...entries.map((r) => `| ${formatTs(r.at)} | ${r.action} | ${r.actor} | ${r.outcome} |`),
  ];
  return lines.filter(Boolean).join("\n");
}

function pickFixId(list: FixSummary[], param: string | null): number | null {
  if (param) {
    const id = Number(param);
    if (list.some((f) => f.id === id)) return id;
  }
  return list[0]?.id ?? null;
}

export function AuditTrailPage() {
  const { show: toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const fixIdParam = searchParams.get("fixId");

  const [fixes, setFixes] = useState<FixSummary[]>([]);
  const [fixId, setFixId] = useState<number | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const loadFixes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setFixes(await api.auditFixes());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load audit trail", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadFixes();
  }, [loadFixes]);

  useEffect(() => {
    if (fixes.length === 0) return;
    setFixId((prev) => pickFixId(fixes, fixIdParam) ?? prev);
  }, [fixIdParam, fixes]);

  useEffect(() => {
    if (fixId == null) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setEntriesLoading(true);
    api
      .audit(fixId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setEntriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fixId]);

  const onSelectFix = (id: number) => {
    setFixId(id);
    setSearchParams({ fixId: String(id) }, { replace: true });
  };

  const selectedFix = fixes.find((f) => f.id === fixId);
  const humanActions = useMemo(() => entries.filter((e) => isHuman(e.actor)).length, [entries]);

  const copyMarkdown = () => {
    navigator.clipboard.writeText(auditToMarkdown(selectedFix, entries)).then(() => toast("Audit trail copied"));
  };

  const downloadMarkdown = () => {
    const blob = new Blob([auditToMarkdown(selectedFix, entries)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-fix-${fixId ?? "unknown"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Download started");
  };

  return (
    <PermissionGate permission="view_audit_trail" title="Audit trail">
      {loading && fixes.length === 0 ? (
        <PageHeader title="Audit trail" subtitle="Loading tamper-evident event log…" />
      ) : fixes.length === 0 ? (
        <>
          <PageHeader title="Audit trail" subtitle="Tamper-evident log of every action, for every incident." />
          <Card>
            <CardSub className="!mb-0">No incidents with audit entries yet. Run the pipeline to populate this view.</CardSub>
          </Card>
        </>
      ) : (
        <>
          <PageHeader
            title="Audit trail"
            subtitle="Tamper-evident log of every action, for every incident."
            actions={
              <Button variant="ghost" size="sm" onClick={() => loadFixes(true)} disabled={refreshing}>
                <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
              </Button>
            }
          />

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Card className="flex items-center gap-3 p-4">
              <ScrollText className="text-accent" size={20} />
              <div>
                <div className="text-2xl font-bold">{fixes.length}</div>
                <CardSub className="!mb-0">Incidents logged</CardSub>
              </div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <div className="text-2xl font-bold">{entries.length}</div>
              <CardSub className="!mb-0">Events this incident</CardSub>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <div className="text-2xl font-bold">{humanActions}</div>
              <CardSub className="!mb-0">Human / GitHub actions</CardSub>
            </Card>
          </div>

          <Card className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Incident">
                <select
                  className={selectClass}
                  value={fixId ?? ""}
                  onChange={(e) => onSelectFix(Number(e.target.value))}
                >
                  {fixes.map((f) => (
                    <option key={f.id} value={f.id}>
                      Fix #{f.id} · {f.repo} · {f.branch}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedFix && (
                <Badge tone={selectedFix.outcome === "merged" ? "good" : selectedFix.outcome === "pending" ? "warn" : "neutral"}>
                  {selectedFix.outcome}
                </Badge>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                <Link to={`/app/fix-log?fixId=${fixId}`}>
                  <Button variant="ghost" size="sm">
                    Fix log
                  </Button>
                </Link>
                <Link to={`/app/issues?fixId=${fixId}`}>
                  <Button variant="ghost" size="sm">
                    <FileText size={14} /> Issue record
                  </Button>
                </Link>
                <Link to={`/app/reports?fixId=${fixId}&tab=incident`}>
                  <Button variant="ghost" size="sm">
                    Incident report
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Event log</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={copyMarkdown} disabled={entries.length === 0}>
                  <Copy size={14} /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadMarkdown} disabled={entries.length === 0}>
                  <Download size={14} /> Export .md
                </Button>
              </div>
            </div>
            {entriesLoading ? (
              <CardSub className="!mb-0">Loading events…</CardSub>
            ) : entries.length === 0 ? (
              <CardSub className="!mb-0">No audit entries for this fix yet.</CardSub>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted">
                      <th className="pb-2 pr-4">Timestamp</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Actor</th>
                      <th className="pb-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((row, i) => {
                      const human = isHuman(row.actor);
                      return (
                        <tr key={`${row.at}-${row.action}-${i}`} className="border-b border-border">
                          <td className="py-2.5 pr-4 font-mono text-xs text-muted">{formatTs(row.at)}</td>
                          <td className="py-2.5 pr-4 font-semibold">{row.action}</td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.65rem] font-bold text-white",
                                  human ? "bg-blue" : "bg-accent",
                                )}
                              >
                                {initials(row.actor)}
                              </span>
                              {row.actor}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <OutcomeCell outcome={row.outcome} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </PermissionGate>
  );
}
