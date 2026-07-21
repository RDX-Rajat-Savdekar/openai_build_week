import { useCallback, useEffect, useState } from "react";
import { api, type TeamData } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal, useToast } from "@/components/ui/Modal";
import { inputClass, selectClass } from "@/components/ui/FormControls";
import { BUILTIN_ROLE_NAMES, BUILTIN_ROLE_COLORS, DEFAULT_INVITE_ROLE } from "@/lib/roles";
import { Copy, Mail, UserPlus, Users } from "lucide-react";

function memberInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function TeamPanel({ currentUserId }: { currentUserId?: string }) {
  const { can, refresh: refreshPermissions } = usePermissions();
  const canManage = can("manage_team");
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleNames, setRoleNames] = useState<string[]>([...BUILTIN_ROLE_NAMES]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(DEFAULT_INVITE_ROLE);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.team(), api.roles()])
      .then(([team, rows]) => {
        setData(team);
        setRoleNames(rows.map((r) => r.name));
      })
      .catch((err) => toast.show(err instanceof Error ? err.message : "Failed to load team", false))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      const result = await api.inviteTeamMember({ email: inviteEmail.trim() || undefined, role: inviteRole });
      setGeneratedLink(result.url);
      load();
      toast.show("Invite link generated");
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Invite failed", false);
    }
  };

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => toast.show("Invite link copied"));
  };

  const changeRole = async (id: string, role: string) => {
    if (!canManage) return;
    try {
      await api.updateMemberRole(id, role);
      toast.show("Role updated");
      load();
      if (id === currentUserId) await refreshPermissions();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Update failed", false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!canManage) return;
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    try {
      await api.removeMember(id);
      toast.show(`${name} removed`);
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Remove failed", false);
    }
  };

  const revoke = async (id: string) => {
    if (!canManage) return;
    try {
      await api.revokeInvite(id);
      toast.show("Invite revoked");
      load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Revoke failed", false);
    }
  };

  const closeModal = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole(DEFAULT_INVITE_ROLE);
    setGeneratedLink(null);
  };

  if (loading && !data) {
    return <div className="h-32 animate-pulse rounded-lg bg-panel-2" />;
  }

  if (!data) return null;

  return (
    <>
      {!canManage && (
        <p className="mb-4 text-sm text-muted">View-only — you need “Manage team & roles” to invite or change member roles.</p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users size={16} />
          <span>
            <strong className="text-text">{data.members.length}</strong> member{data.members.length !== 1 ? "s" : ""}
            {data.pendingInvites.length > 0 && (
              <>
                {" "}
                · <strong className="text-text">{data.pendingInvites.length}</strong> pending
              </>
            )}
          </span>
        </div>
        {canManage && (
          <Button variant="solid" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Invite member
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-panel-2 text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5 font-bold">Member</th>
              <th className="px-3 py-2.5 font-bold">Email</th>
              <th className="px-3 py-2.5 font-bold">Role</th>
              {canManage && <th className="px-4 py-2.5 font-bold" />}
            </tr>
          </thead>
          <tbody>
            {data.members.map((m) => {
              const isSelf = m.id === currentUserId;
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: BUILTIN_ROLE_COLORS[m.role] ?? "#6153e0" }}
                      >
                        {memberInitials(m.name)}
                      </span>
                      <span className="font-semibold">
                        {m.name}
                        {isSelf && (
                          <Badge tone="outline" className="ml-2">
                            You
                          </Badge>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted">{m.email}</td>
                  <td className="px-3 py-3">
                    <select
                      className={selectClass}
                      value={m.role}
                      disabled={!canManage}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                    >
                      {roleNames.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      {!isSelf && data.members.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => remove(m.id, m.name)}>
                          Remove
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.pendingInvites.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
            <Mail size={14} /> Pending invites
          </h4>
          <div className="space-y-2">
            {data.pendingInvites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.email ?? "Anyone with the link"}</span>
                  <Badge tone="outline">{i.role}</Badge>
                  {i.expired && <Badge tone="warn">Expired</Badge>}
                </div>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={inviteOpen}
        onClose={closeModal}
        title="Invite a teammate"
        subtitle="No email is sent — generate a link and share it. The invite expires in 7 days and is single-use."
      >
        {generatedLink ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Share this link with your teammate. They'll join with the role you selected.</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-panel-2 p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{generatedLink}</code>
              <Button variant="solid" size="sm" onClick={copyLink}>
                <Copy size={13} /> Copy
              </Button>
            </div>
            <Button variant="ghost" onClick={closeModal}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={createInvite} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Email (optional)
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className={inputClass}
                placeholder="teammate@company.com — leave blank for an open link"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Role on join
              <select className={selectClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {roleNames.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="solid" className="self-end">
              Generate invite link
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
