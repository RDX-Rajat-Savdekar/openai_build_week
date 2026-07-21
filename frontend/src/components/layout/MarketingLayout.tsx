import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { StitchLockup, StitchLogomark } from "@/components/ui/BrandIcon";
import { Button } from "@/components/ui/Button";
import { Footer } from "@/components/layout/Footer";
import { useMarketingStats } from "@/hooks/useMarketingStats";
import { cn } from "@/lib/cn";
import { auth } from "@/lib/api";
import { ArrowRight, Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function MarketingLayout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { data } = useMarketingStats(60_000);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <nav
        className={cn(
          "sticky top-0 z-20 border-b transition-all duration-300",
          scrolled ? "border-border bg-panel/95 shadow-stitch backdrop-blur-md" : "border-border/60 bg-panel/80 backdrop-blur-sm",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          {/* Logo + nav links — left aligned */}
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link to="/" className="flex shrink-0 items-center">
              <StitchLockup tone="light" height={56} />
            </Link>
            <div className="hidden items-center gap-0.5 md:flex">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    pathname === l.to ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-panel-2 hover:text-accent",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Auth actions — right */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button variant="solid" size="sm">
                Get started <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-2 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border px-6 py-4 md:hidden animate-fade-in">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-semibold",
                    pathname === l.to ? "bg-accent-soft text-accent" : "text-text-2",
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-3 flex gap-2 border-t border-border pt-4">
                <Link to="/login" className="flex-1">
                  <Button variant="ghost" className="w-full" size="sm">Sign in</Button>
                </Link>
                <Link to="/signup" className="flex-1">
                  <Button variant="solid" className="w-full" size="sm">Get started</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
      <Footer stats={data} />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "authed" | "anon">("checking");

  useEffect(() => {
    let cancelled = false;
    auth
      .me()
      .then(() => {
        if (!cancelled) setStatus("authed");
      })
      .catch(() => {
        if (!cancelled) setStatus("anon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-bg">
        <StitchLogomark size={44} className="animate-pulse" />
        <p className="text-sm font-semibold text-muted">Loading workspace…</p>
      </div>
    );
  }
  if (status === "anon") return <Navigate to="/login" replace />;
  return <>{children}</>;
}
