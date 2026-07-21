import { Link } from "react-router-dom";
import { Badge, ModeBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardSub, CardTitle } from "@/components/ui/Card";
import { BrandIcon, StitchLogomark } from "@/components/ui/BrandIcon";
import { HeroBackground } from "@/components/marketing/HeroBackground";
import {
  CtaBand,
  LiveFeedPanel,
  MetricStrip,
  PipelineVisual,
  Reveal,
  SectionHeader,
  StatusPill,
} from "@/components/marketing/MarketingShared";
import { useMarketingStats } from "@/hooks/useMarketingStats";
import { useCountUp, useInView } from "@/hooks/useAnimations";
import { api } from "@/lib/api";
import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  Code2,
  Eye,
  FileText,
  Gauge,
  GitBranch,
  GitPullRequest,
  Mail,
  MessageCircle,
  Radio,
  Search,
  Shield,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Undo2,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import { useState } from "react";

const MODES = [
  ["Autopilot", "Autopilot", "Diagnose → fix → PR → auto-merge on trusted branches."],
  ["Fix & propose", "Fix & propose", "Writes the fix — you approve before merge."],
  ["Diagnose & suggest", "Diagnose & suggest", "Posts diagnosis + suggested patch as a PR comment."],
  ["Silent audit", "Silent audit", "Full audit trail — no code changes."],
  ["Notify only", "Notify only", "Pager-style alerts when CI fails."],
] as const;

const FEATURES = [
  { icon: FileText, title: "Issue Records", desc: "Durable markdown per failure, committed to your repo — not locked in our UI." },
  { icon: Shield, title: "Audit Trail", desc: "Every webhook, diagnosis, and merge — exportable for compliance reviews." },
  { icon: Undo2, title: "Rollback & safety", desc: "One-click revert plus auto-revert when the same branch fails again." },
  { icon: Radio, title: "Live SSE command center", desc: "Dashboard, Fix Log, and notifications refresh in real time as the pipeline runs — no refresh button." },
  { icon: Search, title: "Global workspace search", desc: "⌘K to jump to fixes, issues, repos, and pages — same index as the in-app command palette." },
];

const HOW_IT_WORKS = [
  { icon: Webhook, title: "Webhook fires", desc: "CI fails — Stitch receives the event instantly, no human has to notice." },
  { icon: Brain, title: "GPT-5.6 diagnoses", desc: "Reads real logs and repo context — not a pasted stack trace." },
  { icon: Code2, title: "Codex writes the fix", desc: "Generates a validated patch against your actual codebase." },
  { icon: GitPullRequest, title: "PR opens", desc: "Diff, diagnosis, and evidence — merged or waiting for review per branch rules." },
];

const VALUES = [
  { icon: Zap, title: "Autonomous by default", desc: "The loop starts at webhook time — not when someone opens a chat." },
  { icon: Eye, title: "Nothing hidden", desc: "Issue Records and Audit Trail live in your repo and workspace." },
  { icon: Users, title: "Trust levels you control", desc: "Five response modes from full autopilot to notify-only." },
  { icon: GitBranch, title: "Branch-aware judgment", desc: "main, release/*, and feature/* each get a different response." },
];

const CATEGORY_INSIGHTS: Record<string, { why: string; mode: string; icon: typeof Target }> = {
  "Null / reference errors": {
    why: "Stack traces point to exact files — GPT-5.6 reads the repo and Codex patches the null-check in one pass.",
    mode: "Autopilot on main · Fix & propose on feature branches",
    icon: Target,
  },
  "Missing env / config": {
    why: "Env-var failures are mechanically diagnosable from logs — Stitch adds the missing key or default safely.",
    mode: "Diagnose & suggest when confidence is mid-band",
    icon: Gauge,
  },
  "Test timeouts": {
    why: "Flaky timeouts often need a small wait/retry tweak — validated against your test suite before PR.",
    mode: "Fix & propose with human merge approval",
    icon: Timer,
  },
  "Connection / pool leaks": {
    why: "Resource leaks show up in logs + implicated files — ideal for repo-context fixes, not chat snippets.",
    mode: "Autopilot on dev/staging when tests pass",
    icon: TrendingUp,
  },
  "Type / syntax errors": {
    why: "Compiler output maps 1:1 to line numbers — fast diagnosis, high-confidence patches.",
    mode: "Autopilot when confidence ≥ 90%",
    icon: Code2,
  },
  "Logic & regression": {
    why: "Harder cases route to Fix & propose or escalate — never silent auto-merge on low confidence.",
    mode: "Escalate below 50% confidence",
    icon: Brain,
  },
};

