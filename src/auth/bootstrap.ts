import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "workspace";
}

type Tx = Prisma.TransactionClient;

async function uniqueOrgSlug(baseName: string, tx: Tx = prisma): Promise<string> {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let n = 2;
  while (await tx.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }
  return slug;
}

export async function bootstrapOrganization(
  tx: Tx,
  orgName: string,
  user: {
    email: string;
    name: string;
    role: string;
    passwordHash?: string | null;
    githubId?: string;
    githubUsername?: string;
    githubAccessToken?: string;
  },
) {
  const slug = await uniqueOrgSlug(orgName, tx);
  const created = await tx.organization.create({ data: { name: orgName, slug, plan: "Free" } });
  await tx.user.create({
    data: {
      email: user.email,
      passwordHash: user.passwordHash ?? null,
      name: user.name,
      role: user.role,
      organizationId: created.id,
      githubId: user.githubId ?? null,
      githubUsername: user.githubUsername ?? null,
      githubAccessToken: user.githubAccessToken ?? null,
    },
  });
  await tx.aiUsage.create({ data: { organizationId: created.id } });
  await tx.project.create({
    data: {
      organizationId: created.id,
      name: "General",
      slug: "general",
      description: "Default project — add your repos here.",
      defaultMode: "Diagnose & suggest",
    },
  });
  await tx.project.create({
    data: {
      organizationId: created.id,
      name: "Unassigned",
      slug: "unassigned",
      description: "Repos not yet assigned to a project.",
      defaultMode: "Notify only",
    },
  });
  for (const key of ["github", "gitlab", "circleci", "jenkins", "bitbucket"]) {
    await tx.integration.create({ data: { organizationId: created.id, key, connected: false, config: {} } });
  }
  for (const key of ["slack", "email"]) {
    await tx.notificationChannelConfig.create({ data: { organizationId: created.id, key, enabled: false, config: {} } });
  }
  return created;
}

export async function joinOrganizationViaInvite(
  invite: { id: string; organizationId: string; role: string; email: string | null },
  user: {
    email: string;
    name: string;
    passwordHash?: string | null;
    githubId?: string;
    githubUsername?: string;
    githubAccessToken?: string;
  },
) {
  if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error(`INVITE_EMAIL_MISMATCH:${invite.email}`);
  }

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) {
    if (existing.organizationId === invite.organizationId) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          githubId: user.githubId ?? existing.githubId,
          githubUsername: user.githubUsername ?? existing.githubUsername,
          githubAccessToken: user.githubAccessToken ?? existing.githubAccessToken,
        },
        include: { organization: true },
      });
      const { markInviteUsed } = await import("../store/appStore.js");
      await markInviteUsed(invite.id);
      return updated;
    }
    throw new Error("ACCOUNT_EXISTS");
  }

  await prisma.user.create({
    data: {
      email: user.email,
      passwordHash: user.passwordHash ?? null,
      name: user.name,
      role: invite.role,
      organizationId: invite.organizationId,
      githubId: user.githubId ?? null,
      githubUsername: user.githubUsername ?? null,
      githubAccessToken: user.githubAccessToken ?? null,
    },
  });

  const { markInviteUsed } = await import("../store/appStore.js");
  await markInviteUsed(invite.id);

  return prisma.user.findUniqueOrThrow({ where: { email: user.email }, include: { organization: true } });
}
