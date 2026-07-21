import type { PermissionKey } from "./permissions";

export type SectionAccessRule = PermissionKey | "admin" | "any";

/** Maps Settings nav section ids to the permission required to view them. */
export const SETTINGS_SECTION_ACCESS: Record<string, SectionAccessRule> = {
  models: "manage_integrations",
  response: "manage_response_rules",
  branches: "manage_response_rules",
  rollback: "manage_response_rules",
  integrations: "manage_integrations",
  repos: "manage_response_rules",
  ticketing: "manage_integrations",
  notifications: "manage_integrations",
  docs: "manage_response_rules",
  prs: "manage_response_rules",
  team: "any",
  security: "any",
  billing: "manage_billing",
  apikey: "any",
  danger: "any",
};

export function canViewSettingsSection(
  sectionId: string,
  can: (key: PermissionKey) => boolean,
  isAdmin: boolean,
): boolean {
  if (sectionId === "danger") return isAdmin || can("export_data");
  const rule = SETTINGS_SECTION_ACCESS[sectionId] ?? "any";
  if (rule === "any") return true;
  if (rule === "admin") return isAdmin;
  return can(rule);
}

export function canEditSettingsSection(
  sectionId: string,
  can: (key: PermissionKey) => boolean,
  isAdmin: boolean,
): boolean {
  if (sectionId === "security" || sectionId === "apikey") return isAdmin;
  if (sectionId === "team") return can("manage_team");
  const rule = SETTINGS_SECTION_ACCESS[sectionId] ?? "any";
  if (rule === "admin") return isAdmin;
  if (rule === "any") return true;
  return can(rule);
}