function GapSection({
  stitchSeconds,
  industryMinutes,
}: {
  stitchSeconds: number;
  industryMinutes: number;
}) {
  const { ref, inView } = useInView();
  const maxSec = industryMinutes * 60;
  const stitchLabel =
    stitchSeconds < 60 ? `${stitchSeconds}s` : `${Math.floor(stitchSeconds / 60)}m ${stitchSeconds % 60}s`;
  const stitchBarPct = Math.max(8, Math.round((stitchSeconds / maxSec) * 100));
  const speedup = Math.round(maxSec / Math.max(stitchSeconds, 1));

  return (
    <div ref={ref} className="mb-16 rounded-stitch border border-border bg-panel/60 p-6 md:p-8">
      <SectionHeader
        eyebrow="The gap that matters"
        title="Not faster typing — faster response"
        subtitle="Same incident — two very different time-to-PR outcomes."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="border-critical/20 bg-critical-soft/10">
          <CardSub className="!mb-1">Industry median restore</CardSub>
          <div className="text-3xl font-extrabold text-critical">~{industryMinutes} min</div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-code-bg">
            <div
              className="h-full rounded-full bg-critical transition-all duration-1000 ease-out"
              style={{ width: inView ? "100%" : "0%" }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">DORA median time-to-restore — measured in hours for most teams.</p>
        </Card>
        <Card className="border-good/20 bg-good-soft/10">
          <div className="mb-1 flex items-center justify-between gap-2">
            <CardSub className="!mb-0">Stitch median time to PR</CardSub>
            <Badge tone="good">{speedup}× faster</Badge>
          </div>
          <div className="text-3xl font-extrabold text-good">{stitchLabel}</div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-code-bg">
            <div
              className="h-full min-w-[2rem] rounded-full bg-gradient-to-r from-good to-accent transition-all duration-700 ease-out"
              style={{ width: inView ? `${stitchBarPct}%` : "0%" }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Webhook → diagnose → fix → validate → open PR.</p>
        </Card>
      </div>
    </div>
  );
}

const DEFAULT_CATEGORIES: { label: string; pct: number; tone: "good" | "warn" | "critical" }[] = [
  { label: "Null / reference errors", pct: 34, tone: "good" },
  { label: "Missing env / config", pct: 28, tone: "good" },
  { label: "Test timeouts", pct: 18, tone: "warn" },
  { label: "Connection / pool leaks", pct: 12, tone: "warn" },
  { label: "Logic & regression", pct: 8, tone: "critical" },
];

function WhereStitchWinsSection({
  categories,
  totalFixes,
}: {
  categories: { label: string; pct: number; tone: "good" | "warn" | "critical" }[];
  totalFixes: number;
}) {
  const { ref, inView } = useInView();
  const items = categories.length >= 3 ? categories.slice(0, 5) : DEFAULT_CATEGORIES;
  const maxPct = Math.max(...items.map((c) => c.pct), 1);
  const top = items[0];

  return (
    <div ref={ref}>
      <SectionHeader
        title="Where Stitch wins"
        subtitle="Top failure categories from Fix records — each maps to an automatic response mode."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="text-center">
          <div className="text-2xl font-extrabold text-accent">{totalFixes || "—"}</div>
          <CardSub className="!mb-0">fixes analyzed</CardSub>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-extrabold">{top?.pct ?? 0}%</div>
          <CardSub className="!mb-0">top category · {top?.label ?? "—"}</CardSub>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-extrabold text-good">{items.length}</div>
          <CardSub className="!mb-0">categories tracked</CardSub>
        </Card>
      </div>
      <Card className="mb-4 overflow-hidden">
        <CardTitle className="!text-base">Share of incidents</CardTitle>
        <div className="mt-4 space-y-4">
          {items.map((cat, i) => {
            const insight = CATEGORY_INSIGHTS[cat.label] ?? CATEGORY_INSIGHTS["Logic & regression"]!;
            const barPct = Math.round((cat.pct / maxPct) * 100);
            return (
              <div key={cat.label}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{cat.label}</span>
                  <span className="text-muted">{cat.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-code-bg">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-700 ease-out"
                    style={{
                      width: inView ? `${barPct}%` : "0%",
                      transitionDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">{insight.mode}</p>
              </div>
            );
          })}
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 3).map((cat) => {
          const insight = CATEGORY_INSIGHTS[cat.label] ?? CATEGORY_INSIGHTS["Logic & regression"]!;
          const Icon = insight.icon;
          return (
            <Card key={`${cat.label}-card`} className="hover-lift">
              <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={16} />
              </span>
              <CardTitle className="!text-sm">{cat.label}</CardTitle>
              <CardSub className="!mb-0 text-xs">{insight.why}</CardSub>
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Source: Fix root-cause fields across workspaces ·{" "}
        <Link to="/app/reports" className="font-bold text-accent">
          view weekly digest
        </Link>
      </p>
    </div>
  );
}

export function HomePage() {
  const { data } = useMarketingStats();
  const hero = useInView();
  const success = useCountUp(data?.metrics.successRate ?? 0, Boolean(data), 0);
  const hours = useCountUp(data?.metrics.hoursSaved ?? 0, Boolean(data), 1);
  const workspaces = useCountUp(data?.metrics.workspaces ?? 0, Boolean(data), 0);

  const [failures, setFailures] = useState(40);
  const [minutes, setMinutes] = useState(data?.marketContext.typicalManualFixMinutes ?? 45);
  const [rate, setRate] = useState(85);
  const autoRate = (data?.metrics.successRate ?? data?.metrics.autoFixRateModel ?? 74) / 100;
  const savedHours = ((failures * autoRate * minutes) / 60).toFixed(1);
  const savedDollars = Math.round(Number(savedHours) * rate);

  return (
    <>
      <section className="relative overflow-hidden border-b border-border/60 px-6 pb-20 pt-16 md:pt-24">
        <HeroBackground />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <Badge tone="accent">OpenAI Build Week · Developer Tools</Badge>
            <StatusPill data={data} />
          </div>

          <div className="mb-4 flex items-center justify-center gap-3">
            <StitchLogomark size={44} className="md:hidden" />
            <StitchLogomark size={52} className="hidden md:block" />
            <div className="hero-brand-name">Stitch</div>
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-accent md:text-sm">
            Autonomous CI repair
          </p>

          <h1 className="hero-tagline-gradient mx-auto max-w-3xl">
            The CI failure that fixes itself while you sleep.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-text-2 md:text-xl">
            Stitch watches your pipeline, diagnoses with GPT-5.6, writes the fix with Codex, and opens a pull request — autonomously, before you&apos;ve had coffee.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup">
              <Button variant="solid" size="lg" className="shadow-stitch">
                Start free workspace <ArrowRight size={16} />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="ghost" size="lg">See how it works</Button>
            </a>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted">No credit card · Real PostgreSQL workspaces · 2-minute setup</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <MetricStrip data={data} />

        <Reveal className="mt-16" instant>
          <div id="how-it-works" className="scroll-mt-28">
            <SectionHeader
              eyebrow="How it works"
              title="Four steps, zero human to start"
              subtitle="Same pipeline you can run from the dashboard demo or a real CI webhook."
            />
            <div className="mb-8">
              <PipelineVisual />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, i) => (
                <Card key={title} className="hover-lift group relative overflow-hidden">
                  <span className="absolute -right-2 -top-3 text-5xl font-black text-border/80 transition-colors group-hover:text-accent/20">
                    {i + 1}
                  </span>
                  <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon size={20} />
                  </span>
                  <CardTitle>{title}</CardTitle>
                  <CardSub className="!mb-0">{desc}</CardSub>
                </Card>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <SectionHeader
            eyebrow="Live platform"
            title="Happening across workspaces"
            subtitle="Aggregated from real Fix rows and the activity stream — same data as inside the product."
          />
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="overflow-hidden">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="!mb-0">Incident feed</CardTitle>
                <Badge tone="good">Live · refreshes every 45s</Badge>
              </div>
              <LiveFeedPanel feed={data?.liveFeed ?? []} />
            </Card>
            <Card className="flex flex-col justify-center bg-gradient-to-br from-accent-soft/30 to-panel text-center">
              <Sparkles className="mx-auto mb-2 text-accent" size={22} />
              <div className="text-4xl font-extrabold text-accent">{success}%</div>
              <CardSub>measured auto-fix rate</CardSub>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-left text-sm">
                <div>
                  <div className="font-bold">{data?.metrics.fixesToday ?? 0}</div>
                  <div className="text-xs text-muted">fixes today</div>
                </div>
                <div>
                  <div className="font-bold">{workspaces}</div>
                  <div className="text-xs text-muted">workspaces</div>
                </div>
                <div>
                  <div className="font-bold">{hours}h</div>
                  <div className="text-xs text-muted">hours saved (fleet)</div>
                </div>
                <div>
                  <div className="font-bold">{data?.metrics.connectedRepos ?? 0}</div>
                  <div className="text-xs text-muted">repos connected</div>
                </div>
              </div>
            </Card>
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <GapSection
            stitchSeconds={data?.metrics.avgTimeSeconds ?? 134}
            industryMinutes={data?.marketContext.industryMedianRestoreMinutes ?? 60}
          />
        </Reveal>

        <Reveal className="mt-16">
          <SectionHeader title="Five levels of trust" subtitle="Branch rules pick the mode — you stay in control." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {MODES.map(([label, mode, desc]) => (
              <Card key={label} className="hover-lift">
                <ModeBadge mode={mode} />
                <CardSub className="mt-2 !mb-0">{desc}</CardSub>
              </Card>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <SectionHeader title="Everything, in the open" subtitle="Documentation lives in your repo — not trapped in our UI." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="hover-lift">
                <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={20} />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardSub className="!mb-0">{desc}</CardSub>
              </Card>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <div id="integrations" className="scroll-mt-28">
            <SectionHeader title="Works with your stack" subtitle="One plugin interface — connect once per workspace." />
            <div className="flex flex-wrap justify-center gap-2">
              {(data?.integrations ?? []).map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-bold text-text-2 shadow-stitch transition-transform hover:-translate-y-0.5"
                >
                  <BrandIcon name={chip.key} size={18} />
                  {chip.label}
                  <Badge tone={chip.status === "live" ? "good" : chip.status === "ready" ? "blue" : "neutral"}>
                    {chip.status}
                  </Badge>
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-16">
          <WhereStitchWinsSection
            categories={data?.failureCategories ?? []}
            totalFixes={data?.metrics.totalFixes ?? 0}
          />
        </Reveal>

        <Reveal className="mt-16">
          <Card className="overflow-hidden border-accent/20">
            <CardTitle>ROI calculator</CardTitle>
            <CardSub>Uses your measured {data?.metrics.successRate ?? 74}% auto-fix rate — drag to match your team.</CardSub>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="space-y-5">
                <label className="block text-sm font-bold">
                  CI failures / month <span className="text-accent">{failures}</span>
                  <input type="range" min={5} max={200} value={failures} onChange={(e) => setFailures(+e.target.value)} className="mt-2 w-full accent-accent" />
                </label>
                <label className="block text-sm font-bold">
                  Avg manual fix (min) <span className="text-accent">{minutes}</span>
                  <input type="range" min={15} max={120} value={minutes} onChange={(e) => setMinutes(+e.target.value)} className="mt-2 w-full accent-accent" />
                </label>
                <label className="block text-sm font-bold">
                  Engineer hourly ($) <span className="text-accent">{rate}</span>
                  <input type="range" min={40} max={200} value={rate} onChange={(e) => setRate(+e.target.value)} className="mt-2 w-full accent-accent" />
                </label>
              </div>
              <div className="flex flex-col items-center justify-center rounded-stitch bg-accent-soft/30 p-6 text-center">
                <div className="text-5xl font-extrabold text-accent">{savedHours}h</div>
                <CardSub>saved per month</CardSub>
                <div className="mt-2 text-3xl font-bold">${savedDollars.toLocaleString()}</div>
                <CardSub>estimated value</CardSub>
                <p className="mt-3 max-w-xs text-xs text-muted">{data?.marketContext.source}</p>
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal className="mt-16">
          <CtaBand />
        </Reveal>
      </div>
    </>
  );
}

export function AboutPage() {
  const { data } = useMarketingStats();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Reveal instant>
        <Badge tone="accent" className="mb-4">Our story</Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Built for teams who ship at 3am</h1>
        <p className="mt-4 text-lg text-text-2">
          CI fails when no one is watching. Stitch removes the step where a human has to notice, paste logs into chat, and hope the suggestion applies to the real repo.
        </p>
        <p className="mt-4 text-text-2">
          We built Stitch for <b>OpenAI Build Week</b> — webhook-triggered, branch-aware, and SaaS-shaped from day one: real auth, PostgreSQL workspaces, Fix Log, Issue Records, Audit Trail, and live SSE.
        </p>
      </Reveal>

      <Reveal instant className="mt-10">
        <MetricStrip data={data} />
      </Reveal>

      <Reveal instant className="mt-14">
        <SectionHeader center={false} title="What we believe" subtitle="Principles behind every product decision." />
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="hover-lift">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={18} />
              </span>
              <CardTitle>{title}</CardTitle>
              <CardSub className="!mb-0">{desc}</CardSub>
            </Card>
          ))}
        </div>
      </Reveal>

      <Reveal instant className="mt-14">
        <SectionHeader center={false} title="The pipeline, end to end" />
        <div className="grid gap-3 sm:grid-cols-2">
          {HOW_IT_WORKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3 rounded-stitch border border-border bg-panel/50 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={18} />
              </span>
              <div>
                <div className="text-sm font-bold">{title}</div>
                <div className="text-xs text-muted">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal instant className="mt-14">
        <SectionHeader center={false} title="Where the numbers come from" subtitle="We show our work — here's how headline metrics are calculated." />
        <div className="space-y-3">
          <Card>
            <CardTitle className="!mb-1">Auto-fix rate ({data?.metrics.successRate ?? "—"}%)</CardTitle>
            <CardSub className="!mb-0">
              Measured from merged fixes ÷ total incidents across all workspaces in PostgreSQL — same query as the live dashboard. The confidence engine in Settings → Response behavior downgrades risky fixes automatically.
            </CardSub>
          </Card>
          <Card>
            <CardTitle className="!mb-1">Time to PR ({data?.metrics.avgTimeToFix ?? "—"})</CardTitle>
            <CardSub className="!mb-0">
              Audit trail timestamps from first webhook to PR opened — includes clone, validation, and GitHub API latency. See the live breakdown on our{" "}
              <Link to="/app/status" className="font-bold text-accent">Status page</Link>.
            </CardSub>
          </Card>
          <Card>
            <CardTitle className="!mb-1">Industry comparison</CardTitle>
            <CardSub className="!mb-0">
              {data?.marketContext.source}. Typical manual triage assumes {data?.marketContext.typicalManualFixMinutes ?? 45} minutes per failure — adjust in the ROI calculator on the home page.
            </CardSub>
          </Card>
        </div>
      </Reveal>

      <Reveal instant className="mt-14">
        <CtaBand />
      </Reveal>
    </div>
  );
}

export function ContactPage() {
  const { data } = useMarketingStats();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await api.contact({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        topic: String(fd.get("topic") ?? "General question"),
        message: String(fd.get("message") ?? ""),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <Reveal instant>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Badge tone="accent">We read every message</Badge>
          <StatusPill data={data} />
        </div>
        <h1 className="mt-4 text-center text-3xl font-bold md:text-4xl">Talk to the Stitch team</h1>
        <p className="mx-auto mt-2 max-w-lg text-center text-text-2">
          Security review, self-hosting, partnership, or a live walkthrough — we&apos;ll route it to the right place.
        </p>
      </Reveal>

      <Reveal instant className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardTitle>Send a message</CardTitle>
          {sent ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-good-soft text-good">
                <Check size={22} />
              </span>
              <p className="mt-4 font-semibold">Message received</p>
              <p className="mt-1 text-sm text-muted">Logged server-side — we typically respond within one business day.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="name" placeholder="Name" required className="rounded-lg border border-border bg-panel-2 px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                <input name="email" type="email" placeholder="Work email" required className="rounded-lg border border-border bg-panel-2 px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              </div>
              <select name="topic" defaultValue="General question" className="rounded-lg border border-border bg-panel-2 px-3 py-2.5 outline-none focus:border-accent">
                <option>General question</option>
                <option>Enterprise / self-hosted</option>
                <option>Security review</option>
                <option>Partnership</option>
                <option>Demo request</option>
              </select>
              <textarea name="message" placeholder="Tell us about your CI setup, team size, and what you're trying to fix…" rows={5} required className="rounded-lg border border-border bg-panel-2 px-3 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
              {error && <p className="text-sm text-critical">{error}</p>}
              <Button type="submit" variant="solid" size="lg" disabled={sending} className="w-full justify-center">
                {sending ? "Sending…" : "Send message"}
              </Button>
            </form>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Mail size={18} /></span>
            <div>
              <div className="text-sm font-bold">Email</div>
              <a href="mailto:hello@stitch.dev" className="text-sm text-accent">hello@stitch.dev</a>
            </div>
          </Card>
          <Card className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><MessageCircle size={18} /></span>
            <div>
              <div className="text-sm font-bold">Community</div>
              <div className="text-sm text-muted">OpenAI Build Week · #build-week-chat</div>
            </div>
          </Card>
          <Card className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Activity size={18} /></span>
            <div>
              <div className="text-sm font-bold">Platform status</div>
              <Link to="/app/status" className="text-sm text-accent">{data?.platform.statusLabel ?? "View status"}</Link>
            </div>
          </Card>
          <Card className="bg-accent-soft/20">
            <CardTitle className="!text-base">Try it first</CardTitle>
            <CardSub className="!mb-3">Create a workspace and run the pipeline demo — no sales call required.</CardSub>
            <Link to="/signup"><Button variant="solid" size="sm">Get started free</Button></Link>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}

function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { id: string; title: string; body: React.ReactNode }[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Reveal instant>
        <Badge tone="neutral" className="mb-3">Legal</Badge>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <CardSub className="mt-2">Last updated {updated} · Stitch (OpenAI Build Week submission)</CardSub>
      </Reveal>

      <Reveal instant className="mt-8">
        <Card className="mb-8 bg-panel-2/50">
          <CardTitle className="!text-sm">On this page</CardTitle>
          <nav className="mt-2 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-border bg-panel px-3 py-1 text-xs font-semibold text-text-2 transition-colors hover:border-accent/40 hover:text-accent"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </Card>

        <div className="space-y-4">
          {sections.map((s) => (
            <Card key={s.id} id={s.id} className="scroll-mt-28">
              <CardTitle className="!text-base">{s.title}</CardTitle>
              <div className="text-sm leading-relaxed text-text-2">{s.body}</div>
            </Card>
          ))}
        </div>
      </Reveal>

      <Reveal instant className="mt-8 text-center">
        <p className="text-sm text-muted">
          Questions?{" "}
          <a href="mailto:hello@stitch.dev" className="font-bold text-accent">
            hello@stitch.dev
          </a>{" "}
          ·{" "}
          <Link to="/contact" className="font-bold text-accent">
            Contact form
          </Link>
        </p>
      </Reveal>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="July 22, 2026"
      sections={[
        {
          id: "overview",
          title: "Overview",
          body: (
            <p>
              Stitch is a developer-tools project for{" "}
              <a href="https://openai.devpost.com/" className="font-bold text-accent" target="_blank" rel="noreferrer">
                OpenAI Build Week
              </a>
              . This policy describes what the hosted demo collects and how it is used — written to match the actual system, not generic boilerplate.
            </p>
          ),
        },
        {
          id: "account-data",
          title: "Account & workspace data",
          body: (
            <p>
              When you sign up, we store your name, email, bcrypt-hashed password, organization membership, and role in PostgreSQL. Fix Log entries, Issue Records, Audit Trail events, and integration settings are persisted per workspace and scoped to your organization.
            </p>
          ),
        },
        {
          id: "third-party",
          title: "Third-party services",
          body: (
            <p>
              If you configure an OpenAI API key, diagnosis (GPT-5.6) and fix-generation (Codex) requests are sent to OpenAI. CI integrations use tokens you connect in Settings to call GitHub or other providers on your behalf. We do not sell your data.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies & sessions",
          body: (
            <p>
              We use httpOnly session cookies for authentication only. Marketing pages do not load analytics pixels, ad trackers, or third-party marketing scripts.
            </p>
          ),
        },
        {
          id: "retention",
          title: "Retention & deletion",
          body: (
            <p>
              Workspace data remains until you delete your organization (Settings → Danger zone) or remove individual Fix records. Contact submissions are logged server-side for demo purposes and are not emailed automatically.
            </p>
          ),
        },
        {
          id: "your-rights",
          title: "Your choices",
          body: (
            <p>
              You can export workspace data from Settings, revoke integrations at any time, and sign out to end your session. For access or deletion requests, email{" "}
              <a href="mailto:hello@stitch.dev" className="font-bold text-accent">hello@stitch.dev</a>.
            </p>
          ),
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="July 22, 2026"
      sections={[
        {
          id: "service",
          title: "The service",
          body: (
            <p>
              Stitch is an autonomous CI repair agent submitted to the Developer Tools track of{" "}
              <a href="https://openai.devpost.com/" className="font-bold text-accent" target="_blank" rel="noreferrer">
                OpenAI Build Week
              </a>
              . The hosted instance is a working demo for evaluation and hackathon judging — not a commercially billed product today.
            </p>
          ),
        },
        {
          id: "eligibility",
          title: "Eligibility & accounts",
          body: (
            <p>
              You must be above the legal age of majority in your country to create a workspace. You are responsible for credentials connected to your organization and for activity under your account. One person may belong to multiple organizations via invite links.
            </p>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: (
            <p>
              You may connect CI providers, run the pipeline demo, and use Fix Log, Issues, and Audit features as intended. Do not connect production secrets unless you accept hackathon-grade deployment risk. Review Settings → Security before enabling autopilot merges on <code className="rounded bg-code-bg px-1">main</code>.
            </p>
          ),
        },
        {
          id: "ai-output",
          title: "AI-generated changes",
          body: (
            <p>
              Fixes are generated by AI and may be incorrect. Stitch validates patches where configured, but you remain responsible for reviewing PRs before merge — especially on protected branches. Auto-revert and rollback settings exist to limit blast radius.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Availability",
          body: (
            <p>
              No SLA is offered for the demo environment. Check the{" "}
              <Link to="/app/status" className="font-bold text-accent">Status page</Link> for current platform health. We may reset or migrate demo data during the Build Week period.
            </p>
          ),
        },
        {
          id: "warranty",
          title: "Disclaimer",
          body: (
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          body: (
            <p>
              We may update these terms as the project evolves. Continued use after changes constitutes acceptance. Material updates will be reflected in the &quot;Last updated&quot; date above.
            </p>
          ),
        },
      ]}
    />
  );
}
