export type PermissionKey =
  | "manage_integrations"
  | "manage_response_rules"
  | "approve_autopilot"
  | "revert_fix"
  | "manage_billing"
  | "manage_team"
  | "view_audit_trail"
  | "export_data";

export type PermissionSet = Record<PermissionKey, boolean>;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_integrations: "Manage integrations & ticketing",
  manage_response_rules: "Change response modes / branch rules",
  approve_autopilot: "Approve Autopilot fixes",
  revert_fix: "Revert a merged fix",
  manage_billing: "Manage billing",
  manage_team: "Manage team & roles",
  view_audit_trail: "View Audit Trail",
  export_data: "Export workspace data",
};

export const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];
