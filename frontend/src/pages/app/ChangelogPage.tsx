import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type ChangelogData, type ChangelogEntry } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Copy, Download, GitCommit, RefreshCw, Share2 } from "lucide-react";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GitCommit size={18} className="text-accent" />
        <CardTitle className="!mb-0">{entry.date}</CardTitle>
        <Badge tone="good">{entry.label}</Badge>
      </div>
      {entry.fixed.length > 0 && (
        <>
          <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted">Fixed</h4>
          <ul className="mb-3 space-y-3 text-sm text-text-2">
            {entry.fixed.map((item) => (
              <li key={`${item.fixId}-${item.file}`} className="flex gap-2">
                <span className="text-good">✓</span>
                <span>
                  <b>{item.file}</b> — {item.summary}.
                  <span className="ml-1 font-mono text-xs text-muted">
                    Fix #{item.fixId}
                    {item.prRef ? ` · ${item.prRef}` : ""}
                  </span>
                  <span className="ml-2 inline-flex gap-2">
                    <Link to={`/app/fix-log?fixId=${item.fixId}`} className="text-accent">
                      Fix log
                    </Link>
                    <Link to={`/app/issues?fixId=${item.fixId}`} className="text-accent">
                      Issue
                    </Link>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {entry.ci.length > 0 && (
        <>
          <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted">CI configuration</h4>
          <ul className="space-y-2 text-sm text-text-2">
            {entry.ci.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-accent">•</span>
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function ChangelogPage() {
  const { can } = usePermissions();
  const canExport = can("export_data");
  const toast = useToast();

  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storing, setStoring] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      setData(await api.changelog());
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load changelog", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyMarkdown = () => {
    if (!data?.markdown) return;
    navigator.clipboard.writeText(data.markdown).then(() => toast.show("Changelog copied"));
  };

  const downloadMarkdown = () => {
    if (!data?.markdown) return;
    downloadText("CHANGELOG.md", data.markdown);
    toast.show("Download started");
  };

  const storeSnapshot = async () => {
    if (!canExport) return;
    setStoring(true);
    try {
      const stored = await api.storeReport({ type: "changelog" });
      toast.show(`Stored as "${stored.title}" — view in Reports`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Store failed", false);
    } finally {
      setStoring(false);
    }
  };

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Changelog" subtitle="Loading merged fixes…" />
        <Card className="h-40 animate-pulse bg-panel-2" />
      </>
    );
  }

  const entries = data?.entries ?? [];
  const mergedCount = entries.reduce((n, e) => n + e.fixed.length, 0);

  return (
    <>
      <PageHeader
        title="Changelog"
        subtitle="Auto-generated from every merged fix — nothing hand-written."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={copyMarkdown} disabled={!data?.markdown}>
              <Copy size={14} /> Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadMarkdown} disabled={!data?.markdown}>
              <Download size={14} /> Download
            </Button>
            {canExport && (
              <Button variant="solid" size="sm" onClick={storeSnapshot} disabled={storing || !data?.markdown}>
                <Share2 size={14} /> Store in Reports
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{entries.length}</div>
          <CardSub className="!mb-0">Release days</CardSub>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-good">{mergedCount}</div>
          <CardSub className="!mb-0">Merged fixes</CardSub>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs text-muted">Generated</div>
          <div className="text-sm font-semibold">
            {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}
          </div>
        </Card>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardSub className="!mb-0">
            No merged fixes yet. Once Stitch merges a fix, it appears here automatically — and can be written to{" "}
            <code className="rounded bg-code-bg px-1">CHANGELOG.md</code> when Documentation settings are enabled.
          </CardSub>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <EntryCard key={entry.date} entry={entry} />
          ))}
        </div>
      )}

      <Card className="mt-4">
        <CardSub className="!mb-0">
          Changelog entries are derived live from your fix pipeline. Stored snapshots and share links live under{" "}
          <Link to="/app/reports" className="text-accent">
            Reports
          </Link>
          . Enable repo writes in Settings → Documentation to commit <code className="rounded bg-code-bg px-1">CHANGELOG.md</code>.
        </CardSub>
      </Card>
    </>
  );
}
