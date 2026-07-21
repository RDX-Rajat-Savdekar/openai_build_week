/**
 * Fix validator — MVP gate before openPr/comment (plan section 3 / 10).
 * Full test-runner validation is post-MVP; this checks diff shape + size.
 */
export interface ValidationResult {
  ok: boolean;
  error?: string;
  checks: string[];
}

export function validateFix(diff: string, maxLines = 500): ValidationResult {
  const checks: string[] = [];
  const trimmed = diff.trim();

  if (!trimmed) {
    return { ok: false, error: "Empty diff", checks };
  }
  checks.push("non-empty");

  if (!trimmed.includes("---") || !trimmed.includes("+++")) {
    return { ok: false, error: "Not a unified diff (missing ---/+++ headers)", checks };
  }
  checks.push("unified-diff-headers");

  const lines = trimmed.split("\n").length;
  if (lines > maxLines) {
    return { ok: false, error: `Diff exceeds ${maxLines} lines`, checks };
  }
  checks.push(`line-count-${lines}`);

  const hasChange = trimmed
    .split("\n")
    .some((l) => (l.startsWith("+") && !l.startsWith("+++")) || (l.startsWith("-") && !l.startsWith("---")));
  if (!hasChange) {
    return { ok: false, error: "Diff has no additions or deletions", checks };
  }
  checks.push("has-hunks");

  return { ok: true, checks };
}
