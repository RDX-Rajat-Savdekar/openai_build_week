import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/FormControls";
import { Markdown } from "@/components/ui/Markdown";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type IssueRecord } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Copy, Download, FileText, RefreshCw, Search } from "lucide-react";

const statusTone: Record<string, BadgeTone> = {
  merged: "good",
  pending_review: "warn",
  escalated: "critical",
  reverted: "outline",
  open: "blue",
};

const statusLabel: Record<string, string> = {
  merged: "Merged",
  pending_review: "Pending review",
  escalated: "Escalated",
  reverted: "Reverted",
  open: "Open",
};

const revertBlockedReason: Record<string, string> = {
  reverted: "Already reverted",
  escalated: "No fix was applied",
  pending_review: "Nothing to revert yet",
  open: "Nothing to revert yet",
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function IssueRecordsPage() {
  const { can } = usePermissions();
  const canRevert = can("revert_fix");
  const canExport = can("export_data");
  const canAudit = can("view_audit_trail");
  const { show: toast } = useToast();
  const [searchParams] = useSearchParams();
  const fixIdParam = searchParams.get("fixId");

  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [selectedFixId, setSelectedFixId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setRecords(await api.issues());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load issue records", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (records.length === 0) return;
    if (fixIdParam) {
      const fixId = Number(fixIdParam);
      if (records.some((r) => r.fixId === fixId)) {
        setSelectedFixId(fixId);
        return;
      }
    }
    setSelectedFixId((prev) => prev ?? records[0]!.fixId);
  }, [fixIdParam, records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q) ||
        r.repo.toLowerCase().includes(q) ||
        String(r.fixId).includes(q),
    );
  }, [records, query]);

  const record = filtered.find((r) => r.fixId === selectedFixId) ?? filtered[0];

  const stats = useMemo(
    () => ({
      total: records.length,
      merged: records.filter((r) => r.status === "merged").length,
      open: records.filter((r) => r.status === "pending_review" || r.status === "open").length,
      escalated: records.filter((r) => r.status === "escalated").length,
    }),
    [records],
  );

  const copyPath = () => {
    if (!record) return;
    navigator.clipboard.writeText(record.path).then(() => toast("Path copied"));
  };

  const copyMarkdown = () => {
    if (!record) return;
    navigator.clipboard.writeText(record.markdown).then(() => toast("Markdown copied"));
  };

  const downloadMarkdown = () => {
    if (!record) return;
    downloadText(record.path.split("/").pop() ?? "issue.md", record.markdown);
    toast("Download started");
  };

  const revert = async () => {
    if (!record) return;
    const reason = window.prompt(
      "Reason for reverting this fix (required if your workspace's Rollback & safety settings require one)",
    );
    if (reason === null) return;
    try {
      await api.revertFix(record.fixId, reason.trim() || undefined);
      toast(`Fix #${record.fixId} reverted`);
      void load(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Revert failed", false);
    }
  };

  if (loading && records.length === 0) {
    return <PageHeader title="Issue records" subtitle="Loading markdown files…" />;
  }

  if (!record) {
    return (
      <>
        <PageHeader title="Issue records" subtitle="One markdown file per issue, written into the repo." />
        <Card>
          <CardSub className="!mb-0">No issue records yet. Run the pipeline or simulate a failure from the dashboard.</CardSub>
        </Card>
      </>
    );
  }

  const blocked = revertBlockedReason[record.status];

  return (
    <>
      <PageHeader
        title="Issue records"
        subtitle="One markdown file per issue, written into the repo."
        actions={
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <CardSub className="!mb-0">Total records</CardSub>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-good">{stats.merged}</div>
          <CardSub className="!mb-0">Merged</CardSub>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-warn">{stats.open}</div>
          <CardSub className="!mb-0">Open / pending</CardSub>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-critical">{stats.escalated}</div>
          <CardSub className="!mb-0">Escalated</CardSub>
        </Card>
      </div>

      <Card className="mb-4 border-accent/20 bg-accent-soft/30">
        <CardSub className="!mb-0">
          Files at <code className="rounded bg-code-bg px-1">.stitch/issues/*.md</code> — synced from the fix pipeline. Same content as the Fix Log, but git-tracked and readable without Stitch online.
        </CardSub>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pr-1">
          <Field label="Search">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className={cn(inputClass, "pl-9")}
                placeholder="Title, path, repo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </Field>
          <div className="flex justify-between px-1 text-xs text-muted">
            <code>.stitch/issues/</code>
            <span>{filtered.length} files</span>
          </div>
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedFixId(r.fixId);
                setRaw(false);
              }}
              className={cn(
                "w-full rounded-stitch border p-3 text-left transition-colors",
                record.fixId === r.fixId ? "border-accent bg-accent-soft" : "border-border bg-panel hover:border-accent/40",
              )}
            >
              <div className="flex gap-2">
                <FileText size={16} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-mono text-muted">{r.path.split("/").pop()}</div>
                  <div className="truncate text-sm font-bold">{r.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={statusTone[r.status] ?? "neutral"}>{statusLabel[r.status] ?? r.status}</Badge>
                    <Badge tone="accent">{r.confidence}%</Badge>
                    {r.ticketId && <Badge tone="neutral">{r.ticketId}</Badge>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{record.title}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Link to={`/app/fix-log?fixId=${record.fixId}`}>
                <Button variant="ghost" size="sm">
                  Fix #{record.fixId}
                </Button>
              </Link>
              {canAudit && (
                <Link to={`/app/audit?fixId=${record.fixId}`}>
                  <Button variant="ghost" size="sm">
                    Audit
                  </Button>
                </Link>
              )}
              <Link to={`/app/reports?fixId=${record.fixId}&tab=incident`}>
                <Button variant="ghost" size="sm">
                  Report
                </Button>
              </Link>
            </div>
          </div>
          {raw ? (
            <pre className="max-h-[min(520px,calc(100vh-16rem))] overflow-auto rounded-lg bg-code-bg p-4 font-mono text-xs whitespace-pre-wrap">
              {record.markdown}
            </pre>
          ) : (
            <div className="max-h-[min(520px,calc(100vh-16rem))] overflow-auto rounded-lg border border-border p-4">
              <Markdown text={record.markdown} />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={copyPath}>
              <Copy size={14} /> Copy path
            </Button>
            <Button variant="ghost" size="sm" onClick={() => (raw ? copyMarkdown() : setRaw(true))}>
              {raw ? "Copy raw markdown" : "View raw markdown"}
            </Button>
            {raw && (
              <Button variant="ghost" size="sm" onClick={() => setRaw(false)}>
                Back to rendered
              </Button>
            )}
            {canExport && (
              <Button variant="ghost" size="sm" onClick={downloadMarkdown}>
                <Download size={14} /> Download .md
              </Button>
            )}
            {blocked ? (
              <Button variant="ghost" size="sm" disabled>
                {blocked}
              </Button>
            ) : canRevert ? (
              <Button variant="danger" size="sm" onClick={revert}>
                Revert this fix
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled title="Requires revert permission">
                Revert this fix
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
