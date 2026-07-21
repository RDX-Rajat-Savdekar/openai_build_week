import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  Shield,
  Activity,
  GitCommit,
  BarChart3,
  SlidersHorizontal,
  Building2,
  Users,
  User,
  Map,
  LogOut,
  Menu,
  ChevronDown,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";
import { api, auth } from "@/lib/api";
import { usePermissions } from "@/context/PermissionsContext";
import type { PermissionKey } from "@/lib/permissions";
import { GlobalSearch, MobileSearchButton } from "@/components/layout/GlobalSearch";
import { NotificationInbox } from "@/components/layout/NotificationInbox";

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: PermissionKey;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Monitor",
    items: [
      { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/fix-log", label: "Fix log", icon: Sparkles },
      { to: "/app/issues", label: "Issue records", icon: FileText },
      { to: "/app/audit", label: "Audit trail", icon: Shield, permission: "view_audit_trail" },
      { to: "/app/status", label: "Status", icon: Activity },
    ],
  },
  {
    label: "Report",
    items: [
      { to: "/app/changelog", label: "Changelog", icon: GitCommit },
      { to: "/app/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Configure",
    items: [
      { to: "/app/organization", label: "Organization", icon: Building2 },
      { to: "/app/projects", label: "Projects", icon: FolderKanban },
      { to: "/app/settings", label: "Settings", icon: SlidersHorizontal },
      { to: "/app/roles", label: "Roles & permissions", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/app/profile", label: "Profile", icon: User }],
  },
  {
    label: "Plan",
    items: [{ to: "/app/roadmap", label: "Roadmap", icon: Map }],
  },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { can, role: permRole, loading: permLoading } = usePermissions();
  const [workspace, setWorkspace] = useState<{
    name: string;
    plan: string;
    user: { id: string; name: string; email: string; role: string } | null;
  }>({
    name: "workspace",
    plan: "Team",
    user: null,
  });
  const displayName = workspace.user?.name ?? "…";
  const displayRole = permLoading ? "…" : (permRole || workspace.user?.role || "");
  const initials = initialsOf(displayName);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.workspace().then(setWorkspace).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const signOut = async () => {
    await auth.logout().catch(() => {});
    navigate("/");
  };

  const filteredNav = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => permLoading || !item.permission || can(item.permission)),
    }))
    .filter((g) => g.items.length > 0);

  const sidebar = (
    <>
      <button
        type="button"
        onClick={() => navigate("/app/dashboard")}
        className="flex w-full items-center gap-2.5 border-b border-border px-4 py-4 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          {workspace.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{workspace.name}</div>
          <div className="text-[0.72rem] text-muted">{workspace.plan} plan</div>
        </div>
        <ChevronDown size={16} className="shrink-0 text-muted" />
      </button>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
        {filteredNav.map((g) => (
          <div key={g.label}>
            <div className="px-2.5 pb-1 pt-3.5 text-[0.68rem] font-bold uppercase tracking-wider text-muted">{g.label}</div>
            {g.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.87rem] font-semibold transition-colors duration-200",
                    isActive ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-accent-soft hover:text-accent",
                  )
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-soft text-[0.72rem] font-bold text-blue">{initials}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="text-[0.72rem] text-muted">{displayRole}</div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-full bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col border-r border-border bg-panel lg:flex">
        {sidebar}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex h-full w-[236px] flex-col bg-panel shadow-stitch animate-slide-in-left">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-[60px] items-center gap-3.5 border-b border-border bg-panel/95 px-4 backdrop-blur-md lg:px-6">
          <button type="button" className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <MobileSearchButton onOpen={() => setSearchOpen(true)} />
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          <NotificationInbox userId={workspace.user?.id} />
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              title={displayName}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-[0.72rem] font-bold text-blue"
            >
              {initials}
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-10 w-56 rounded-stitch border border-border bg-panel py-1 shadow-stitch animate-fade-in">
                <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-soft text-xs font-bold text-blue">{initials}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{displayName}</div>
                    <div className="truncate text-xs text-muted">{displayRole} · {workspace.name}</div>
                  </div>
                </div>
                <Link to="/app/profile" className="block px-3 py-2 text-sm hover:bg-accent-soft" onClick={() => setProfileOpen(false)}>Profile</Link>
                <Link to="/app/organization" className="block px-3 py-2 text-sm hover:bg-accent-soft" onClick={() => setProfileOpen(false)}>Organization</Link>
                <Link to="/app/status" className="block px-3 py-2 text-sm hover:bg-accent-soft" onClick={() => setProfileOpen(false)}>System status</Link>
                <button type="button" onClick={signOut} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-critical hover:bg-critical-soft">
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 pb-16 page-shell lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="m-0 text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
