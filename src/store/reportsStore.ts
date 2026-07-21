import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { getOrganization, updatePreferences } from "./appStore.js";

export interface StoredReport {
  id: string;
  type: "incident" | "digest" | "changelog";
  title: string;
  createdAt: string;
  fixId?: number;
  periodStart?: string;
  periodEnd?: string;
  markdown: string;
  shareToken?: string;
  sharedAt?: string;
}

const MAX_STORED = 50;

function readStored(prefs: Record<string, unknown>): StoredReport[] {
  const raw = prefs.storedReports;
  return Array.isArray(raw) ? (raw as StoredReport[]) : [];
}

export async function listStoredReports(organizationId: string): Promise<StoredReport[]> {
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  return readStored(prefs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function storeReport(
  organizationId: string,
  input: {
    type: StoredReport["type"];
    title: string;
    markdown: string;
    fixId?: number;
    periodStart?: string;
    periodEnd?: string;
  },
): Promise<StoredReport> {
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const reports = readStored(prefs);
  const entry: StoredReport = {
    id: randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    ...input,
  };
  await updatePreferences(organizationId, { storedReports: [entry, ...reports].slice(0, MAX_STORED) });
  return entry;
}

export async function deleteStoredReport(organizationId: string, id: string): Promise<boolean> {
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const reports = readStored(prefs);
  const next = reports.filter((r) => r.id !== id);
  if (next.length === reports.length) return false;
  await updatePreferences(organizationId, { storedReports: next });
  return true;
}

export async function shareStoredReport(organizationId: string, id: string): Promise<StoredReport | null> {
  const org = await getOrganization(organizationId);
  const prefs = (org.preferences as Record<string, unknown>) ?? {};
  const reports = readStored(prefs);
  const idx = reports.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const token = reports[idx]!.shareToken ?? randomBytes(16).toString("hex");
  const updated: StoredReport = {
    ...reports[idx]!,
    shareToken: token,
    sharedAt: new Date().toISOString(),
  };
  reports[idx] = updated;
  await updatePreferences(organizationId, { storedReports: reports });
  return updated;
}

export async function findReportByShareToken(token: string): Promise<{ organizationId: string; report: StoredReport } | null> {
  const orgs = await prisma.organization.findMany({ select: { id: true, preferences: true } });
  for (const org of orgs) {
    const prefs = (org.preferences as Record<string, unknown>) ?? {};
    const hit = readStored(prefs).find((r) => r.shareToken === token);
    if (hit) return { organizationId: org.id, report: hit };
  }
  return null;
}

export async function getStoredReport(organizationId: string, id: string): Promise<StoredReport | null> {
  const reports = await listStoredReports(organizationId);
  return reports.find((r) => r.id === id) ?? null;
}
