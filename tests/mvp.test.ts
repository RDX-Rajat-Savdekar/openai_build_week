import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeBranch } from "../src/router/branchRouter.js";
import { validateFix } from "../src/fix/validateFix.js";
import { runPipeline } from "../src/pipeline/runPipeline.js";
import { githubPlugin } from "../src/platforms/github.js";
import { getUserPermissions, roleHasPermission } from "../src/permissions.js";
import { prisma } from "../src/db/prisma.js";
import { getFix, getOrganization, updatePreferences } from "../src/store/appStore.js";

let organizationId: string;

beforeAll(async () => {
  // Tests run against the seeded demo org (`npm run db:seed`) rather than a
  // separate test database — acceptable for this hackathon's scale, but a
  // real CI setup would spin up an isolated database per run instead.
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "acme-corp" } });
  organizationId = org.id;
});

describe("branchRouter", () => {
  it("routes main to aggressive auto-fix", () => {
    const cfg = routeBranch("main");
    expect(cfg.mode).toBe("aggressive");
    expect(cfg.openPr).toBe(true);
    expect(cfg.autoFix).toBe(true);
  });

  it("routes feature branches to comment-only", () => {
    const cfg = routeBranch("feature/checkout");
    expect(cfg.mode).toBe("comment-only");
    expect(cfg.openPr).toBe(false);
  });

  it("routes dev to auto-merge", () => {
    const cfg = routeBranch("dev");
    expect(cfg.mode).toBe("auto-merge");
    expect(cfg.autoMerge).toBe(true);
  });

  it("routes unknown branches to diagnose-only default", () => {
    const cfg = routeBranch("random/experimental");
    expect(cfg.autoFix).toBe(false);
    expect(cfg.openPr).toBe(false);
  });

  it("falls back repo → project → org default modes", () => {
    const cfg = routeBranch("random/experimental", {
      repoDefaultMode: "Notify only",
      projectDefaultMode: "Fix & propose",
      orgDefaultMode: "Autopilot",
    });
    expect(cfg.label).toBe("Notify only");

    const projectFallback = routeBranch("random/experimental", {
      projectDefaultMode: "Fix & propose",
      orgDefaultMode: "Autopilot",
    });
    expect(projectFallback.label).toBe("Fix & propose");
  });
});

describe("validateFix", () => {
  it("accepts a minimal unified diff", () => {
    const diff = `--- a/foo.js
+++ b/foo.js
@@ -1 +1 @@
-old
+new`;
    expect(validateFix(diff).ok).toBe(true);
  });

  it("rejects empty diff", () => {
    expect(validateFix("").ok).toBe(false);
  });

  it("rejects diff without hunks", () => {
    const diff = `--- a/foo.js
+++ b/foo.js`;
    expect(validateFix(diff).ok).toBe(false);
  });
});

describe("runPipeline simulate", () => {
  it("runs full demo pipeline on main without GitHub connected", async () => {
    const result = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch: "main",
        commitSha: "abc123",
        runId: `test-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/1",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );

    expect(result.validated).toBe(true);
    expect(result.diff).toContain("---");
    expect(result.fixId).toBeGreaterThan(0);
    expect(result.action).toBe("pr_opened");
  });

  it("diagnose-only on unknown branch for a repo with no stored mode override", async () => {
    // "acme/backend" carries a seeded mode ("Autopilot") that now genuinely
    // overrides unmatched-branch behavior (see the branch-rules test below) —
    // this case uses a repo absent from the org's Repo table so the fallback
    // reaches the router's true system default (diagnose-only), isolating the
    // branch-router's own fallback logic from the newer per-repo override.
    const result = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/no-such-repo",
        branch: "experiment/xyz",
        commitSha: "abc123",
        runId: `test-diag-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/2",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );

    expect(result.action).toBe("diagnose_only");
    expect(result.validated).toBe(false);
    expect(result.diff).toBe("");
  });
});

