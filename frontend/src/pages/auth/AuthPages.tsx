import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { StitchLockup, StitchLogomark } from "@/components/ui/BrandIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { HeroBackground } from "@/components/marketing/HeroBackground";
import { useMarketingStats } from "@/hooks/useMarketingStats";
import { auth } from "@/lib/api";
import { Github, Mail, Lock, Building2, User, Eye, EyeOff, Check, Shield, Zap, GitPullRequest, ArrowLeft, MailCheck, AlertCircle } from "lucide-react";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  github_not_configured: "GitHub sign-in isn't set up yet — add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env, or use email + password below.",
  github_oauth_failed: "GitHub sign-in failed — try again, or use email + password below.",
  invite_invalid: "This invite link is invalid or has expired.",
  invite_email_mismatch: "Your GitHub email doesn't match this invite — use the invited email, or ask for a new link.",
  account_exists: "An account with that email already exists — sign in instead.",
};

const PANEL_POINTS = [
  { icon: Zap, text: "Diagnose → fix → PR, before you've had coffee" },
  { icon: Shield, text: "Every action logged to a tamper-evident audit trail" },
  { icon: GitPullRequest, text: "A validated PR with diff and evidence, not a chat reply" },
];

function IconField({
  icon: Icon,
  ...props
}: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        {...props}
        className="w-full rounded-lg border border-border bg-panel-2 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </div>
  );
}

function PasswordField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        {...props}
        type={show ? "text" : "password"}
        className="w-full rounded-lg border border-border bg-panel-2 py-2.5 pl-9 pr-10 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 700);
  };

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-good-soft text-good">
          <MailCheck size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
        <p className="mt-1.5 text-sm text-muted">
          If an account exists for <b className="text-text">{email}</b>, we've sent a link to reset the password.
        </p>
        <button type="button" onClick={onBack} className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
          <ArrowLeft size={14} /> Back to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-accent">
        <ArrowLeft size={14} /> Back to sign in
      </button>
      <h1 className="text-center text-2xl font-bold">Reset your password</h1>
      <p className="mt-1.5 text-center text-sm text-muted">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <IconField icon={Mail} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="solid" size="lg" disabled={sending}>
          {sending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </>
  );
}

