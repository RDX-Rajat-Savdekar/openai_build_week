import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { api, subscribeEvents, type InboxNotification } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";

function dismissKey(userId: string) {
  return `stitch:inbox:dismissed:${userId}`;
}

function loadDismissed(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissed(userId: string, ids: Set<string>) {
  localStorage.setItem(dismissKey(userId), JSON.stringify([...ids]));
}

function levelStyles(level: InboxNotification["level"]) {
  if (level === "critical") return "border-l-critical bg-critical-soft/20";
  if (level === "warn") return "border-l-warn bg-warn-soft/15";
  return "border-l-border bg-panel-2/40";
}

interface NotificationInboxProps {
  userId?: string;
}

export function NotificationInbox({ userId }: NotificationInboxProps) {
  const { can } = usePermissions();
  const canAudit = can("view_audit_trail");
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => (userId ? loadDismissed(userId) : new Set()));

  useEffect(() => {
    if (userId) setDismissed(loadDismissed(userId));
  }, [userId]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await api.inbox();
        setItems(data.notifications);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeEvents({
      onActivity: () => void load(true),
      onPipeline: () => void load(true),
    });
    return unsub;
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const visible = items.filter((n) => !dismissed.has(n.id));
  const unread = visible.filter((n) => n.level !== "info" || n.kind === "attention").length;

  const dismiss = (id: string) => {
    if (!userId) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(userId, next);
      return next;
    });
  };

  const dismissAll = () => {
    if (!userId) return;
    const next = new Set(dismissed);
    for (const n of visible) next.add(n.id);
    setDismissed(next);
    saveDismissed(userId, next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel-2 text-text-2 transition-colors hover:border-accent/30"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-stitch border border-border bg-panel shadow-stitch animate-fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
              Notifications
              {unread > 0 && <Badge tone="accent">{unread}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="rounded-md p-1 text-muted hover:bg-accent-soft hover:text-text"
                aria-label="Refresh"
              >
                <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
              </button>
              {visible.length > 0 && (
                <button
                  type="button"
                  onClick={dismissAll}
                  className="rounded-md px-2 py-1 text-[0.68rem] font-semibold text-muted hover:bg-accent-soft hover:text-text"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-3.5 py-8 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="px-3.5 py-8 text-center text-sm text-muted">You&apos;re all caught up.</div>
            )}
            {!loading &&
              visible.map((n) => (
                <div
                  key={n.id}
                  className={cn("border-b border-border border-l-[3px] px-3.5 py-3 last:border-0", levelStyles(n.level))}
                >
                  <div className="flex justify-between gap-2 text-xs text-muted">
                    <span className="truncate font-semibold text-text">
                      {n.repo}
                      <span className="font-normal text-muted"> · </span>
                      <code className="rounded bg-code-bg px-1">{n.branch}</code>
                    </span>
                    <span className="shrink-0">{n.ago}</span>
                  </div>
                  <div className="mt-1 text-sm leading-snug">
                    {n.body}
                    {n.badge && (
                      <Badge tone="accent" className="ml-1.5 align-middle">
                        {n.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Link to={n.action.href} onClick={() => setOpen(false)}>
                      <Button variant="solid" size="sm">
                        {n.action.label}
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => dismiss(n.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          <Link
            to={canAudit ? "/app/audit" : "/app/fix-log"}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            View all activity <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
