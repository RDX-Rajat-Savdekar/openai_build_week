/** Built-in role colors — matches Roles & permissions page swatches. */
export const BUILTIN_ROLE_COLORS: Record<string, string> = {
  Admin: "#4a3aa7",
  "Product Owner": "#0f8f4f",
  "Release Manager": "#a8710a",
  SRE: "#2a78d6",
  Developer: "#6153e0",
  "Security & Compliance": "#c0392b",
  "Billing Manager": "#898781",
  Viewer: "#52514e",
};

export const DEFAULT_INVITE_ROLE = "Developer";

/** Fallback before /api/roles loads — keep in sync with src/permissions.ts BUILTIN_ROLE_ORDER. */
export const BUILTIN_ROLE_NAMES = [
  "Admin",
  "Product Owner",
  "Release Manager",
  "SRE",
  "Developer",
  "Security & Compliance",
  "Billing Manager",
  "Viewer",
] as const;
