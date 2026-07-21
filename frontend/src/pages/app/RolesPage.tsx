import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Field, inputClass } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type RoleDefinition } from "@/lib/api";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { Check, Trash2 } from "lucide-react";

import { BUILTIN_ROLE_COLORS } from "@/lib/roles";

const SWATCHES = ["#4a3aa7", "#2a78d6", "#0f8f4f", "#a8710a", "#c0392b", "#898781"];

function roleColor(role: RoleDefinition): string {
  return role.color ?? BUILTIN_ROLE_COLORS[role.name] ?? "#6153e0";
}

function roleColumnLabel(name: string): string {
  const first = name.split(" ")[0] ?? name;
  return first.length > 8 ? first.slice(0, 7).toUpperCase() : first.toUpperCase();
}

export function RolesPage() {
  const { can, isAdmin, role: myRole, error, loading, refresh: refreshPermissions } = usePermissions();
  const canManage = can("manage_team");
  const toast = useToast();
  const matrixRef = useRef<HTMLDivElement>(null);

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<PermissionKey, boolean>>>({});
  const [saved, setSaved] = useState<Record<string, Record<PermissionKey, boolean>>>({});
  const [focusRole, setFocusRole] = useState<string>("Developer");
  const [newName, setNewName] = useState("");
  const [selectedSwatch, setSelectedSwatch] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const load = useCallback(() => {
    setLoadingRoles(true);
    api
      .roles()
      .then((rows) => {
        setRoles(rows);
        const nextDraft: Record<string, Record<PermissionKey, boolean>> = {};
        const nextSaved: Record<string, Record<PermissionKey, boolean>> = {};
        for (const r of rows) {
          nextDraft[r.name] = { ...r.permissions };
          nextSaved[r.name] = { ...r.permissions };
        }
        setDraft(nextDraft);
        setSaved(nextSaved);
        if (!rows.some((r) => r.name === focusRole) && rows[0]) setFocusRole(rows[0].name);
      })
      .catch((e) => toast.show(e instanceof Error ? e.message : "Failed to load roles", false))
      .finally(() => setLoadingRoles(false));
  }, [focusRole]);

  useEffect(() => {
    load();
  }, [load]);

  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);

  const hasChanges = useMemo(
    () =>
      roles.some((role) => {
        if (role.name === "Admin") return false;
        const d = draft[role.name];
        const s = saved[role.name];
        if (!d || !s) return false;
        return PERMISSION_KEYS.some((k) => d[k] !== s[k]);
      }),
    [roles, draft, saved],
  );

  const toggle = (roleName: string, key: PermissionKey) => {
    if (!canManage || roleName === "Admin") return;
    setDraft((d) => ({
      ...d,
      [roleName]: { ...d[roleName], [key]: !d[roleName]?.[key] },
    }));
  };

  const editRole = (name: string) => {
    setFocusRole(name);
    matrixRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveMatrix = async () => {
    if (!canManage || !hasChanges) return;
    setSaving(true);
    try {
      let updated = 0;
      for (const role of roles) {
        if (role.name === "Admin") continue;
        const perms = draft[role.name];
        const baseline = saved[role.name];
        if (!perms || !baseline) continue;
        const changed = PERMISSION_KEYS.some((k) => perms[k] !== baseline[k]);
        if (changed) {
          await api.updateRole(role.name, { permissions: perms });
          updated += 1;
        }
      }
      toast.show(updated ? `Saved permissions for ${updated} role${updated === 1 ? "" : "s"}` : "No changes to save");
      load();
      await refreshPermissions();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Save failed", false);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    const name = newName.trim();
    if (!name) {
      toast.show("Role name is required", false);
      return;
    }
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.show(`Role "${name}" already exists`, false);
      return;
    }
    try {
      await api.createRole({
        name,
        color: selectedSwatch,
        permissions: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])),
      });
      toast.show(`Role "${name}" created`);
      setNewName("");
      setFocusRole(name);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Create failed", false);
    }
  };

  const deleteRole = async (name: string) => {
    if (!confirm(`Delete role "${name}"? Members must be reassigned first.`)) return;
    try {
      await api.deleteRole(name);
      toast.show(`Role "${name}" deleted`);
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Delete failed", false);
    }
  };

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Who can do what — built-in roles plus custom roles. Changes are enforced on every API route."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Signed in as</span>
        <Badge tone={isAdmin ? "good" : "blue"}>{loading ? "…" : myRole || "Unknown"}</Badge>
        {canManage ? (
          hasChanges ? (
            <Badge tone="warn">Unsaved permission changes</Badge>
          ) : (
            <Badge tone="good">All permissions saved</Badge>
          )
        ) : (
          <Badge tone="outline">View only</Badge>
        )}
      </div>

      {!canManage && (
        <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-text-2">
          You need <b>Manage team & roles</b> to edit this page. Ask an Admin to grant it in the matrix below.
        </div>
      )}

      <Card className="mb-4">
        <CardTitle>Roles</CardTitle>
        {loadingRoles ? (
          <CardSub className="!mb-0">Loading roles…</CardSub>
        ) : (
          <div className="mt-2">
            {roles.map((role) => (
              <div
                key={role.name}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0",
                  focusRole === role.name && "rounded-lg bg-accent-soft/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: roleColor(role) }} />
                  <div>
                    <span className="font-bold">{role.name}</span>
                    {role.description && <p className="mt-0.5 max-w-lg text-xs font-normal text-muted">{role.description}</p>}
                  </div>
                  {role.custom && <Badge tone="warn">Custom</Badge>}
                  {role.name === "Admin" && <Badge tone="good">All access</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">
                    {role.members} member{role.members !== 1 ? "s" : ""}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => editRole(role.name)}>
                    Edit
                  </Button>
                  {role.custom && canManage && (
                    <Button variant="danger" size="sm" onClick={() => void deleteRole(role.name)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {canManage && (
              <div className="mt-4 border-t border-border pt-4">
                <CardSub className="!mb-3">Create custom role</CardSub>
                <div className="flex flex-wrap gap-4">
                  <Field label="Role name">
                    <input
                      className={inputClass}
                      placeholder="Release Manager"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void createRole()}
                    />
                  </Field>
                  <div>
                    <span className="text-sm font-bold">Color</span>
                    <div className="mt-2 flex gap-2">
                      {SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedSwatch(c)}
                          className={cn(
                            "relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform",
                            selectedSwatch === c ? "scale-110 border-text" : "border-transparent",
                          )}
                          style={{ background: c }}
                        >
                          {selectedSwatch === c && <Check size={12} className="text-white drop-shadow" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button variant="solid" size="sm" className="mt-4" onClick={() => void createRole()}>
                  + Create role
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card ref={matrixRef}>
        <CardTitle>Permission matrix</CardTitle>
        <CardSub>
          What each role can do across the product
          {focusRole ? ` — highlighting ${focusRole}` : ""}
        </CardSub>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-2 pr-4 text-left font-bold">Permission</th>
                {roleNames.map((r) => (
                  <th
                    key={r}
                    className={cn(
                      "pb-2 px-2 text-center font-bold",
                      focusRole === r && "text-accent",
                    )}
                  >
                    {roleColumnLabel(r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map((key) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 text-left font-semibold">{PERMISSION_LABELS[key]}</td>
                  {roleNames.map((roleName) => {
                    const allowed = roleName === "Admin" ? true : Boolean(draft[roleName]?.[key]);
                    const editable = canManage && roleName !== "Admin";
                    const highlighted = focusRole === roleName;
                    return (
                      <td
                        key={roleName}
                        className={cn("py-2.5 px-2 text-center", highlighted && "bg-accent-soft/30")}
                      >
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => toggle(roleName, key)}
                          aria-label={`${allowed ? "Revoke" : "Grant"} ${PERMISSION_LABELS[key]} for ${roleName}`}
                          aria-pressed={allowed}
                          className={cn(
                            "mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                            allowed
                              ? "border-good bg-good/15 text-good"
                              : "border-border bg-panel-2 text-transparent",
                            editable && "cursor-pointer hover:border-accent",
                            !editable && "cursor-not-allowed opacity-70",
                          )}
                        >
                          {allowed && <Check size={11} strokeWidth={3} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="solid" size="sm" disabled={saving || !hasChanges} onClick={() => void saveMatrix()}>
              {saving ? "Saving…" : "Save permission changes"}
            </Button>
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(JSON.parse(JSON.stringify(saved)) as typeof draft)}
              >
                Discard changes
              </Button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
