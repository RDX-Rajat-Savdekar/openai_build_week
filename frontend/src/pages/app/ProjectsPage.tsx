import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, Toggle, inputClass, selectClass } from "@/components/ui/FormControls";
import { Modal, useToast } from "@/components/ui/Modal";
import { usePermissions } from "@/context/PermissionsContext";
import { api, type DemoRepo, type Project } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  ChevronRight,
  FolderKanban,
  GitBranch,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";

const MODES = ["Autopilot", "Fix & propose", "Diagnose & suggest", "Silent audit", "Notify only"] as const;

function isSystemProject(p: Project) {
  return p.slug === "unassigned";
}

export function ProjectsPage() {
  const { can } = usePermissions();
  const canManage = can("manage_response_rules");
  const canIntegrations = can("manage_integrations");
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [repos, setRepos] = useState<DemoRepo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [addRepoOpen, setAddRepoOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([api.projects(), api.repos()]);
      setProjects(p);
      setRepos(r);
      setSelectedId((prev) => (prev && p.some((x) => x.id === prev) ? prev : p.find((x) => !isSystemProject(x))?.id ?? p[0]?.id ?? null));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Failed to load projects", false);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => projects.find((p) => p.id === selectedId) ?? null, [projects, selectedId]);

  const stats = useMemo(() => {
    const unassigned = projects.find(isSystemProject);
    return {
      projects: projects.filter((p) => !isSystemProject(p)).length,
      repos: repos.length,
      enabled: repos.filter((r) => r.enabled).length,
      unassigned: unassigned ? repos.filter((r) => r.project === unassigned.id).length : 0,
    };
  }, [projects, repos]);

  const projectRepos = useMemo(() => {
    if (!selected) return [];
    return repos
      .filter((r) => r.project === selected.id)
      .filter((r) => !search.trim() || r.repo.toLowerCase().includes(search.trim().toLowerCase()));
  }, [repos, selected, search]);

  const sortedProjects = useMemo(() => {
    const user = projects.filter((p) => !isSystemProject(p));
    const system = projects.filter(isSystemProject);
    return [...user, ...system];
  }, [projects]);

  const syncGithub = async () => {
    setSyncing(true);
    try {
      const result = await api.syncIntegration("github");
      toast.show(`Synced ${result.synced} repos from GitHub — new repos land in Unassigned`);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "GitHub sync failed", false);
    } finally {
      setSyncing(false);
    }
  };

  const createProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    try {
      const created = await api.createProject({
        name,
        description: String(fd.get("description") ?? ""),
        defaultMode: String(fd.get("defaultMode") ?? ""),
      });
      toast.show(`Project "${name}" created`);
      setCreateOpen(false);
      await load();
      setSelectedId(created.id);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Create failed", false);
    }
  };

  const saveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    try {
      await api.updateProject(editing.id, {
        name: String(fd.get("name") ?? editing.name),
        description: String(fd.get("description") ?? ""),
        defaultMode: String(fd.get("defaultMode") ?? ""),
      });
      toast.show("Project updated");
      setEditing(null);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Update failed", false);
    }
  };

  const removeProject = async (project: Project) => {
    if (isSystemProject(project)) return;
    if (projects.filter((p) => !isSystemProject(p)).length <= 1 && projects.length <= 2) {
      toast.show("Can't delete your only user project", false);
      return;
    }
    if (!confirm(`Delete "${project.name}"? Its ${project.repoCount} repo(s) move to Unassigned.`)) return;
    try {
      await api.deleteProject(project.id);
      toast.show(`Project "${project.name}" deleted`);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Delete failed", false);
    }
  };

  const patchRepo = async (repo: DemoRepo, patch: Partial<{ enabled: boolean; mode: string; project: string }>) => {
    try {
      await api.updateRepo(repo.repo, patch);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Update failed", false);
    }
  };

  const removeRepo = async (repo: DemoRepo) => {
    if (!confirm(`Remove ${repo.repo} from this workspace?`)) return;
    try {
      await api.deleteRepo(repo.repo);
      toast.show(`${repo.repo} removed`);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Remove failed", false);
    }
  };

  const addRepo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    const repo = String(fd.get("repo") ?? "").trim();
    if (!repo.includes("/")) {
      toast.show("Use owner/name format (e.g. acme/backend)", false);
      return;
    }
    try {
      await api.createRepo({
        repo,
        provider: String(fd.get("provider") ?? "GitHub"),
        mode: String(fd.get("mode") ?? selected.defaultMode),
        project: selected.id,
      });
      toast.show(`${repo} added`);
      setAddRepoOpen(false);
      await load();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Add failed", false);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <>
        <PageHeader title="Projects" subtitle="Loading workspace…" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-64 animate-pulse bg-panel-2" />
          <Card className="h-64 animate-pulse bg-panel-2" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Projects"
          subtitle="Organize repositories by team or product. Response modes inherit from the project unless overridden per repo."
        />
        <div className="flex flex-wrap gap-2">
          {canIntegrations && (
            <Button variant="ghost" size="sm" onClick={syncGithub} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync from GitHub
            </Button>
          )}
          {canManage && (
            <Button variant="solid" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> New project
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <Callout className="mb-4">View-only — you need “Change response modes / branch rules” to manage projects and repositories.</Callout>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Projects", value: stats.projects },
          { label: "Repositories", value: stats.repos },
          { label: "Enabled for Stitch", value: stats.enabled },
          { label: "Unassigned", value: stats.unassigned },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card className="text-center">
          <CardTitle>No projects yet</CardTitle>
          <CardSub>Create a project to group repositories, or sync from GitHub under Integrations.</CardSub>
          {canManage && (
            <Button variant="solid" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Create first project
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
          <Card className="!p-0">
            <div className="border-b border-border px-4 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Workspace</div>
            </div>
            <ul className="max-h-[520px] overflow-y-auto p-2">
              {sortedProjects.map((p) => {
                const active = p.id === selectedId;
                const system = isSystemProject(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        active ? "bg-accent-soft text-accent" : "hover:bg-panel-2 text-text-2",
                      )}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", system ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>
                        {system ? <Inbox size={16} /> : <FolderKanban size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        <span className="block text-xs text-muted">{p.repoCount} repo{p.repoCount !== 1 ? "s" : ""}</span>
                      </span>
                      <ChevronRight size={14} className={cn("shrink-0 opacity-50", active && "opacity-100")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected ? (
            <Card className="flex flex-col !p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    {isSystemProject(selected) && <Badge tone="warn">System bucket</Badge>}
                    <ModeBadge mode={selected.defaultMode} />
                  </div>
                  {selected.description && <p className="mt-1 text-sm text-muted">{selected.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Default mode applies to repos unless overridden below · slug <code className="rounded bg-code-bg px-1">{selected.slug}</code>
                  </p>
                </div>
                {canManage && !isSystemProject(selected) && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(selected)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeProject(selected)}>
                      <Trash2 size={13} /> Delete
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className={cn(inputClass, "pl-9")}
                    placeholder="Filter repositories…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {canManage && (
                  <Button variant="solid" size="sm" onClick={() => setAddRepoOpen(true)}>
                    <Plus size={14} /> Add repository
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted">
                      <th className="px-5 py-2 font-bold">Repository</th>
                      <th className="px-3 py-2 font-bold">Provider</th>
                      <th className="px-3 py-2 font-bold">Mode</th>
                      <th className="px-3 py-2 font-bold">Enabled</th>
                      {canManage && projects.length > 1 && <th className="px-3 py-2 font-bold">Move to</th>}
                      {canManage && <th className="px-5 py-2 font-bold" />}
                    </tr>
                  </thead>
                  <tbody>
                    {projectRepos.length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 6 : 4} className="px-5 py-10 text-center text-muted">
                          {search ? "No repositories match your filter." : "No repositories in this project yet."}
                          {canManage && !search && (
                            <div className="mt-3 flex justify-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setAddRepoOpen(true)}>
                                Add manually
                              </Button>
                              {canIntegrations && (
                                <Button variant="ghost" size="sm" onClick={syncGithub} disabled={syncing}>
                                  Sync from GitHub
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      projectRepos.map((r) => (
                        <tr key={r.repo} className="border-b border-border last:border-0">
                          <td className="px-5 py-3 font-mono text-xs">
                            <span className="inline-flex items-center gap-1.5">
                              <GitBranch size={12} className="text-muted" />
                              {r.repo}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted">{r.provider}</td>
                          <td className="px-3 py-3">
                            {canManage ? (
                              <select className={selectClass} value={r.mode} onChange={(e) => patchRepo(r, { mode: e.target.value })}>
                                {MODES.map((m) => (
                                  <option key={m}>{m}</option>
                                ))}
                              </select>
                            ) : (
                              <ModeBadge mode={r.mode} />
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Toggle checked={r.enabled} onChange={canManage ? (v) => patchRepo(r, { enabled: v }) : undefined} />
                          </td>
                          {canManage && projects.length > 1 && (
                            <td className="px-3 py-3">
                              <select
                                className={selectClass}
                                value={r.project}
                                onChange={(e) => patchRepo(r, { project: e.target.value })}
                              >
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          {canManage && (
                            <td className="px-5 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => removeRepo(r)}>
                                Remove
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {isSystemProject(selected) && stats.unassigned > 0 && (
                <div className="border-t border-border px-5 py-3 text-xs text-muted">
                  Assign repos to a project so branch rules and dashboards scope correctly.{" "}
                  <Link to="/app/settings" className="font-semibold text-accent">
                    Settings → Repositories
                  </Link>{" "}
                  mirrors this table.
                </div>
              )}
            </Card>
          ) : (
            <Card className="flex items-center justify-center text-muted">Select a project</Card>
          )}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New project" subtitle="Repositories can be added immediately or synced from GitHub.">
        <form onSubmit={createProject} className="flex flex-col gap-3">
          <Field label="Name">
            <input name="name" className={inputClass} placeholder="e.g. Core Platform" required autoFocus />
          </Field>
          <Field label="Description">
            <input name="description" className={inputClass} placeholder="What lives in this project?" />
          </Field>
          <Field label="Default response mode">
            <select name="defaultMode" className={selectClass} defaultValue="Diagnose & suggest">
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="solid" className="self-end">
            Create project
          </Button>
        </form>
      </Modal>

      <Modal open={addRepoOpen} onClose={() => setAddRepoOpen(false)} title="Add repository" subtitle={selected ? `Adding to ${selected.name}` : ""}>
        <form onSubmit={addRepo} className="flex flex-col gap-3">
          <Field label="Repository (owner/name)">
            <input name="repo" className={inputClass} placeholder="acme/backend" required />
          </Field>
          <Field label="Provider">
            <select name="provider" className={selectClass} defaultValue="GitHub">
              <option>GitHub</option>
              <option>GitLab</option>
              <option>CircleCI</option>
              <option>Jenkins</option>
              <option>Bitbucket</option>
            </select>
          </Field>
          <Field label="Response mode">
            <select name="mode" className={selectClass} defaultValue={selected?.defaultMode ?? "Diagnose & suggest"}>
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="solid" className="self-end">
            Add repository
          </Button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""}>
        {editing && (
          <form onSubmit={saveEdit} className="flex flex-col gap-3">
            <Field label="Name">
              <input name="name" className={inputClass} defaultValue={editing.name} required autoFocus />
            </Field>
            <Field label="Description">
              <input name="description" className={inputClass} defaultValue={editing.description} />
            </Field>
            <Field label="Default response mode">
              <select name="defaultMode" className={selectClass} defaultValue={editing.defaultMode}>
                {MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Button type="submit" variant="solid" className="self-end">
              Save changes
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
