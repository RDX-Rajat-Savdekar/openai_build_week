/** Live submission test repo — local copy in `testrepo/`, remote on GitHub. */
export const STITCH_TEST_REPO =
  process.env.STITCH_TEST_REPO ?? process.env.DEMO_REPO ?? "Khushalsarode/stitch-test-flow-repo";

/** Branch names aligned with Stitch default branch rules (branchRouter.ts). */
export const STITCH_TEST_BRANCHES = {
  /** Autopilot — opens PR on main (human review on main by default router) */
  main: "main",
  /** Fix & propose — PR opened, pending review */
  fixPropose: "release/v1.0",
  /** Diagnose & suggest — comment on existing PR, no new PR */
  diagnoseSuggest: "feature/checkout-v2",
  /** Autopilot + auto-merge when GitHub connected */
  autoMerge: "dev",
  /** Urgent hotfix path */
  hotfix: "hotfix/auth-guard",
} as const;
