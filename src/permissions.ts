export type PermissionKey =
  | "manage_integrations"
  | "manage_response_rules"
  | "approve_autopilot"
  | "revert_fix"
  | "manage_billing"
  | "manage_team"
  | "view_audit_trail"
  | "export_data";

export const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: "manage_integrations", label: "Manage integrations & ticketing" },
  { key: "manage_response_rules", label: "Change response modes / branch rules" },
  { key: "approve_autopilot", label: "Approve Autopilot fixes" },
  { key: "revert_fix", label: "Revert a merged fix" },
  { key: "manage_billing", label: "Manage billing" },
  { key: "manage_team", label: "Manage team & roles" },
  { key: "view_audit_trail", label: "View Audit Trail" },
  { key: "export_data", label: "Export workspace data" },
];

export type PermissionSet = Record<PermissionKey, boolean>;

export interface RoleDefinition {
  name: string;
  permissions: PermissionSet;
  custom: boolean;
  color?: string;
  description?: string;
}

function perms(keys: PermissionKey[]): PermissionSet {
  const all = PERMISSIONS.map((p) => p.key);
  return Object.fromEntries(all.map((k) => [k, keys.includes(k)])) as PermissionSet;
}

/** Stable display order on Roles & permissions and team invite pickers. */
export const BUILTIN_ROLE_ORDER = [
  "Admin",
  "Product Owner",
  "Release Manager",
  "SRE",
  "Developer",
  "Security & Compliance",
  "Billing Manager",
  "Viewer",
] as const;

/**
 * Built-in roles for a real CI/automation team. Admin is always all-permissioned
 * (hardcoded in roleHasPermission). Others are editable per-org but can't be deleted.
 */
export const BUILTIN_ROLES: Record<string, RoleDefinition> = {
  Admin: {
    name: "Admin",
    custom: false,
    description: "Full workspace control — billing, security, team, and every integration.",
    permissions: perms(PERMISSIONS.map((p) => p.key)),
  },
  "Product Owner": {
    name: "Product Owner",
    custom: false,
    description: "Business owner — approve Autopilot fixes before they ship, review audit trail, export reports.",
    permissions: perms(["approve_autopilot", "view_audit_trail", "export_data"]),
  },
  "Release Manager": {
    name: "Release Manager",
    custom: false,
    description: "Owns the release train — branch rules, Autopilot approvals, reverts, and CI integrations.",
    permissions: perms([
      "manage_integrations",
      "manage_response_rules",
      "approve_autopilot",
      "revert_fix",
      "view_audit_trail",
    ]),
  },
  SRE: {
    name: "SRE",
    custom: false,
    description: "Platform engineer — connect CI/CD, tune response modes, revert bad deploys, read audit trail.",
    permissions: perms(["manage_integrations", "manage_response_rules", "revert_fix", "view_audit_trail"]),
  },
  Developer: {
    name: "Developer",
    custom: false,
    description: "Day-to-day engineer — approve and revert fixes on their repos, view audit trail.",
    permissions: perms(["approve_autopilot", "revert_fix", "view_audit_trail"]),
  },
  "Security & Compliance": {
    name: "Security & Compliance",
    custom: false,
    description: "Read-only oversight — audit trail and workspace exports for compliance reviews.",
    permissions: perms(["view_audit_trail", "export_data"]),
  },
  "Billing Manager": {
    name: "Billing Manager",
    custom: false,
    description: "Finance ops — manage plan & usage billing, view audit trail for chargebacks.",
    permissions: perms(["manage_billing", "view_audit_trail"]),
  },
  Viewer: {
    name: "Viewer",
    custom: false,
    description: "Read-only — audit trail visibility without changing anything.",
    permissions: perms(["view_audit_trail"]),
  },
};

export const DEFAULT_ROLE_NAME = "Developer";

export function resolveRoles(orgRoles: Record<string, RoleDefinition> | undefined): Record<string, RoleDefinition> {
  const result: Record<string, RoleDefinition> = { ...BUILTIN_ROLES };
  if (!orgRoles) return result;

  for (const [name, override] of Object.entries(orgRoles)) {
    const base = BUILTIN_ROLES[name];
    if (base) {
      result[name] = {
        ...base,
        ...override,
        name,
        custom: false,
        description: override.description ?? base.description,
      };
    } else {
      result[name] = { ...override, name, custom: override.custom ?? true };
    }
  }
  return result;
}

export function sortRoles(roles: RoleDefinition[]): RoleDefinition[] {
  const order = new Map(BUILTIN_ROLE_ORDER.map((name, i) => [name, i]));
  return [...roles].sort((a, b) => {
    const ai = order.get(a.name as (typeof BUILTIN_ROLE_ORDER)[number]);
    const bi = order.get(b.name as (typeof BUILTIN_ROLE_ORDER)[number]);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    if (a.custom !== b.custom) return a.custom ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function roleHasPermission(orgRoles: Record<string, RoleDefinition> | undefined, roleName: string, permission: PermissionKey): boolean {
  const roles = resolveRoles(orgRoles);
  if (roleName === "Admin") return true;
  return Boolean(roles[roleName]?.permissions[permission]);
}

export function getUserPermissions(orgRoles: Record<string, RoleDefinition> | undefined, roleName: string): PermissionSet {
  if (roleName === "Admin") return perms(PERMISSIONS.map((p) => p.key));
  const roles = resolveRoles(orgRoles);
  const role = roles[roleName];
  if (!role) return perms([]);
  return { ...role.permissions };
}
