import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-stitch border border-border bg-panel p-6 shadow-stitch animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-lg font-semibold">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-accent-soft hover:text-accent"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, ok = true }: { message: string; ok?: boolean }) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[100] animate-slide-up rounded-lg border bg-panel px-4 py-3 text-sm font-semibold shadow-stitch",
        ok ? "border-good" : "border-critical",
      )}
    >
      {message}
    </div>
  );
}

export function useToast() {
  const show = useCallback((message: string, ok = true) => {
    const el = document.createElement("div");
    el.className = `fixed bottom-6 right-6 z-[100] animate-slide-up rounded-lg border bg-panel px-4 py-3 text-sm font-semibold shadow-stitch ${ok ? "border-good" : "border-critical"}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }, []);
  return useMemo(() => ({ show }), [show]);
}
