import { useEffect, useState } from "react";
import { api, type NotificationChannel } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";

export function NotificationsPanel() {
  const { can } = usePermissions();
  const canManage = can("manage_integrations");
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const toast = useToast();

  const load = () => api.notifications().then(setChannels).catch(console.error);
  useEffect(() => {
    load();
  }, []);

  const setField = (channelKey: string, fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [channelKey]: { ...prev[channelKey], [fieldName]: value } }));
  };

  const toggleEnabled = async (c: NotificationChannel, enabled: boolean) => {
    if (!canManage) return;
    // Real, immediate toggle — matches every other live Settings control (no separate Save click needed for this one).
    setChannels((prev) => prev.map((ch) => (ch.key === c.key ? { ...ch, workspaceEnabled: enabled } : ch)));
    try {
      await api.saveNotification(c.key, { enabled });
      toast.show(`${c.displayName} ${enabled ? "enabled" : "disabled"} for this workspace`);
    } catch (err) {
      setChannels((prev) => prev.map((ch) => (ch.key === c.key ? { ...ch, workspaceEnabled: !enabled } : ch)));
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const saveFields = async (c: NotificationChannel) => {
    if (!canManage) return;
    const body: Record<string, unknown> = { enabled: c.workspaceEnabled };
    const values = fieldValues[c.key] ?? {};
    for (const f of c.fields) {
      if (values[f.name]?.trim()) body[f.name] = values[f.name].trim();
    }
    try {
      await api.saveNotification(c.key, body);
      toast.show(`${c.displayName} saved`);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Save failed", false);
    }
  };

  const sendTest = async (c: NotificationChannel) => {
    if (!canManage) return;
    setTesting(c.key);
    try {
      await api.testNotification(c.key);
      toast.show("Test notification sent");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Test failed", false);
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      {!canManage && (
        <p className="mb-3 text-sm text-muted">View-only — you need “Manage integrations & ticketing” to configure notifications.</p>
      )}
      <div className="grid gap-3.5 md:grid-cols-2">
      {channels.map((c) => (
        <Card key={c.key} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BrandIcon name={c.icon} alt={c.displayName} />
              <span className="font-bold">{c.displayName}</span>
            </div>
            <Badge tone={c.configured ? "good" : "neutral"}>
              {c.configured ? "Configured" : "Not configured"}
            </Badge>
          </div>
          <Toggle
            checked={c.workspaceEnabled}
            label="Enabled for workspace"
            onChange={(v) => toggleEnabled(c, v)}
          />
          {c.fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1 text-xs font-semibold text-muted">
              {f.label}
              <input
                type={f.type}
                autoComplete="off"
                disabled={!canManage}
                value={fieldValues[c.key]?.[f.name] ?? ""}
                onChange={(e) => setField(c.key, f.name, e.target.value)}
                className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text"
              />
            </label>
          ))}
          {canManage && (
            <div className="flex gap-2">
              <Button variant="solid" onClick={() => saveFields(c)}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => sendTest(c)} disabled={testing === c.key}>
                {testing === c.key ? "Sending…" : "Send test"}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
    </>
  );
}
