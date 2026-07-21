import { useEffect, useState } from "react";
import { api, type TicketingIntegration } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, useToast } from "@/components/ui/Modal";

export function TicketingPanel() {
  const { can } = usePermissions();
  const canManage = can("manage_integrations");
  const [providers, setProviders] = useState<TicketingIntegration[]>([]);
  const [modal, setModal] = useState<TicketingIntegration | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  const load = () => api.ticketing().then(setProviders).catch(console.error);
  useEffect(() => {
    load();
  }, []);

  const testConnection = async (key: string) => {
    if (!canManage) return;
    setTesting(key);
    try {
      const result = await api.testTicketing(key);
      toast.show(result.ok ? "Connection verified" : (result.error ?? "Test failed"), result.ok);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Test failed", false);
    } finally {
      setTesting(null);
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
      const result = await api.connectTicketing(modal.key, body);
      if (!result.connected) {
        toast.show("Saved — fill all required fields to connect", false);
      } else {
        toast.show(`${modal.name} connected`);
      }
      setModal(null);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Connect failed", false);
    }
  };

  return (
    <>
      {!canManage && (
        <p className="mb-3 text-sm text-muted">View-only — you need “Manage integrations & ticketing” to connect ticketing providers.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => (
          <div key={p.key} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <BrandIcon name={p.key} size={32} />
            <div className="flex-1 min-w-0">
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-muted">{p.detail}</div>
              {!p.liveTested && <div className="text-[11px] text-muted">Coded, not live-tested</div>}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge tone={p.connected ? "good" : "neutral"}>{p.connected ? "Connected" : "Not connected"}</Badge>
              {p.fields.length > 0 ? (
                canManage ? (
                <div className="flex gap-1.5">
                  {p.connected ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => testConnection(p.key)} disabled={testing === p.key}>
                        {testing === p.key ? "Testing…" : "Test"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setModal(p)}>
                        Manage
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          await api.disconnectTicketing(p.key);
                          toast.show("Disconnected");
                          load();
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button variant="solid" size="sm" onClick={() => setModal(p)}>
                      Connect
                    </Button>
                  )}
                </div>
                ) : null
              ) : (
                <Button variant="ghost" size="sm" disabled title="This provider isn't wired up to a real connect flow yet — Jira is the only live ticketing integration today">
                  Coming soon
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `Connect ${modal.name}` : ""}
        subtitle={
          modal?.liveTested
            ? "Real API calls — tickets are created for real in your Jira site."
            : "Interface ready — provider API calls may still be stubbed."
        }
      >
        {modal && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            {modal.fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1 text-sm font-semibold text-muted">
                {f.label}
                <input
                  name={f.name}
                  type={f.type}
                  autoComplete="off"
                  required
                  className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-text"
                />
              </label>
            ))}
            <Button type="submit" variant="solid" className="self-end">
              Connect
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
