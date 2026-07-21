export type RouterMode = "aggressive" | "conservative" | "comment-only" | "auto-merge" | "hotfix";

/** The 5 trust-level labels shown throughout the product UI (Settings, Fix Log, Repositories). */
export type UiModeLabel = "Autopilot" | "Fix & propose" | "Diagnose & suggest" | "Silent audit" | "Notify only";

export interface BehaviorConfig {
  mode: RouterMode;
  /** Canonical UI label — what actually gets stored on a Fix/shown in the product, distinct from `mode`'s internal granularity. */
  label: UiModeLabel;
  autoFix: boolean;
  openPr: boolean;
  autoMerge: boolean;
  requireHumanReview: boolean;
  notify: ("slack" | "email")[];
  urgent: boolean;
}

export interface BranchRule {
  pattern: string;
  mode: UiModeLabel;
}

const RULES: { pattern: RegExp; config: BehaviorConfig }[] = [
  {
    pattern: /^(main|master)$/,
    config: { mode: "aggressive", label: "Autopilot", autoFix: true, openPr: true, autoMerge: false, requireHumanReview: false, notify: ["slack", "email"], urgent: false },
  },
  {
    pattern: /^release\//,
    config: { mode: "conservative", label: "Fix & propose", autoFix: true, openPr: true, autoMerge: false, requireHumanReview: true, notify: ["slack", "email"], urgent: true },
  },
  {
    pattern: /^feature\//,
    config: { mode: "comment-only", label: "Diagnose & suggest", autoFix: true, openPr: false, autoMerge: false, requireHumanReview: true, notify: ["slack"], urgent: false },
  },
  {
    pattern: /^(dev|staging)$/,
    config: { mode: "auto-merge", label: "Autopilot", autoFix: true, openPr: true, autoMerge: true, requireHumanReview: false, notify: ["slack"], urgent: false },
  },
  {
    pattern: /^hotfix\//,
    config: { mode: "hotfix", label: "Autopilot", autoFix: true, openPr: true, autoMerge: false, requireHumanReview: true, notify: ["slack", "email"], urgent: true },
  },
];

const DEFAULT_CONFIG: BehaviorConfig = {
  mode: "comment-only",
  label: "Diagnose & suggest",
  autoFix: false,
  openPr: false,
  autoMerge: false,
  requireHumanReview: true,
  notify: ["slack"],
  urgent: false,
};

/**
 * The default rule set expressed in the same {pattern, mode} shape the
 * Settings → Branch rules screen edits — used only to render sane starting
 * values before an org has ever saved its own rules (see `GET /settings/branch-rules`).
 * Once an org saves anything, `routeBranch`'s `customRules` param takes over
 * completely and this constant is no longer consulted for that org.
 */
export const DEFAULT_BRANCH_RULES: BranchRule[] = [
  { pattern: "main, master", mode: "Autopilot" },
  { pattern: "release/*", mode: "Fix & propose" },
  { pattern: "feature/*", mode: "Diagnose & suggest" },
  { pattern: "dev, staging", mode: "Autopilot" },
  { pattern: "hotfix/*", mode: "Autopilot" },
];

/** One canonical BehaviorConfig per UI label — what a custom branch rule or a repo/org default-mode override resolves to. */
export const MODE_TO_BEHAVIOR: Record<UiModeLabel, BehaviorConfig> = {
  Autopilot: { mode: "auto-merge", label: "Autopilot", autoFix: true, openPr: true, autoMerge: true, requireHumanReview: false, notify: ["slack", "email"], urgent: false },
  "Fix & propose": { mode: "conservative", label: "Fix & propose", autoFix: true, openPr: true, autoMerge: false, requireHumanReview: true, notify: ["slack", "email"], urgent: false },
  "Diagnose & suggest": { mode: "comment-only", label: "Diagnose & suggest", autoFix: true, openPr: false, autoMerge: false, requireHumanReview: true, notify: ["slack"], urgent: false },
  "Silent audit": { mode: "comment-only", label: "Silent audit", autoFix: false, openPr: false, autoMerge: false, requireHumanReview: true, notify: [], urgent: false },
  "Notify only": { mode: "comment-only", label: "Notify only", autoFix: false, openPr: false, autoMerge: false, requireHumanReview: true, notify: ["slack", "email"], urgent: true },
};

export function isUiModeLabel(value: string): value is UiModeLabel {
  return value in MODE_TO_BEHAVIOR;
}

/** Supports comma-separated literal alternatives ("main, master") and a single trailing "*" prefix glob ("release/*"). */
function patternMatches(pattern: string, branch: string): boolean {
  return pattern
    .split(",")
    .map((p) => p.trim())
    .some((token) => {
      if (!token) return false;
      if (token.endsWith("*")) return branch.startsWith(token.slice(0, -1));
      return branch === token;
    });
}

/**
 * Pure function: branch name in, behavior config out (plan section 3.2 / 4).
 * `customRules` — an org's saved Settings → Branch rules list — takes full
 * priority over the built-in defaults below when present and non-empty,
 * evaluated top to bottom exactly like the built-ins. `repoDefaultMode` /
 * `orgDefaultMode` are the fallback when nothing matches (repo's own mode
 * override wins over the org's Response Behavior default mode), matching the
 * Repositories screen's "Overrides the workspace default" language.
 */
export function routeBranch(
  branch: string,
  opts?: { customRules?: BranchRule[]; repoDefaultMode?: string; projectDefaultMode?: string; orgDefaultMode?: string },
): BehaviorConfig {
  if (opts?.customRules && opts.customRules.length > 0) {
    const rule = opts.customRules.find((r) => patternMatches(r.pattern, branch));
    if (rule && isUiModeLabel(rule.mode)) return MODE_TO_BEHAVIOR[rule.mode];
    if (opts.repoDefaultMode && isUiModeLabel(opts.repoDefaultMode)) return MODE_TO_BEHAVIOR[opts.repoDefaultMode];
    if (opts.projectDefaultMode && isUiModeLabel(opts.projectDefaultMode)) return MODE_TO_BEHAVIOR[opts.projectDefaultMode];
    if (opts.orgDefaultMode && isUiModeLabel(opts.orgDefaultMode)) return MODE_TO_BEHAVIOR[opts.orgDefaultMode];
    return DEFAULT_CONFIG;
  }

  const rule = RULES.find((r) => r.pattern.test(branch));
  if (rule) return rule.config;
  if (opts?.repoDefaultMode && isUiModeLabel(opts.repoDefaultMode)) return MODE_TO_BEHAVIOR[opts.repoDefaultMode];
  if (opts?.projectDefaultMode && isUiModeLabel(opts.projectDefaultMode)) return MODE_TO_BEHAVIOR[opts.projectDefaultMode];
  if (opts?.orgDefaultMode && isUiModeLabel(opts.orgDefaultMode)) return MODE_TO_BEHAVIOR[opts.orgDefaultMode];
  return DEFAULT_CONFIG;
}
