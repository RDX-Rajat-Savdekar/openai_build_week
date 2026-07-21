import { Link } from "react-router-dom";
import { StitchLockup } from "@/components/ui/BrandIcon";
import type { PublicMarketingData } from "@/lib/api";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Home", to: "/" },
      { label: "How it works", to: "/#how-it-works" },
      { label: "Integrations", to: "/#integrations" },
      { label: "System status", to: "/app/status" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Roadmap", to: "/app/roadmap" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Create workspace", to: "/signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

export function Footer({ stats }: { stats?: PublicMarketingData | null }) {
  const m = stats?.metrics;

  return (
    <footer className="border-t border-border bg-gradient-to-b from-panel-2/30 to-panel-2/60">
      {m && (
        <div className="border-b border-border/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-6 py-8 sm:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-accent">{m.successRate}%</div>
              <div className="text-xs font-semibold text-muted">auto-fix rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold">{m.avgTimeToFix}</div>
              <div className="text-xs font-semibold text-muted">median time to PR</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold">{m.workspaces}</div>
              <div className="text-xs font-semibold text-muted">workspaces</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold">{m.connectedRepos}</div>
              <div className="text-xs font-semibold text-muted">repos connected</div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <StitchLockup tone="light" height={48} />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Autonomous CI repair — webhook in, validated PR out. Built for OpenAI Build Week.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <a href="mailto:hello@stitch.dev" className="flex items-center gap-2 text-text-2 transition-colors hover:text-accent">
              <Mail size={15} /> hello@stitch.dev
            </a>
            <span className="flex items-center gap-2 text-text-2">
              <MessageCircle size={15} /> Build Week community
            </span>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">{col.title}</div>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-text-2 transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Stitch · OpenAI Build Week submission</span>
          <a
            href="https://openai.devpost.com/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-semibold text-text-2 transition-colors hover:text-accent"
          >
            Developer Tools track <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </footer>
  );
}
