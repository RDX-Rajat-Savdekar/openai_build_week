const BRAND_COLORS: Record<string, string> = {
  github: "181717",
  gitlab: "FC6D26",
  circleci: "343434",
  jenkins: "D24939",
  bitbucket: "0052CC",
  slack: "4A154B",
  email: "4a3aa7",
  linear: "5E6AD2",
  jira: "0052CC",
  asana: "F06A6A",
  discord: "5865F2",
  teams: "6264A7",
};

const INTEGRATION_KEYS: Record<string, string> = {
  github: "github",
  gitlab: "gitlab",
  circleci: "circleci",
  jenkins: "jenkins",
  bitbucket: "bitbucket",
  slack: "slack",
  linear: "linear",
  jira: "jira",
  asana: "asana",
  github_issues: "github",
};

export function brandIconUrl(key: string, color?: string): string {
  const slug = INTEGRATION_KEYS[key] ?? key;
  const c = color ?? BRAND_COLORS[slug] ?? "4a3aa7";
  return `https://cdn.simpleicons.org/${slug}/${c}`;
}
