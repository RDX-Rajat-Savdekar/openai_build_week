import { useState } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/Badge";
import { Card, CardSub } from "@/components/ui/Card";
import { ROADMAP } from "@/data/demoContent";
import { ChevronDown, ChevronRight } from "lucide-react";

const priorityTone: Record<string, "accent" | "warn" | "blue" | "outline"> = {
  Now: "accent",
  Next: "blue",
  Later: "warn",
  Future: "outline",
};

const priorityNote: Record<string, string> = {
  Now: "would block calling this submission-ready",
  Next: "first thing after submission",
  Later: "real, but not urgent",
  Future: "directional, not scoped",
};

export function RoadmapPage() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true, 7: true });

  return (
    <>
      <PageHeader
        title="Roadmap"
        subtitle="Planning only — mirrors plan section 16. Nothing here is built yet."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        {(["Now", "Next", "Later", "Future"] as const).map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <Badge tone={priorityTone[p]}>{p}</Badge>
            <span className="text-xs text-muted">{priorityNote[p]}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {ROADMAP.map((cat, i) => (
          <Card key={cat.title}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
              className="flex w-full items-center gap-2 text-left"
            >
              {open[i] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="text-base font-bold">{cat.title}</span>
              <Badge tone="neutral">{cat.items.length} items</Badge>
            </button>
            {open[i] && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {cat.items.map((item) => (
                  <div key={item.t} className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-3">
                    <Badge tone={priorityTone[item.p]}>{item.p}</Badge>
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-bold">{item.t}</div>
                      <CardSub className="!mb-0">{item.n}</CardSub>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
