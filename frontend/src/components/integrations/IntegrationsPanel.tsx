import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Integration } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { inputClass } from "@/components/ui/FormControls";
import { Modal, useToast } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { CheckCircle2, Copy, Plug, RefreshCw, Unplug, Webhook, Zap } from "lucide-react";

function formatUpdated(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function IntegrationsPanel() {
  const { can } = usePermissions();
  const canManage = can("manage_integrations");
  const toast = useToast();

  const [plugins, setPlugins] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Integration | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlugins(await api.integrations());
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load integrations", false);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: plugins.length,
      connected: plugins.filter((p) => p.connected).length,
      pipeline: plugins.filter((p) => p.pipelineReady).length,
      repos: plugins.reduce((n, p) => n + p.repoCount, 0),
    }),
    [plugins],
  );

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${label} copied`);
    } catch {
      toast.show("Copy failed — select the URL manually", false);
    }
  };

  const runSync = async (p: Integration) => {
    if (!p.capabilities.syncRepos) return;
    setBusy(`sync:${p.key}`);
    try {
      const result = await api.syncIntegration(p.key);
      toast.show(`Synced ${result.synced} repos from ${p.displayName} — new repos land in Unassigned`);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Sync failed", false);
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (key: string, body?: Record<string, string>) => {
    setBusy(`test:${key}`);
    try {
      const result = await api.testIntegration(key, body);
      if (!result.ok) {
        toast.show(result.message ?? result.error ?? "Connection test failed", false);
        return false;
      }
      toast.show(result.detail ? `${result.message} · ${result.detail}` : (result.message ?? "Connection OK"));
      return true;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Test failed", false);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modal) return;
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (String(v).trim()) body[k] = String(v).trim();
    });
    try {
      const result = await api.connectIntegration(modal.key, body);
      if (!result.connected) {
        toast.show("Saved — fill all required fields to connect", false);
      } else {
        toast.show(`${modal.displayName} connected`);
        if (modal.capabilities.testConnection) {
          await runTest(modal.key, body);
        }
      }
      setModal(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Connect failed", false);
    }
  };

  if (loading && plugins.length === 0) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-44 animate-pulse bg-panel-2" />
        ))}
      </div>
    );
  }

  return (
    <>
      {!canManage && (
        <Callout className="mb-4">
          View-only — you need “Manage integrations & ticketing” to connect providers, run tests, or sync repositories.
        </Callout>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Providers", value: stats.total },
          { label: "Connected", value: stats.connected },
          { label: "Pipeline-ready", value: stats.pipeline },
          { label: "Tracked repos", value: stats.repos },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="!mb-0">CI/CD providers</CardTitle>
          <CardSub className="!mt-1">
            GitHub Actions is fully wired for the demo. Other providers accept credentials and webhooks — pipeline support ships incrementally.
          </CardSub>
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plugins.map((p) => {
          const syncing = busy === `sync:${p.key}`;
          const testing = busy === `test:${p.key}`;
          return (
            <Card key={p.key} className="flex flex-col gap-3 !p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-panel-2">
                    <BrandIcon name={p.icon} alt={p.displayName} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{p.displayName}</span>
                      <Badge tone={p.connected ? "good" : "neutral"}>{p.connected ? "Connected" : "Not connected"}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{p.subtitle}</p>
                  </div>
                </div>
                {p.pipelineReady ? (
                  <Badge tone="good" className="shrink-0">
                    <Zap size={12} /> Live pipeline
                  </Badge>
                ) : (
                  <Badge tone="warn" className="shrink-0">
                    UI ready
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge tone={p.liveTested ? "good" : "neutral"} className="text-[10px]">
                  {p.liveTested ? "Live-tested" : "Stubbed API"}
                </Badge>
                {p.connected && (
                  <Badge tone="neutral" className="text-[10px]">
                    {p.repoCount} repo{p.repoCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {p.updatedAt && (
                  <Badge tone="neutral" className="text-[10px]">
                    Updated {formatUpdated(p.updatedAt)}
                  </Badge>
                )}
              </div>

              {p.connected && Object.keys(p.configPreview).length > 0 && (
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs">
                  {Object.entries(p.configPreview).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 py-0.5">
                      <span className="text-muted">{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-dashed border-border bg-panel px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  <Webhook size={12} /> Webhook URL
                </div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-[11px] text-text-2">{p.webhookUrl}</code>
                  <Button variant="ghost" size="sm" className="shrink-0 !px-2" onClick={() => void copyText(p.webhookUrl, "Webhook URL")}>
                    <Copy size={12} />
                  </Button>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                {canManage &&
                  (p.connected ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setModal(p)}>
                        <Plug size={13} /> Manage
                      </Button>
                      {p.capabilities.testConnection && (
                        <Button variant="ghost" size="sm" disabled={testing} onClick={() => void runTest(p.key)}>
                          <CheckCircle2 size={13} className={testing ? "animate-pulse" : ""} />
                          {testing ? "Testing…" : "Test"}
                        </Button>
                      )}
                      {p.capabilities.syncRepos && (
                        <Button variant="ghost" size="sm" disabled={syncing} onClick={() => void runSync(p)}>
                          <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                          {syncing ? "Syncing…" : "Sync repos"}
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`Disconnect ${p.displayName}? Existing repos stay in Projects.`)) return;
                          await api.disconnectIntegration(p.key);
                          toast.show(`${p.displayName} disconnected`);
                          await load();
                        }}
                      >
                        <Unplug size={13} /> Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button variant="solid" size="sm" onClick={() => setModal(p)}>
                      Connect {p.displayName}
                    </Button>
                  ))}
                {p.key === "github" && p.connected && (
                  <Link to="/app/projects" className={cn("ml-auto self-center text-xs font-semibold text-accent hover:underline")}>
                    Assign repos → Projects
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? (modal.connected ? `Manage ${modal.displayName}` : `Connect ${modal.displayName}`) : ""}
        subtitle={
          modal?.pipelineReady
            ? "Credentials apply immediately. GitHub is the primary live integration for this demo."
            : "Save credentials now — full pipeline support for this provider is still rolling out."
        }
      >
        {modal && (
          <form ref={setFormEl} onSubmit={submit} className="flex flex-col gap-3">
            {modal.fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {f.label}
                <input
                  name={f.name}
                  type={f.type}
                  autoComplete="off"
                  required={!modal.connected}
                  placeholder={modal.configPreview[f.name] ? `Current: ${modal.configPreview[f.name]}` : undefined}
                  className={inputClass}
                />
              </label>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              {modal.capabilities.testConnection && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={async () => {
                    if (!formEl) return;
                    const fd = new FormData(formEl);
                    const body: Record<string, string> = {};
                    fd.forEach((v, k) => {
                      if (String(v).trim()) body[k] = String(v).trim();
                    });
                    await runTest(modal.key, body);
                  }}
                >
                  Test connection
                </Button>
              )}
              <Button type="submit" variant="solid">
                {modal.connected ? "Update credentials" : "Connect"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
