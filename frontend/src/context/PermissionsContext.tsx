import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { PERMISSION_KEYS, type PermissionKey, type PermissionSet } from "@/lib/permissions";

interface PermissionsContextValue {
  role: string;
  isAdmin: boolean;
  permissions: PermissionSet | null;
  loading: boolean;
  error: string | null;
  can: (key: PermissionKey) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

const EMPTY: PermissionSet = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as PermissionSet;

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.myPermissions();
      setRole(data.role);
      setPermissions(data.permissions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load permissions";
      try {
        const ws = await api.workspace();
        if (ws.user?.role) {
          setRole(ws.user.role);
          if (ws.user.role === "Admin") {
            setPermissions(Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as PermissionSet);
          } else {
            setPermissions(EMPTY);
          }
          setError(`Permissions sync failed (${message}) — using role from workspace`);
          return;
        }
      } catch {
        /* workspace also failed */
      }
      setError(message);
      setRole("");
      setPermissions(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isAdmin = role === "Admin";

  const can = useCallback(
    (key: PermissionKey) => isAdmin || Boolean(permissions?.[key]),
    [isAdmin, permissions],
  );

  const value = useMemo(
    () => ({ role, isAdmin, permissions, loading, error, can, refresh }),
    [role, isAdmin, permissions, loading, error, can, refresh],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}