describe("branch rules — real per-org and per-repo overrides", () => {
  let originalBranchRules: unknown;

  beforeAll(async () => {
    const org = await getOrganization(organizationId);
    originalBranchRules = (org.preferences as Record<string, unknown> | null)?.branchRules;
  });

  afterAll(async () => {
    await updatePreferences(organizationId, { branchRules: originalBranchRules });
  });

  it("a repo's own mode overrides the built-in default for an unmatched branch", async () => {
    // "acme/backend" is seeded with mode "Autopilot" — an unmatched branch
    // should now auto-fix (not diagnose-only), proving the Repositories
    // screen's per-repo mode override genuinely drives the pipeline.
    const result = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch: `experiment/repo-override-${Date.now()}`,
        commitSha: "abc123",
        runId: `test-repo-override-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/4",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );

    expect(result.action).not.toBe("diagnose_only");
    expect(result.validated).toBe(true);
  });

  it("a custom org branch rule takes priority over both the built-in defaults and the repo's own mode", async () => {
    await updatePreferences(organizationId, {
      branchRules: [{ pattern: "custom/*", mode: "Silent audit" }],
    });

    const result = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch: `custom/rule-test-${Date.now()}`,
        commitSha: "abc123",
        runId: `test-custom-rule-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/5",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );

    // Silent audit -> autoFix: false, so this takes the diagnose-only path,
    // even though the repo's own mode ("Autopilot") would otherwise auto-fix.
    expect(result.action).toBe("diagnose_only");
  });

  it(
    "auto-reverts a merged fix when CI fails again on the same repo+branch within the window (Rollback & safety)",
    async () => {
    const branch = `dev`; // dev/staging routes to Autopilot (auto-merge) by default — see DEFAULT_BRANCH_RULES
    const first = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch,
        commitSha: "abc123",
        runId: `test-autorevert-1-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/6",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );
    expect(first.action).toBe("pr_opened");

    const second = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch,
        commitSha: "def456",
        runId: `test-autorevert-2-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/7",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );
    void second;

    const firstFix = await getFix(organizationId, first.fixId);
    expect(firstFix?.outcome).toBe("reverted");
  },
  15_000,
  );
});

describe("ticketing fallback", () => {
  let originalTicketingPrefs: unknown;

  beforeAll(async () => {
    const org = await getOrganization(organizationId);
    originalTicketingPrefs = (org.preferences as Record<string, unknown> | null)?.ticketing;
  });

  afterAll(async () => {
    await updatePreferences(organizationId, { ticketing: originalTicketingPrefs });
  });

  it("falls back to the simulated ticket ID when Jira isn't connected", async () => {
    // No Jira Integration row is connected for this org — createOn: "every"
    // forces a ticket to be created for this run's outcome, which must land
    // on the pre-existing JIRA-SIM/LINEAR-SIM fallback rather than throwing
    // or leaving the fix ticket-less.
    await updatePreferences(organizationId, { ticketing: { createOn: "every" } });

    const result = await runPipeline(
      organizationId,
      githubPlugin,
      {
        platform: "github",
        repo: "acme/backend",
        branch: "main",
        commitSha: "abc123",
        runId: `test-ticket-${Date.now()}`,
        logsUrl: "https://github.com/acme/backend/actions/runs/3",
        prNumber: null,
        triggeredAt: new Date().toISOString(),
      },
      { simulate: true },
    );

    const fix = await getFix(organizationId, result.fixId);
    expect(fix?.ticket).toBe("LINEAR-SIM");
  });
});

describe("githubPlugin", () => {
  it("ignores non-failure workflow events", () => {
    expect(
      githubPlugin.normalize({
        action: "completed",
        workflow_run: { id: 1, head_branch: "main", head_sha: "abc", conclusion: "success", logs_url: "", created_at: "" },
        repository: { full_name: "acme/backend" },
      }),
    ).toBeNull();
  });

  it("normalizes failed workflow runs", () => {
    const failure = githubPlugin.normalize({
      action: "completed",
      workflow_run: {
        id: 99,
        head_branch: "main",
        head_sha: "deadbeef",
        conclusion: "failure",
        logs_url: "https://github.com/acme/backend/actions/runs/99",
        created_at: "2026-07-21T00:00:00Z",
      },
      repository: { full_name: "acme/backend" },
    });

    expect(failure).toMatchObject({
      platform: "github",
      repo: "acme/backend",
      branch: "main",
      runId: "99",
    });
  });
});

