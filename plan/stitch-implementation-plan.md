# Stitch — implementation plan

Status (updated 2026-07-21): webhook/plugin/notify backend, the full diagnose -> generateFix -> validateFix -> PR pipeline, and the real `frontend/` React SPA are all built and verified end-to-end. The legacy `public/` vanilla-JS dashboard has been removed — `frontend/` is the only UI. See section 14 for the current build-status breakdown (now stale in places — treat this line and the jornal.md entry for 2026-07-21 as authoritative over section 14's older wording).
Deadline: 2026-07-21, 5:00 PM PT.

This plan is deliberately time-boxed. It exists to get one reliable end-to-end slice built, demoed, and submitted — not to spec the full product vision. Anything not in the MVP section is a stretch goal, documented so it isn't lost, not a commitment.

---

## 1. Product summary

CI fails. A webhook fires. Stitch fetches the failing logs, asks GPT-5.6 to diagnose the root cause, clones the repository and reads the implicated files, asks Codex to write a fix, validates the fix, and opens a pull request with the diagnosis, the diff, and test evidence attached. A Slack message announces it. No human has to notice the failure to start this loop — that's the entire differentiator over "paste your logs into ChatGPT."

## 2. Why this is not a console session

- **Trigger is autonomous.** The pipeline starts on a webhook event, not on a person opening a chat window.
- **Context is the real repository**, cloned fresh, not a snippet a human chose to paste.
- **Behavior depends on where the failure happened** (branch-aware routing, section 4) — a judgment call a generic chat session doesn't make on its own.
- **Output is an artifact a reviewer can act on** — a PR with a diff and evidence, not a chat transcript.

## 3. Architecture

```
Webhook Receiver (Express)
        |
Plugin Registry / Platform Normalizer
        -> GitHub (full) | GitLab | CircleCI | Jenkins | Bitbucket (interface-complete, stubbed)
        -> unified failure object
        |
Branch Router                -> behavior config keyed on branch pattern
        |
Log Fetcher + Parser          -> pulls full CI logs via platform API, strips noise
        |
GPT-5.6 Diagnosis Engine      -> reads logs, identifies root cause, plain-English summary + file hints
        |
Codebase Reader               -> shallow-clones repo, reads files implicated by the diagnosis
        |
Codex Fix Generator           -> writes a patch with real repo context
        |
Fix Validator                 -> applies patch, runs tests/lint/syntax check
        |
PR Creator                    -> opens PR (or comment, per branch router): diagnosis + diff + test evidence
        |
Notification Dispatcher       -> Slack + Email (both plugin-style channels, section 6)
```

Each stage is a separate module with a typed input/output so it can be unit-tested without hitting a live webhook or a live model call.

### 3.1 Unified failure object (platform normalizer output)

```json
{
  "platform": "github",
  "repo": "org/name",
  "branch": "main",
  "commitSha": "abc123",
  "workflowRunId": "1234567",
  "conclusion": "failure",
  "logsUrl": "https://api.github.com/.../logs",
  "prNumber": null,
  "triggeredAt": "2026-07-20T18:04:00Z"
}
```

Every downstream stage consumes this shape, not a platform-specific payload. That's what makes GitLab a config/adapter addition later rather than a rewrite.

### 3.2 Branch router output (behavior config)

```json
{
  "mode": "aggressive" | "conservative" | "comment-only" | "auto-merge" | "hotfix",
  "autoFix": true,
  "openPr": true,
  "autoMerge": false,
  "requireHumanReview": false,
  "notify": ["slack", "email"],
  "urgent": false
}
```

## 4. Branch-aware behavior

| Branch pattern | Mode | Behavior |
|---|---|---|
| `main` / `master` | aggressive | auto-fix + auto-PR + Slack alert |
| `release/*` | conservative | diagnose only + human-review PR + urgent alert |
| `feature/*` | comment-only | comment on the existing PR with diagnosis + suggested fix |
| `dev` / `staging` | auto-merge | full auto-fix + auto-merge if tests pass |
| `hotfix/*` | hotfix | fastest path: fix + PR + tag reviewer immediately |

**MVP builds and demos `main` (aggressive) and `feature/*` (comment-only) only** — that pair is enough to prove the router is real branch-aware logic, not a hardcoded path, without building and testing all five modes under deadline pressure. The other three rows are config the router already supports structurally; wiring their demo repos is a stretch goal.

## 5. Platform support — plugin model

Every CI/CD provider is a **plugin** implementing one shared interface (`CiCdPlugin` — section 5.1), registered in `src/platforms/registry.ts`. This is what lets the product be pitched and used SaaS-style: a workspace "connects" a provider (a token/webhook secret lands in config), it shows up as an enabled integration, and the rest of the pipeline (branch router, diagnosis, fix, PR/comment, notify) doesn't care which provider fired the event. Decision: **code all five now**; GitHub is the one that's fully wired end-to-end and used for the recorded demo, because it's the only one we can test live against a real repo before the deadline. The rest are structurally complete (real method signatures, real config entries, show up in the Integrations list) with their provider-specific API calls marked as explicit TODOs rather than faked.

| Platform | Trigger | Plugin coded | Live-tested / demo |
|---|---|---|---|
| GitHub Actions | `workflow_run` completed=failure | **Yes — full** | **Yes — MVP demo platform** |
| GitLab CI | Pipeline Hook, status=failed | Yes — interface + stub API calls | Not before deadline |
| CircleCI | `workflow-completed` failed | Yes — interface + stub API calls | Not before deadline |
| Jenkins | generic webhook | Yes — interface + stub API calls | Not before deadline |
| Bitbucket Pipelines | `repo:push` + status | Yes — interface + stub API calls | Not before deadline |
| Linear / Jira / Asana / GitHub Issues (ticketing) | — | Not a CI/CD plugin — separate `TicketingProvider` model, see section 8.8 | — |

### 5.1 `CiCdPlugin` interface

```ts
interface CiCdPlugin {
  key: "github" | "gitlab" | "circleci" | "jenkins" | "bitbucket";
  displayName: string;
  connected: boolean;                          // true if required config/secrets are present
  verifyWebhook(req: IncomingRequest): boolean; // signature/secret check
  normalize(payload: unknown): NormalizedFailure | null; // null = not a failure event, ignore
  fetchLogs(failure: NormalizedFailure): Promise<string>;
  fetchFileContents(failure: NormalizedFailure, paths: string[]): Promise<Record<string, string>>;
  openPr(failure: NormalizedFailure, diagnosis: Diagnosis, diff: string): Promise<{ url: string }>;
  commentOnExisting(failure: NormalizedFailure, diagnosis: Diagnosis, diff: string): Promise<{ url: string }>;
}
```

Adding a sixth provider later (Jenkins variants, Azure DevOps, etc.) is "implement this interface and register it" — not a change to any other layer. That property is the actual point of the plugin model, and it's what makes the "add all CI/CD plugins" ask tractable inside a one-day build instead of five separate one-off integrations.

## 6. Notification channels — same plugin model

Notifications follow the identical pattern as CI/CD providers: a shared `NotificationChannel` interface, a registry, and per-channel config that determines whether it's "connected."

```ts
interface NotificationChannel {
  key: "slack" | "email";
  displayName: string;
  enabled: boolean;                              // from config/workspace notification preferences
  send(event: NotificationEvent): Promise<void>;
}

interface NotificationEvent {
  type: "fix_opened" | "comment_posted" | "diagnosis_failed" | "urgent_release_failure";
  repo: string;
  branch: string;
  summary: string;      // one-line, e.g. "Fixed: null pointer in auth.js"
  url: string;           // PR or comment link
  urgent: boolean;       // true for release/* per the branch router
}
```

- **Slack** — incoming webhook URL (`SLACK_WEBHOOK_URL`), posts the one-line summary + link. Fully implemented; this is the one demoed live.
- **Email** — SMTP via `nodemailer` (`EMAIL_SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `EMAIL_TO`), same event shape rendered as a short HTML message. Fully implemented and testable with any SMTP provider (including a free-tier transactional provider) since it doesn't depend on a third-party CI platform being live.
- Both channels dispatch from the same `notify()` call in `src/notify/index.ts` — a workspace can enable either, both, or neither per the (planned) notification-preferences screen in section 7.3.

## 7. Tech stack

- **Node.js + TypeScript + Express** — webhook receiver. Fastest path to a working endpoint; native Octokit support for GitHub.
- **Octokit** — GitHub API: fetch workflow run logs, read repo contents, open PRs, post PR comments.
- **Provider SDKs (stubbed for now)** — `@gitbeaker` (GitLab), CircleCI/Jenkins/Bitbucket REST clients — wired behind the plugin interface, real calls added as each is tested.
- **OpenAI SDK** — GPT-5.6 for the diagnosis engine (read-only, explanation-producing), Codex for the fix generator (write-producing). Kept as two distinct calls/modules, not merged, so the demo can narrate "this is diagnosis, this is the fix" clearly and each is independently testable.
- **simple-git** — shallow clone, apply patch, diff.
- **nodemailer** — email notification channel (SMTP, provider-agnostic).
- **dotenv** — all provider tokens/secrets and notification config, see `.env.example`.
- **ngrok** — local tunnel so the demo GitHub webhook can reach a laptop during recording.

## 8. SaaS product structure

The backend is provider-agnostic by construction (section 5-6). The product framing on top of it is a small SaaS shape: a **workspace** connects CI/CD providers and notification channels once, then every repo under those connections gets autonomous fixes without further setup. This section documents the intended screens so the UI can be built directly from this spec later — for the deadline, the equivalent configuration lives in `.env` / a JSON config file, and the pipeline code doesn't need to change when the UI lands on top of it.

### 8.1 Workspace model

```json
{
  "workspaceId": "ws_demo",
  "connectedPlatforms": ["github"],
  "notificationChannels": { "slack": true, "email": false },
  "repos": [
    { "platform": "github", "fullName": "org/demo-repo", "branchPolicy": "default" }
  ]
}
```

`branchPolicy: "default"` uses the table in section 4; a repo can override individual branch patterns later (not needed for the MVP demo).

### 8.2 Screen: Integrations ("Connect")

One card per `CiCdPlugin` (section 5), showing: provider logo/name, connection status (`Connected` / `Not connected`), a **Connect** button (opens the provider's OAuth flow or a token-entry form, depending on provider), and — once connected — the list of repos visible under that connection with a per-repo enable/disable toggle. This is a direct UI over the plugin registry: the registry is already the source of truth for "which providers exist and are they connected," so this screen has almost no logic of its own beyond rendering that list and handling the connect callback.

### 8.3 Screen: Notifications

Two rows — **Slack** (webhook URL field, test-message button) and **Email** (recipient address, test-message button) — each with an enable/disable toggle, mapping directly onto `NotificationChannel.enabled` (section 6). A workspace can turn either, both, or neither on.

### 8.4 Screen: Activity / Fix history

A feed of `NotificationEvent`s already being generated for Slack/email (section 6) — repo, branch, what broke, what changed, link to the PR/comment, timestamp. This is a read view over data the pipeline already produces; no new backend logic, just persistence and a list page. Out of scope for the MVP demo, first UI item to add once the Integrations page exists.

### 8.5 Build status

1. ✅ Integrations page, wired to `registry.ts` via `GET /api/integrations` — real data, not a mock.
2. ✅ Connect flow — generic across all five plugins (`POST /api/integrations/:key/connect`, driven by `platforms/connectFields.ts` so the form shape isn't hardcoded per provider). Backed by an in-memory runtime-config layer (`config/env.ts`, `updateEnvSection`) so connecting actually flips `isConnected()` live, no restart.
3. ✅ Notifications page — Slack + Email, both fully functional, plus a "Send test" action (`POST /api/notifications/:key/test`) that bypasses the workspace toggle so a channel can be verified before being turned on.
4. ✅ Activity feed — `GET /api/activity`, populated by every real and test notification dispatch (`notify/activityLog.ts`).
5. Not done: persistence (everything above resets on server restart — see the tradeoff note in `config/env.ts`), and a real multi-tenant workspace/auth layer. Both are explicitly out of scope for a single-workspace hackathon demo.

Originally served from `public/` as static HTML/CSS/vanilla JS. **Update, 2026-07-21: `public/` has been removed.** This functionality now lives in `frontend/` (the real React SPA — see section 14), served from `frontend/dist` by the same Express process in production, or via Vite dev server with an API proxy in development.

### 8.6 Issue records, rollback, and branch-scoped views

Documented and shown in the full product mockup (`plan/stitch-project-dashboard.html`) as of 2026-07-20. **Update, 2026-07-21: this is now built.** Issue Records render real markdown files generated per fix (`src/issues/issueRecord.ts`, `GET /api/issues`, `frontend/src/pages/app/IssueRecordsPage.tsx`); rollback/revert is real (`POST /api/fixes/:id/revert`, `appStore.revertFix` — gated to fixes with `outcome === "merged"`); branch-scoped filtering exists in the Fix Log page. The spec below is kept as the original design record.

**Issue records.** Every fix attempt writes one markdown file, `.stitch/issues/<id>-<slug>.md`, committed into the target repo alongside the fix itself (not just stored in Stitch's own database). Content mirrors the Fix Log card: summary, GPT-5.6 diagnosis, confidence score + why, the Codex diff, a timeline, and (once merged) the outcome. The point is durability and portability — the record survives even if a team disconnects the integration later, and it's greppable/diffable/searchable with tools the team already has, not locked behind a dashboard login. The mockup's **Issue records** page is a two-pane browser over these files (file list + rendered preview) — a thin read view, same pattern as Integrations being a thin view over the plugin registry (section 8.2).

```ts
interface IssueRecord {
  id: number;
  slug: string;                 // "jwt-secret-null-reference"
  path: string;                 // ".stitch/issues/247-jwt-secret-null-reference.md"
  repo: string;
  branch: string;
  status: "open" | "merged" | "pending_review" | "escalated" | "reverted";
  confidence: number;
  ticketId?: string;             // set once a ticketing provider creates one — section 8.8
}
```

`generateIssueRecord(failure, diagnosis, diff, outcome): string` would render this to markdown and commit it in the same PR/commit as the fix — one new module (`src/issues/generateRecord.ts`), no change to any existing plugin or the branch router.

**Rollback / revert.** A merged fix can be reverted from the dashboard with one click instead of a manual `git revert`. Mechanically: `plugin.revertPr` (a new, sixth method on `CiCdPlugin` — section 5.1) opens a revert commit/PR against the same branch, referencing the original fix's commit SHA (already recorded in the `NormalizedFailure`/Issue Record). The Issue Record is updated in place to `status: "reverted"` rather than deleted, so the history stays intact — matches the mockup's Fix #239 example. Adds one `NotificationEvent` type, `fix_reverted`, and one audit-trail action kind.

**Branch-scoped views.** Repo and branch are kept as two separate dimensions on purpose — the same repo can have wildly different behavior on `main` vs. `feature/*` (section 4), so aggregating everything to "per repo" hides that. Concretely: a branch filter on the Fix Log (filters the same `NotificationEvent`/activity data already collected, no new backend), and a "branch activity" aggregation grouped by which `branchRouter` pattern matched, not by repo. Both are read views over data the pipeline already produces once activity logging is persisted (section 8.5, item 5).

**Dashboard widgets shown in the mockup that would need a real data source if built:** a 7-day weekly-activity chart and a "needs your attention" queue are both aggregations over the activity log (section 8.5) — no new collection needed once persistence exists. The Codex/GPT-5.6 usage-and-cost widget is the one exception — it needs real OpenAI usage-API integration, which nothing today provides; treat it as its own follow-up, not a byproduct of anything already built.

### 8.7 Full settings surface

The mockup's Settings page (`plan/stitch-project-dashboard.html`) now covers every screen the product needs, not just Integrations/Notifications. Fifteen sections, in the order they appear. **Update, 2026-07-21:** every section below is now a real, rendered page in `frontend/src/pages/app/SettingsPage.tsx` — "Mockup only" in this table should now be read as "renders in `frontend/`, still demo data, not API-backed" rather than "doesn't exist as UI." The AI models & API keys section specifically is now fully real (`GET/POST /api/settings`, `/api/settings/openai`) — no longer partial.

| Screen | Status | Note |
|---|---|---|
| **AI models & API keys** | Real | Now fully wired: `GET/POST /api/settings`, `/api/settings/openai`, `/api/settings/openai/disconnect`, `/api/settings/openai/test`, backed by `src/config/env.ts`'s `setOpenAiKey`/`setOpenAiModels`. |
| Response behavior | Real (Default mode, Confidence floor); recorded only (auto-merge delay, required approvers, max PRs/hour, working hours) | `GET/POST /api/settings/response-behavior` — Default mode and Confidence floor genuinely drive `routeBranch()`/escalation; the rest need a queue/scheduler this pass doesn't add. See section 8.14. |
| Branch rules | **Real** | `GET/POST /api/settings/branch-rules` — this list *is* the pipeline's branch-routing rule set once saved, full parity with the built-in defaults it replaces. See section 8.14. |
| Rollback & safety | **Real** | `GET/POST /api/settings/rollback` — who-can-revert and revert-requires-reason are enforced on every revert call; auto-revert-on-repeat-failure is a real, working pipeline feature now. See section 8.14. |
| Integrations | Real (`frontend/`) | Already built — see section 8.5. CI/CD providers only now; ticketing moved to its own section below. GitHub also has real OAuth login (section 8.11) and a "Sync repos now" live-fetch action (section 8.12). |
| **Repositories** | **Real** | Per-repo Mode and Enabled are both now wired to `PATCH /api/repos/:name` and genuinely affect the pipeline as a fallback when no branch rule matches. See section 8.14. |
| **Ticketing** | Real (Jira), mockup (Linear/Asana/GitHub Issues) | Jira connect/disconnect/test + automation rules are fully real — section 8.13. Linear/Asana/GitHub Issues remain as speced in section 8.8, not wired. |
| Notifications | Real (Slack/Email), mockup (Discord/Teams/PagerDuty/custom webhook) | See section 8.5 for what's real. |
| Documentation | Real (Write Fix log to repo); recorded only (everything else) | `GET/POST /api/settings/documentation` — "Write Fix log to repo" genuinely commits the Issue Record markdown into the same branch as the PR; changelog/incident-reports/digest/retention have no generator/scheduler/pruning job behind them yet. See section 8.14. |
| Pull requests | **Real** | `GET/POST /api/settings/pull-requests` — Open as draft/ready, labels, and include-diagnosis-in-body all apply to the real GitHub PR `openPr()` opens. Required approvers is recorded only (needs GitHub branch-protection API access this pass doesn't add). See section 8.14. |
| **Team & access** | **Real** | Real email-free invite links (`Invite` table + `/api/team/*`), role change, member removal, all Admin-gated. See section 8.15. Full RBAC *enforcement* on every route remains roadmap 16.1. |
| Security | Real (Require-approval-on-main, Session timeout); recorded only (IP allowlist); roadmap (2FA) | `GET/POST /api/settings/security` — the first two are enforced in the pipeline and at session-creation time respectively; IP allowlist has no request-time check yet. See section 8.14. |
| Plan & billing | Mockup only | Roadmap 16.6, labeled "Illustrative" in the mockup — no pricing model has actually been decided; needs a real payment processor, deliberately out of scope. |
| API key | Real | Regenerate/preview are real (`GET /api/settings/api-key`, `POST /api/settings/api-key/regenerate`) — section 8.10. Scoping (read-only vs. connect-integrations vs. can-revert) is still roadmap 16.1. |
| Danger zone | Real | Disconnect-all, export-all, delete-workspace all genuinely act on the database — section 8.10. |

### 8.8 Ticketing integration &amp; automation

Documented and shown in the full mockup as of 2026-07-20, same tier of detail as issue records/rollback (section 8.6); **none of this is built**. Previously this was just a disabled "Coming soon" card under Integrations — this section replaces that with an actual spec, since a CI-fix tool that can't hand off to a team's existing ticket tracker is a real gap for any team that lives in Linear/Jira, not GitHub Issues.

Ticketing is deliberately **not** a `CiCdPlugin` (section 5) and not a `NotificationChannel` (section 6) — it needs bidirectional lifecycle sync (create, then later update/close/reopen the same ticket), which neither existing interface models. It's its own small plugin family:

```ts
type TicketingKey = "linear" | "jira" | "asana" | "github_issues";

interface TicketingProvider {
  key: TicketingKey;
  displayName: string;
  isConnected(): boolean;
  createTicket(failure: NormalizedFailure, diagnosis: Diagnosis, issueRecord: IssueRecord): Promise<{ ticketId: string; url: string }>;
  updateTicketStatus(ticketId: string, status: "in_progress" | "done" | "reopened"): Promise<void>;
  linkPr(ticketId: string, prUrl: string): Promise<void>;
}
```

`github_issues` is the interesting case: it needs no separate "connect" step at all, since it reuses the already-connected GitHub token from the `CiCdPlugin` (section 5.1) — the mockup's Ticketing card for it shows an enable toggle, not a Connect button, to make that distinction visible rather than implying a second GitHub auth flow.

**Automation rules** — a small config object, same spirit as the branch router's behavior config (section 3.2):

```ts
interface TicketingAutomationConfig {
  createOn: "escalated_only" | "escalated_and_pending_review" | "every_failure";
  projectKey: string;                                              // target board/project, e.g. "ENG"
  priorityMap: { high: string; medium: string; low: string };      // confidence tier -> provider's own priority label
  autoCloseOnMerge: boolean;
  autoReopenOnRevert: boolean;
  linkTicketInPrBody: boolean;
}
```

**Lifecycle, reusing events that already exist** — ticketing hooks the same pipeline events as notifications (section 6), it just does more with them than posting a message:
- `diagnosis_failed` / an escalation (confidence below the floor, section on Response Behavior) → `createTicket()`, priority set from `priorityMap` by confidence tier.
- `comment_posted` (Fix & Propose, pending review) → `createTicket()` too, but only if `createOn` is `"escalated_and_pending_review"` or `"every_failure"`.
- `fix_opened` / merge → `updateTicketStatus(ticketId, "done")` if `autoCloseOnMerge`.
- `fix_reverted` (section 8.6) → `updateTicketStatus(ticketId, "reopened")` if `autoReopenOnRevert` — the ticket and the Issue Record end up telling the same story from two different tools, on purpose.

The ticket ID is stored on the `IssueRecord` (section 8.6) once created, so the Issue Records page, the Fix Log card, and the ticket itself all cross-link to each other — no new storage concept, one new field.

### 8.9 Multi-project support (org → projects → repos)

**Update, 2026-07-21: built and verified**, not documented-only like most of section 8. The project owner asked whether one account could hold multiple projects — the answer was yes, and it shipped the same session, scoped deliberately narrow to avoid a data-model rewrite:

```ts
interface Project {
  id: string;           // slug, e.g. "core-platform"
  name: string;
  slug: string;
  description: string;
  defaultMode: string;  // suggested response mode for repos added here
  createdAt: string;
}
```

**Design decision:** a `Project` does **not** store a list of repo ids. Each repo (`DemoRepoConfig` in `src/data/demoData.ts`, `DemoRepo` on the frontend) instead carries a `project: string` field pointing back at a project id — single source of truth, and moving a repo between projects is a one-field `PATCH /api/repos/:name`, not a two-record sync. `GET /api/projects` computes `repoCount`/`repos` by filtering the repo list at read time.

**Deliberately out of scope for this pass:** fixes, Issue Records, and the audit trail stay keyed by **repo**, not by project — threading a `project` foreign key through the whole pipeline (`runPipeline.ts`, `appStore.ts`'s fixes/issues arrays) would have been a much bigger, riskier change for a feature that's fundamentally about *organizing* repos, not about giving every fix a second identity. Only `GET /api/dashboard?project=` and `GET /api/repos?project=` actually scope by project today; the Fix Log/Issue Records/Audit Trail pages remain workspace-wide. If per-project fix history becomes a real requirement, add a derived filter (repo → project lookup, same pattern as the dashboard's `repoStatus`) before ever adding a stored `project` field to a fix record.

**Deleting a project** reassigns its repos to an auto-created `Unassigned` fallback project (created lazily on first delete) rather than orphaning them or cascading. The last remaining project and `Unassigned` itself cannot be deleted.

Real, verified surface:
- Backend: `src/store/appStore.ts` (`listProjects`/`createProject`/`updateProject`/`deleteProject`, slug collision handling), `src/api.ts` (`/api/projects` CRUD, `?project=` filters on `/api/repos` and `/api/dashboard`).
- Frontend: `frontend/src/pages/app/ProjectsPage.tsx` (grid, create/rename modals, delete-with-confirm), a **Project** column + move-control in Settings → Repositories, a project filter on the Dashboard, a projects/repos summary card on Organization, and a **Projects** sidebar nav entry.
- Verified via `npx tsc --noEmit` (both `tsconfig.json` and `frontend/tsconfig.app.json`), `npm run build`, `npx vitest run` (11/11 still passing), and a live API smoke test: list seeded projects → create a project → move a repo into it → confirm `/api/dashboard?project=` scopes correctly → delete the project → confirm the repo lands in `Unassigned` → confirm empty-name creation correctly 400s.

### 8.10 Real database + real auth (PostgreSQL, Prisma, bcrypt sessions)

**Built 2026-07-21**, at the project owner's explicit request ("set the database and make all things from login to all internal options... fully working"), with PostgreSQL already installed locally. This is the single biggest architectural change in the project's history — the in-memory `appStore` (arrays reset on every restart, one shared demo workspace for everyone) becomes real Postgres tables, and the `sessionStorage`-flag "auth" becomes real signup/login backed by bcrypt and a `Session` table.

**Schema** (`prisma/schema.prisma`): `Organization` is the tenant root; `User`/`Session`/`Project`/`Repo`/`Fix`/`IssueRecord`/`AuditEntry`/`AiUsage`/`Integration`/`NotificationChannelConfig` all carry (or derive from a parent that carries) `organizationId`. Signing up creates a brand-new, empty `Organization` in a single transaction (org + user + AI-usage row + a "General" project + disconnected placeholder rows for all 5 CI/CD integrations and both notification channels) — a fresh account is never missing a row the rest of the app expects to exist.

**Auth** (`src/auth/`): `session.ts` generates a random 32-byte token (`node:crypto` `randomBytes`), stores it in `Session` with a 30-day expiry, and sets it as an httpOnly, `SameSite=Lax` cookie (no external auth library, no JWT — a real database-backed session is simpler to reason about and revoke than a signed token for a project this size). `middleware.ts` exports `attachUser` (parses the cookie, loads the session's user + org onto `req.user`/`req.org`, never blocks) and `requireAuth` (401s if `attachUser` found nothing). `routes.ts` is `POST /auth/signup|login|logout` and `GET /auth/me`. Passwords are bcrypt-hashed (`bcryptjs`, 10 rounds — pure JS, chosen over native `bcrypt` specifically to avoid native-addon build failures on Windows dev machines, which is what this project is developed on).

**Multi-tenant wiring** (`src/server.ts`): `attachUser` runs for all of `/api/*`; `/api/auth/*` is mounted *before* `requireAuth` so signup/login/logout/`me` are reachable without a session, and everything else in `apiRouter` sits behind `requireAuth`. The GitHub webhook route no longer trusts a single global webhook secret — it normalizes the payload first (to learn the repo name), looks up which `Organization` owns that repo (`findOrganizationByRepo`), loads *that org's* stored webhook secret, and only then verifies the signature. Two different customers can now each connect their own GitHub App to the same Stitch deployment without one's webhook secret working for the other's repos.

**The one real tradeoff, stated plainly (not glossed over):** CI/CD provider credentials and the OpenAI key are stored per-organization in Postgres (`Integration.config`, `Organization.preferences.openai`), but `src/platforms/*.ts`, `src/diagnosis/diagnose.ts`, and `src/fix/generateFix.ts` were **not** rewritten to accept those values as parameters — they still read a single shared, process-global `env` object (`src/config/env.ts`), exactly as before this migration. `runPipeline.ts`'s `applyOrgConfig()` and `api.ts`'s `seedEnvForOrg()` copy the *current* organization's stored config into that global object immediately before a plugin call, OpenAI call, or test-send. This makes the values genuinely per-org in the common case, but two requests from *different* organizations arriving concurrently could race on the shared global in the gap between "copy config in" and "the call that reads it" — a real limitation for true concurrent multi-tenant safety, acceptable for this app's actual traffic shape (webhooks/simulate calls handled close to one at a time), and the correct next fix is threading config through explicitly (or `AsyncLocalStorage`) rather than a shared mutable object. Rewriting all five platform files plus the two OpenAI-calling files was the alternative — correct, but a much larger and riskier change than the value justified in this pass.

**Left as in-memory, on purpose:** the live activity feed (`notify/activityLog.ts`) and SSE broadcast (`realtime/sse.ts`) are transient "what's happening right now" views, not durable records — persisting them wasn't the ask, and they're not yet scoped per-organization either (every connected browser sees every org's live events; low-risk for a single-demo-instance hackathon submission, a real gap for a genuine multi-tenant deployment). Webhook idempotency (`isRunProcessed`) also stays a process-lifetime `Set`, not a table — it only needs to survive long enough to de-duplicate webhook retries, and the durable record of what happened is the Audit Trail, which *is* real.

**Also shipped in this pass, beyond the schema/auth core:** real repo add/remove (`POST`/`DELETE /api/repos`, previously frontend-only fakes), a real API key (SHA-256-hashed, masked preview, regenerate), a `Organization.preferences` JSON blob + `GET/PATCH /api/settings/preferences` for the many small Settings toggles that don't warrant their own table, and real danger-zone actions (disconnect-all-integrations, a genuine JSON data export, and workspace deletion that actually cascades).

**Verified:** `npx tsc --noEmit` clean (root + frontend), `npm run build` clean, `npx vitest run` 11/11. Live end-to-end smoke test: signed up a fresh account → confirmed its dashboard/projects/fixes start completely empty (genuine tenant isolation, not a shared demo view) → added a repo → ran `/api/demo/simulate` → got back a real, persisted `Fix` row scoped to that new org's id → logged out → confirmed every route 401s without a session → logged back in → confirmed data was still there → confirmed a wrong password correctly 401s → logged into the seeded `demo@stitch.dev` account and confirmed its original 4 fixes, 3 projects, and 7-entry audit trail for fix #247 were untouched by any of the new-account testing. Test data created during verification (extra orgs, extra simulated fixes, drifted `AiUsage` counters) was cleaned up afterward via targeted `DELETE`s so the seeded demo account is back to exactly its original state.

### 8.11 Real GitHub OAuth login ("Continue with GitHub")

**Built 2026-07-21**, at the project owner's explicit request to make GitHub login and data genuinely real rather than cosmetic. A standard GitHub OAuth App (not a GitHub App) was chosen deliberately: this project's data model only needs identity plus a repo/workflow read scope, not per-repo installation scoping or an installation-token exchange — a GitHub App would add real complexity (managing installation tokens, install/uninstall webhooks) with no corresponding value here.

**Deliberately kept separate from the org's CI credential.** `Integration.config` (key `"github"`) is the org-wide PAT used to drive the CI/CD pipeline (section 5.1) — that's an org-level, admin-provided secret. The new `User.githubAccessToken` is a personal, per-user OAuth token obtained via login. They must never silently overwrite each other; see the token-precedence rule in section 8.12.

**Schema** (`prisma/schema.prisma`): `User.passwordHash` becomes nullable (OAuth-only accounts have no password), plus `githubId String? @unique`, `githubUsername String?`, `githubAccessToken String?`. Additive migration, existing rows untouched.

**Flow** (`src/auth/github.ts`, two new routes on the existing `authRouter` in `src/auth/routes.ts`): `GET /auth/github` redirects to GitHub's authorize URL with a short-lived CSRF `state` cookie (or straight to `/login?error=github_not_configured` if `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` aren't set — same graceful-degradation pattern as a missing `OPENAI_API_KEY`). `GET /auth/github/callback` verifies `state`, exchanges the code, fetches the GitHub profile (`/user` + `/user/emails`), then resolves an account:
1. Existing `githubId` match → sign in as that user.
2. No `githubId` match, but GitHub reports a **verified** email matching an existing user → link onto that account (sets `githubId`/`githubUsername`/`githubAccessToken`, keeps their existing org/password).
3. Otherwise → create a brand-new Organization + User in one transaction (same shape as `/signup`: AI-usage row, a "General" project, disconnected placeholder CI/CD + notification rows), with no password set.

Any failure anywhere in the callback redirects to `/login?error=github_oauth_failed` rather than a raw 500. The frontend (`AuthPages.tsx`) reads `?error=` and shows the existing error banner with a specific message per failure code.

**Known, accepted edge case:** a user who signs up with email/password first, then later logs in with a GitHub account whose email is unverified or private, gets a *second*, separate organization rather than being linked to their first — auto-linking only happens on a GitHub-verified email match, specifically to avoid account-takeover via an unverified email claim. A real fix would need an explicit "link accounts" confirmation UI; out of scope for this pass.

### 8.12 Real-time GitHub repo sync

**Built 2026-07-21.** "Real-time" here means what's honestly achievable without adding new infrastructure: webhook-driven where a repo has `/webhooks/github` pointed at this server (already fully real, unchanged), plus **on-demand sync** for initial population and a manual refresh — explicitly not a new polling/cron system (no BullMQ or background-job runner exists in this project, and this pass doesn't add one).

`src/platforms/githubSync.ts` exports `syncGithubRepos(organizationId, token)`: `Octokit.paginate(repos.listForAuthenticatedUser)`, upserts every repo into the existing `Repo` table keyed on `(organizationId, fullName)`. Newly-synced real repos are created **disabled** — unlike the pre-seeded demo repos, a human should review mode/policy before Stitch can auto-fix a real, non-demo repository.

**Token precedence** (`resolveGithubToken`): the org's connected PAT (`Integration.config.token`, key `"github"`) wins if connected — it's the deliberate, admin-provisioned org-wide CI credential. The signed-in user's personal OAuth token (section 8.11) is only a fallback, so a brand-new org with no PAT yet can still sync from whoever's currently logged in.

`POST /api/integrations/github/sync` (in `src/api.ts`) resolves the token with that precedence and calls `syncGithubRepos`; the "Sync repos now" button on the GitHub card in `IntegrationsPanel.tsx` calls it and reports how many repos were synced. The button is shown regardless of the PAT's connected state — if neither a PAT nor a personal OAuth token is available, the request 400s with a clear message rather than the button silently doing nothing.

### 8.13 Real Jira ticketing (supersedes section 8.8 for Jira)

**Built 2026-07-21.** Section 8.8's `TicketingProvider` interface is now real for Jira specifically — Linear/Asana/GitHub Issues stay exactly as documented in 8.8 (demo-labeled, not wired), a deliberate scope decision: the ask named GitHub and Jira specifically, and spreading effort across four providers would have made all four weaker.

**Storage**: no new table. Reuses the existing `Integration` table with `key: "jira"` (`config: {siteUrl, email, apiToken, projectKey}`) — the same `(organizationId, key)` shape already proven for the 5 CI/CD providers, exposed through two new `appStore.ts` functions (`getTicketingIntegration`/`upsertTicketingIntegration`) that deliberately do **not** touch `listIntegrations()`'s hardcoded CI/CD seed array — ticketing is its own key family, seeded lazily only when connected, not pre-created for every org like the CI/CD rows.

**New `src/ticketing/`**:
- `types.ts` — `TicketingProvider` interface. Every method takes `config` explicitly as a parameter, unlike the CI/CD plugins (section 5) which read from the shared global `env` object (section 8.10's documented tradeoff). This is new code with no legacy call sites, so it's written the way that plumbing arguably should have been from the start.
- `jira.ts` — real Jira Cloud REST v3 calls via `fetch` + HTTP Basic Auth (`base64(email:apiToken)`), same idiom as `notify/slack.ts`: `testConnection` → `GET /rest/api/3/myself`; `createTicket` → `POST /rest/api/3/issue` (summary + Atlassian Document Format description referencing the repo/branch/run); `updateTicketStatus` → looks up the issue's available transitions and best-effort name-matches the target status (`done`/`in_progress`/`reopened`), swallowing and logging rather than throwing if no transition matches — a Jira call must never break the pipeline or the revert endpoint.
- `connectFields.ts` / `registry.ts` — same `ConnectField`/registry pattern as `src/platforms/connectFields.ts` and `registry.ts`, scoped to the one live-tested key (`jira`).

**API** (`src/api.ts`): `GET /ticketing` now returns Jira's *real* connected state and detail (falling back to the section 8.8 static demo entries for Linear/Asana/GitHub Issues), plus `POST /ticketing/:key/connect|disconnect|test` (Jira only — other keys 404, since they have no real connect form yet). `GET/POST /settings/ticketing` persists the automation rules (`createOn`, `defaultBoard`, `autoCloseOnMerge`, `autoReopenOnRevert`, `linkInPrDescription`, `priorityMap`) in `Organization.preferences.ticketing`, same pattern as the OpenAI settings — merged with defaults on read so a partially-saved prefs object never masks the rest.

**Pipeline** (`src/pipeline/runPipeline.ts`): the ticket-creation decision moved out of the old hardcoded "only on low-confidence escalation" check into a `createOn`-driven rule (`esc_only` / `esc_pending` / `every`, default `esc_pending` — matches the old behavior plus "pending review" fixes, matching the automation-rules UI's own default). When the rule says to create a ticket: if Jira is connected, call the real `createTicket()`; on any failure, or if Jira isn't connected, fall back to the **exact pre-existing** `"JIRA-SIM"`/`"LINEAR-SIM"` literal (feature branches vs. everything else) — regression-safe, never hard-fails the pipeline. If the outcome is already `"merged"` and `autoCloseOnMerge` is on, the freshly-created ticket is immediately best-effort transitioned to done. On `POST /fixes/:id/revert`, if the reverted fix carries a real (non-`-SIM`) ticket and `autoReopenOnRevert` isn't explicitly off, the API layer (not `appStore.ts`, to keep the ticketing dependency out of the data layer) best-effort calls `updateTicketStatus(..., "reopened")`.

**Frontend**: new `frontend/src/components/ticketing/TicketingPanel.tsx` (Modal + connect form + toast, same pattern as `IntegrationsPanel.tsx`, plus a "Test connection" action) replaces the fully-decorative Ticketing card in `SettingsPage.tsx`. The Automation Rules card's five controls and three priority-mapping selects are now all real, backed by `GET/POST /api/settings/ticketing` — no more `onChange={() => {}}` no-ops.

**Verified:** `npx tsc --noEmit` (root + frontend) and `npm run build` clean. `npx vitest run` extended to 12/12 — the new case asserts a fresh pipeline run with `createOn: "every"` and no Jira connected still lands on the `"LINEAR-SIM"` fallback (regression guard for the refactor above). Live smoke test against a booted server: `GET /auth/github` correctly redirects to `?error=github_not_configured` (no OAuth App credentials provided yet — see the open item below); `GET /ticketing` shows Jira's real per-org state alongside the static demo entries; connected a Jira integration with placeholder credentials, confirmed the list reflects it, ran `POST /ticketing/jira/test` and got back a real `401` **from Jira's actual API** (`https://example-test.atlassian.net/rest/api/3/myself`, confirming the code is genuinely hitting Jira Cloud, not a stub), then disconnected; confirmed `GET /settings/ticketing` returns full, correct defaults; confirmed `POST /integrations/github/sync` 400s with a clear message when no token is available; re-ran `/api/demo/simulate` end to end to confirm the pipeline refactor didn't regress the existing flow.

**Still open, needs the project owner's input to finish:**
- A real GitHub OAuth App (Client ID/Secret from https://github.com/settings/developers) to test the live login round-trip — the code path is complete and degrades gracefully without it.
- A real Jira Cloud site + API token (from https://id.atlassian.com/manage-profile/security/api-tokens) to test live ticket creation/transitions end-to-end — `testConnection` against a placeholder site already proves the HTTP/auth plumbing is correct.

### 8.14 Settings module: making every real setting actually do something

**Built 2026-07-21**, at the project owner's explicit request ("lets make whole setting module and each and every setting totally live and functional! do it aggressively!"). Before this pass, several Settings sections looked identical to the finished ones but were entirely decorative — every control's `onChange` was a no-op, and in one case (Repositories' per-repo Mode/Enabled) the value was persisted to the database but the pipeline never actually read it. This pass went section by section, making each control either genuinely real or, where real enforcement would need infrastructure this project doesn't have (a job queue, a payment processor, GitHub branch-protection API access), leaving it persisted-but-honestly-labeled rather than silently faking it.

**Branch rules + Response behavior — the biggest structural change.** `src/router/branchRouter.ts`'s `routeBranch()` previously only ever consulted one hardcoded rule table; there was no way for a user's own Branch Rules edits, or a repo's own Mode setting, to affect anything. It now takes an optional `{customRules, repoDefaultMode, orgDefaultMode}`: an org's saved Branch Rules (`Organization.preferences.branchRules`) take full priority when present, falling back to the exact original built-in rules when the org hasn't touched the screen (zero regression); when nothing matches, the repo's own `mode` field is consulted before the org's Response Behavior "Default mode." A new `label` field was added to `BehaviorConfig` (the 5 canonical UI trust-level names — Autopilot/Fix & propose/Diagnose & suggest/Silent audit/Notify only) and a `MODE_TO_BEHAVIOR` map gives each one a concrete, real `BehaviorConfig`, including two labels ("Silent audit," "Notify only") that existed in the UI but had never been implemented as real pipeline modes before. Response Behavior's Confidence floor also became real, replacing a hardcoded `confidence < 50` escalation threshold in `runPipeline.ts`.

**A real bug found and fixed along the way**: `Repo.mode` and `Project.defaultMode` were being stored and rendered in the UI since section 8.10, with copy literally saying "Overrides the workspace default from Response Behavior" — but nothing in `runPipeline.ts` ever read `Repo.mode`. The Repositories screen's Mode dropdown and Enabled toggle were fully decorative for pipeline purposes even though the backend `updateRepo()` already supported both fields (a pure frontend wiring gap — the Enabled toggle's `onChange` was `() => {}`). Both are now real.

**Rollback & safety** (`Organization.preferences.rollback`, `GET/POST /api/settings/rollback`): "Who can revert" and "Revert requires reason" are enforced in `POST /fixes/:id/revert` (403/400 respectively); the Fix Log and Issue Records "Revert" actions now prompt for an actual reason via `window.prompt` instead of sending a hardcoded string, so the reason requirement has real teeth. **Auto-revert on repeat failure** — previously just a decorative toggle with an explanatory Callout — is now a real pipeline feature: before diagnosing any new failure, `runPipeline.ts` checks whether the same repo+branch has a merged fix still inside the configured window (default 30 min) and, if so, reverts it first (`appStore.ts`'s new `findRecentMergedFix`), before processing the new failure. Default-on, matching the UI's own pre-existing `checked` state.

**Pull requests** (`Organization.preferences.pullRequests`, `GET/POST /api/settings/pull-requests`): Open as draft/ready, labels, and "include GPT diagnosis in PR body" all now genuinely apply to the real PR `src/platforms/github.ts`'s `openPr()` creates (`draft:` param, `client.issues.addLabels`, conditional diagnosis section in the PR body). Reuses the established "seed the shared `env` object right before the plugin call" pattern (section 8.10) via a new `env.pullRequests` section and `setPullRequestConfig()`, rather than changing the `CiCdPlugin` interface's `openPr` signature (which all 5 providers implement identically). Required approvers stays recorded-only — GitHub doesn't expose a "require N approvers" API without repo-admin-level branch-protection scopes this project doesn't request.

**Documentation** (`Organization.preferences.documentation`, `GET/POST /api/settings/documentation`) — closed a real, previously undocumented gap: the README and section 8.6 both describe Issue Records as "one durable markdown file per issue, written into your repo," and `IssueRecord.path` (e.g. `.stitch/issues/247-jwt-secret-null-reference.md`) was always computed, but nothing ever actually committed that file anywhere — it only ever lived in the `IssueRecord.markdown` database column. "Write Fix log to repo" (default on, matching the UI) now makes this real: a new `commitFileToBranch()` in `src/fix/applyFix.ts` pushes a follow-up commit with the Issue Record markdown onto the same branch the PR was opened from, run *after* the Fix/IssueRecord rows exist (their DB-assigned `fixId` is part of the file's path, so this can't happen in the same commit as the code fix itself, which is written before any Fix row exists). Every other Documentation control (changelog, incident reports, weekly digest, retention, export format) is persisted but honestly marked "not yet enforced" — each would need a generator, a scheduler, or a pruning job this pass didn't add.

**Security** (`Organization.preferences.security`, `GET/POST /api/settings/security`): "Require approval for Autopilot on main" is real — checked in `runPipeline.ts` right after `routeBranch()` computes behavior, forcing `requireHumanReview` on for main/master even when the resolved mode is Autopilot (the behavior object is now cloned, not a shared reference into `MODE_TO_BEHAVIOR`/the built-in rule table, specifically so this per-run override can't corrupt those shared constants for other orgs/requests). **Session timeout** is also real: `src/auth/session.ts`'s `createSession`/`buildSessionCookie` now take an explicit TTL instead of a hardcoded 30 days; login, signup, and the GitHub OAuth callback all resolve it from the org's saved preference (falling back to a new 8-hour default — matching what the Settings mockup had always shown as its own default value, rather than preserving the old undocumented 30-day constant). This only affects sessions created *after* the preference is saved — already-open sessions keep whatever TTL they were created with. IP allowlist remains recorded-only (no request-time IP check exists); 2FA stays explicitly labeled roadmap (real TOTP/SMS infrastructure, out of scope).

**Deliberately left as-is, not wired this pass**: Team & access (invites need an email-sending flow this project doesn't have) and Plan & billing (needs a real payment processor) — both already correctly labeled in the UI before this pass, and touching them wasn't part of "make every *setting* live," since neither has a settings control to wire, only whole missing subsystems.

**Verified:** `npx tsc --noEmit` (root + frontend) and `npm run build` clean throughout. `npx vitest run` grew from 12 to 15 — two new cases prove a repo's own mode overrides the built-in default on an unmatched branch and that a custom org branch rule beats both; one more proves auto-revert-on-repeat-failure actually reverts a merged fix when the same repo+branch fails again. Live smoke test against the project owner's own running dev server (not a separately started instance, to avoid disturbing their live session): confirmed `GET /settings/branch-rules`, `/settings/response-behavior`, `/settings/rollback`, `/settings/pull-requests`, `/settings/documentation`, and `/settings/security` all return correct, real defaults reflecting the exact pre-existing pipeline behavior (zero regression for orgs that haven't touched these screens yet).

### 8.15 Team & access: real invite links, and a Settings correctness pass

**Built 2026-07-21.** A follow-up pass fixing a concrete bug and finishing the remaining decorative Settings surface. `Settings → Ticketing` was showing Linear as "Connected" (a leftover hardcoded `connected: true` in `TICKETING_PROVIDERS`, from before Jira became real) right next to a "Coded, not live-tested" badge — a visible contradiction. Fixed by correcting Linear/Asana/GitHub Issues to `connected: false`, since none of them have a real connect flow.

**Team & access made real without email infrastructure.** A new `Invite` table (`prisma/schema.prisma`) backs a genuine invite-link flow: an Admin generates a link via `POST /api/team/invite` (random token, 7-day expiry, optionally locked to one email), shares it manually, and whoever opens `/signup?invite=<token>` joins the *same* organization — extending `POST /auth/signup` to branch on an optional `invite` param rather than always creating a new org. Role changes (`PATCH /api/team/members/:id`) and removal (`DELETE /api/team/members/:id`) are real and Admin-gated, with guards against removing yourself or the workspace's last member. No email is sent; the link itself is the invite, which is a legitimate, complete way to ship this feature without SMTP.

**A real toggle bug found and fixed**: `NotificationsPanel.tsx`'s "Enabled for workspace" control was an uncontrolled `<input type="checkbox" defaultChecked>` read via `document.getElementById` on Save — the one place in Settings not using the shared, controlled `Toggle` component everything else uses, and the most likely source of "toggles feel unresponsive." Rewritten to the same real, immediate-save pattern as the rest of Settings.

**Verified:** typecheck + build clean, `npx vitest run` 15/15 (pipeline logic untouched this pass). Live end-to-end test of the full invite lifecycle against the project owner's own running dev server: generate → validate → sign up a new user who joins the existing org → change role → remove → revoke a second invite → confirm self-removal is blocked. Final team state matched the pre-test baseline exactly.

## 9. Repository structure (target)

```
src/
  server.ts                  # Express app, webhook route
  platforms/
    types.ts                 # CiCdPlugin interface + NormalizedFailure types
    registry.ts               # plugin registry — connected-provider list, powers the Integrations screen
    github.ts                 # full implementation (Octokit)
    gitlab.ts                 # interface-complete, API calls stubbed
    circleci.ts               # interface-complete, API calls stubbed
    jenkins.ts                 # interface-complete, API calls stubbed
    bitbucket.ts               # interface-complete, API calls stubbed
  router/
    branchRouter.ts           # branch pattern -> behavior config
  diagnosis/
    logFetcher.ts
    diagnose.ts                # GPT-5.6 call
  fix/
    codebaseReader.ts
    generateFix.ts             # Codex call
    validateFix.ts             # run tests/lint against patched clone
  notify/
    types.ts                  # NotificationChannel + NotificationEvent
    slack.ts                   # full implementation
    email.ts                   # full implementation (nodemailer/SMTP)
    index.ts                   # dispatch to all enabled channels
  config/
    env.ts                     # central env/config loader
    workspace.ts                # workspace config (section 8.1) — JSON/env for now, DB-backed later
tests/
  router.test.ts
  diagnosis.test.ts
  fix.test.ts
demo-repo/                    # seeded repository with a deliberate bug, used for the recorded demo

# Not yet built — section 8.6:
#   src/issues/generateRecord.ts   # writes .stitch/issues/<id>-<slug>.md into the target repo
#   CiCdPlugin.revertPr()          # sixth plugin method, opens a revert commit/PR
```

## 10. MVP scope (build this first, this is the deadline-critical path)

1. Express webhook endpoint that accepts a GitHub `workflow_run` failure event (verified with `GITHUB_WEBHOOK_SECRET`).
2. Platform normalizer for GitHub only.
3. Branch router supporting `main` (aggressive) and `feature/*` (comment-only) modes.
4. Log fetcher that pulls the failing job's logs via the GitHub API.
5. GPT-5.6 diagnosis call: logs in, `{ rootCause, explanation, likelyFiles[] }` out.
6. Codebase reader: shallow-clone the demo repo, read the files named in `likelyFiles`.
7. Codex fix generator: diagnosis + file contents in, unified diff out.
8. Fix validator: apply the diff to a scratch clone, run the demo repo's test/lint command, pass/fail result.
9. PR creator: on `main`, open a PR with the diagnosis and diff in the description; on `feature/*`, post a comment on the existing PR instead.
10. Notification dispatcher: Slack (webhook) and Email (SMTP) both wired and enabled for the demo workspace; post the one-line summary and PR/comment link to both.
11. One seeded demo repository with a small, deliberately introduced, demo-legible bug (e.g., an uninitialized variable causing a null reference) on both a `main`-style push and a `feature/*` PR.

**Definition of done for the MVP:** a real GitHub Actions run fails in the seeded repo, the webhook fires, and within the recording a diagnosis appears, a PR opens with a working fix, and a Slack message announces it — end to end, no manual steps in between.

## 11. Stretch goals (only after the MVP above is demo-ready and recorded)

- Wire real API calls for the GitLab, CircleCI, Jenkins, and Bitbucket plugins (interfaces already coded per section 5) and demo at least one of them live.
- `release/*`, `dev`/`staging`, `hotfix/*` modes wired to their own demo scenarios.
- Auto-merge path on `dev`/`staging` when tests pass.
- Integrations page UI (section 8.2), even as a read-only view over `registry.ts`.
- Ticketing provider integration (Linear/Jira/Asana/GitHub Issues) and its automation rules — full spec in section 8.8, not built.

Do not start these until the MVP above is recorded and the submission form could be filled out with what exists. A working narrow demo beats a broken wide one under the judging criteria (design: "complete, coherent product experience," not "technical proof of concept").

## 12. Demo script (3 minutes, matches README)

1. **0:00–0:20** — problem: a red CI run sits there, nobody's looking, it's 3am.
2. **0:20–1:20** — webhook fires live on camera; GPT-5.6 diagnosis appears; Codex writes the fix; diff shown; PR opens automatically with diagnosis + diff + test evidence.
3. **1:20–2:20** — branch-aware behavior: trigger the same class of bug on a `feature/*` branch, show it becomes a PR *comment* instead of a new PR — proves the router, not just the happy path.
4. **2:20–2:50** — architecture recap on screen; explicit voiceover on where GPT-5.6 was used (diagnosis) vs. where Codex was used (fix generation) vs. what the team decided (branch-aware routing, validation gate before PR).
5. **2:50–3:00** — impact statement, close.

## 13. Risks

- **Model latency inside a live demo.** Mitigate by having a pre-run recording as a fallback take, and by keeping the demo repo/bug small so diagnosis + fix generation stay fast.
- **Fix validator false-positives (bad patch "passes" trivially).** Keep the demo repo's test suite small but meaningful — at least one test that actually exercises the bug.
- **GitHub webhook signature/setup friction during a live recording.** Rehearse the ngrok + webhook registration flow before the take; keep a working recording as backup regardless.
- **Scope creep into non-GitHub plugins or the Integrations UI before the MVP is solid.** Enforced by the phase order in section 10/11 — do not start section 11 items early. Coding all five plugin interfaces (section 5) is fine and already done by design; wiring their live API calls and building UI on top is not.

## 14. Current status: built vs. documented-only vs. not started (updated 2026-07-21)

Kept current so nobody has to reconstruct this from the journal. Superseded the earlier 2026-07-21 version of this section — real PostgreSQL persistence and real auth (bcrypt + sessions) moved from "out of scope" into "built and verified" since that version was written, per section 8.10. See jornal.md's 2026-07-21 entries for the full verification trail.

**Built and verified (real code, exercised live, not just typechecked):**
- Webhook receiver, GitHub webhook signature verification, event normalization, branch router (all 5 modes) — `src/`.
- Plugin architecture for all 5 CI/CD providers (`CiCdPlugin` interface); GitHub fully wired (Octokit, including job-log download, diff-apply-then-open-PR, and dev/staging auto-merge); GitLab/CircleCI/Jenkins/Bitbucket interface-complete with provider API calls stubbed.
- Notification dispatch to Slack (real webhook POST) and Email (real SMTP send), per-channel fault isolation, activity logging.
- `diagnose()` (GPT-5.6) and `generateFix()` (Codex) — real OpenAI calls (`src/diagnosis/diagnose.ts`, `src/fix/generateFix.ts`), with a deterministic demo fallback when no key is configured or the API call fails, so the pipeline never hard-fails in demo conditions.
- The fix-validator (`src/fix/validateFix.ts`) and the full pipeline orchestrator (`src/pipeline/runPipeline.ts`): diagnose -> generateFix -> validateFix -> confidence-based escalation/auto-merge gate -> `openPr`/`commentOnExisting` -> notify -> store fix + issue record + audit entry. Idempotent per `platform:runId`, now organization-scoped throughout.
- Real git operations (`src/fix/applyFix.ts`, `simple-git`): clone, branch, `git apply`, commit, push against `GITHUB_TOKEN`.
- **Real PostgreSQL persistence + real auth — section 8.10.** `prisma/schema.prisma` (Organization/User/Session/Project/Repo/Fix/IssueRecord/AuditEntry/AiUsage/Integration/NotificationChannelConfig) replaces the in-memory `appStore` and `config/workspace.ts` entirely. Real signup/login/logout with bcrypt-hashed passwords and httpOnly session cookies (`src/auth/`) replaces the `sessionStorage` demo flag. Every account is a genuinely isolated organization — verified live (see 8.10's smoke test). A full REST API (`src/api.ts`) sits on top of it, org-scoped end to end; Server-Sent Events (`src/realtime/sse.ts`) still broadcast live (not yet per-org — see 8.10).
- **The real product frontend, `frontend/`** — React 19 + TypeScript + Vite + Tailwind + React Router, replacing both the old vanilla-JS `public/` dashboard (deleted) and the standalone HTML mockup as the actual UI. Every page from the mockup has a corresponding real React page: Home/About/Pricing/Contact (marketing), Login/Signup (real auth, forgot-password flow), Dashboard (SSE-driven live feed, count-up stats, project filter, simulate-pipeline buttons), Fix Log, Issue Records (rendered markdown), Audit Trail, Settings (15 sections — Integrations/Notifications/AI models/Repositories/API key are live/API-backed; the rest are labeled demo data), Status, Profile (real theme toggle + real user identity), Organization (real project/repo summary), Roles, Changelog, Reports, Roadmap, Projects.
- `tests/mvp.test.ts` — 11 passing vitest cases (branch router, validateFix, full pipeline simulate x2, github plugin normalize x2), now running against the real Postgres-backed pipeline.
- **Multi-project support (org → projects → repos)** — real CRUD (`/api/projects`), a `project` field on every repo, project-scoped `/api/dashboard`/`/api/repos`, and a full frontend surface (Projects page, Settings → Repositories project column, Dashboard project filter, Organization summary card). See section 8.9 for the data-model decision (projects don't cascade into fixes/issues — repo-scoped only, on purpose).
- Real repo add/remove (`POST`/`DELETE /api/repos`), a real hashed API key with regenerate, a `Organization.preferences` JSON settings blob, and real danger-zone actions (disconnect-all, JSON export, workspace delete) — section 8.10.
- **Real GitHub OAuth login + live repo sync + real Jira ticketing — sections 8.11/8.12/8.13.** "Continue with GitHub" is a genuine OAuth App flow (account creation/linking, personal access token stored per-user); `POST /api/integrations/github/sync` fetches the signed-in user's or org's actual GitHub repos via Octokit and upserts them into the real `Repo` table; Jira is a fully real `TicketingProvider` (Jira Cloud REST v3, real connect/test/disconnect, real ticket creation and best-effort status transitions wired into the pipeline and the revert endpoint), with the automation-rules UI backed by real preferences. Linear/Asana/GitHub Issues remain demo-labeled, unchanged from section 8.8.
- **The Settings module made live — section 8.14.** Branch rules and Response Behavior's Default mode/Confidence floor now genuinely drive `routeBranch()`; Repositories' per-repo Mode/Enabled now actually affect the pipeline (previously stored but silently ignored — a real bug found and fixed in this pass); Rollback & Safety's who-can-revert and revert-requires-reason are enforced, and auto-revert-on-repeat-failure is a real working feature; Pull Requests' draft/labels/diagnosis-in-body apply to the actual GitHub PR; Documentation's "Write Fix log to repo" now genuinely commits the Issue Record markdown into the repo (closing a real gap where the README's own claim about this wasn't true yet); Security's require-approval-on-main and session timeout are both enforced. `tests/mvp.test.ts` grew from 12 to 15 cases covering the new branch-rule/repo-override/auto-revert behavior.

**Documented and shown in the mockup (`plan/stitch-project-dashboard.html`, now design-reference-only) or in `frontend/` as clearly-labeled demo data — real database underneath, not yet wired to it:**
- Linear/Asana/GitHub Issues ticketing — real interface documented (section 8.8), not wired to a live provider or a DB table. (Jira itself is now real — section 8.13.)
- The remaining recorded-but-not-yet-enforced Settings fields (section 8.14): Response Behavior's auto-merge delay/required approvers/max PRs per hour/working hours, Documentation's changelog/incident-reports/digest/retention/export-format, Pull Requests' required approvers, Security's IP allowlist — each needs infrastructure (a queue/scheduler, a generator, GitHub branch-protection API access, a request-time IP check) this pass didn't add.
- Organization profile fields, Roles & Permissions persistence, Changelog, Reports, Roadmap pages — still render real, well-designed UI in `frontend/` but operate on demo/static data.
- Team & access is real up to one member per organization (the signed-up user) — invite-a-teammate (would need email-sent invite tokens) is not built. Plan & billing remains illustrative — needs a real payment processor.

**Not started at all:**
- A seeded external demo repository, a valid long-lived `.env` (the currently configured `OPENAI_API_KEY` is expired), and a registered GitHub App/webhook exercised live, for the recorded demo.
- A real GitHub OAuth App and a real Jira site/API token to actually exercise the section 8.11/8.13 login and ticket-creation flows live — the code is complete and degrades gracefully without them (see the open items listed at the end of section 8.13).
- README's "How Codex and GPT-5.6 were used" section and the `/feedback` Codex Session ID.
- Real RBAC *enforcement* (the Roles matrix is UI-only), secrets encryption at rest for stored Integration/OpenAI/Jira config, per-org SSE scoping — all captured in section 18.3's revised open-items list.

**Priority order for remaining time:** get a valid OpenAI key + seeded demo repo in place, a real GitHub OAuth App + Jira site if the live login/ticketing flows need to be demoed, record the live demo video, fill in the README's Codex/GPT-5.6 usage section and session ID. The engineering work (pipeline, frontend, tests, database, auth, GitHub OAuth, Jira ticketing) that used to gate everything else is done.

## 15. Submission-readiness checklist (build-owner facing)

- [ ] MVP end-to-end works against the seeded demo repo.
- [ ] Demo video recorded and uploaded (public, unlisted-is-not-allowed, <3 min, with audio).
- [ ] README "How Codex and GPT-5.6 were used" section filled in with specifics, not placeholders.
- [ ] `/feedback` Codex Session ID captured from the core build session.
- [ ] Repo made public with a license, or private + shared with `testing@devpost.com` and `build-week-event@openai.com`.
- [ ] Installation instructions verified by literally following them on a clean checkout.
- [ ] A way for judges to test without rebuilding documented (demo instance, sandbox, or test account/credentials).
- [ ] At least a few unit tests exist (`branchRouter`, `notify` dispatcher) — cheap, and directly supports the "technological implementation" judging criterion.

## 16. Roadmap / post-MVP

Everything below is **planning only** — none of it is built, and none of it should be started before the section 14 "not started at all" list is done. It exists so nothing raised in review gets lost, and so post-hackathon work has a starting spec instead of a blank page. Shown in the mockup's **Roadmap** page (`plan/stitch-project-dashboard.html`), grouped identically to here.

Priority key: **Now** = would block calling this submission-ready; **Next** = right after the MVP, still hackathon week; **Later** = post-hackathon, needed to be a real product; **Future** = long-term differentiator, not needed to be credible.

### 16.1 Security & access control (RBAC and friends)

| Item | Priority | Note |
|---|---|---|
| Real RBAC enforcement | Later | Mockup shows Admin/Developer/Viewer as static rows; nothing enforces it today. Needs role checks on every `/api/*` route. |
| Auth (SSO, additional OAuth providers) | Later | Real bcrypt/session auth plus real GitHub OAuth login both exist now (sections 8.10/8.11). SSO and non-GitHub OAuth providers remain open. |
| API key scoping | Later | Today's mockup API key is all-or-nothing; real keys need per-scope tokens (read-only vs. connect-integrations vs. can-revert). |
| Secrets encrypted at rest | Next | Tokens currently live in a plaintext in-memory object (`src/config/env.ts`). Blocking as soon as persistence (section 14) lands — don't persist plaintext secrets to disk/DB. |
| Webhook secret rotation | Later | No rotate/expire flow for `GITHUB_WEBHOOK_SECRET` and friends. |
| Audit-trail tamper-evidence | Later | The mockup *calls* the audit trail tamper-evident; nothing makes it actually so (hash-chaining or an append-only store). |
| Multi-tenant isolation | Later | Today it's one hardcoded `demoWorkspace` (`src/config/workspace.ts`). Real multi-tenancy needs workspace-scoped data, not a global singleton. |

### 16.2 Core product features not yet anywhere

| Item | Priority | Note |
|---|---|---|
| Onboarding / first-run flow | Later | Nothing walks a new user through "connect your first repo." |
| Dry-run / simulate mode | Later | Preview what Stitch *would* do on a failure without acting — useful for trust-building before a team flips to Autopilot. |
| Manual trigger ("diagnose this now") | Next | For a failure that was missed or ignored; cheap once `diagnose()`/`generateFix()` exist — reuses the same pipeline, different entry point. |
| Regression test generation | Later | Codex currently only writes the fix; it could also write the test proving the bug is gone. |
| Dedup / noise control | Next | The same root cause failing repeatedly (a flaky test, say) has no suppression today — would spam PRs/Slack. Cheap relative to its impact; worth doing early. |
| Snooze / mute | Later | Temporarily pause a repo or branch (e.g. during a deploy freeze) without changing its configured mode. |
| Per-repo confidence tuning / custom instructions | Later | "Always follow our style guide," "never touch `payments/`" — today all config is workspace- or branch-pattern-level only. |
| Monorepo support | Future | Different modes per path within one repo, not just per repo. |
| Proactive scans | Future | Currently 100% reactive to a CI failure; a "scan for brittle patterns" mode would differentiate but is a different product surface. |
| Learning loop (👍/👎 feedback on fixes) | Future | Mark a fix as good/bad to actually adjust the confidence engine over time — today's confidence engine (section 8.6 relatives, plan section on Settings) is static heuristics, not learned. |

### 16.3 Reliability / engineering hardening

| Item | Priority | Note |
|---|---|---|
| Idempotency on webhook delivery | Now | GitHub retries webhook deliveries; a duplicate delivery today would trigger two fix attempts. Cheap (dedupe on `platform` + `runId`), should land with the MVP pipeline, not after. |
| Rate limiting / abuse protection on the webhook endpoint | Next | None exists today. |
| Queue instead of inline async | Later | `server.ts` runs the whole pipeline inline after responding to the webhook; a real system wants a job queue so a slow model call can't pile up. |
| Dead-letter handling / retry | Later | A failed pipeline run today just logs + notifies; nothing lets you retry it later without waiting for the next real failure. |
| Observability on Stitch itself | Later | No logs/metrics/tracing on Stitch's own service — notable gap for a tool whose pitch is observability for *your* CI. |

### 16.4 Testing & quality

| Item | Priority | Note |
|---|---|---|
| Unit tests (`branchRouter`, `notify` dispatcher, plugin `normalize()`) | Now | Already on the section 15 submission checklist — cheap, directly supports the "technological implementation" judging criterion. |
| Integration test against a real sandbox repo | Next | Exercises the full webhook -> PR loop end-to-end in CI, not just manually during the demo recording. |
| Load test on the webhook endpoint | Future | Lowest priority of the three; only matters once there's real traffic. |

### 16.5 Compliance & enterprise readiness

| Item | Priority | Note |
|---|---|---|
| Data retention & deletion controls | Later | Needed before any real customer data flows through this. |
| Self-hosted / on-prem option | Future | Some orgs won't send code to a third-party SaaS at all — a real blocker for enterprise sales, not for the hackathon. |
| Terms of service / privacy policy pages | Later | Needed for a real launch; not needed for judge testing. |
| SOC2-style audit export | Future | Downstream of the audit-trail tamper-evidence item (16.1) — do that first. |

### 16.6 Billing & monetization

| Item | Priority | Note |
|---|---|---|
| Billing page | Future | Mockup shows a "Team plan" badge with nothing behind it. |
| Usage-based pricing tied to Codex/GPT-5.6 spend | Future | The Dashboard's cost meter (section 8.6) shows usage but enforces nothing. |
| Plan-tier gating | Future | E.g. number of connected repos, which response modes are available. |

### 16.7 Integration depth

| Item | Priority | Note |
|---|---|---|
| Outbound custom webhook signature (HMAC) | Later | The Settings page's custom-webhook field has no signing on what *Stitch* sends out. |
| Retry on failed notification sends | Next | `notify()` (section 6) currently records a failure and moves on; no retry/backoff. |
| GitHub Check Run integration | Later | Native check status instead of just a PR comment — more "in-workflow" than the current comment-based approach. |
| ChatOps (Slack/Teams slash commands) | Future | E.g. `/stitch approve 247` — turns notification channels into control surfaces, not just read-only alerts. |

### 16.8 Hackathon-submission-specific

Cross-references section 14/15 rather than duplicating it — this is the actual highest-leverage bucket for the deadline:

| Item | Priority | Note |
|---|---|---|
| `diagnose()`, `generateFix()`, fix-validator, seeded demo repo, demo video, `/feedback` session ID | Now | See section 14's "not started at all" list — unchanged, still the blocking path. |
| Hosted/live demo instance | Now | Judges need something clickable without cloning the repo. |
| Landing/pitch page | ~~Next~~ Done (mockup) | Built in the mockup as of 2026-07-21 — see section 17. Still needs to be a real, hosted, standalone page for actual judge-facing use; the mockup version lives behind the same file as the app. |

### 16.9 Long-term differentiators

Not needed to be credible for the hackathon; worth having on record for "where this goes next" in the demo video's closing seconds.

| Item | Priority | Note |
|---|---|---|
| Cross-repo pattern detection | Future | "This null-check bug has hit 6 repos this month — add a lint rule?" |
| Stitch reliability score per repo | Future | Tracked over time, a single trust signal per repo. |
| VS Code extension for Issue Records | Future | Browse `.stitch/issues/*.md` inline without leaving the editor. |

## 17. Full-fledged mockup: marketing site, auth, org/roles/permissions, live status, real-time widgets

As of 2026-07-21, `plan/stitch-project-dashboard.html` covers the entire user journey, not just the authenticated app — at the project owner's explicit request to take the mockup "to the fullest" before actual-code build starts. This section is the spec for everything added in this pass. As always: **mockup**, with one exception called out explicitly in 17.6.

### 17.1 Three-mode shell: marketing → auth → app

The single HTML file now has three top-level shells, toggled by a `data-mode` attribute on `<body>` (`marketing` | `auth` | `app`), each a sibling `<div>` (`#marketing-shell`, `#auth-shell`, `#app-shell` — the last is the same `.app` sidebar+topbar shell every earlier section describes). CSS hides the other two shells per mode; nothing is destroyed/recreated, so state (e.g. which Settings section is scrolled to) survives a mode switch.

**Default mode is `marketing`** — opening the file now lands on the public Home page, not the Dashboard. This is a deliberate change from every earlier version of this mockup, matching the requested journey: home → about/pricing/contact → sign in or sign up → app. Reviewing the app pages now requires going through Sign in/Sign up (or, for local testing, setting `data-mode="app"` directly).

### 17.2 Marketing site

Four pages under `#marketing-shell`, switched by the same "buttons carry a data attribute, JS toggles `data-active`" pattern used everywhere else in this file (`data-mkt` instead of `data-target`, scoped to `#mkt-tabs a` and `.mkt-page`):

- **Home** — hero, three headline stats, the five response modes reused directly from Settings (proves the pitch matches the product instead of drifting), three feature cards (Issue Records, Audit Trail, one-click rollback), an integrations/ticketing chip row, and a closing CTA.
- **About** — the "why" (the 3am problem, the approach), plus three build-in-the-open stats (15 settings sections, 5 CI/CD providers, 42+ roadmap items) that pull directly from sections 8.7 and 16 rather than inventing new numbers.
- **Pricing** — three tiers (Free/Team/Enterprise), explicitly captioned "illustrative — see the Roadmap's Billing & monetization items for what's actually decided" so it can't be mistaken for a real pricing decision (roadmap 16.6 is still all "Future").
- **Contact** — a form (decorative submit → a "this is a mockup, nothing was sent" message, so nobody's fooled into thinking a message went anywhere) plus email/Discord/status pointers.

### 17.3 Auth shell

`#auth-shell` has two views (`data-auth="login"` / `"signup"`), a centered card layout distinct from both the marketing nav and the app sidebar (on purpose — a login screen shouldn't look like it's already inside the product). Both offer a "Continue with GitHub" SSO button (GitHub is the natural first SSO provider, given the product — matches roadmap 16.1's auth item) and a plain email/password form. Signup additionally asks for organization name, feeding the Organization page's org name field conceptually (not actually wired — still a mockup).

Submitting either form (or clicking GitHub SSO) triggers `enterApp()`: a ~900ms **boot overlay** ("Setting up your workspace…", a spinning-border loader) before switching to `data-mode="app"` and landing on Dashboard. This is a deliberate, cheap piece of "getting started" feel — real onboarding (roadmap 16.2) is a first-run wizard, which this is not; it's a transition, not a wizard.

### 17.4 New app pages: Organization, Roles & Permissions, Profile, Status

Four new `section.page` entries, four new sidebar buttons (`Organization`/`Roles & permissions` under **Configure**, `Profile` under a new **Account** group, `Status` under **Monitor**):

- **Organization** (`data-target="organization"`) — org profile (name, domain, industry, size), and the **org-wide time zone/locale defaults** that the project owner asked for: time zone, date format, time format, first-day-of-week. Explicitly states these apply to Fix Log/Audit Trail/Changelog/Reports timestamps unless a member overrides it in their own Profile — i.e. project-activity timestamps are timezone-aware by design, not just the org settings page. A compact member list (links to Roles & Permissions for the real thing) and an org-level danger zone (transfer ownership, delete organization).
- **Roles & Permissions** (`data-target="roles"`) — the built-in three roles (Admin/Developer/Viewer) plus one example **custom role** ("Release Manager") with its own color dot, member count, and Edit action; a "+ Create custom role" flow with a swatch picker (six accent colors) that actually is clickable (adds `.selected` to the chosen swatch); and a full **permission matrix** (8 permissions × 4 roles, checkbox grid) covering exactly the operations this product actually has: manage integrations/ticketing, change response modes/branch rules, approve Autopilot fixes, revert a merged fix, manage billing, manage team/roles, view Audit Trail, export workspace data. This is the UI surface for roadmap 16.1's "real RBAC enforcement" — today the checkboxes are inert (`disabled` on cells that shouldn't be user-editable for Viewer, but nothing persists a change).
- **Profile** (`data-target="profile"`) — the user's own account: name/email, password change, **personal preferences** (time zone/date-format override of the org default, language), personal notification toggles, and active sessions (with a "sign out all other sessions" action). See 17.6 — the Appearance control here is the one part of this entire addition that is not just decorative.
- **Status** (`data-target="status"`) — see 17.5.

### 17.5 Status / health page

A conventional status-page layout: a banner ("All systems operational", green, matches the worst-case coloring convention used everywhere else in this file), two grouped tables of health rows (Core services: webhook receiver, GPT-5.6 diagnosis API, Codex fix-generation API, Dashboard & API, notification dispatcher; CI/CD & ticketing connectors: GitHub/GitLab/CircleCI webhook delivery, Linear/Jira sync), each with a status dot, a 30-tick uptime-history strip (rendered by JS, not hand-authored — see `renderUptimeBars()`), and an uptime%/latency figure. Two resolved historical incidents below, and a decorative "subscribe to updates" row. This directly answers the "health and liveliness and operational status" ask — the component list matches the actual pipeline stages named throughout sections 3 and 5, not a generic template.

### 17.6 What's actually real in this batch — and what isn't

Consistent with every other pass over this mockup, almost everything here is illustrative. Two things are not:

- **The Appearance/theme control on the Profile page genuinely works.** The CSS for `:root[data-theme="dark"]` / `[data-theme="light"]` has existed since the very first version of this file (section 8's original dark-mode-aware design) but was never wired to a control — every screenshot taken of this mockup used the OS/browser default. Selecting Light/Dark/System in Profile now calls `document.documentElement.setAttribute('data-theme', …)` (or removes it for "system") for real, and the entire mockup — every page, every mode — repaints correctly. Verified via a rendered screenshot showing a full light-mode repaint, not just asserted.
- **The dashboard's "live" behaviors are real, running JavaScript, not static images** — a genuine count-up animation on three stat tiles (Success rate, Developer time saved, Total incidents; "Avg. time to fix" was left static since "2m 14s" doesn't have a clean single numeric value to animate) and a live incident feed ticker (`setInterval`, 7s) that prepends a new simulated event with a fade-in and caps the list at 5 rows, incrementing the Total Incidents tile to match. Both only run while the Dashboard tab is actually active (started/stopped from the same tab-click handler that already existed), so they don't burn cycles in the background on other pages. **This animation surfaced and fixed a real bug during verification**: the count-up's easing math only clamped its progress variable on the upper bound (`Math.min(1, p)`), so a negative elapsed-time reading (reproduced by Chrome's headless `--virtual-time-budget` test flag, which can desynchronize `requestAnimationFrame` timestamps from `performance.now()`) produced a negative progress value and a visibly wrong negative stat ("−5%"). Fixed by clamping both bounds (`Math.max(0, Math.min(1, p))`) — a genuine defensive-coding fix, not a workaround for the test harness, since a real browser under real-but-unusual conditions (tab backgrounding, some rAF throttling scenarios) could hit the same unclamped-lower-bound gap.
- Everything else added this pass — notification panel actions, profile menu links, the create-role swatch picker, the theme-adjacent time zone/locale fields, permission-matrix checkboxes, the contact form, the boot overlay, mode switching itself — changes only in-memory mockup state (or nothing at all) and resets on reload. Consistent with the standing convention: don't imply real persistence anywhere in this file.

### 17.7 Mapping to real implementation later

**Update, 2026-07-21:** section 17's pages are now built for real in `frontend/` (Home, About, Pricing, Contact, Login/Signup, Organization, Roles & Permissions, Profile, Status). The mapping notes below were written when this was still mockup-only planning and remain accurate for what's *not yet* real — persistence, real multi-tenant RBAC enforcement, and timezone-aware rendering are all still pending, per section 14's "documented ... not live/API-backed" bucket.

- Marketing site and auth are a genuinely separate concern from the product API — likely a separate static site/framework, not the Express app in `src/server.ts`. Nothing here should be read as "add marketing routes to the webhook receiver."
- Organization/Roles & Permissions map directly to roadmap 16.1 (multi-tenant isolation, real RBAC enforcement) — the permission matrix in 17.4 is close to a literal spec for the authorization check every `/api/*` route will eventually need.
- Profile's time zone/locale fields are the first concrete design for something no earlier section specified: **all timestamps the product already renders** (Fix Log, Audit Trail, Changelog, Reports) need a timezone-aware rendering layer, org-default-with-personal-override, once persistence exists (section 8.5, item 5) — not a new backend concept, a rendering concern at the same layer that already formats those timestamps.
- The Status page's component list is close to a literal spec for a real `/healthz`-style aggregator once `diagnose()`/`generateFix()` (section 14) exist to actually have latency/uptime to report on.

### 17.8 Marketing Home: proof-of-value polish (live ticker, ROI calculator, before/after)

A follow-up pass, at the project owner's request, specifically on the Home page's ability to argue its own value — "why this holds value and impact and effectiveness" — with dynamic, real-time elements rather than static claims.

- **Scroll-reveal** (`.reveal` / `.in-view`, `IntersectionObserver`) on every major Home section, plus the About page's cards. **Safety net:** anything not revealed within 1.8s force-reveals regardless of observer state — added specifically because scroll-triggered content that can get permanently stuck invisible (a slow observer, a fast scroll, a browser quirk) is a well-known real-world failure mode for this pattern, not a hypothetical. About/Pricing/Contact are hardcoded `in-view` from the start rather than observer-gated at all, since those pages are reached by a nav click (an instant `display:none → block` toggle), not a scroll — a fundamentally different, less reliable trigger for `IntersectionObserver` than genuine in-page scrolling.
- **"Happening right now"** — a live ticker (`#mkt-ticker-list`, same rotating-pool pattern as the Dashboard's incident feed, section 17) and a big incrementing counter ("developer hours saved… and counting") that ticks up every ~2.6s while marketing mode is active. Deliberately anonymized ("a workspace…") rather than naming specific fake companies, since this is a proof-of-activity device, not a claim about identifiable customers.
- **"The gap that actually matters"** — an animated before/after bar comparison (~4 hours manual vs. 2m 14s with Stitch), the same numbers already used elsewhere on the page, not new invented figures.
- **"See what it's worth to your team"** — a real-time ROI calculator: three range sliders (CI failures/month, average manual fix minutes, engineer hourly cost) recompute hours-saved and dollar-value on every `input` event, using the same 74% auto-fix rate shown in the hero stats. This is genuinely computed, not decorative — verified with a DOM-level test (not a screenshot) confirming the math end-to-end: 40 failures/45min/$75 → 22.2h/$1,665; moving to 120 failures → 66.6h/$4,995; also moving to 90min → 133.2h/$9,990 — all match `failures × 0.74 × minutes ÷ 60 × cost` exactly, and the slider value labels stayed in sync throughout.
- Hero stats (`74%`, `26.4h`) count up on scroll-reveal using the same clamped easing function as the Dashboard (section 17.6); `2m 14s` was left static there too, consistently.

**Verification note, told straight:** headless-screenshot verification of this specific batch surfaced a real limitation of the verification method itself, not of the page. Chrome's `--virtual-time-budget` headless mode does not reliably service `requestAnimationFrame` or CSS-transition compositor frames on the same timeline it services `setTimeout`/`setInterval` — a DOM-level check confirmed the scroll-reveal safety net correctly applies `.in-view` to all 12 tracked elements every time, while a screenshot taken too soon after can still show pre-transition (faint) content even though the underlying state is already correct. Increasing the render budget resolved most of it (the ticker, the live counter, and the before/after bars all rendered at full, correct opacity once given enough budget); a lower section still fading at capture time is the same category of artifact, not a functional gap. The ROI calculator was verified via direct DOM/event dispatch instead of a screenshot for exactly this reason — it depends on neither `requestAnimationFrame` nor a CSS transition, so it isn't subject to this limitation at all.

## 18. Target architecture for a real SaaS-grade build (post-hackathon)

Raised directly by the project owner: is the current stack (section 7) actually right, given how far the product surface has grown (section 17)? Answer, honestly: **the backend half is fine; the frontend half was never meant to be the real architecture.** `public/`'s vanilla HTML/JS is adequate for the three tabs it actually needs to serve today (Integrations, Notifications, Activity). The full mockup (`plan/stitch-project-dashboard.html`) — marketing site, auth, org/roles/permissions, live dashboards, permission matrices, forms — is a **design reference implemented as a single static file**, explicitly not an architecture to build the real thing on top of. Hand-rolling all of that in vanilla JS for real would mean no component reuse, no real state management, and manual DOM synchronization everywhere; it does not scale to what's now specified.

**Decision, per the project owner:** document the target architecture here; do not migrate today. The hackathon deadline is today, and this is a genuine framework migration — attempting it now would cost the hours still needed for the actually-blocking work in section 14 (`diagnose()`, `generateFix()`, the fix-validator, the demo recording). Nothing in this section should be started before that work is done and submitted.

### 18.1 Recommended stack

| Layer | Recommendation | Why |
|---|---|---|
| Frontend framework | **Next.js (App Router) + React + TypeScript** | One framework for both shells this product already has (section 17.1): SSR/SEO for the public marketing site, client-rendered for the authenticated app. A plain React+Vite SPA would need a separate answer for marketing-page SEO; Next.js doesn't. |
| Styling / components | **Tailwind CSS + shadcn/ui** (Radix primitives) | The mockup already has a real design system — CSS custom properties for color/spacing, a consistent badge/card/button/table vocabulary. Tailwind's theme config maps onto those tokens almost directly; shadcn/ui gives accessible, unstyled-by-default primitives (dropdown, dialog, popover) to re-skin as the mockup's dropdown panels, modals, and command palette instead of hand-rolling `.dropdown-panel` CSS again. |
| Backend / API | **Keep Express as-is, or fold into Next.js Route Handlers** | Either works; no urgency to choose. The plugin architecture (`CiCdPlugin`, `NotificationChannel`, `TicketingProvider` — sections 5, 6, 8.8) is framework-agnostic TypeScript and survives this migration completely untouched either way. |
| Database | **PostgreSQL + Prisma** — ✅ done 2026-07-21 | Real persistence for Organization, User, Session, Project, Repo, Fix, IssueRecord, AuditEntry, AiUsage, Integration, NotificationChannelConfig — see section 8.10. Role/Permission/TicketingProvider tables were scoped out of this pass (Roles matrix and Ticketing remain UI/demo-data — see section 14). |
| Auth | **Real bcrypt + session cookies + real GitHub OAuth login** — ✅ done 2026-07-21 | Real signup/login/logout replacing the `sessionStorage` flag, plus a genuine "Continue with GitHub" OAuth App flow (section 8.11); not NextAuth specifically, but GitHub OAuth itself is real — see sections 8.10/8.11 and 18.3 item 4. |
| Real-time | **WebSockets or Server-Sent Events** | Replaces the mockup's client-side `setInterval` ticker simulation (sections 17, 17.8) with genuine server-pushed events sourced from the real `notify()`/activity-log pipeline that already exists in `src/`. |
| Background jobs | **BullMQ + Redis** | Directly implements roadmap 16.3's "queue instead of inline async" — moves the diagnose → fix → validate pipeline off the webhook request/response cycle. |
| Deployment | Vercel (Next.js) + a Node host for the worker/queue (Railway/Render/Fly) + managed Postgres (Neon/Supabase) + managed Redis (Upstash) | Conventional, low-ops split; revisit only if self-hosting (roadmap 16.5) becomes a real requirement. |

**Alternatives considered and set aside:** plain React + Vite (loses SSR/SEO for the public marketing pages, buys little in return); Remix (a legitimate peer to Next.js, but Next.js's ecosystem and shadcn/ui's Next-first conventions make it the more pragmatic default here); NestJS for the backend (more structure than Express, worth reconsidering if the API layer grows substantially, but not a blocker today since the plugin interfaces are already decoupled from Express specifically).

### 18.2 What does not change

The technical spec built up across sections 3–8.8 (the `CiCdPlugin`/`NotificationChannel`/`TicketingProvider` interfaces, the branch router, the diagnosis/fix pipeline, the unified failure object, the notification event lifecycle) is plain TypeScript with no framework dependency. None of it is invalidated or wasted by a frontend migration — it's the part of this plan that was always going to survive regardless of which UI framework eventually renders it.

### 18.3 Suggested migration phasing (for when this is actually picked up)

**Update, 2026-07-21:** steps 1, 2, 3, 5, and 6 below are now done. `frontend/` is a complete React SPA (Vite + React Router instead of Next.js, no SSR) with every page built, and — the big one — **PostgreSQL + Prisma is in**, replacing the in-memory `appStore`/`config/workspace.ts`, plus real bcrypt/session auth replacing the `sessionStorage` demo flag. See the new section 8.10 for the full data-model writeup and section 14 for what's built vs. what's still demo data on top of it. What's left:

1. ~~Stand up Next.js + Tailwind; port design tokens~~ — done via Vite instead; revisit only if SSR/SEO for the marketing pages becomes a real requirement.
2. ~~Rebuild the dashboard as React~~ — done (`frontend/`), calling the existing, unmodified Express API.
3. ~~Introduce PostgreSQL + Prisma~~ — **done, 2026-07-21.** `prisma/schema.prisma` covers Organization, User, Session, Project, Repo, Fix, IssueRecord, AuditEntry, AiUsage, Integration, NotificationChannelConfig. `config/workspace.ts`'s single `demoWorkspace` object is gone; `activityLog.ts`/`realtime/sse.ts` remain in-memory on purpose (see section 8.10 — transient live-feed data, not durable records).
4. ~~Auth — done, but not via NextAuth.~~ Real signup/login/logout with bcrypt-hashed passwords and httpOnly session cookies (`src/auth/`), **plus real GitHub OAuth login** ("Continue with GitHub" now actually authenticates — section 8.11), not built on NextAuth. Swapping the hand-rolled session/OAuth code for NextAuth later is additive, not a rewrite — the `User`/`Session` tables and `requireAuth` middleware boundary are already the right shape for it.
5. ~~Build out remaining mockup-only pages~~ — done; most of Settings/Organization/Roles still operate on demo data layered on top of the now-real database (see section 14) — persistence existing doesn't mean every UI control is wired to it yet. Ticketing is now a partial exception: Jira is real (section 8.13), Linear/Asana/GitHub Issues remain demo data.
6. ~~Add the real-time layer~~ — done (SSE, still process-global, not yet org-scoped — see section 8.10); a background queue (BullMQ) is still worth adding once webhook volume justifies moving off the pipeline's inline execution.

Genuinely still open, in priority order: (a) real RBAC *enforcement* (the Roles matrix is UI-only — nothing in `requireAuth` checks permissions yet, it only checks "is there a valid session"), (b) encrypting `Integration.config`/`NotificationChannelConfig.config` at rest instead of plaintext JSON columns, (c) scoping SSE broadcast per-organization, (d) the `AsyncLocalStorage` refactor noted in section 8.10 to remove the shared-global-config race condition, (e) NextAuth as a drop-in replacement for the hand-rolled session/OAuth code, if that consolidation is ever worth it, (f) BullMQ, (g) Linear/Asana/GitHub Issues as real `TicketingProvider`s alongside Jira (section 8.13).