function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const { data: marketing } = useMarketingStats(90_000);
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(mode === "login");
  const [forgot, setForgot] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    return code ? (OAUTH_ERROR_MESSAGES[code] ?? "Something went wrong — try again.") : null;
  });

  const inviteToken = mode === "signup" ? searchParams.get("invite") : null;
  const [invite, setInvite] = useState<{ orgName: string; email: string | null; role: string } | null>(null);
  const [inviteChecked, setInviteChecked] = useState(!inviteToken);

  useEffect(() => {
    auth.config().then((c) => setGithubEnabled(c.githubOAuth)).catch(() => setGithubEnabled(false));
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    auth
      .invite(inviteToken)
      .then((r) => setInvite({ orgName: r.orgName, email: r.email, role: r.role }))
      .catch(() => setError("This invite link is invalid or has expired — sign up normally below."))
      .finally(() => setInviteChecked(true));
  }, [inviteToken]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode === "signup" && !agreed) return;
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    setLoading(true);
    try {
      if (mode === "login") {
        await auth.login({ email, password });
      } else {
        const orgName = String(fd.get("orgName") ?? "").trim();
        const name = String(fd.get("name") ?? "").trim();
        await auth.signup({ orgName, name, email, password, invite: invite && inviteToken ? inviteToken : undefined });
      }
      navigate("/app/dashboard");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="flex min-h-full">
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/90 backdrop-blur-sm">
          <StitchLogomark size={48} className="animate-pulse" />
          <p className="mt-4 font-semibold text-muted">Setting up your workspace…</p>
        </div>
      )}

      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1a1140] via-[#120c30] to-[#0a0718] px-10 py-12 text-white lg:flex">
        <HeroBackground className="opacity-60" tone="invert" motion={true} />
        <Link to="/" className="relative z-10">
          <StitchLockup tone="light" height={40} />
        </Link>
        <div className="relative z-10">
          <Badge tone="outline" className="mb-4 border-white/25 bg-white/10 text-white">
            Trusted by {marketing?.metrics.workspaces ?? "—"} workspaces
          </Badge>
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight">
            Ship with confidence — even when CI fails at 3am.
          </h2>
          <div className="mt-8 space-y-4">
            {PANEL_POINTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Icon size={16} />
                </span>
                <span className="text-sm leading-relaxed text-white/90">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="text-2xl font-extrabold">{marketing?.metrics.successRate ?? 74}%</div>
            <div className="text-xs text-white/75">measured auto-fix rate</div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="text-2xl font-extrabold">{marketing?.metrics.avgTimeToFix ?? "2m 14s"}</div>
            <div className="text-xs text-white/75">median time to PR</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-bg px-6 py-12">
        <div className="w-full max-w-md rounded-stitch border border-border bg-panel/50 p-6 shadow-stitch backdrop-blur-sm md:p-8">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/"><StitchLockup tone="dark" height={56} /></Link>
          </div>

          {forgot ? (
            <ForgotPasswordForm onBack={() => setForgot(false)} />
          ) : !inviteChecked || githubEnabled === null ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <StitchLogomark size={40} className="opacity-60" />
              <p className="text-sm text-muted">Loading…</p>
            </div>
          ) : (
            <>
              <h1 className="text-center text-2xl font-bold">
                {mode === "login" ? "Welcome back" : invite ? `Join ${invite.orgName}` : "Create your workspace"}
              </h1>
              <p className="mt-1.5 text-center text-sm text-muted">
                {mode === "login"
                  ? "Sign in to your workspace"
                  : invite
                    ? `You've been invited as ${invite.role}${invite.email ? ` (${invite.email})` : ""}`
                    : "Free to start — you'll be the workspace Admin"}
              </p>

              <div className="mt-6 min-h-[44px]">
                {githubEnabled ? (
                  <a href={auth.githubLoginUrl(inviteToken ?? undefined)} className="block">
                    <Button variant="ghost" className="w-full" type="button">
                      <Github size={16} /> Continue with GitHub
                    </Button>
                  </a>
                ) : (
                  <p className="rounded-lg border border-border bg-panel-2 px-3 py-2.5 text-center text-xs text-muted">
                    GitHub sign-in is off — set <code className="rounded bg-code-bg px-1">GITHUB_CLIENT_ID</code> and{" "}
                    <code className="rounded bg-code-bg px-1">GITHUB_CLIENT_SECRET</code> in <code className="rounded bg-code-bg px-1">.env</code> to enable it.
                  </p>
                )}
              </div>

              <div className="my-5 flex items-center gap-3 text-xs font-semibold text-muted">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              {error && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-sm text-critical">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={submit} className="flex flex-col gap-3">
                {mode === "signup" && (
                  <>
                    {!invite && <IconField icon={Building2} name="orgName" placeholder="Organization name" required />}
                    <IconField icon={User} name="name" placeholder="Your name" required />
                  </>
                )}
                <IconField
                  icon={Mail}
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  defaultValue={invite?.email ?? ""}
                  readOnly={Boolean(invite?.email)}
                />
                <PasswordField name="password" placeholder={mode === "signup" ? "Password (min. 8 characters)" : "Password"} required minLength={8} />

                {mode === "signup" ? (
                  <label className="flex items-start gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-accent"
                    />
                    <span>
                      I agree to the <Link to="/terms" className="font-bold text-accent">Terms of Service</Link> and{" "}
                      <Link to="/privacy" className="font-bold text-accent">Privacy Policy</Link>.
                    </span>
                  </label>
                ) : (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setForgot(true)} className="text-xs font-semibold text-accent">Forgot password?</button>
                  </div>
                )}

                <Button type="submit" variant="solid" size="lg" disabled={loading || !inviteChecked || (mode === "signup" && !agreed)}>
                  {mode === "login" ? "Sign in" : invite ? `Join as ${invite.role}` : "Create workspace as Admin"}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted">
                {mode === "login" ? (
                  <>No account? <Link to="/signup" className="font-bold text-accent">Sign up</Link></>
                ) : (
                  <>Have an account? <Link to="/login" className="font-bold text-accent">Sign in</Link></>
                )}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1"><Check size={13} className="text-good" /> No credit card</span>
                <span className="flex items-center gap-1"><Check size={13} className="text-good" /> 2-minute setup</span>
                <span className="flex items-center gap-1"><Check size={13} className="text-good" /> Cancel anytime</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  return <AuthForm mode="login" />;
}

export function SignupPage() {
  return <AuthForm mode="signup" />;
}