describe("permissions RBAC", () => {
  it("Admin always passes every permission check", () => {
    expect(roleHasPermission(undefined, "Admin", "manage_team")).toBe(true);
    expect(roleHasPermission(undefined, "Admin", "export_data")).toBe(true);
    expect(getUserPermissions(undefined, "Admin").manage_billing).toBe(true);
  });

  it("Developer can approve/revert but not manage team", () => {
    expect(roleHasPermission(undefined, "Developer", "approve_autopilot")).toBe(true);
    expect(roleHasPermission(undefined, "Developer", "revert_fix")).toBe(true);
    expect(roleHasPermission(undefined, "Developer", "manage_team")).toBe(false);
    expect(roleHasPermission(undefined, "Developer", "manage_integrations")).toBe(false);
  });

  it("Viewer can only view audit trail", () => {
    expect(roleHasPermission(undefined, "Viewer", "view_audit_trail")).toBe(true);
    expect(roleHasPermission(undefined, "Viewer", "approve_autopilot")).toBe(false);
    expect(roleHasPermission(undefined, "Viewer", "export_data")).toBe(false);
  });

  it("Product Owner can approve fixes and export reports but not change CI", () => {
    expect(roleHasPermission(undefined, "Product Owner", "approve_autopilot")).toBe(true);
    expect(roleHasPermission(undefined, "Product Owner", "export_data")).toBe(true);
    expect(roleHasPermission(undefined, "Product Owner", "view_audit_trail")).toBe(true);
    expect(roleHasPermission(undefined, "Product Owner", "manage_integrations")).toBe(false);
    expect(roleHasPermission(undefined, "Product Owner", "manage_team")).toBe(false);
  });

  it("Release Manager owns branch rules and release approvals", () => {
    expect(roleHasPermission(undefined, "Release Manager", "manage_response_rules")).toBe(true);
    expect(roleHasPermission(undefined, "Release Manager", "approve_autopilot")).toBe(true);
    expect(roleHasPermission(undefined, "Release Manager", "revert_fix")).toBe(true);
    expect(roleHasPermission(undefined, "Release Manager", "manage_billing")).toBe(false);
  });

  it("SRE connects CI and reverts bad deploys but does not manage billing", () => {
    expect(roleHasPermission(undefined, "SRE", "manage_integrations")).toBe(true);
    expect(roleHasPermission(undefined, "SRE", "revert_fix")).toBe(true);
    expect(roleHasPermission(undefined, "SRE", "approve_autopilot")).toBe(false);
    expect(roleHasPermission(undefined, "SRE", "manage_billing")).toBe(false);
  });

  it("Security & Compliance is read-only with export", () => {
    expect(roleHasPermission(undefined, "Security & Compliance", "view_audit_trail")).toBe(true);
    expect(roleHasPermission(undefined, "Security & Compliance", "export_data")).toBe(true);
    expect(roleHasPermission(undefined, "Security & Compliance", "revert_fix")).toBe(false);
  });

  it("Billing Manager can manage billing and view audit only", () => {
    expect(roleHasPermission(undefined, "Billing Manager", "manage_billing")).toBe(true);
    expect(roleHasPermission(undefined, "Billing Manager", "view_audit_trail")).toBe(true);
    expect(roleHasPermission(undefined, "Billing Manager", "manage_team")).toBe(false);
  });

  it("org custom role permissions override built-ins", () => {
    const orgRoles = {
      "Custom QA": {
        name: "Custom QA",
        custom: true,
        permissions: {
          manage_integrations: false,
          manage_response_rules: false,
          approve_autopilot: true,
          revert_fix: false,
          manage_billing: false,
          manage_team: false,
          view_audit_trail: true,
          export_data: false,
        },
      },
    };
    expect(roleHasPermission(orgRoles, "Custom QA", "approve_autopilot")).toBe(true);
    expect(roleHasPermission(orgRoles, "Custom QA", "manage_integrations")).toBe(false);
  });
});
