import { cn } from "@/lib/cn";
import { type HTMLAttributes } from "react";

export type BadgeTone = "good" | "warn" | "critical" | "accent" | "neutral" | "blue" | "outline";

const tones: Record<BadgeTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  critical: "bg-critical-soft text-critical",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-code-bg text-muted",
  blue: "bg-blue-soft text-blue",
  outline: "bg-transparent text-muted border border-border",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const map: Record<string, BadgeTone> = {
    Autopilot: "accent",
    "Fix & propose": "blue",
    "Diagnose & suggest": "warn",
    "Silent audit": "neutral",
    "Notify only": "outline",
  };
  return <Badge tone={map[mode] ?? "neutral"}>{mode}</Badge>;
}
