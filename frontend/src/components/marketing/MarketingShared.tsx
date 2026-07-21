import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { useInView } from "@/hooks/useAnimations";
import type { PublicMarketingData } from "@/lib/api";
import { Activity, ArrowRight } from "lucide-react";

const dotClass: Record<string, string> = {
  good: "bg-good",
  warn: "bg-warn",
  critical: "bg-critical animate-pulse-dot",
  neutral: "bg-muted",
};

export function Reveal({
  children,
  className = "",
  instant = false,
}: {
  children: React.ReactNode;
  className?: string;
  instant?: boolean;
}) {
  const { ref, inView } = useInView();
  const visible = instant || inView;
  return (
    <div
      ref={instant ? undefined : ref}
      className={cn(
        "transition-all duration-700",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusPill({ data }: { data: PublicMarketingData | null }) {
  const status = data?.platform.status ?? "degraded";
  const label = data?.platform.statusLabel ?? "Checking platform status…";
  return (
    <Link
      to="/app/status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition-colors hover:border-accent/40",
        status === "operational" && "border-good/30 bg-good-soft/40 text-good",
        status === "degraded" && "border-warn/30 bg-warn-soft/40 text-warn",
        status === "down" && "border-critical/30 bg-critical-soft/40 text-critical",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "operational" ? "bg-good animate-pulse" : status === "down" ? "bg-critical" : "bg-warn",
        )}
      />
      {label}
    </Link>
  );
}

export function LiveFeedPanel({ feed }: { feed: PublicMarketingData["liveFeed"] }) {
  return (
    <div className="space-y-0">
      {feed.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Run a pipeline demo inside the app to populate this feed.</p>
      ) : (
        feed.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-0 animate-slide-in-left"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass[row.tone] ?? dotClass.neutral)} />
              <span className="min-w-0 truncate">
                <span className="font-semibold text-text">{row.repo}</span>
                <span className="text-muted"> · </span>
                <span className="text-text-2">{row.summary}</span>
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-muted">{row.ago}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function MetricStrip({ data }: { data: PublicMarketingData | null }) {
  if (!data) {
    return (
      <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-stitch bg-panel-2" />
        ))}
      </div>
    );
  }
  const m = data.metrics;
  const items = [
    { label: "Auto-fix rate", value: `${m.successRate}%`, accent: true },
    { label: "Median time to PR", value: m.avgTimeToFix, accent: false },
    { label: "Hours saved (fleet)", value: `${m.hoursSaved}h`, accent: true },
    { label: "Active workspaces", value: String(m.workspaces), accent: false },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="rounded-stitch border border-border bg-panel/80 p-4 text-center backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-stitch animate-slide-up"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
        >
          <div className={cn("text-2xl font-extrabold tracking-tight", item.accent && "text-accent")}>{item.value}</div>
          <div className="mt-1 text-xs font-semibold text-muted">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("mb-8", center && "text-center")}>
      {eyebrow && (
        <Badge tone="accent" className="mb-3">
          {eyebrow}
        </Badge>
      )}
      <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      {subtitle && <p className={cn("mt-2 max-w-2xl text-sm text-muted md:text-base", center && "mx-auto")}>{subtitle}</p>}
    </div>
  );
}

export function CtaBand() {
  return (
    <section className="relative overflow-hidden rounded-stitch border border-accent/25 bg-gradient-to-br from-accent-soft/50 via-panel to-panel px-8 py-14 text-center">
      <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-accent/20 blur-[80px]" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-blue/15 blur-[70px]" />
      <div className="relative">
        <h2 className="text-2xl font-bold md:text-3xl">Stop debugging CI at 3am</h2>
        <p className="mx-auto mt-2 max-w-md text-text-2">Connect your repo, pick a trust level, and let Stitch handle the loop.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/signup">
            <span className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-stitch transition-transform hover:-translate-y-0.5">
              Start free workspace <ArrowRight size={16} />
            </span>
          </Link>
          <Link to="/contact">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-5 py-2.5 text-sm font-bold text-text-2 transition-colors hover:border-accent/40 hover:text-accent">
              Talk to us
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PipelineVisual() {
  const steps = ["Webhook", "Diagnose", "Fix", "Validate", "PR"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2 md:gap-3">
          <div
            className="rounded-full border border-accent/30 bg-accent-soft/50 px-3 py-1.5 text-xs font-bold text-accent animate-slide-up"
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
          >
            {step}
          </div>
          {i < steps.length - 1 && <Activity size={14} className="hidden text-muted sm:block" />}
        </div>
      ))}
    </div>
  );
}
