import { BrandIcon } from "@/components/ui/BrandIcon";
import { INTEGRATION_CHIPS } from "@/data/demoContent";

export function IntegrationChips({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
      {INTEGRATION_CHIPS.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-bold text-text-2 shadow-stitch transition-transform hover:-translate-y-0.5"
        >
          <BrandIcon name={chip.key} size={18} />
          {chip.label}
        </span>
      ))}
    </div>
  );
}
