import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { api, type SearchResult } from "@/lib/api";

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: typeof Sparkles; tone?: "good" | "warn" | "critical" | "accent" | "neutral" }
> = {
  fix: { label: "Fix", icon: Sparkles, tone: "accent" },
  issue: { label: "Issue", icon: FileText, tone: "warn" },
  repo: { label: "Repo", icon: GitBranch, tone: "good" },
  project: { label: "Project", icon: FolderKanban, tone: "neutral" },
  page: { label: "Page", icon: LayoutDashboard, tone: "neutral" },
};

function toneFor(result: SearchResult) {
  if (result.tone === "good") return "good" as const;
  if (result.tone === "warn") return "warn" as const;
  if (result.tone === "critical") return "critical" as const;
  return TYPE_META[result.type].tone ?? "neutral";
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await api.search(q);
      setResults(data.results);
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    runSearch("");
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, runSearch]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void runSearch(query), query ? 180 : 0);
    return () => window.clearTimeout(t);
  }, [query, open, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const pick = (result: SearchResult) => {
    onOpenChange(false);
    navigate(result.href);
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      pick(results[activeIndex]!);
    }
  };

  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="hidden w-56 items-center gap-2 rounded-lg border border-border bg-panel-2 px-2.5 py-1.5 text-left text-sm text-muted transition-colors hover:border-accent/30 hover:text-text-2 sm:flex"
        >
          <Search size={16} />
          <span className="flex-1 truncate">Search fixes, repos…</span>
          <kbd className="rounded border border-border bg-panel px-1.5 py-0.5 text-[0.65rem] font-semibold">⌘K</kbd>
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="hidden w-56 items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft/30 px-2.5 py-1.5 text-left text-sm text-text-2 sm:flex"
      >
        <Search size={16} />
        <span className="flex-1 truncate">Search fixes, repos…</span>
        <kbd className="rounded border border-border bg-panel px-1.5 py-0.5 text-[0.65rem] font-semibold">⌘K</kbd>
      </button>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)} />
      <div className="fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-stitch border border-border bg-panel shadow-stitch animate-slide-up">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search fixes, issues, repos, projects…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {loading && <Loader2 size={16} className="animate-spin text-muted" />}
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md p-1 text-muted hover:bg-accent-soft hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[min(420px,55vh)] overflow-y-auto p-1.5">
          {!loading && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted">
              {query ? `No results for “${query}”` : "Start typing to search your workspace"}
            </div>
          )}
          {results.map((result, i) => {
            const meta = TYPE_META[result.type];
            const Icon = meta.icon;
            const active = i === activeIndex;
            return (
              <button
                key={result.id}
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(result)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active ? "bg-accent-soft" : "hover:bg-panel-2",
                )}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-accent">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{result.title}</span>
                    <Badge tone={toneFor(result)}>{result.badge ?? meta.label}</Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{result.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[0.68rem] font-semibold text-muted">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </>
  );
}

export function MobileSearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel-2 text-text-2 sm:hidden"
      aria-label="Search"
    >
      <Search size={16} />
    </button>
  );
}
