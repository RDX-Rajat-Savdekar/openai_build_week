import { cn } from "@/lib/cn";
import { AnimatedSparkline } from "@/components/dashboard/DashboardCharts";
import { CardSub } from "./Card";
import type { ReactNode } from "react";

export function Sparkline({ points, tailFrom = 8 }: { points: number[]; tailFrom?: number }) {
  return <AnimatedSparkline points={points} tailFrom={tailFrom} />;
}

export function StatTile({
  label,
  value,
  delta,
  deltaPositive,
  suffix = "",
  spark,
  index = 0,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  suffix?: string;
  spark?: number[];
  index?: number;
}) {
  return (
    <div
      className="hover-lift rounded-stitch border border-border bg-panel p-4 shadow-stitch animate-slide-up"
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "backwards" }}
    >
      <CardSub className="!mb-1">{label}</CardSub>
      <div className="flex items-baseline justify-between">
        <div className="text-3xl font-bold tracking-tight tabular-nums">
          {value}
          {suffix}
        </div>
        {delta && (
          <div
            className={cn(
              "text-xs font-bold",
              deltaPositive === true ? "text-good" : deltaPositive === false ? "text-critical" : "text-muted",
            )}
          >
            {delta}
          </div>
        )}
      </div>
      {spark && <AnimatedSparkline points={spark} />}
    </div>
  );
}

export function UptimeBars({ uptime }: { uptime: number }) {  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 30 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-5 w-1 rounded-sm",
            i / 30 < uptime / 100 ? "bg-good" : "bg-warn",
          )}
          title={`${uptime.toFixed(2)}% uptime`}
        />
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange?: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
      {label && <span className="text-sm font-semibold">{label}</span>}
    </label>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-text">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export const selectClass = inputClass;
