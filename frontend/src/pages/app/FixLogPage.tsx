import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub } from "@/components/ui/Card";
import { Field, selectClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type FixRecord } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  ScrollText,
  ShieldAlert,
} from "lucide-react";

function formatAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function FixLogPage() {
  const { can } = usePermissions();
  const canRevert = can("revert_fix");
  const canApprove = can("approve_autopilot");
  const canAudit = can("view_audit_trail");
  const { show: toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [fixes, setFixes] = useState<FixRecord[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [repo, setRepo] = useState("all");
  const [branch, setBranch] = useState("all");
  const [mode, setMode] = useState("all");
  const [outcome, setOutcome] = useState("all");

  const highlightParam = searchParams.get("fixId");
  const highlightId = highlightParam ? Number(highlightParam) : null;
  const scrolledRef = useRef<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDetailsElement | null>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [fixList, repoList] = await Promise.all([api.fixes(), api.repos()]);
      setFixes(fixList);
      setRepos(Array.from(new Set(repoList.map((r) => r.repo))).sort());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load fix log", false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightId || scrolledRef.current === highlightId) return;
    const node = cardRefs.current[highlightId];
    if (!node) return;
    scrolledRef.current = highlightId;
    node.open = true;
    requestAnimationFrame(() => {
      node.scrollIntoView({ block: "nearest" });
    });
  }, [highlightId, fixes.length]);

  const filtered = useMemo(() => {
    return fixes.filter((f) => {
      if (repo !== "all" && f.repo !== repo) return false;
      if (branch !== "all" && f.branch !== branch) return false;
      if (mode !== "all" && f.mode !== mode) return false;
      if (outcome !== "all" && f.outcome !== outcome && f.badgeLabel?.toLowerCase().replace(" ", "_") !== outcome) {
        return false;
      }
      return true;
    });
  }, [fixes, repo, branch, mode, outcome]);

  const stats = useMemo(() => {
    const base = filtered.length ? filtered : fixes;
    return {
      total: base.length,
      merged: base.filter((f) => f.outcome === "merged").length,
      pending: base.filter((f) => f.outcome === "pending").length,
      escalated: base.filter((f) => f.outcome === "escalated").length,
      reverted: base.filter((f) => f.outcome === "reverted").length,
      avgConfidence: base.length
        ? Math.round(base.reduce((s, f) => s + f.confidence, 0) / base.length)
        : 0,
    };
  }, [filtered, fixes]);

  const branches = useMemo(() => Array.from(new Set(fixes.map((f) => f.branch))).sort(), [fixes]);
  const modes = useMemo(() => Array.from(new Set(fixes.map((f) => f.mode))).sort(), [fixes]);

  const approve = async (id: number) => {
    try {
      await api.approveFix(id);
      toast(`Fix #${id} approved`);
      void load(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Approve failed", false);
    }
  };

  const revert = async (id: number) => {
    const reason = window.prompt(
      "Reason for reverting this fix (required if your workspace's Rollback & safety settings require one)",
    );
    if (reason === null) return;
    try {
      await api.revertFix(id, reason.trim() || undefined);
      toast(`Fix #${id} reverted`);
      void load(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Revert failed", false);
    }
  };

  const onToggleFix = (id: number, open: boolean) => {
    if (open) {
      setSearchParams({ fixId: String(id) }, { replace: true });
    } else if (highlightId === id) {
      setSearchParams({}, { replace: true });
      scrolledRef.current = null;
    }
  };

  if (loading && fixes.length === 0) {
    return (
      <>
        <PageHeader title="Fix log" subtitle="Loading fix history…" />
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-panel-2" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Fix log"
        subtitle="Every fix attempt, with the diagnosis, the diff, and the outcome."
        actions={
          <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="flex items-center gap-3 p-4">
          <ScrollText className="text-accent" size={20} />
          <div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <CardSub className="!mb-0">Total fixes</CardSub>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <CheckCircle2 className="text-good" size={20} />
          <div>
            <div className="text-2xl font-bold text-good">{stats.merged}</div>
            <CardSub className="!mb-0">Merged</CardSub>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Clock className="text-warn" size={20} />
          <div>
            <div className="text-2xl font-bold text-warn">{stats.pending}</div>
            <CardSub className="!mb-0">Pending review</CardSub>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <ShieldAlert className="text-critical" size={20} />
          <div>
            <div className="text-2xl font-bold text-critical">{stats.escalated + stats.reverted}</div>
            <CardSub className="!mb-0">Escalated / reverted</CardSub>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
          <CardSub className="!mb-0">Avg confidence</CardSub>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <Field label="Repository">
            <select className={selectClass} value={repo} onChange={(e) => setRepo(e.target.value)}>
              <option value="all">All repos</option>
              {repos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch">
            <select className={selectClass} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mode">
            <select className={selectClass} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="all">All modes</option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Outcome">
            <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="all">All outcomes</option>
              <option value="merged">Merged</option>
              <option value="pending">Pending review</option>
              <option value="escalated">Escalated</option>
              <option value="reverted">Reverted</option>
            </select>
          </Field>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardSub className="!mb-0">No fixes match the current filters. Adjust filters or run a pipeline simulation from the dashboard.</CardSub>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((fix) => (
            <details
              key={fix.id}
              ref={(el) => {
                cardRefs.current[fix.id] = el;
              }}
              className={cn(
                "group rounded-stitch border bg-panel shadow-stitch open:ring-1 open:ring-accent/20",
                highlightId === fix.id ? "border-accent ring-1 ring-accent/30" : "border-border",
              )}
              defaultOpen={highlightId === fix.id}
              onToggle={(e) => onToggleFix(fix.id, e.currentTarget.open)}
            >
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
                <span className="font-bold text-accent">#{fix.id}</span>
                <span className="text-sm">
                  <b>{fix.repo}</b> · <code className="rounded bg-code-bg px-1">{fix.branch}</code>
                </span>
                <span className="text-xs text-muted">
                  {formatAt(fix.at)} · {fix.author}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-code-bg">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${fix.confidence}%`, background: `var(--${fix.meterClass})` }}
                    />
                  </span>
                  <span className="text-sm font-bold">{fix.confidence}%</span>
                </span>
                <Badge tone={fix.badgeClass as "good"}>{fix.badgeLabel}</Badge>
              </summary>
              <div className="border-t border-border px-5 pb-5 pt-2 text-sm">
                <h4 className="text-xs font-bold uppercase text-muted">Root cause — GPT-5.6</h4>
                <p className="mt-1">{fix.rootCause}</p>

                {fix.files.length > 0 && (
                  <>
                    <h4 className="mt-4 text-xs font-bold uppercase text-muted">Files changed</h4>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {fix.files.map((f) => (
                        <code key={f} className="rounded bg-code-bg px-2 py-1 text-xs">
                          {f}
                        </code>
                      ))}
                    </div>
                  </>
                )}

                <h4 className="mt-4 text-xs font-bold uppercase text-muted">Diff{fix.files[0] ? ` — ${fix.files[0]}` : ""}</h4>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-code-bg p-3 font-mono text-xs">
                  {fix.diff.map((l, i) => (
                    <div key={i} className={l.del ? "text-code-del-text bg-code-del/30" : l.add ? "text-code-add-text bg-code-add/30" : ""}>
                      {l.del ?? l.add ?? l.ctx}
                    </div>
                  ))}
                </pre>

                {fix.badgeLabel === "Escalated" && (
                  <>
                    <h4 className="mt-4 text-xs font-bold uppercase text-muted">Confidence engine</h4>
                    <p className="mt-1">
                      Score fell below the confidence floor — mode downgraded to <b>diagnose-only</b>, and no code was written.
                    </p>
                  </>
                )}

                <h4 className="mt-4 text-xs font-bold uppercase text-muted">Outcome</h4>
                <p className="mt-1">{fix.outcomeText}</p>

                {fix.ticket && (
                  <>
                    <h4 className="mt-4 text-xs font-bold uppercase text-muted">Ticket</h4>
                    <p className="mt-1">
                      <Badge tone="accent">{fix.ticket}</Badge> linked from this fix ({fix.confidence}% confidence).
                    </p>
                  </>
                )}

                {fix.prUrl && (
                  <a href={fix.prUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-accent">
                    <ExternalLink size={14} /> View PR
                  </a>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Link to={`/app/issues?fixId=${fix.id}`}>
                    <Button variant="ghost" size="sm">
                      <FileText size={14} /> Issue record
                    </Button>
                  </Link>
                  {canAudit && (
                    <Link to={`/app/audit?fixId=${fix.id}`}>
                      <Button variant="ghost" size="sm">Audit trail</Button>
                    </Link>
                  )}
                  <Link to={`/app/reports?fixId=${fix.id}&tab=incident`}>
                    <Button variant="ghost" size="sm">Incident report</Button>
                  </Link>
                  {fix.badgeLabel === "Pending review" && canApprove && (
                    <Button variant="solid" size="sm" onClick={() => approve(fix.id)}>
                      Approve fix
                    </Button>
                  )}
                  {fix.badgeLabel === "Merged" && canRevert && (
                    <Button variant="danger" size="sm" onClick={() => revert(fix.id)}>
                      Revert this fix
                    </Button>
                  )}
                  {fix.badgeLabel === "Reverted" && (
                    <Button variant="ghost" size="sm" disabled>
                      Already reverted
                    </Button>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
