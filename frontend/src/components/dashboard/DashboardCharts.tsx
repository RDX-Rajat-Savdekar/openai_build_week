import { useEffect, useState } from "react";
import { CardSub } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function AnimatedSparkline({ points, tailFrom = 8 }: { points: number[]; tailFrom?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, [points.join(",")]);

  const w = 100;
  const step = w / Math.max(points.length - 1, 1);
  const coords = points.map((y, i) => [i * step, y] as const);
  const body = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const tail = coords.slice(tailFrom).map(([x, y]) => `${x},${y}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1] ?? [w, 0];

  return (
    <svg className="mt-2 h-7 w-full" viewBox="0 0 100 28" preserveAspectRatio="none">
      <polyline
        points={body}
        fill="none"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={120}
        className={cn(ready && "animate-draw-spark")}
        style={{ strokeDasharray: 120, strokeDashoffset: ready ? 0 : 120 }}
      />
      <polyline
        points={tail}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={120}
        className={cn(ready && "animate-draw-spark")}
        style={{ strokeDasharray: 120, strokeDashoffset: ready ? 0 : 120, animationDelay: "0.15s" }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill="var(--accent)"
        stroke="var(--panel)"
        strokeWidth="2"
        className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      />
    </svg>
  );
}

export function WeeklyActivityChart({
  data,
}: {
  data: { day: string; good: number; warn: number; critical: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.good + d.warn + d.critical));

  return (
    <div className="flex items-end justify-between gap-2 pt-4">
      {data.map((d, i) => {
        const total = d.good + d.warn + d.critical;
        const h = Math.max(total, total === 0 ? 0.15 : 0);
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="flex w-full origin-bottom flex-col justify-end overflow-hidden rounded-md transition-all"
              style={{
                height: `${Math.max(h / max, 0.08) * 120}px`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              {d.good > 0 && (
                <div
                  className="origin-bottom bg-good animate-bar-grow"
                  style={{ height: `${(d.good / max) * 120}px`, animationDelay: `${i * 60}ms` }}
                />
              )}
              {d.warn > 0 && (
                <div
                  className="origin-bottom bg-warn animate-bar-grow"
                  style={{ height: `${(d.warn / max) * 120}px`, animationDelay: `${i * 60 + 40}ms` }}
                />
              )}
              {d.critical > 0 && (
                <div
                  className="origin-bottom bg-critical animate-bar-grow"
                  style={{ height: `${(d.critical / max) * 120}px`, animationDelay: `${i * 60 + 80}ms` }}
                />
              )}
              {total === 0 && <div className="h-1 w-full rounded bg-border/60" />}
            </div>
            <span className="text-[0.72rem] font-semibold text-muted">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ConfidenceChart({
  slices,
}: {
  slices: { label: string; pct: number; tone: "good" | "warn" | "critical" }[];
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setWidth(100));
    return () => cancelAnimationFrame(t);
  }, [slices.map((s) => s.pct).join(",")]);

  return (
    <>
      <div className="mt-3 flex h-9 overflow-hidden rounded-lg text-xs font-bold text-white shadow-inner">
        {slices.map((c, i) => (
          <div
            key={c.label}
            className="flex items-center justify-center transition-all duration-700 ease-out"
            style={{
              flex: Math.max(c.pct, 6),
              background: `var(--${c.tone})`,
              opacity: width ? 1 : 0,
              transform: width ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transitionDelay: `${i * 80}ms`,
            }}
          >
            {c.pct}%
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5 text-xs font-semibold text-muted">
        {slices.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: `var(--${c.tone})` }} />
            {c.label} · {c.pct}%
          </div>
        ))}
      </div>
    </>
  );
}

export function UsageMeter({ pct, label }: { pct: number; label: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(Math.min(100, pct)));
    return () => cancelAnimationFrame(t);
  }, [pct]);

  return (
    <>
      <CardSub className="!mb-2">{label}</CardSub>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-code-bg">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-1000 ease-out"
          style={{ width: `${w}%` }}
        />
      </div>
    </>
  );
}

export function OutcomeRing({
  successRate,
  total,
}: {
  successRate: number;
  total: number;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);

  useEffect(() => {
    const t = requestAnimationFrame(() => setOffset(c - (successRate / 100) * c));
    return () => cancelAnimationFrame(t);
  }, [successRate, c]);

  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
      <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--good)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold">{successRate}%</div>
        <div className="text-[0.65rem] text-muted">{total} fixes</div>
      </div>
    </div>
  );
}
