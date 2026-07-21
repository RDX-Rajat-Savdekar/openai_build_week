import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEMO_REPOS_CONFIG,
  PROJECTS_SEED,
  SEED_AUDIT_FIX_247,
  SEED_FIXES,
  SEED_ISSUE_RECORDS,
} from "../src/data/demoData.js";
import { generateIssueRecordMarkdown } from "../src/issues/issueRecord.js";
import type { NormalizedFailure } from "../src/platforms/types.js";

const prisma = new PrismaClient();

function diffToText(diff: { ctx?: string; del?: string; add?: string }[]): string {
  return diff.map((l) => l.del ?? l.add ?? l.ctx ?? "").join("\n");
}

// Staggers the single flat timestamp the old in-memory seed used into the
// real chronological sequence the Audit Trail page's copy already implies.
const AUDIT_TIMES_FIX_247 = [
  "2026-07-20T03:41:02Z",
  "2026-07-20T03:41:04Z",
  "2026-07-20T03:42:10Z",
  "2026-07-20T03:42:31Z",
  "2026-07-20T03:42:38Z",
  "2026-07-20T03:42:41Z",
  "2026-07-20T03:53:47Z",
];

async function main() {
  console.log("Seeding stitch database...");

  const org = await prisma.organization.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "Team",
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "demo@stitch.dev" },
    update: {},
    create: {
      email: "demo@stitch.dev",
      passwordHash,
      name: "Rajat Savdekar",
      role: "Admin",
      organizationId: org.id,
    },
  });

  const demoTeam = [
    { email: "tara@stitch.dev", name: "Tara Mehta", role: "Developer" },
    { email: "james@stitch.dev", name: "James Lee", role: "Release Manager" },
    { email: "maya@stitch.dev", name: "Maya Gupta", role: "Product Owner" },
    { email: "alex@stitch.dev", name: "Alex Chen", role: "SRE" },
    { email: "compliance@stitch.dev", name: "Sam Rivera", role: "Security & Compliance" },
  ] as const;

  for (const member of demoTeam) {
    await prisma.user.upsert({
      where: { email: member.email },
      update: { role: member.role, organizationId: org.id },
      create: {
        email: member.email,
        passwordHash,
        name: member.name,
        role: member.role,
        organizationId: org.id,
      },
    });
  }

  await prisma.aiUsage.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      budget: 75,
      spent: 44.5,
      gptCalls: 312,
      gptCost: 18.4,
      codexCalls: 89,
      codexCost: 26.1,
    },
  });

  const projectIdByLegacyId: Record<string, string> = {};
  for (const p of [
    ...PROJECTS_SEED,
    { id: "unassigned", name: "Unassigned", slug: "unassigned", description: "Repos not yet assigned to a project.", defaultMode: "Notify only", createdAt: new Date().toISOString() },
  ]) {
    const project = await prisma.project.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: p.slug } },
      update: {},
      create: {
        organizationId: org.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        defaultMode: p.defaultMode,
      },
    });
    projectIdByLegacyId[p.id] = project.id;
  }

  const repoIdByFullName: Record<string, string> = {};
  for (const r of DEMO_REPOS_CONFIG) {
    const repo = await prisma.repo.upsert({
      where: { organizationId_fullName: { organizationId: org.id, fullName: r.repo } },
      update: {
        enabled: r.enabled,
        mode: r.mode,
        policy: r.policy,
        provider: r.provider,
        projectId: projectIdByLegacyId[r.project] ?? projectIdByLegacyId.unassigned,
      },
      create: {
        organizationId: org.id,
        projectId: projectIdByLegacyId[r.project] ?? projectIdByLegacyId.unassigned,
        fullName: r.repo,
        provider: r.provider,
        mode: r.mode,
        policy: r.policy,
        enabled: r.enabled,
      },
    });
    repoIdByFullName[r.repo] = repo.id;
  }

  for (const key of ["github", "gitlab", "circleci", "jenkins", "bitbucket"]) {
    await prisma.integration.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      update: {},
      create: { organizationId: org.id, key, connected: false, config: {} },
    });
  }

  for (const key of ["slack", "email"]) {
    await prisma.notificationChannelConfig.upsert({
      where: { organizationId_key: { organizationId: org.id, key } },
      update: {},
      create: { organizationId: org.id, key, enabled: true, config: {} },
    });
  }

  for (const fix of SEED_FIXES) {
    const repoId = repoIdByFullName[fix.repo];
    const created = await prisma.fix.upsert({
      where: { id: fix.id },
      update: {},
      create: {
        id: fix.id,
        organizationId: org.id,
        repoId,
        repoName: fix.repo,
        branch: fix.branch,
        author: fix.author,
        confidence: fix.confidence,
        outcome: fix.outcome,
        mode: fix.mode,
        rootCause: fix.rootCause,
        files: fix.files,
        diffText: diffToText(fix.diff),
        outcomeText: fix.outcomeText,
        ticket: fix.ticket,
        prUrl: fix.outcome === "merged" ? "https://github.com/acme/backend/pull/312" : undefined,
        createdAt: new Date(fix.at),
      },
    });

    const seedIssue = SEED_ISSUE_RECORDS.find((i) => i.fixId === fix.id);
    if (seedIssue) {
      const failure: NormalizedFailure = {
        platform: "github",
        repo: fix.repo,
        branch: fix.branch,
        commitSha: "",
        runId: "",
        logsUrl: "",
        prNumber: null,
        triggeredAt: fix.at,
      };
      const full = generateIssueRecordMarkdown(
        created.id,
        failure,
        { rootCause: fix.rootCause, explanation: fix.rootCause, likelyFiles: fix.files },
        diffToText(fix.diff),
        seedIssue.status,
        fix.confidence,
        fix.ticket,
      );
      await prisma.issueRecord.upsert({
        where: { fixId: created.id },
        update: {},
        create: {
          fixId: created.id,
          slug: seedIssue.slug,
          path: seedIssue.path,
          repoLabel: seedIssue.repo,
          branch: seedIssue.branch,
          title: full.title,
          status: seedIssue.status,
          confidence: fix.confidence,
          ticketId: fix.ticket,
          summary: seedIssue.summary,
          diagnosis: seedIssue.diagnosis,
          markdown: full.markdown,
        },
      });
    }
  }

  const existingAudit = await prisma.auditEntry.findFirst({ where: { organizationId: org.id, fixId: 247 } });
  if (!existingAudit) {
    for (let i = 0; i < SEED_AUDIT_FIX_247.length; i++) {
      const row = SEED_AUDIT_FIX_247[i]!;
      await prisma.auditEntry.create({
        data: {
          organizationId: org.id,
          fixId: 247,
          action: row.action,
          actor: row.actor,
          outcome: row.outcome,
          at: new Date(AUDIT_TIMES_FIX_247[i] ?? "2026-07-20T03:41:00Z"),
        },
      });
    }
  }

  console.log(`Seed complete. Organization: ${org.name} (${org.id}).`);
  console.log(`Live test repo seeded: Khushalsarode/stitch-test-flow-repo (project: Stitch Live Test)`);
  console.log("Demo logins (password demo1234 for all): demo@stitch.dev (Admin), tara@stitch.dev (Developer),");
  console.log("  maya@stitch.dev (Product Owner), james@stitch.dev (Release Manager), alex@stitch.dev (SRE),");
  console.log("  compliance@stitch.dev (Security & Compliance)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
