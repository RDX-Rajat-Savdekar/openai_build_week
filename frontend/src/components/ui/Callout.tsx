import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

export function Callout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 flex gap-3 rounded-lg border border-accent/20 bg-accent-soft/40 p-3 ${className}`}>
      <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-sm text-text-2">{children}</p>
    </div>
  );
}
