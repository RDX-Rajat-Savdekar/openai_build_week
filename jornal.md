# OpenAI Build Week project journal

This file is the chronological record of major product decisions, implementation updates, repository changes, verification, and pushes.

> The filename `jornal.md` intentionally follows the project owner's requested spelling.

## Journal protocol

- Add an entry after every substantive project conversation.
- Record decisions separately from suggestions that remain undecided.
- List material files created or changed.
- Record verification honestly, including checks that could not be run.
- For commits and pushes, include the branch, commit hash, remote, and result only after verification.
- Append corrections instead of silently rewriting historical decisions.

## 2026-07-20 — Pivot to Stitch, prior direction archived

### Context

- Prior sessions (2026-07-19) had produced a full plan for **TracePatch CI**, an agent-trace regression tester with a two-loop design (incident repair + PR-check simulation).
- The project owner brought a new, fully-formed idea: a webhook-triggered CI-failure autonomous fixer — GPT-5.6 diagnoses a failed build from logs, Codex writes a fix against the real repository, the fix is validated, and a PR opens automatically, with no human needed to start the loop. Branch-aware behavior (different handling for `main`, `release/*`, `feature/*`, `dev`/`staging`, `hotfix/*`) and multi-platform support (GitHub, GitLab, CircleCI, Jenkins, Bitbucket) were specified as differentiators.
- This is a full pivot, not an extension of TracePatch CI — different problem, different architecture, different demo.

### Decision

- Adopted the new idea as the active submission under the name **Stitch** (stitch.dev), chosen by the project owner over "PatchPilot" and keeping the old "TracePatch CI" name.
- Track: **Developer Tools**.
- Archived all TracePatch CI and A11y Sentinel material — `README.md`, `AGENTS.md`, `jornal.md` (prior version), `openai_project.md`, and `plan/` — into a new `ex-idea/` directory at the repository root, preserved verbatim for reference. It is explicitly not part of the active submission.
- Rewrote `README.md`, `AGENTS.md`, `jornal.md` (this file), and `openai_project.md` at the repository root for Stitch.
- Created `plan/stitch-implementation-plan.md` and `plan/stitch-project-dashboard.html`.
- Added a root `LICENSE` (MIT) since the hackathon rules require a public repo to carry "relevant licensing."

### Scope decision (time-boxed)

- The submission deadline is **2026-07-21, 5:00 PM PT** — same day / next day from this entry. A multi-platform, fully branch-aware build is not realistic in the remaining time.
- Set the MVP cut line explicitly: **GitHub Actions only, `main`-branch aggressive auto-fix (auto-fix + auto-PR + Slack alert), one seeded demo repository with a deliberately committed bug.**
- GitLab support and the full branch-aware behavior matrix (release/feature/dev/hotfix handling) are documented as stretch goals in the implementation plan, with the branch router built so adding them is configuration, not a rewrite — but the MVP does not depend on them shipping.
- This scope call was made to avoid the outcome the judging criteria explicitly penalize: "broad but unreliable" over "polished end-to-end for one specific problem."

### Repository update

- Moved to `ex-idea/`: `README.md`, `AGENTS.md`, `jornal.md`, `openai_project.md`, `plan/tracepatch-ci-implementation-plan.md`, `plan/tracepatch-project-dashboard.html`, `plan/accessibility-regression-agent-plan.md`.
- Created at root: `README.md`, `AGENTS.md`, `jornal.md`, `openai_project.md`, `LICENSE`, `plan/stitch-implementation-plan.md`, `plan/stitch-project-dashboard.html`.
- No application code exists yet. This entry covers documentation and planning only.

### Verification

- Confirmed via filesystem listing that the archive move completed and the root directory contains only the new Stitch documents plus `ex-idea/`.
- Did not run any build, test, or lint commands — no application code exists yet to check.
- Git-based diff/commit verification was not performed; no commit has been made or requested as part of this entry.

### Open questions / next steps

- Build the GitHub-only MVP slice: webhook receiver -> log fetch -> GPT-5.6 diagnosis -> Codex fix -> validation -> PR -> Slack notify.
- Stand up the seeded demo repository with a deliberate, demo-friendly bug.
- Fill in the README's "How Codex and GPT-5.6 were used" section and capture the `/feedback` Codex Session ID once the core build session happens.
- Record the demo video (<3 minutes, public YouTube, audio covering Codex + GPT-5.6 usage) once the MVP is working end-to-end.
- Decide and document judge-facing access: public repo, or private + shared with `testing@devpost.com` and `build-week-event@openai.com`, plus a way to test without rebuilding.

## 2026-07-20 - SaaS plugin architecture: all CI/CD providers, email + Slack, first code scaffold

### Decision

- Expanded scope from "GitHub-only MVP" to a plugin architecture covering all five originally-listed CI/CD providers (GitHub, GitLab, CircleCI, Jenkins, Bitbucket) and two notification channels (Slack, Email), at the project owner's explicit request.
- Confirmed with the project owner: (1) the SaaS "Integrations"/"Notifications" UI is documented now (full screen spec in the plan) but not built as real UI this session — the owner will decide later whether to build it as time permits; (2) all five CI/CD plugins get coded now, but only GitHub is live-tested and used for the demo, since it is the only provider we can test against a real repo before the deadline.
- Every CI/CD provider and every notification channel now shares one interface (`CiCdPlugin`, `NotificationChannel`) and a registry, so the product is positioned and structured SaaS-style: connect a provider/channel once, every repo under the workspace benefits, adding a sixth provider later is a registration, not a rewrite.

### Repository update

- `plan/stitch-implementation-plan.md`: added section 5 (`CiCdPlugin` interface, plugin table for all 5 providers), section 6 (notification channel interface, Slack + Email), section 8 (SaaS product structure — workspace model, Integrations screen spec, Notifications screen spec, Activity feed, UI build order), renumbered sections 7-14 accordingly, updated the architecture diagram, repo structure, and MVP-scope wording throughout.
- `README.md`: rewrote the architecture diagram, added Integrations and Notifications tables (all 5 providers, both channels), updated tech stack, repo structure, and setup instructions.
- `plan/stitch-project-dashboard.html`: replaced the single "Platforms" tab with separate **Integrations** (5 connect cards, clickable mock connect/disconnect state) and **Notifications** (Slack/Email toggle cards) tabs.
- First application code created:
  - `src/platforms/types.ts` — `CiCdPlugin` interface, `NormalizedFailure`, `Diagnosis` types.
  - `src/platforms/github.ts` — full implementation (Octokit): webhook signature verification, normalize, fetch logs, fetch file contents, open PR, comment on PR.
  - `src/platforms/gitlab.ts`, `circleci.ts`, `jenkins.ts`, `bitbucket.ts` — interface-complete, `verifyWebhook`/`normalize` implemented against each provider's documented payload shape (not live-tested), provider API calls (`fetchLogs`, `fetchFileContents`, `openPr`, `commentOnExisting`) explicitly throw with a TODO message rather than faking success.
  - `src/platforms/registry.ts` — plugin registry (`allPlugins`, `connectedPlugins`, `pluginFor`), the intended data source for the future Integrations screen.
  - `src/notify/types.ts`, `slack.ts` (real webhook POST), `email.ts` (real nodemailer/SMTP send), `index.ts` (dispatcher against workspace + per-channel config).
  - `src/router/branchRouter.ts` — pure function implementing the full 5-mode branch table plus a safe default for unmatched branches.
  - `src/config/env.ts`, `src/config/workspace.ts` — central env loader (all provider/channel vars) and a demo workspace config matching the section 8.1 shape.
  - `src/server.ts` — Express webhook receiver wiring plugin -> branch router -> (diagnosis/fix, stubbed) -> notify, plus `/integrations` and `/healthz` routes.
  - `src/diagnosis/diagnose.ts`, `src/fix/generateFix.ts` — explicit stubs for the GPT-5.6 and Codex calls; not implemented yet, next on the MVP list.
  - `package.json`, `tsconfig.json`, `.env.example`, `.gitignore` — added since a real Node/TypeScript project now exists.

### Verification

- Ran `npm install` — 255 packages installed cleanly (via PowerShell; the Bash/Git-Bash tool's `npx` could not resolve `node` on this machine's PATH, PowerShell's could).
- Ran `npx tsc --noEmit -p tsconfig.json` — exit code 0, no type errors across all new source files.
- Ran the branch router against all five patterns plus an unmatched branch via `tsx`; output matched the table in the plan exactly, including the safe default (`comment-only`, `autoFix: false`) for branches that match nothing.
- Did not test any live provider API call (GitHub included) — no credentials configured in this environment. `diagnose()` and `generateFix()` are intentionally unimplemented stubs, not yet exercised.

### Open questions / next steps

- Implement `diagnose()` (GPT-5.6) and `generateFix()` (Codex) — the two remaining stubs blocking an actual end-to-end run.
- Add the fix-validator stage (apply diff to scratch clone, run tests) before `server.ts` is allowed to call `plugin.openPr`/`commentOnExisting` — currently the pipeline stops short of that call on purpose.
- Stand up the seeded demo repository and a real GitHub App/token to exercise the full loop live.
- Decide, once the MVP is demoed and recorded, whether to spend remaining time on the real Integrations/Notifications UI (plan section 8.5) or on live-testing one more CI/CD plugin.

## 2026-07-20 - Real dashboard: Integrations, Notifications, Activity

### Decision

- Built the real frontend that plan section 8 had deferred, at the project owner's request ("now we need front end for this right!"). Scope: a working dashboard, not another mockup — served statically by the same Express process, no separate build step or frontend framework, to keep "one thing to run" for the demo.
- Config connected through the dashboard is in-memory only (a new `updateEnvSection`/`clearEnvSection` pair in `src/config/env.ts` mutates the already-mutable `env` object at runtime). Deliberately not persisted to `.env` or disk — the dashboard should never be the thing that writes secrets to a file this session doesn't own. This resets on restart; documented as a known gap versus a real multi-tenant secrets store, not silently glossed over.
- Kept the "GitHub is live-tested, the other four are coded but not" distinction visible in the UI itself (a `liveTested` flag per plugin, sourced from `platforms/connectFields.ts`), so the dashboard doesn't imply GitLab/CircleCI/Jenkins/Bitbucket work end-to-end when they don't yet.

### Repository update

- `src/config/env.ts` — added `updateEnvSection`/`clearEnvSection`.
- `src/notify/activityLog.ts` (new) — in-memory, newest-first log of every notification dispatch.
- `src/notify/index.ts` — `notify()` now sends to each channel independently (one failing channel no longer blocks the others), records every dispatch to the activity log, and gained `sendTestNotification()` for the dashboard's "Send test" button.
- `src/platforms/connectFields.ts`, `src/notify/connectFields.ts` (new) — field metadata (name/label/input type) per plugin and per notification channel, so the frontend renders connect forms generically instead of one hardcoded form per provider.
- `src/api.ts` (new) — REST API behind the dashboard: `GET/POST /api/integrations[...]`, `GET/POST /api/notifications[...]`, `POST /api/notifications/:key/test`, `GET /api/activity`.
- `src/server.ts` — now serves `public/` as static files and mounts the API router at `/api` (scoped `express.json()`, kept separate from the webhook route's raw-body parser). Removed the old ad-hoc `/integrations` route, superseded by `/api/integrations`.
- `public/index.html`, `public/app.js` (new) — the real dashboard: Integrations, Notifications, and Activity tabs, vanilla HTML/CSS/JS, no build tooling, theme-aware styling reused from the plan's mockup dashboard.
- `README.md`, `plan/stitch-implementation-plan.md` (section 8.5) updated to describe the dashboard as built, not planned, and to be explicit about what's still missing (persistence, real auth/multi-tenancy).
- Synced `npm install` after the user's in-editor package.json edits (`nodemailer` -> ^9.0.3, `vitest` -> ^3.2.7); no incompatibilities found.

### Verification

- `npx tsc --noEmit` — exit 0 across the full source tree including the new files.
- Booted the server and drove it live (not just typechecked):
  - `GET /` and `GET /app.js` — 200, dashboard serves.
  - `GET /api/integrations`, `/api/notifications`, `/api/activity` — correct real data (all disconnected/unconfigured/empty on a clean boot).
  - `POST /api/integrations/github/connect` with a fake token/secret — flipped `connected: true` immediately; `POST .../disconnect` flipped it back — confirms the in-memory config layer actually works, not just compiles.
  - `POST /api/notifications/slack/test` before configuring — correctly `400`s.
  - Configured Slack with a fake webhook URL, sent a test — got a real network failure (`fetch failed`), correctly recorded in `/api/activity` with the exact error and zero `sent` channels. This confirms the dashboard's "Send test" hits a real `fetch()` call, not a stub.
- Did not test GitLab/CircleCI/Jenkins/Bitbucket connect flows against real accounts (none exist) — their `isConnected()`/connect round-trip was exercised structurally (same code path as GitHub), their provider API calls remain untested per the existing TODOs.

### Open questions / next steps

- Still blocking an actual end-to-end fix: `diagnose()` (GPT-5.6) and `generateFix()` (Codex), plus the fix-validator gate before `openPr`/`commentOnExisting` can be called — unchanged from the prior entry.
- Decide whether remaining time goes to implementing those two stubs (needed for the recorded demo) versus live-testing a second CI/CD plugin or adding dashboard polish — implementing the stubs is higher priority since nothing else in the MVP definition-of-done is reachable without them.

## 2026-07-20 - Full SaaS product UI mockup

### Decision

- Replaced `plan/stitch-project-dashboard.html`'s prior purpose (an interactive explainer of the implementation plan — overview/pipeline/branch table/scope/demo script) with a full professional SaaS product UI mockup, at the project owner's request, expanding on a detailed "PatchPilot"-style product concept they provided (five response-mode trust levels, a confidence engine, per-branch/per-platform settings, a full documentation suite: fix log, audit trail, changelog, incident reports, weekly digest).
- Kept the product name **Stitch** rather than adopting the pasted concept's "PatchPilot" name — the request was scoped to redesigning one mockup file, not a repo-wide rebrand; flagged this choice rather than silently deciding either way.
- Chose not to copy the pasted concept's emoji-heavy styling into the actual UI chrome (🤖🔧🔍 etc.) — used color, badges, and icons instead, since real professional SaaS dashboards (the explicit ask) signal state through color/iconography/typography rather than emoji glyphs in the product surface itself.
- Added one clear disclaimer banner at the top of the page distinguishing it from the real app ("Product UI mockup — illustrative screens with sample data, not wired to a backend"), so it can't be mistaken for the working dashboard in `public/`.
- Mode badges encode autonomy level through a deliberate visual-weight ramp (solid violet -> blue -> amber -> neutral-filled -> outline-only for Notify Only) rather than five arbitrary colors — each is always paired with its text label, so identity never depends on color alone.
- Confidence tiers (High/Medium/Low) and the weekly digest's outcome breakdown reuse the same three status colors (good/warn/critical) throughout the page, consistent with the dataviz skill's rule that status color is reserved and never doubles as a categorical series color.

### Repository update

- Rewrote `plan/stitch-project-dashboard.html` in full: a real app shell (workspace-switcher sidebar with icon nav, topbar with search/notifications/avatar) replacing the old top-tab-bar layout, and six pages — Dashboard (stat tiles with sparklines, live incident feed, repo status, confidence breakdown), Fix Log (expandable fix cards with root cause, confidence meter, diff viewer, outcome), Audit Trail (tamper-evident action timeline), Changelog (auto-generated, grouped by date), Reports (Incident Reports + Weekly Digest as a sub-tabbed view), and Settings (response modes reference, global behavior, branch rules, integrations reusing the prior connect/disconnect interaction, notifications for six channels, documentation retention/export config, PR settings, team & access, API key).
- README updated with a pointer to the mockup and what it's for versus the real app.

### Verification

- Structural check: opening/closing tag counts balanced across `div`, `section`, `details`, `summary`, `table`, `tbody`, `tr`, `svg`, `nav`, `aside`, `header`, `main`, `ul`, `select`, `button` (all matched, via a grep-based count script).
- JS syntax check: extracted the inline `<script>` block and parsed it with `new Function()` — no syntax errors.
- Rendered and visually inspected the actual page: used headless Microsoft Edge (`--headless --disable-gpu --screenshot`) to capture the Dashboard, Fix Log, and Settings pages and viewed the resulting PNGs directly. Confirmed dark-mode styling, sparklines, stacked confidence bar, mode badges, the diff viewer, and sidebar nav-highlighting all render correctly with no layout breakage.
- Investigated an apparent horizontal-scrollbar artifact seen when driving tab-switching through a temporary iframe test harness; confirmed via a corrected harness (removed the outer wrapper's own default margin/inline-gap) that it was a test-harness artifact, not a real overflow bug in the mockup — the page itself has no horizontal scroll at 1440px.
- Deleted all temporary screenshot and test-harness files after verification; nothing left behind in `plan/`.

## 2026-07-20 - Readiness gap-list + mockup expansion (Issue Records, rollback, more dashboard widgets)

### Context

- Project owner asked for two things together: (1) an honest check of what's still needed before "real implementation," and (2) more dashboard widgets, a per-issue markdown documentation section, rollback/revert buttons, and a branch-scoped view — added to the mockup and reflected in the planning docs.

### Gap-list delivered

Reported to the project owner directly (also captured in `plan/stitch-implementation-plan.md`, section 14, "Current status: built vs. documented-only vs. not started"):
- **Blocking:** `diagnose()` (GPT-5.6) and `generateFix()` (Codex) are still stubs; no fix-validator stage exists; `server.ts` intentionally stops before `openPr`/`commentOnExisting`; no seeded demo repo, real `.env`, or live GitHub App/webhook; demo video and README's "How Codex and GPT-5.6 were used" section and `/feedback` Codex Session ID are all still pending; judge-access path (public vs. private+shared) undecided.
- **Should-have:** zero test files exist despite `vitest` being wired in `package.json`; only GitHub is live-tested; all data is in-memory only.
- **Nice/background:** real Issue Records generation, real rollback, real branch-scoped dashboard filtering — exactly what got designed into the mockup this session, so they're ready to build rather than invented later.

### Decision

- Expanded `plan/stitch-project-dashboard.html` rather than the real app (`src/`, `public/`) this session — the request was explicitly scoped to the mockup plus documentation updates, not a request to build these into the working backend. Flagged this scoping explicitly rather than silently deciding.
- Added a new nav page, **Issue Records**: a two-pane file browser (`.stitch/issues/<id>-<slug>.md` per fix) with a rendered-markdown preview pane, matching the project owner's ask for "one file per issue, beside the log." Specified this as a real, buildable feature in the implementation plan (section 8.6) — durable, git-tracked, portable records that survive disconnecting the integration, not just another database table.
- Added a **revert/rollback** interaction: a "Revert this fix" button on merged Fix Log cards and in the Issue Record view, plus a fourth example fix (#239) showing the full lifecycle (auto-merged -> regression found -> reverted, record updated in place rather than deleted). Specified the real mechanism in section 8.6 (`CiCdPlugin.revertPr()`, a sixth plugin method; a new `fix_reverted` notification/audit event).
- Added **branch-scoped views**: a branch filter on the Fix Log filter row, and a new "Branch activity" dashboard card that aggregates by branch pattern (via the branch router's own matching, not by repo) — kept deliberately separate from "Repository status" since the same repo behaves differently per branch by design (section 4).
- Added dashboard widgets: a 7-day weekly-activity bar chart, a "Needs your attention" actionable queue (escalations + pending reviews), and a Codex/GPT-5.6 cost-and-usage meter (ties to the hackathon's own "watch your credit usage" guidance). Noted in section 8.6 that the first two are free once activity persistence exists, but the cost widget needs real OpenAI usage-API integration that nothing today provides.
- Colors/marks for all new widgets reused the existing validated token system (status colors for the bar-chart stack, the same meter/track pattern, the same badge formula) rather than introducing new ad hoc colors.

### Repository update

- `plan/stitch-project-dashboard.html`: added the Issue Records page, revert buttons + a 4th "Reverted" fix example, a branch filter on Fix Log, and three new Dashboard cards (Weekly activity, Needs your attention, Branch activity) plus a Codex/GPT-5.6 usage card. New CSS for bar charts, the two-pane issue browser, rendered-markdown typography, attention rows, and branch rows — all built on the existing token system, no new colors introduced.
- `plan/stitch-implementation-plan.md`: added section 8.6 (issue records, rollback, branch-scoped views — technical spec for all three); replaced section 14 with a three-bucket "built / documented-only / not started" status breakdown; updated the top-of-file status line (was stale — still said "application code not yet started"); added a unit-test checklist item to section 15.
- `README.md`: updated the mockup pointer to name the new features and point to the plan's section 14 status breakdown.

### Verification

- Structural check after every edit round: balanced open/close tag counts (`div`, `section`, `details`, `table`, `svg`, `button`, `pre`, etc.) via a grep-based script — all matched.
- JS syntax check via `new Function()` on the extracted `<script>` block — no errors.
- Rendered and visually inspected the actual page again via headless Microsoft Edge screenshots: Dashboard (bar chart, needs-attention queue, branch activity, cost meter all render correctly), Fix Log (branch filter, red revert button, 4th reverted card with its badge), and Issue Records (file list + rendered markdown preview, clicking a file swaps the preview — verified via a scripted click through the test harness). All temporary screenshot/harness files deleted after verification.

### Open questions / next steps

- Unchanged from the prior entry: `diagnose()`, `generateFix()`, and the fix-validator gate remain the highest-priority real work. Everything added this session is documented and mockup-shown, deliberately not built into `src/`/`public/` yet.

## 2026-07-20 - Full roadmap captured in both plan doc and mockup

### Context

- Project owner asked "what else remains for improvement or a final version" and requested a full list (RBAC, more features, etc.). That list was delivered in chat, then the owner asked for every single item to be written into the plan docs and reflected in the HTML mockup, with the instruction to follow through strictly and completely — i.e. no trimming or summarizing the list down.

### Decision

- Added the full audit as a new, permanent section (16) in `plan/stitch-implementation-plan.md` rather than leaving it as a one-off chat answer — organized into the same 9 categories used in chat (security/RBAC, core product features, reliability/hardening, testing, compliance/enterprise, billing, integration depth, hackathon-submission-specific, long-term differentiators), each item given an explicit priority (Now/Next/Later/Future) and a one-line reason.
- Mirrored the same content, verbatim in substance, into a new **Roadmap** page in `plan/stitch-project-dashboard.html` — a new sidebar group ("Plan") with collapsible category cards, so the mockup and the written plan never drift into two different lists.
- Kept the framing explicit in both places: this is planning only, nothing here is built, and none of it should be started before the section 14 "not started at all" list (`diagnose()`, `generateFix()`, fix-validator, etc.) is done.
- Reused the existing badge/color system for priority (accent=Now, blue=Next, warn=Later, outline=Future) rather than introducing new colors — consistent with the established design system.

### Repository update

- `plan/stitch-implementation-plan.md`: added section 16 "Roadmap / post-MVP" — 9 subsections, ~42 individual items, each as a small table with Item / Priority / Note.
- `plan/stitch-project-dashboard.html`: added a "Plan" sidebar group with a **Roadmap** nav entry; a new page with a priority legend and 9 collapsible category cards (`<details>`), each listing every item from section 16 with a priority badge and note, matching the plan doc 1:1.

### Verification

- Structural check after the edit: balanced open/close tag counts across `div`, `section`, `details`, `summary`, `table`, `svg`, `button`, etc. — all matched (471/471 divs, 13/13 details, etc.).
- JS syntax check via `new Function()` on the extracted `<script>` block — no errors (nav/interaction JS was untouched by this change, only content added).
- Rendered and visually inspected the Roadmap page via a headless Microsoft Edge screenshot, with the "Security & access control" category expanded by default — confirmed all 7 items render with correct priority badges, correct nav highlighting, and the other 8 categories collapse correctly with accurate item counts. Temporary screenshot/harness files deleted after verification.

### Open questions / next steps

- Unchanged: `diagnose()`, `generateFix()`, and the fix-validator gate remain the highest-priority real work (section 14). The roadmap added this session is intentionally sequenced after all of that.

## 2026-07-20 - Correction: roadmap was missing from README/AGENTS/openai_project.md

### Context

- Project owner asked directly whether the roadmap had been added to documentation "all type wherever needed." Checked via grep and it had not — the previous entry's claim of updating "all planning .md files" was true for `jornal.md` and `plan/stitch-implementation-plan.md` only; `README.md`, `AGENTS.md`, and `openai_project.md` had no mention of the roadmap or section 16 at all. Correcting that here per the standing rule to append corrections rather than silently rewrite history.

### Repository update

- `README.md`: added a new "## Roadmap" section (before "How Codex and GPT-5.6 were used") summarizing all 9 categories at a glance and pointing to the plan doc section 16 and the mockup's Roadmap page.
- `AGENTS.md`: added a convention — new feature ideas from any source belong in plan section 16 (mirrored into the mockup), not scattered into ad hoc notes, so this gap doesn't recur.
- `openai_project.md`: added one line connecting the mockup/roadmap to the "potential impact" and "quality of idea" judging criteria, with an explicit caveat that the video/description still must match what's actually built.

### Verification

- Re-ran the grep check (`roadmap|section 16` across all `*.md`) after the edits — now matches in `README.md`, `AGENTS.md`, `openai_project.md`, `jornal.md`, and `plan/stitch-implementation-plan.md` (the `ex-idea/jornal.md` match is unrelated archived content).

## 2026-07-20 - Settings page made comprehensive: OpenAI key, 6 new sections

### Context

- Project owner asked to add an OpenAI/model API key option to Settings and to make the whole Settings page "fully ready" with all options the project needs.

### Decision

- Expanded the mockup's Settings page from 8 to 14 sections. New: **AI models & API keys** (OpenAI key input + GPT-5.6/Codex model pickers + quota-fallback behavior — placed first since nothing else works without it), **Rollback & safety** (who can revert, an auto-revert-on-repeat-failure safety net, revert-reason requirement), **Repositories** (per-repo mode/branch-policy override, distinct from the pattern-based Branch Rules screen), **Security** (autopilot-approval gate, session timeout, IP allowlist, 2FA — explicitly labeled "planned" rather than implied working), **Plan & billing** (labeled "illustrative" — no pricing model actually exists), **Danger zone** (disconnect-all / export-all / delete-workspace, red-bordered).
- Noted explicitly in the plan doc (new section 8.7) that the AI Models & API Keys screen is the one item in this batch that configures something already real: `OPENAI_API_KEY` already exists in `src/config/env.ts` and `.env.example`. Flagged it as the cheapest thing here to actually wire up later (same pattern as Integrations/Notifications), but did not build it into `public/` without being asked, per the standing AGENTS.md convention.
- Added a small interactive touch (not just static markup): the "Test connection" button reads whether the key field has a value and flips a status badge between "Not configured" and "Connected" — consistent with how other interactive elements in this mockup behave (connect/disconnect toggles, revert buttons).

### Repository update

- `plan/stitch-project-dashboard.html`: added 6 new `settings-section` blocks, extended the `settings-nav` anchor list to 14 entries, added `.danger-zone`/`.danger-row` CSS, added the "Test connection" JS handler.
- `plan/stitch-implementation-plan.md`: added section 8.7 ("Full settings surface") — a table of all 14 Settings sections with real/mockup-only status and a note per section; updated section 14's documented-only bucket to list the full 14-section settings surface instead of the old generic description.

### Verification

- Structural check: balanced tag counts across `div` (523/523), `table` (3/3), `select` (23/23), `button` (58/58), etc. — all matched.
- JS syntax check via `new Function()` on the extracted script — no errors.
- Rendered via headless Microsoft Edge across two scroll positions (top of Settings and scrolled to the bottom) to visually confirm every new section: AI models & API keys card with working-looking Save/Test buttons, Rollback & safety callout referencing the Fix #239 example, the Repositories table with mode badges and toggles, Security's "Planned — roadmap 16.1" badge on 2FA, Plan & billing's usage meter, and the red-bordered Danger zone with all three destructive actions. Learned and corrected a test-harness bug mid-verification: the wrapper iframe's own fixed height (not the browser window size) determines how much of a long page gets captured — fixed by scrolling the iframe's content instead of just growing the outer window. Temporary screenshot/harness files deleted after verification.

## 2026-07-20 - Ticketing tools support & automation (Linear/Jira/Asana/GitHub Issues)

### Context

- Project owner asked to add ticketing tool support and automation to both the mockup and the documentation, and to double-check whether anything from prior turns was missing from the `.md` files (a direct continuation of the correction made earlier this same day for the Roadmap).

### Decision

- Gave ticketing the same tier of treatment Issue Records and rollback got earlier (section 8.6) rather than leaving it as the vague, disabled "Coming soon" card it had been since the very first mockup pass: a real interface (`TicketingProvider`), a real automation-rule config (`TicketingAutomationConfig`), and a documented lifecycle that reuses pipeline events that already exist (`diagnosis_failed`/escalation → create; merge → close; `fix_reverted` → reopen) rather than inventing new ones.
- Modeled ticketing as its own plugin family, explicitly **not** a `CiCdPlugin` and **not** a `NotificationChannel` — it needs bidirectional lifecycle sync (create, then later update the same ticket) that neither existing interface supports. Documented why, not just what.
- `github_issues` reuses the already-connected GitHub token rather than requiring a second connect flow — modeled as an enable toggle in the mockup instead of a Connect button, to make that distinction visible rather than implying a redundant auth step.
- Removed the old disabled Linear/Jira card from the CI/CD Integrations grid (it was miscategorized there from the start — Linear/Jira aren't CI/CD providers) and replaced it with a pointer to the new dedicated Ticketing section.
- Added a `ticketId?` field to the `IssueRecord` interface (section 8.6) rather than inventing a separate storage concept — the Fix Log card, the Issue Records page, and the ticket itself all cross-link through that one field.
- Re-verified documentation completeness across all `.md` files per the direct ask, following the same check used earlier for the Roadmap gap: confirmed README now names ticketing in both the mockup-pointer paragraph and its own new section, and confirmed AGENTS.md's existing conventions (don't build mockup-only features into `src/`/`public/` unless asked; log new feature ideas in plan section 16) already generically cover ticketing without needing feature-specific edits — same for `openai_project.md`, whose existing mockup/roadmap pointer already covers new mockup features generically.

### Repository update

- `plan/stitch-implementation-plan.md`: added section 8.8 ("Ticketing integration & automation" — `TicketingProvider` interface, `TicketingAutomationConfig`, lifecycle mapped to existing events); added a `ticketId?` field to `IssueRecord` (section 8.6); updated section 5's platform table row (was "Backlog, not a CI/CD plugin", now points to 8.8); updated section 8.7's settings-surface table (added a Ticketing row, 14 sections → 15, noted Integrations is now CI/CD-only); updated section 11's stretch-goal bullet; updated section 14's documented-only bucket.
- `plan/stitch-project-dashboard.html`: removed the old Linear/Jira placeholder card from CI/CD Integrations; added a new "Ticketing" settings section (Linear/Jira/Asana/GitHub Issues cards + an Automation rules card with create-on condition, project/board, confidence→priority mapping, auto-close/auto-reopen/link-in-PR toggles); added a "Ticketing" anchor to the settings nav; added ticket badges/sections to Fix Log cards #251 (`JIRA-1190`) and #256 (`LINEAR-482`), to their Issue Records list entries and markdown docs, and to the Dashboard's "Needs your attention" rows.
- `README.md`: expanded the mockup-pointer paragraph to name ticketing and the full 15-section settings surface; added a new "## Ticketing" section (provider table + automation summary) between Notifications and Tech stack.

### Verification

- Structural check: balanced tag counts across `div` (546/546), `select` (28/28), `button` (62/62), etc. — all matched after the ticketing edits.
- JS syntax check via `new Function()` on the extracted script — no errors (no JS changes were needed for this feature; existing connect-toggle handlers already cover the new Ticketing cards via the same `[data-action="connect"]` selector).
- Rendered via headless Microsoft Edge at two scroll positions to confirm the full Ticketing settings section (all four providers, the automation-rules card, the confidence→priority selects, the callout referencing Fix #251/#256) and the Integrations section's replacement note with a working in-page link.
- Grepped the rendered file for `JIRA-1190` and `LINEAR-482` — 4 occurrences each, matching the 4 intended insertion points (Fix Log card, Issue Records list tag, Issue Records markdown doc, Dashboard attention row) exactly. Temporary screenshot/harness files deleted after verification.

## 2026-07-21 - Full-fledged mockup: marketing site, auth, org/roles/permissions, live status, real animations

### Context

- Project owner asked for the mockup to be taken "to the fullest" before actual-code build starts: organization management, roles/permissions management, profile management, time zone/locale for app and project activity, a marketing site (Home, About, Landing, Pricing, Contact Us), a login/signup flow to get into the app, dynamic/real-time dashboard widgets, custom badges, working notification actions, working profile menus, and a health/liveliness/operational status page. Explicit instruction to take the time to do it completely and correctly.

### Decision

- Restructured the single-file mockup into three mode shells (`marketing` / `auth` / `app`) toggled via a `data-mode` attribute on `<body>`, rather than bolting marketing/auth pages onto the existing app-page-switching mechanism — a login screen and a marketing nav are genuinely different chrome from the sidebar app shell, and conflating them would have made the CSS fight itself.
- **Changed the mockup's default entry point from the app Dashboard to the marketing Home page** — a real, visible behavior change from every prior version of this file. Flagging this explicitly since it means casually opening the file now shows a marketing page, not the product; reaching the app requires going through Sign in/Sign up (or setting `data-mode="app"` directly for quick local checks).
- Built four new app pages (Organization, Roles & Permissions, Profile, Status) as first-class sidebar destinations, not sub-tabs of Settings — they're distinct enough concerns (org identity, access control, personal account, service health) to earn their own nav entries, consistent with how Fix Log/Issue Records/Audit Trail are already separated rather than folded into one mega-page.
- Time zone/locale got two levels on purpose: an org-wide default (Organization page) and a personal override (Profile page) — mirrors how Slack/Linear/most real SaaS products handle it, and ties explicitly to "project activity" timestamps (Fix Log, Audit Trail, Changelog, Reports) per the request, not just a settings-page-only concern.
- Made exactly two things in this batch **genuinely functional** rather than static-looking mockup, and documented the distinction explicitly (plan section 17.6) rather than letting it blur: the Profile page's Appearance/theme selector (wired to CSS that has existed since the very first version of this file but was never connected to a control), and the Dashboard's count-up stat tiles + live incident-feed ticker (real `requestAnimationFrame`/`setInterval` code). Chose these two because they were the cheapest genuinely-real additions with the most visible payoff, not because everything else couldn't also be made real — everything else remains deliberately illustrative, consistent with the standing convention for this file.
- Modeled custom badges via a swatch-picker on the Roles & Permissions "create custom role" flow (six accent colors, clickable, matches the existing badge-color system rather than introducing new colors) and a compact permission matrix (8 permissions × 4 roles) covering only operations that actually exist elsewhere in this product (approve Autopilot, revert a fix, manage ticketing, etc.) rather than a generic/invented permission list.
- Notification panel and profile menu are real, working dropdowns (open/close, click-outside-to-close, per-notification action buttons that mark an item done and decrement the unread badge) — not just an icon with a static `.dot`, which is what the topbar had been since the very first pass over this mockup.

### Repository update

- `plan/stitch-project-dashboard.html`: added ~490 lines of new CSS (mode shells, marketing site, auth shell, boot overlay, dropdowns, health/status, permission matrix, org/profile, live-animation keyframes); restructured the body into `#marketing-shell` / `#auth-shell` / `#app-shell`; added the marketing site (nav + Home/About/Pricing/Contact + footer), the auth shell (Login/Signup), four new sidebar nav entries and their page sections (Organization, Roles & Permissions, Profile, Status), working topbar dropdowns (notifications with actions, profile menu), and a large JS addition (mode switching, dropdown wiring, notification actions, theme toggle, create-role panel + swatch picker, contact-form submit, animated stat tiles, live-feed ticker, status-page uptime-bar rendering).
- Found and fixed a real bug during verification: the stat-tile count-up animation's easing math clamped progress only on the upper bound (`Math.min(1, p)`), so a negative-elapsed-time reading (reproduced via Chrome headless's `--virtual-time-budget` flag, which can desync `requestAnimationFrame` timestamps from `performance.now()`) produced visibly wrong negative stat values ("−5%"). Fixed with a proper two-sided clamp (`Math.max(0, Math.min(1, p))`) — genuine defensive coding, not a test-harness-only patch, since the same unclamped gap could plausibly be hit in a real browser under tab-backgrounding/rAF-throttling conditions.
- `plan/stitch-implementation-plan.md`: added section 17 (full spec: three-mode shell, marketing site, auth shell, the four new app pages, an explicit "what's real vs. illustrative" accounting, and a mapping of each new surface to the real backend work it foreshadows); updated section 14's status summary and the section 16.8 roadmap row for "Landing/pitch page" (now built in the mockup, still needs a real hosted version).
- `README.md`: added a paragraph describing the full journey and explicitly noting the new default entry point and the two genuinely-functional pieces.

### Verification

- Structural check: balanced tag counts across `div` (780/780), `section` (16/16), `select` (39/39), `button` (102/102), etc. — all matched. No duplicate `id` attributes anywhere in the file (checked via a dedicated grep pass, since this addition introduced dozens of new IDs for dropdown triggers/panels and page sections).
- JS syntax check via `new Function()` on the extracted script (13,717 characters) — no errors.
- Rendered and visually verified, via headless Microsoft Edge screenshots, in this order: the marketing Home page (hero, stats, mode badges, feature cards, integrations chip row); the full Login → boot overlay → Dashboard flow (confirmed the new sidebar groups appear and the "Live" badge shows); the notification panel open with real action buttons; the Roles & Permissions page (role list + full permission matrix); the Status page (green banner, uptime-bar strips including the intentionally-degraded CircleCI/Codex rows, incident history); the profile menu open; and the Profile page's theme toggle actually flipping the entire rendered page to light mode.
- The count-up bug above was caught specifically because of this screenshot-based verification (a static "looks right" review would not have caught a virtual-clock-dependent glitch) — re-verified clean (74%/26.4h/89, correct final values) after the fix. All temporary screenshot/test-harness files deleted after verification.

### Open questions / next steps

- Unchanged from every prior entry: `diagnose()`, `generateFix()`, and the fix-validator gate remain the highest-priority real work (section 14). Everything in this entry is mockup/plan only, deliberately sequenced after that per the standing convention (`AGENTS.md`).
- The mockup's new default-to-marketing-page behavior is a meaningful change worth the project owner's awareness the next time they open the file expecting the Dashboard directly.

## 2026-07-21 - Marketing Home polish: live proof-of-value, ROI calculator, scroll-reveal

### Context

- Project owner asked for a "final touch-up" specifically on the user-facing marketing pages (Home and the rest) — make them dynamic, animated, and show real-time data that argues the product's value/impact/effectiveness, not just static claims.

### Decision

- Added, to the Home page specifically: scroll-reveal animation on every section; a "Happening right now" proof strip (a live rotating activity ticker + an incrementing "developer hours saved" counter); a "the gap that actually matters" animated before/after comparison (~4h manual vs. 2m 14s with Stitch — reusing figures already established elsewhere on the page, not inventing new ones); and a real-time ROI calculator (three sliders recompute hours/dollars saved live from the same 74% auto-fix rate already used in the hero stats).
- Kept the live ticker anonymized ("a workspace…") rather than naming fabricated companies — a proof-of-activity device should not read as a claim about specific identifiable customers.
- Applied scroll-reveal only where the trigger is genuine in-page scrolling (Home, About) — About/Pricing/Contact's own cards are hardcoded visible instead of observer-gated, since those pages are reached by a nav click (`display:none → block`), a fundamentally less reliable trigger for `IntersectionObserver` than real scrolling, consistent with the caution already applied to those pages in the prior session.
- Added a safety-net fallback (force-reveal anything not yet revealed after 1.8s) to the scroll-reveal system — this is a real defensive fix for a known real-world failure mode (content permanently stuck invisible behind a scroll trigger that doesn't fire), not just a response to a testing artifact, though it was testing that surfaced the need for it.

### Repository update

- `plan/stitch-project-dashboard.html`: added CSS for scroll-reveal, the live proof strip, the before/after comparison, and the ROI calculator; added the corresponding HTML to the Home page (and `reveal`/`in-view` to About's cards, hardcoded for Pricing/Contact); added JS for the reveal system + its safety net, the marketing ticker, the incrementing global counter, and the ROI calculator's live recompute.
- `plan/stitch-implementation-plan.md`: added section 17.8 with the full spec and an honest verification account.
- `README.md`: added a paragraph pointing to this pass.

### Verification

- Structural check: balanced tag counts across `div` (817/817), `select` (39/39), `button` (102/102), etc. — all matched. JS syntax check via `new Function()` on the extracted script (18,208 characters) — no errors. No duplicate `id` attributes.
- **ROI calculator** verified via direct DOM/event-dispatch testing (not a screenshot, since it depends on neither `requestAnimationFrame` nor a CSS transition): default inputs (40 failures/45min/$75) produced 22.2h/$1,665; moving failures to 120 produced 66.6h/$4,995; also moving time to 90min produced 133.2h/$9,990 — all match `failures × 0.74 × minutes ÷ 60 × cost` exactly, with slider labels staying in sync throughout.
- **Scroll-reveal safety net** verified via a DOM-level check (not a screenshot): confirmed all 12 tracked `.reveal` elements received `.in-view` correctly.
- **Screenshot verification of the reveal/counter animations specifically surfaced a real limitation of the verification method**, told straight rather than glossed over: Chrome headless's `--virtual-time-budget` mode does not reliably service `requestAnimationFrame`/CSS-transition compositor frames on the same timeline as `setTimeout`/`setInterval`, so early screenshots showed correct DOM state but pre-transition (faint) visuals. Increasing the render budget resolved most of it — the ticker, the live counter, and the before/after bars all rendered at full, correct opacity and correct values once given enough budget in a subsequent capture. Documented in plan section 17.8 rather than treated as a passed/failed binary, since the underlying page behavior is correct and only the speed of screenshot-based confirmation was limited by the test tool.
- All temporary screenshot/debug-harness files deleted after verification.

### Open questions / next steps

- Unchanged from every prior entry: `diagnose()`, `generateFix()`, and the fix-validator gate remain the highest-priority real work (section 14). This entry, like all of section 17, is mockup/plan only.

## 2026-07-21 - Tech stack review: target architecture documented, not migrated

### Context

- Project owner asked directly whether the current tech stack (Node.js + TypeScript + Express) is proper given how far the product surface has grown, or whether it needs reconsidering for "an actual web/app SaaS grade" build.

### Decision

- Assessment given straight: the backend (Express, the plugin architecture) is fine and doesn't need to change. The frontend does — `public/`'s vanilla JS is adequate only for its actual current scope (3 tabs), and the full mockup (marketing site, auth, org/roles/permissions, live dashboards) was always a design reference in a single static file, never intended as the real frontend architecture; hand-rolling all of that in vanilla JS for real would not scale.
- Asked the project owner directly whether to (a) just document a target architecture for later, or (b) start migrating today, given the hackathon deadline is today. They chose (a) — document only. Proceeded accordingly rather than assuming either way.
- Recommended stack: Next.js (App Router) + React + TypeScript, Tailwind + shadcn/ui, PostgreSQL + Prisma, NextAuth (GitHub OAuth), WebSockets/SSE for real-time, BullMQ + Redis for the background queue already called for in roadmap 16.3. Considered and set aside plain React+Vite (loses SSR/SEO for the marketing pages) and NestJS (unnecessary structure for the current API surface).
- Explicitly documented what does **not** change: the `CiCdPlugin`/`NotificationChannel`/`TicketingProvider` interfaces, the branch router, and the diagnosis/fix pipeline (sections 3–8.8) are framework-agnostic TypeScript — none of that work is invalidated by a future frontend migration.

### Repository update

- `plan/stitch-implementation-plan.md`: added section 18 ("Target architecture for a real SaaS-grade build (post-hackathon)") — the stack table with rationale, what doesn't change, and a 6-step migration phasing, deliberately not time-estimated so it doesn't invite starting early.
- `README.md`: added a note to the Tech stack section clarifying it describes what's built today, not the target architecture, pointing to plan section 18.

### Verification

- Documentation-only change; no code touched. No structural verification needed beyond confirming the new section renders as valid markdown (checked visually while editing).

### Open questions / next steps

- Unchanged: `diagnose()`, `generateFix()`, and the fix-validator gate remain the highest-priority real work today (section 14). Section 18 is explicitly not to be started before submission.

## 2026-07-21 - Logo media kit added under `media/`

### Context

- Project owner requested logo generation prompts for all standard SaaS logo use cases, then asked to organize them into a `media/` folder.

### What was added

- `media/README.md` — index, brand colors, usage workflow, priority order
- `media/brand/` — shared brand brief, negative prompt, export checklist
- `media/prompts/` — 18 numbered prompt files (primary logo through animated brief)
- `media/exports/README.md` — placeholder for generated SVG/PNG/favicon assets

### Verification

- Folder structure created; no image generation run yet. Prompts aligned to existing UI tokens (`#4a3aa7` accent, dark mode `#9085e9`).

### Follow-up — full asset generation completed

- Generated 18 AI PNG concept images (prompts 01–18) into `media/exports/png/`.
- Added hand-authored SVG geometry in `media/source/` and `media/scripts/build-assets.mjs`.
- Built 9 SVG masters, sized logomark PNGs (16–1024), `favicon.ico`, and `apple-touch-icon.png`.
- Added `npm run media:build` to regenerate vector exports.
- Updated `media/exports/README.md` with full inventory.

### Open questions / next steps

- Wire `exports/favicon/favicon.ico` and `exports/svg/stitch-logomark.svg` into `public/` and the dashboard mockup (replace placeholder "S" mark) when ready.

## 2026-07-21 - Full SaaS UI + API integration

### Context

- Project owner requested complete SaaS product: full mockup UI in `public/`, icons, animations, API wiring, diagnose/fix implementation, and `setup.md`.

### Implementation

- **`scripts/sync-ui.mjs`** — syncs `plan/stitch-project-dashboard.html` → `public/index.html` (removes mockup banner, adds favicon, logo img, polish CSS, stitch-api scripts).
- **`public/stitch-api.js`** — wires Integrations (connect modal + icons), Notifications (Slack/Email save/test), Status health, OpenAI test, SSE live feed, marketing hero GIF.
- **`public/icons.js`** — Simple Icons CDN helpers for GitHub, GitLab, Slack, Linear, Jira, etc.
- **`src/api.ts`** — extended with `/dashboard`, `/fixes`, `/status`, `/ticketing`, `/settings`, `/workspace`, `/events` (SSE).
- **`src/data/demoData.ts`** — seed fix log, status components, dashboard stats.
- **`src/diagnosis/diagnose.ts`**, **`src/fix/generateFix.ts`** — OpenAI when `OPENAI_API_KEY` set, deterministic demo fallback otherwise.
- **`src/realtime/sse.ts`** — Server-Sent Events; activity log broadcasts to dashboard.
- **`src/server.ts`** — serves `/media`, pipeline calls openPr/commentOnExisting when connected.
- **`setup.md`** — full install, env, API reference, troubleshooting.
- **`README.md`** — updated Setup/Dashboard sections pointing to setup.md.
- **`npm run ui:sync`** added to package.json.

### Verification

- `npm run typecheck` — pass.
- `npm run dev` — listening on :3000; `/healthz` OK; `/api/integrations` returns 5 plugins.
- UI sync produced `public/index.html` (~205KB).

### Open questions / next steps

- Seeded demo repo + live webhook recording still blocking submission (plan section 14).
- Expand placeholder app pages (Issue Records, Audit Trail, Organization) with full mockup content as React components.
- Post-hackathon: consider Next.js migration per plan section 18.

## 2026-07-21 - Proper React frontend codebase (`frontend/`)

### Context

- Project owner clarified `plan/stitch-project-dashboard.html` is mock UI reference only; requested a proper frontend codebase.

### Implementation

- Added **`frontend/`** — Vite + React 19 + TypeScript + Tailwind + React Router.
- Component library: Button, Badge, Card, Modal, BrandIcon (Simple Icons CDN).
- Layouts: MarketingLayout, AppLayout with sidebar nav (12 routes).
- Pages: Home (ROI calculator, ticker, animations), About, Pricing, Contact, Login/Signup, Dashboard (SSE + count-up), Fix Log, Settings (integrations + notifications live), Status, Profile (theme).
- `frontend/src/lib/api.ts` — typed API client + SSE subscription.
- Express serves `frontend/dist` when built; Vite dev on :5173 with API proxy.
- Root scripts: `npm run dev` (concurrently), `npm run frontend:build`, `npm run frontend:install`.
- Updated `setup.md` and `README.md`.

### Verification

- `npm run frontend:build` — success (dist/ ~300KB JS).
- Backend `npm run typecheck` — pass (prior session).

### Open questions / next steps

- Unchanged blocking items from plan section 14 (demo repo, webhook recording, tests).

## 2026-07-21 - Logo assets generated (18 PNGs)

### Context

- Project owner asked to generate all logo prompts as actual image files.

### What was done

- Generated 18 brand assets via image generation tool, using `stitch-logomark.png` as the reference lock for consistency across variants.
- Copied all PNGs to `media/exports/png/`; favicon copy at `media/exports/favicon/favicon-32.png`.
- Updated `media/exports/README.md` with inventory table.

### Files

- `media/exports/png/stitch-logomark.png` through `stitch-animation-storyboard.png` (18 total + `avatar-1024.png` alias)

### Verification

- Copy command confirmed 18 files in `media/exports/png/`.

### Open questions / next steps

- PNGs are raster — trace logomark to SVG before production hardening.
- `media/` is gitignored; adjust `.gitignore` if prompts should be tracked separately from exports.
- Wire logos into `public/index.html` and mockup `workspace-mark` when ready.

## 2026-07-21 — Full SaaS frontend port (React)

### Context

- Project owner asked to bring `frontend/` to full mockup parity: all pages, navigation, logos, animations, dynamic widgets, SaaS-grade polish per `plan/stitch-project-dashboard.html` and plan sections 8/17.

### What was done

- Added `frontend/src/data/demoContent.ts` — structured mockup data for all app pages.
- Built full pages (replacing placeholders): Issue Records, Audit Trail, Changelog, Reports, Organization, Roles & Permissions, Roadmap.
- Expanded Dashboard (stat deltas, weekly chart legend, repo/branch/confidence widgets, AI cost meter), Fix Log (filters, fix #239, expandable cards), Settings (all 15 sections), Profile (sessions, preferences, theme), Status (uptime bars, subscribe).
- Marketing Home: feature grid, integration chips, ROI calculator, live ticker/counters, before/after bars, closing CTA; enhanced About/Pricing/Contact.
- App shell: mobile sidebar, notification dropdown, profile menu, Lucide icons throughout, Stitch logomark + animated GIF on Home.
- Shared UI: `StatTile`, `Toggle`, `Field`, `UptimeBars`, `IntegrationChips`, hover-lift + compare-bar CSS animations.

### Files (key)

- `frontend/src/pages/app/*` — 12 app pages
- `frontend/src/pages/marketing/MarketingPages.tsx`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/data/demoContent.ts`
- `frontend/src/App.tsx` — all routes wired

### Verification

- `tsc -p tsconfig.app.json` — pass
- `npm run frontend:build` — pass (~354KB JS, ~24KB CSS)

### Open questions / next steps

- Live GitHub webhook + seeded demo repo still needed for recorded demo (simulate works offline).
- Persistence still in-memory (resets on restart).

## 2026-07-21 — Working MVP: pipeline + API + wired UI

### What was done

- **Pipeline module** (`src/pipeline/runPipeline.ts`): webhook → diagnose → generateFix → **validateFix** → PR/comment → notify → store fix + issue record + audit. Idempotent on `platform:runId`.
- **In-memory store** (`src/store/appStore.ts`): fixes, issue records, audit log, repos, AI usage counters.
- **New API routes**: `/demo/simulate`, `/issues`, `/audit`, `/fixes/:id/revert`, `/repos`.
- **Frontend wired**: Dashboard simulate buttons, Fix Log revert, Issue Records + Audit from API, live SSE on pipeline/activity.
- **Tests**: `tests/mvp.test.ts` (branchRouter + validateFix).

### Verification

- `npm run typecheck` — pass
- `npm test` — 4 passed
- `npm run frontend:build` — pass

## 2026-07-21 — Backend hardening: live GitHub path + pipeline completeness

### What was done

- **`src/fix/applyFix.ts`**: `simple-git` clone → branch → `git apply` → commit → push (uses `GITHUB_TOKEN`).
- **`src/platforms/github.ts`**: job log download via REST (not raw zip bytes); `openPr` applies diff before opening PR; `mergeGithubPullRequest` for dev/staging auto-merge.
- **`src/pipeline/runPipeline.ts`**: respects `autoFix` (diagnose-only on unknown branches), `autoMerge` on `dev`/`staging`, low-confidence escalation unchanged.
- **`diagnose.ts` / `generateFix.ts`**: demo fallback on missing or invalid OpenAI key (pipeline never hard-fails in demo).
- **`validateFix.ts`**: fixed false-positive on `---` header lines.
- **`server.ts`**: async webhook handler (202 immediately), port-in-use error message, richer `/healthz`.
- **`api.ts`**: `GET /fixes/:id`, unused import cleanup.
- **`env.ts`**: email section resets to sane defaults on disconnect.
- **Tests**: 11 passing (branchRouter, validateFix, runPipeline simulate, github normalize).

### Verification

- `npm test` — 11 passed
- `npm run typecheck` — pass

### Still open for live demo

- Seeded external demo repo + valid `.env` tokens for end-to-end GitHub PR recording.
- Full test-runner validator (clone + apply + `npm test`) remains post-MVP.

## 2026-07-21 — `public/` removed; `frontend/` verified as the sole, finished UI

### Context

- Project owner's instruction: keep `frontend/` (the real React app, built in a prior session outside this assistant's direct edits — consistent with using Codex directly), delete the legacy `public/` vanilla-JS dashboard entirely, and confirm the frontend actually works end-to-end as a finished SaaS-grade platform rather than assuming it does because the code exists.
- Audited `frontend/` in full first (every page, layout, hook, API client, context provider) before touching anything, since the code had grown substantially since the last entry in this journal without a corresponding journal update.

### Decision

- Deleted `public/` (`index.html`, `app.js`, `icons.js`, `stitch-api.js`) and `scripts/sync-ui.mjs` (the mockup->`public/index.html` sync script) — both fully superseded by `frontend/`, which already has 1:1 or better coverage of every page.
- `src/server.ts`: removed the `else` branch that fell back to serving `public/` when `frontend/dist` was missing; replaced it with a console warning telling the operator to run `npm run frontend:build` or `npm run dev`. There is now exactly one frontend, not a fallback pair.
- `package.json`: removed the `ui:sync` script (nothing left to sync into).
- `setup.md`, `README.md`: rewritten to describe `frontend/` as the actual, only, finished product UI — not a target architecture, not a WIP alongside a legacy dashboard. Tech stack and repo structure sections updated accordingly (React 19/Vite/Tailwind/React Router listed as built dependencies, not aspirational ones).

### Verification

- `npx tsc --noEmit` (backend) and the frontend's own typecheck — both clean.
- `npx vitest run` — all passing (branch router, validateFix, pipeline simulate x2, github plugin normalize x2).
- `npm run build` — full production build succeeds (API compiles, `frontend/dist` produced).
- Booted the production server (`PORT=3010`) and drove it live, not just typechecked:
  - `/healthz` → `{ok:true, openai:true, github:false, frontend:true}`.
  - `GET /` served the real SPA (confirmed via headless-browser screenshot, not just a 200/byte-count check).
  - `POST /api/demo/simulate` → full diagnose -> generateFix -> validateFix -> PR pipeline ran end-to-end and returned a coherent result (demo fallback used since the configured OpenAI key had expired — pipeline correctly degraded rather than failing).
  - `POST /api/integrations/github/connect` then `/disconnect` → `connected` flipped true then false, `repoCount` updated correctly in between — confirms the Integrations panel's backend contract actually works, not just renders.
  - `POST /api/notifications/slack/test` (unconfigured) → correct `400`, matching what the Notifications panel expects to display.
  - `POST /api/fixes/257/revert` → fix flipped from `outcome:"merged"` to `outcome:"reverted"` with an updated `outcomeText` including the given reason — confirms one-click rollback works end-to-end, not just in the UI.
- Investigated one apparent bug found during a first-pass screenshot of the marketing Home page: a large blank area below the hero/stat tiles, missing the ticker/ROI-calculator/feature sections `setup.md` promises. Root-caused by reading `frontend/src/pages/marketing/MarketingPages.tsx` and `frontend/src/hooks/useAnimations.ts`: those sections are wrapped in a `<Reveal>` component gated by `useInView`'s `IntersectionObserver` (with an 1800ms timeout fallback + a 700ms CSS transition) — the first screenshot was simply taken before that fallback fired. A second screenshot at full page height confirmed every section renders correctly with correct computed values (live ticker, incrementing counters, ROI calculator producing $1,665/22.2h at default slider positions). **Not a real bug** — same class of headless-screenshot-timing false alarm already diagnosed twice in the prior mockup work (section 17.8 above); no code change was needed or made.
- No other bugs found in this pass. All temporary screenshot files (`_shot_home.png`, `_shot_home2.png`) deleted after verification.

### Open questions / next steps

- OpenAI key in `.env` is expired (401 on both diagnosis and fix generation) — pipeline correctly falls back to demo mode, but a live GPT-5.6/Codex-backed demo recording still needs a valid key.
- Still blocking full submission per the standing list: seeded external demo repo + live webhook recording for the video, README's "How Codex and GPT-5.6 were used" section, `/feedback` Codex Session ID.
- Full interactive browser click-through (mouse clicks through Settings' 15 sections, Organization, Roles, theme toggle live in a running session) was not performed this session — verification here was via direct API calls plus headless screenshots, not a driven browser session (no Playwright/Puppeteer available in this environment). The underlying API contracts each panel depends on were confirmed correct; a full manual click-through before the recorded demo is still worth doing.

## 2026-07-21 — Mockup parity pass, then a from-scratch "SaaS-grade" redesign of the marketing/auth surface

### Context

- Project owner asked to bring `frontend/` to full parity with `plan/stitch-project-dashboard.html` ("make front end complete and fully working ... make it proper and working"), then, in a follow-up turn, asked for something beyond parity: a polished, professional, "best possible" redesign of Home/About/Pricing/Contact/Sign-in/Get-started specifically — footer, icons, background/particle effects, and richer content everywhere.

### Decision — mockup parity pass

- Delegated a page-by-page, widget-by-widget comparison of the mockup against every `frontend/` page to a research agent (read-only) rather than re-reading the ~2,900-line mockup and every page myself — returned 44 concrete, prioritized gaps.
- Fixed all 44: real bug found and fixed (Roadmap's priority badge colors were swapped relative to its own on-page legend); Issue Records markdown was being dumped raw into a `<pre>` instead of rendered — wrote a small first-party `Markdown.tsx` renderer scoped to exactly the format `generateIssueRecordMarkdown()` produces (headings/bold/code/fences/lists/hr), not a general-purpose Markdown library; Dashboard gained sparklines, a weekly-activity legend, a live-badge, a proper stacked confidence bar; Fix Log gained branch/mode filters, a confidence meter, file chips, per-fix ticket/confidence-engine copy computed from real fields (not hardcoded per fix ID, to stay consistent with the app's "real, dynamic data" philosophy); Audit Trail gained bot/human actor-avatar chips and outcome color-coding; Settings gained ~10 missing fields across seven sections; Status stopped showing fabricated uptime numbers for CI/CD connectors (those now show connection state instead); the app shell's notification dropdown became real (unread count, per-item actions, footer link).

### Decision — the redesign pass

- Built two new shared marketing components: `ParticleField.tsx` (a small hand-rolled canvas constellation effect — no new npm dependency, consistent with the project's minimal-deps convention; reads `--accent` from CSS custom properties so it's theme-aware, with a `colorVar` override for use on accent-colored panels) and `HeroBackground.tsx` (blurred floating gradient blobs + the particle field, with a `tone="invert"` variant for dark/colored backgrounds).
- Built a real multi-column `Footer.tsx` (Product/Company/Get started/Legal columns) and added it to `MarketingLayout`, along with a mobile hamburger menu (the nav previously had no small-screen behavior at all).
- Added two new real pages, `/privacy` and `/terms`, specifically so the new footer would have no dead links — written to honestly describe what this demo actually does (in-memory store, session-based auth, no real billing) rather than generic SaaS boilerplate, consistent with the project's standing honesty convention.
- Rebuilt the Login/Signup pages as a split-screen layout: a branded panel (particle/gradient background, value props, a real stat) plus a form panel with icon-prefixed inputs, a show/hide password toggle, and a terms-agreement checkbox gating the signup submit button.
- **Caught and fixed a real bug during this pass, not just a screenshot-timing false alarm this time**: on the auth pages, `ParticleField`'s lines default to `var(--accent)`, but the branding panel's own background was also `bg-accent` — same color on same color, invisible. Fixed by adding a `colorVar`/`tone="invert"` path so the auth panel's particles render in white.

### Decision — user-flagged follow-ups in the same session

- **Comparison bars not rendering (Home, "The gap that actually matters"):** root cause was a fragile custom CSS `@keyframes` animation (`animation-fill-mode: forwards` on a `scaleX` transform) with no runtime fallback — replaced with the same `useInView`-driven inline-style width transition already used reliably elsewhere in this exact file, and deleted the now-dead keyframe CSS. Lesson: prefer the codebase's own proven animation pattern over introducing a second, different mechanism for what is conceptually the same "reveal on scroll" effect.
- **"Add background research to show off on About":** deliberately did **not** fabricate a fake external study or invented statistics attributed to a nonexistent source — instead added a "Where these numbers come from" section that shows the actual methodology: the 74% auto-fix rate traced to the confidence-engine tiers already documented in Settings, the 2m 14s time-to-PR traced to the real per-stage latencies already seeded on the Status page (840ms GPT-5.6 / 1.2s Codex / 45ms API), and the top failure patterns traced to the Reports page's own weekly-digest data. Explicitly honest that this describes demo/seed data, with a link to the new Privacy page.
- **Working "Forgot password":** added a real (client-side, demo-appropriate) flow on the Login page — a `ForgotPasswordForm` sub-view with its own email field, a "sent" confirmation state using the standard "if an account exists…" non-leaking copy, and a back-to-sign-in link. Not wired to a real email system (there is no real backend account system to reset), but functionally complete as a demo interaction, matching the effort level of the rest of the demo-auth flow.
- **Mobile horizontal overflow on the Home page:** real bug, not a headless-screenshot artifact — confirmed by testing with a fresh, isolated Edge profile (ruling out session/cache reuse, which had produced misleading stale-content results earlier in the debugging). Root cause: `MarketingLayout`'s outer flex-column container's `<div className="flex-1"><Outlet/></div>` wrapper had no `min-w-0`, so its content (specifically the hero heading) could force the flex item — and therefore the whole page — wider than the viewport on narrow screens, the classic "flexbox children don't shrink below content size by default" bug. Fixed with `min-w-0` on that wrapper; also added a defensive `overflow-x: hidden` on `html`/`body` as a second line of defense against this class of bug from any future decorative background element.

### Verification

- `npx tsc --noEmit` (both root and `frontend/tsconfig.app.json`) clean after every round of changes.
- `npm run build` clean, `npx vitest run` 11/11 passing throughout.
- Rendered and visually verified via headless Microsoft Edge screenshots: Home (full page, confirming the multi-row live ticker with real timestamps), Login/Signup (confirming the particle-color fix — white constellation lines now visible against the purple panel), About, Pricing (compare table + FAQ accordion), Contact, Privacy — all render correctly with the new footer present and every footer link pointing at a real route.
- All temporary screenshot files and Edge scratch profiles deleted after verification.

## 2026-07-21 — Multi-project support (org → projects → repos)

### Context

- Project owner asked whether one account could hold multiple projects, and asked for it to be implemented in both frontend and backend, plus documentation.

### Decision

- Scoped as a grouping/organizing layer over the existing repo list, not a rearchitecture of the fix/issue pipeline: a `Project` (`id`, `name`, `description`, `defaultMode`) does not store a repo list; each repo instead carries a `project: string` field pointing back at a project id, and `GET /api/projects` computes `repoCount`/`repos` at read time. Fixes, Issue Records, and the Audit Trail deliberately stay keyed by repo, not by project — full rationale captured in plan section 8.9, including what a future "per-project fix history" feature would need to add.
- Deleting a project reassigns its repos to an auto-created `Unassigned` fallback project rather than orphaning them or cascading the delete; the last remaining project and `Unassigned` itself are protected from deletion.

### Repository update

- `src/data/demoData.ts`: added `Project` type + `PROJECTS_SEED` (3 seed projects), added `project` field to `DemoRepoConfig` and all 5 seed repos.
- `src/store/appStore.ts`: `listProjects`/`getProject`/`createProject`/`updateProject`/`deleteProject` (slug collision handling, audit-log entries on create/delete), `listRepos(projectId?)` filter, `updateRepo` now accepts a `project` patch.
- `src/api.ts`: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `?project=` filter on `GET /api/repos` and `GET /api/dashboard`, `PATCH /api/repos/:name` now accepts `project`, `/api/workspace` gained `projectCount`.
- `frontend/src/lib/api.ts`: `Project` type, `api.projects()`/`createProject()`/`updateProject()`/`deleteProject()`, `dashboard()`/`repos()` gained an optional `projectId` param.
- New `frontend/src/pages/app/ProjectsPage.tsx`: project grid, create/rename modals (reusing the existing `Modal`/`useToast` pattern from `IntegrationsPanel`), delete-with-confirm.
- Wired `/app/projects` route and a new "Projects" sidebar nav entry (`AppLayout.tsx`, reordered the Configure group to Organization → Projects → Settings → Roles to reflect the real hierarchy).
- Settings → Repositories gained a **Project** column with a live-updating `<select>` that calls `PATCH /api/repos/:name`; Dashboard gained a project filter dropdown; Organization gained a live projects/repos summary card linking to the Projects page.

### Verification

- `npx tsc --noEmit` clean (root and frontend), `npm run build` clean, `npx vitest run` 11/11 passing.
- Live API smoke test against a booted server: listed the 3 seeded projects with correct repo counts → created a new project → moved a repo into it via `PATCH /api/repos/:name` → confirmed `GET /api/dashboard?project=` correctly scoped `repoStatus` to just that repo → deleted the project → confirmed the repo landed in the auto-created `Unassigned` project rather than being orphaned → confirmed `POST /api/projects` with an empty name correctly 400s.

### Open questions / next steps

- Per-project fix/issue history is not implemented (by design this round — see plan 8.9). If requested, the right shape is a derived repo→project lookup at query time, not a stored `project` field on every fix.
- Unchanged from every prior entry: a valid OpenAI key, a seeded external demo repo, and a live webhook recording remain the blocking items for the actual submission video.

## 2026-07-21 — Real PostgreSQL database + real auth (login → every internal option)

### Context

- Project owner: "lets set the database and make all things from login to all internal options, button fully working as much as possible! installed postgresql into system!!! ... make sure each and every aspect is covered!" — the biggest, most architecturally significant request of the project so far: replace the in-memory demo store and the `sessionStorage`-flag "auth" with a real database and real accounts.
- Confirmed PostgreSQL 18 was already installed and running as a Windows service. The `postgres` role's password was unknown initially; walked the project owner through resetting it via pgAdmin's Query Tool (`ALTER USER postgres PASSWORD ...`) rather than asking for their Windows admin password (never needed — only the Postgres DB password matters to this app). Confirmed connectivity directly via `psql` before writing any schema.

### Decision

- **Prisma over raw `pg`**, matching the stack already recommended (and now largely superseded) in plan section 18 — migrations + type-safe queries were worth the extra dependency for a schema this size (11 models).
- **Schema design**: `Organization` is the tenant root; every other table carries or derives `organizationId`. A `Project` still doesn't store a repo list (per section 8.9's existing decision) — `Repo.project` is the single source of truth. `AuditEntry.fixId` is deliberately **not** a Prisma relation (no FK constraint) — pipeline-stage events are logged with `fixId=0` before a real `Fix` row exists, which would violate real referential integrity if it were a strict foreign key.
- **Auth**: bcrypt (via `bcryptjs`, not native `bcrypt`, specifically to avoid native-addon build failures on this Windows dev machine) + a `Session` table + httpOnly cookies. Deliberately not NextAuth/JWT — a database-backed session is simpler to reason about and revoke for a project this size, and doesn't require picking an OAuth provider that doesn't exist yet for this submission.
- **The one tradeoff decided on and documented rather than solved**: per-org CI/CD and OpenAI credentials are stored for real in Postgres, but the code that actually *uses* them (`platforms/*.ts`, `diagnose.ts`, `generateFix.ts`) still reads one shared, process-global `env` object — unchanged from before this migration, to avoid rewriting five plugin files plus the two OpenAI-calling files. The org's stored config is copied into that global object immediately before each use (`applyOrgConfig`/`seedEnvForOrg`). This is genuinely per-org in the common case but has a theoretical race under concurrent requests from different orgs — written up in full in plan section 8.10 rather than silently shipped as if it were fully solved.
- **Webhook routing changed shape**: since two different organizations can now each own different repos on the same platform, the GitHub webhook handler normalizes the payload *before* verifying its signature (to learn the repo name), looks up which org owns that repo, loads that org's own webhook secret, and only then verifies — a real inversion of the previous "verify first" order, necessary once there's more than one tenant.
- Scoped out of this pass, decided explicitly rather than by omission: RBAC *enforcement* (the Roles matrix stays UI-only — `requireAuth` checks "is there a session," not permissions), secrets-at-rest encryption for stored credentials (plaintext JSON columns for now), per-organization SSE scoping, and real GitHub OAuth. All captured in plan section 18.3's revised list.

### Repository update

- **New**: `prisma/schema.prisma` (Organization, User, Session, Project, Repo, Fix, IssueRecord, AuditEntry, AiUsage, Integration, NotificationChannelConfig), `prisma/seed.ts` (seeds `acme-corp` + `demo@stitch.dev`/`demo1234` + all pre-existing demo content), `prisma/migrations/20260721080327_init/`.
- **New**: `src/db/prisma.ts` (shared client), `src/auth/session.ts` (token/cookie helpers), `src/auth/middleware.ts` (`attachUser`/`requireAuth`, Express `Request` type augmentation), `src/auth/routes.ts` (`/auth/signup|login|logout|me`).
- **Rewritten**: `src/store/appStore.ts` — every function now async and takes `organizationId` as its first real argument; Prisma queries replace in-memory arrays throughout. `src/pipeline/runPipeline.ts` — takes `organizationId`, awaits every store call, seeds org config before plugin/OpenAI use. `src/server.ts` — mounts `attachUser`/`requireAuth`/`authRouter`, webhook route resolves org by repo lookup. `src/api.ts` — every route org-scoped via `req.org.id`; added `/settings/preferences`, `/settings/api-key` (+regenerate), `/danger/disconnect-all`, `/danger/export`, `DELETE /organization`, `POST`/`DELETE /repos`.
- **Frontend**: `frontend/src/lib/api.ts` gained `auth.signup/login/logout/me` plus `createRepo`/`deleteRepo`/`preferences`/`apiKey`/`regenerateApiKey`/danger-zone calls. `MarketingLayout.tsx`'s `RequireAuth` now does a real async `GET /api/auth/me` check (loading state → redirect on 401) instead of reading `sessionStorage`. `AuthPages.tsx` — real signup/login calls, inline error display (wrong password, duplicate email), "Continue with GitHub" now honestly toasts that it isn't wired rather than silently faking success. `AppLayout.tsx`, `ProfilePage.tsx` — real signed-in user's name/email/role/initials everywhere the demo previously hardcoded "Rajat Savdekar."
- `package.json`: added `db:migrate`/`db:generate`/`db:seed`/`db:studio`/`db:reset` scripts and the `"prisma": {"seed": ...}` config block; moved `prisma` (the CLI) to devDependencies, kept `@prisma/client`/`bcryptjs` as runtime deps.
- `.env`/`.env.example`: added `DATABASE_URL`.

### Verification

- `npx tsc --noEmit` clean on both `tsconfig.json` and `frontend/tsconfig.app.json`; `npm run build` clean; `npx vitest run` 11/11 passing against the real Postgres-backed pipeline.
- Live, end-to-end smoke test against a booted server: signed up a fresh account (`Test Co`) → confirmed its dashboard/projects/fixes started completely empty — a genuinely separate tenant, not a shared demo view showing through → added a repo → ran `/api/demo/simulate` → got back a real, persisted `Fix` row with a correctly-computed badge/meter, scoped to the new org's id → confirmed `/api/fixes` for that org showed only its own fix, not `acme-corp`'s seeded four → logged out → confirmed every non-auth route correctly 401s without a session → logged back in → confirmed the data was still there → confirmed a wrong password correctly 401s and a duplicate-email signup correctly 409s.
- Confirmed the pre-existing seeded `demo@stitch.dev` account's original data (4 fixes, 3 projects + Unassigned, the 7-entry audit trail for fix #247) was untouched by any of the new-account testing — real isolation, not accidental sharing.
- **Caught and fixed one unexplained data anomaly during verification**: the seeded demo org's fourth project came out of the database named "Unassigned1" instead of "Unassigned," even though both places in the source that could have created it (`prisma/seed.ts`, `appStore.ts`'s `ensureUnassignedProject`) literally write the string `"Unassigned"` with no numeric suffix logic on the `name` field anywhere in the codebase. Grepped the full `prisma/` and `src/` trees for any other source of the string — found none. Treated honestly as an unexplained one-off rather than force-fitting an explanation: corrected the stored value directly via SQL and moved on, since it's demo data (not a live code path) and the actual, current source of truth (the checked-in seed script) is provably correct.
- **Cleanup**: test data created during verification (3 extra organizations, 6 extra simulated fixes and their orphaned pipeline-stage audit rows, drifted `AiUsage` call counters on the demo org) was removed afterward via targeted `DELETE`/`UPDATE` statements — not a full `prisma migrate reset`, which Prisma itself correctly refused to run without explicit user consent when invoked from an AI agent (a real safety guard working as intended; respected it rather than working around it). The seeded demo account is back to exactly its original state.

### Open questions / next steps

- The shared-global-config race condition for per-org credentials (section 8.10) is a documented, bounded limitation, not a bug to be fixed reflexively — revisit only if concurrent multi-tenant traffic becomes a real scenario for this project.
- RBAC enforcement, secrets-at-rest encryption, per-org SSE scoping, and real GitHub OAuth remain open (plan section 18.3).
- Unchanged from every prior entry: a valid OpenAI key, a seeded external demo repo, and a live webhook recording remain the blocking items for the actual submission video.

## 2026-07-21 — Real GitHub OAuth login + live GitHub repo sync + real Jira ticketing

### Context

- Project owner: "need to implement real github login and fetch all specific and everything real time working into product... for now atleast github and jira and all system should work very perfectly!... first make an plan then we will implement faster." Requested planning before implementation; entered plan mode, researched the existing codebase (CI/CD plugin architecture, the ticketing spec already documented but never built in plan section 8.8, the auth/session work from the previous entry), wrote a plan, and the project owner approved it before any code was written.
- Named GitHub and Jira specifically as the two systems that needed to be genuinely real for this pass, not all four ticketing providers or all five CI/CD platforms — a deliberate, owner-set scope boundary.

### Decision

- **GitHub OAuth App, not a GitHub App.** This product only needs identity plus a repo/workflow read scope — a GitHub App's installation-token exchange and per-repo install scoping would have added real complexity with no corresponding value here.
- **OAuth login kept structurally separate from the org's CI credential.** The org's PAT (`Integration.config.token`, key `"github"`) remains the deliberate, admin-provisioned CI-pipeline credential; the new `User.githubAccessToken` is a personal, per-user token from login. Token-resolution precedence for repo sync: the org's PAT wins if connected, the signed-in user's personal token is only a fallback.
- **Account linking only on a GitHub-verified email match.** A user who signs up with email/password, then later logs in with GitHub using an unverified or private email, gets a second, separate organization rather than being silently linked — accepted as a known tradeoff (a real fix needs an explicit "link accounts" UI) rather than risking account-takeover via an unverified email claim.
- **"Real-time" GitHub data means on-demand sync, not a new poller.** No BullMQ/cron infrastructure exists in this project and this pass doesn't add one; the honest scope is "webhook-driven where a webhook already points at this server (already real) + on-demand sync for initial population and manual refresh."
- **Jira reuses the existing `Integration` table** (`key: "jira"`), not a new schema table — zero migration needed, same pattern already proven for the five CI/CD providers. Deliberately not added to `appStore.ts`'s hardcoded CI/CD seed array — ticketing is its own key family, seeded lazily only on connect.
- **New convention for the ticketing code specifically**: every `TicketingProvider` method takes `config` as an explicit parameter, unlike the CI/CD plugins which read from the shared global `env` object (the previous entry's documented tradeoff). This is new code with no legacy call sites to preserve, written the way that plumbing arguably should have been from the start.
- **Ticket-creation trigger generalized** from a hardcoded "only on low-confidence escalation" check to a `createOn` preference (`esc_only`/`esc_pending`/`every`, default `esc_pending`, matching the automation-rules UI's own default) — and on any failure, or when Jira isn't connected, falls back to the exact pre-existing `"JIRA-SIM"`/`"LINEAR-SIM"` literal, so the refactor is regression-safe by construction.
- Linear/Asana/GitHub Issues intentionally left exactly as previously speced (plan section 8.8) — demo-labeled, not wired. Spreading this pass's effort across four providers would have made all four weaker.

### Repository update

- **New**: `src/auth/github.ts` (OAuth authorize/token-exchange/profile-fetch helpers), `src/platforms/githubSync.ts` (`syncGithubRepos`, `resolveGithubToken`), `src/ticketing/{types,jira,connectFields,registry}.ts` (the real Jira `TicketingProvider`), `frontend/src/components/ticketing/TicketingPanel.tsx`.
- **Schema**: `User.passwordHash` made nullable (OAuth-only accounts); added `User.githubId`/`githubUsername`/`githubAccessToken`. Migration `prisma/migrations/20260721112912_add_github_oauth_fields/`.
- **`src/auth/routes.ts`**: added `GET /auth/github` and `GET /auth/github/callback` (state-cookie CSRF check, account-matching/linking/creation, never a raw 500 on failure); fixed a login type-error introduced by the now-nullable `passwordHash` with a clearer "this account signed up with GitHub" message.
- **`src/api.ts`**: `POST /integrations/github/sync`; `GET /ticketing` now blends Jira's real per-org state with the still-static Linear/Asana/GitHub Issues demo entries; `POST /ticketing/:key/connect|disconnect|test`; `GET/POST /settings/ticketing` (automation-rules preferences, merged with sane defaults on read so a partially-saved prefs object never masks the rest — caught and fixed a bug during smoke testing where `??` treated a stored `{}` as "already configured" instead of falling through to defaults).
- **`src/store/appStore.ts`**: added `getTicketingIntegration`/`upsertTicketingIntegration`, deliberately separate from `listIntegrations()`'s CI/CD seed list.
- **`src/pipeline/runPipeline.ts`**: ticket-creation logic moved out of the `lowConfidence` branch into the `createOn`-driven rule described above; best-effort `updateTicketStatus(..., "done")` immediately if a ticket is created for an already-`merged` outcome and `autoCloseOnMerge` is on. `POST /fixes/:id/revert` (in `api.ts`, not `appStore.ts`, to keep the ticketing dependency out of the data layer) best-effort reopens a real (non-`-SIM`) ticket on revert.
- **Frontend**: `AuthPages.tsx`'s "Continue with GitHub" is now a real link with `?error=` handling; `IntegrationsPanel.tsx` gained a "Sync repos now" button (shown unconditionally on the GitHub card, since a user might have a personal OAuth token even without an org PAT connected); `SettingsPage.tsx`'s Ticketing section now renders `TicketingPanel` and wires the Automation Rules card's five toggles/selects to real `GET/POST /api/settings/ticketing`, replacing every `onChange={() => {}}` no-op.
- `.env`/`.env.example`: added `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`/`GITHUB_OAUTH_CALLBACK_URL`.
- `plan/stitch-implementation-plan.md`: new sections 8.11 (GitHub OAuth), 8.12 (repo sync), 8.13 (real Jira ticketing); updated section 8.7's Integrations/Ticketing rows, section 14's built/open lists, section 16.1's stale "there is no login today" line, section 18.1's Auth row, and section 18.3's phasing list to stop claiming GitHub OAuth is unwired.

### Verification

- `npx tsc --noEmit` clean on both `tsconfig.json` and `frontend/tsconfig.app.json`; `npm run build` clean.
- `npx vitest run` extended from 11 to 12 passing — new case asserts that with `createOn: "every"` and no Jira connected, a fresh pipeline run still lands on the `"LINEAR-SIM"` fallback (regression guard for the ticket-decision refactor). Test cleanup restores the org's exact prior `preferences.ticketing` value rather than clobbering it with `{}` — the first version of this cleanup accidentally left `ticketing: {}` on the seeded `acme-corp` org, which is exactly what surfaced the defaults-merge bug above; fixed both the test and the route.
- Live smoke test against a booted server: logged in as `demo@stitch.dev` → `GET /auth/github` correctly redirects to `/login?error=github_not_configured` (no OAuth App credentials provided for this submission yet) → `GET /ticketing` shows Jira's real per-org state (`connected: false`, real fields) alongside the three static demo entries → connected Jira with placeholder credentials → `GET /ticketing` reflected it connected → `POST /ticketing/jira/test` returned a real `401` **from Jira Cloud's actual API** (`https://example-test.atlassian.net/rest/api/3/myself` — `atlassian.net` resolves and answers for any subdomain, so this genuinely proves the HTTP/Basic-Auth plumbing hits real Jira infrastructure, not a stub) → disconnected and confirmed the row cleared → `GET /settings/ticketing` returns full correct defaults → `POST /integrations/github/sync` correctly 400s with a clear message when neither a PAT nor a personal OAuth token exists → re-ran `/api/demo/simulate` end-to-end to confirm the pipeline refactor didn't regress the existing simulate flow.
- **Cleanup**: the dummy Jira connection created during smoke testing was disconnected (config cleared) before finishing; the test-cleanup bug's leftover `preferences.ticketing: {}` on the seeded org was removed via a targeted, non-destructive script, restoring the org to its exact pre-test state.

### Open questions / next steps

- A real GitHub OAuth App (Client ID/Secret) and a real Jira site + API token are both needed to exercise the live login round-trip and live ticket creation/transitions — the code degrades gracefully without them and everything short of those two external credentials has been verified.
- Everything scoped out on purpose, unchanged from the previous entry: RBAC enforcement, secrets-at-rest encryption, per-org SSE scoping, the `AsyncLocalStorage` config-race fix. Newly scoped out: Linear/Asana/GitHub Issues as real `TicketingProvider`s (Jira only, this pass).
- Unchanged from every prior entry: a valid OpenAI key, a seeded external demo repo, and a live webhook recording remain the blocking items for the actual submission video.

## 2026-07-21 — Settings module made live: every real setting actually does something

### Context

- Project owner, after confirming the GitHub repo sync worked ("repo are showing!"): "now lets go one by one! lets make whole setting module and each and every setting totally live and functional! do it aggressively!"
- Several Settings sections looked visually finished but were entirely decorative (`onChange={() => {}}` throughout) — Response behavior, Branch rules, Rollback & safety, Repositories' Mode/Enabled columns, Pull requests, Documentation, Security. Went through them methodically rather than all at once, verifying (typecheck + build + vitest) after each group.

### Decision

- **Branch Rules + Response Behavior first, as one unit** — highest leverage, since both map directly onto `src/router/branchRouter.ts`, which already existed as real pipeline logic, just never configurable per-org. `routeBranch()` now accepts an org's saved custom rules (full priority, falling back to the exact original hardcoded rules when unconfigured — zero regression) plus a repo-level and org-level default-mode fallback for anything unmatched.
- **Found a real, previously-undocumented bug while doing this**: `Repo.mode` has been stored in Postgres and rendered in the UI since the database migration (with copy literally claiming "Overrides the workspace default"), but `runPipeline.ts` never actually read it — every repo's Mode setting was pure decoration for pipeline purposes. Fixed as part of this pass, not filed as a separate ticket, since it's directly in scope of "make Repositories live."
- **Auto-revert-on-repeat-failure, made real rather than left as a Callout.** The mockup always described this ("if CI fails again within the window, Stitch reverts automatically") but nothing implemented it. Now genuinely checks for a same-repo-same-branch merged fix inside the configured window before diagnosing any new failure, and reverts it first if found.
- **Found a second, previously-undocumented gap**: the README and section 8.6 of the plan both state Issue Records are "written into your repo," and `IssueRecord.path` has always computed a real-looking file path — but nothing ever committed that file anywhere; it only ever lived in a database column. Fixed as part of "Write Fix log to repo" going from decorative to real, since that's exactly the gap that toggle claims to control.
- **Consistent honesty convention applied throughout**: every control that can't be genuinely enforced without infrastructure this project doesn't have (a job queue/scheduler for auto-merge delay/digests/retention, GitHub branch-protection API scopes for required-approvers, a request-time IP check) is still persisted for real — Save actually works and round-trips — but the Settings UI now says so explicitly via a `hint` under the field, rather than implying full enforcement.
- **Session timeout default changed from an undocumented 30 days to 8 hours** — matching what the Settings mockup had always shown as its own default value. This only affects *new* sessions created after a login/signup from this point forward; anyone already signed in keeps their existing session's TTL untouched.
- **Team & access and Plan & billing deliberately left alone** — neither has a settings *control* to wire (invites need an email-sending flow; billing needs a real payment processor), so touching them wasn't in scope of "make every setting live," only "build a missing subsystem," which wasn't what was asked.

### Repository update

- **`src/router/branchRouter.ts`** — added `label` (canonical UI mode) to `BehaviorConfig`, `MODE_TO_BEHAVIOR` map, `BranchRule`/`DEFAULT_BRANCH_RULES`, `patternMatches()` (comma-separated literals + trailing-`*` prefix globs), `routeBranch()` extended with `{customRules, repoDefaultMode, orgDefaultMode}`.
- **`src/pipeline/runPipeline.ts`** — org/prefs fetched once near the top and reused throughout (branch rules, response behavior, rollback prefs, security prefs, PR prefs, documentation prefs, ticketing prefs); `behavior` is now a clone (not a shared reference into `MODE_TO_BEHAVIOR`) so the new "require approval for Autopilot on main" override can't corrupt shared constants; new auto-revert-on-repeat-failure check (via `appStore.ts`'s new `findRecentMergedFix`); confidence floor now reads from preferences; new "write fix log to repo" step calling `applyFix.ts`'s new `commitFileToBranch()` after the Fix/IssueRecord rows exist.
- **`src/fix/applyFix.ts`** — new `commitFileToBranch()`, a lightweight follow-up commit onto an already-pushed Stitch branch, separate from `applyFixToBranch()` since the issue-record file's path needs a DB-assigned `fixId` that doesn't exist yet when the code fix itself is committed.
- **`src/platforms/github.ts`** — `openPr()` now reads `env.pullRequests` (draft/labels/diagnosis-in-body) and applies them to the real `client.pulls.create`/`client.issues.addLabels` calls.
- **`src/config/env.ts`** — new mutable `pullRequests` section + `setPullRequestConfig()`, same established pattern as `setOpenAiKey`/`setOpenAiModels`.
- **`src/auth/session.ts`** — `createSession`/`buildSessionCookie` take an explicit TTL; new `sessionTtlMsFor()` resolves an org's `sessionTimeoutHours` preference (including `"never"`).
- **`src/auth/routes.ts`** — new `orgSessionTtlMs()` helper, used at signup/login/GitHub-callback session creation.
- **`src/api.ts`** — new routes: `GET/POST /settings/branch-rules`, `/settings/response-behavior`, `/settings/rollback`, `/settings/pull-requests`, `/settings/documentation`, `/settings/security`; `POST /fixes/:id/revert` now enforces who-can-revert and revert-requires-reason before calling `revertFix`.
- **`src/store/appStore.ts`** — new `findRecentMergedFix()`.
- **Frontend**: `frontend/src/lib/api.ts` gained `BranchRule`/`ResponseBehavior`/`RollbackPreferences`/`PullRequestPreferences`/`DocumentationPreferences`/`SecurityPreferences` types and their get/save calls. `SettingsPage.tsx`'s Response behavior, Branch rules, Rollback & safety, Repositories (Mode select + Enabled toggle), Pull requests, Documentation, and Security sections were all rewritten from static demo markup to real, API-backed state — each field that's genuinely enforced says so in its `CardSub`/`Callout`; each that isn't says that too, via a `hint`. `FixLogPage.tsx` and `IssueRecordsPage.tsx`'s revert actions now prompt for a real reason instead of sending a hardcoded string.
- **`tests/mvp.test.ts`** — grew from 12 to 15 cases: a repo's own mode overriding an unmatched branch, a custom org branch rule beating both the built-in defaults and the repo's own mode, and auto-revert-on-repeat-failure actually reverting a merged fix.

### Verification

- `npx tsc --noEmit` (root + frontend) and `npm run build` clean after every round.
- `npx vitest run` 15/15 passing. One genuine regression caught and fixed mid-pass: the first version of the repo-mode-fallback design broke the existing "diagnose-only on unknown branch" test, because the seeded `acme/backend` repo's mode ("Autopilot") started overriding the fallback for *any* unmatched branch, not just the ones the test cared about. Resolved by giving that test a repo not present in the org's `Repo` table (isolating the router's own default-fallback behavior) and adding a *new*, explicit test proving the repo-override behavior is real and intentional — not by loosening the original assertion.
- Live smoke test against the project owner's own already-running dev server (deliberately not a separately started instance, so as not to disturb their live session) — confirmed all six new `GET /settings/*` endpoints return correct, real defaults matching the exact pre-existing pipeline behavior.
- **Cleanup note**: no destructive test data was created this pass beyond what vitest's own `beforeAll`/`afterAll` hooks already clean up (verified the seeded org's `preferences` blob is back to exactly its pre-session-4 state after each vitest run).

### Open questions / next steps

- Recorded-but-not-yet-enforced fields (see section 8.14's table): Response Behavior's auto-merge delay/required approvers/max PRs per hour/working hours, Documentation's changelog/incident-reports/digest/retention/export-format, Pull Requests' required approvers, Security's IP allowlist. Each is a real, separate feature (a queue/scheduler, a generator, GitHub branch-protection API scopes, a request-time IP check) rather than a wiring gap.
- Team & access (invites) and Plan & billing (real payments) remain out of scope, unchanged from every prior entry — both need external infrastructure this hackathon submission doesn't include.
- Unchanged from every prior entry: a valid OpenAI key, a seeded external demo repo, a live webhook recording, and (from the previous entry) a real GitHub OAuth App + Jira site remain the blocking items for the actual submission video.

## 2026-07-21 — Settings bugfixes, real Team & access (invite links), icon/toggle cleanup

### Context

- Project owner reported a concrete bug after the previous pass: Settings → Ticketing showed Linear as "Connected · Project: ENG" alongside a "Coded, not live-tested" badge — a contradiction, since Linear has no real connect flow. Also asked for Team & access to become real, all toggles verified working, and icons/descriptions polished. Explicitly noted limited remaining credits — prioritized concrete, verifiable fixes over speculative ones.

### Decision

- **Root cause of the Linear bug**: `src/data/demoData.ts`'s `TICKETING_PROVIDERS` hardcoded `connected: true` for Linear (leftover decorative demo data from before Jira became real). Fixed by setting `connected: false` for all three non-Jira providers — they have no real connect flow, so claiming "Connected" was always dishonest, just newly visible now that Jira's real state exists alongside it for contrast.
- **Toggle audit**: reviewed every `Toggle` usage in Settings — all are correctly wired to real save handlers. The one concrete bug found was in `NotificationsPanel.tsx`: its "Enabled for workspace" control was a raw, uncontrolled `<input type="checkbox" defaultChecked>` read via `document.getElementById` on Save click — inconsistent with every other real toggle in the app (the styled, controlled `Toggle` component) and the most likely source of "toggles don't feel like they're working." Rewritten as a real controlled `Toggle` that saves immediately on click; the credential fields (webhook URL, SMTP settings) now use React state instead of DOM refs, removing an anti-pattern along the way.
- **Team & access, built for real without email infrastructure**: rather than skip this (no SMTP-based invite email exists), implemented a genuine invite-link mechanism — an admin generates a link (backed by a new `Invite` table + random token, 7-day expiry, single-use), shares it manually, and whoever opens it joins the *same* organization via `/signup?invite=<token>` instead of creating a new one. This is a real, complete feature: no email service was needed because the link itself is the invite.
- **Role changes and member removal are real**, gated to Admins, with a guard against removing yourself or the last remaining member.

### Repository update

- **`prisma/schema.prisma`** — new `Invite` model (`organizationId`, `token` unique, optional `email`, `role`, `invitedBy`, `expiresAt`, `usedAt`) + `Organization.invites` relation. Migration `prisma/migrations/20260721205748_add_invite/`.
- **`src/store/appStore.ts`** — `listTeam`, `createInvite`, `revokeInvite`, `getInviteByToken`, `markInviteUsed`, `updateMemberRole`, `removeMember`.
- **`src/api.ts`** — `GET /team`, `POST /team/invite`, `DELETE /team/invite/:id`, `PATCH /team/members/:id`, `DELETE /team/members/:id` (all Admin-gated via a new `requireAdmin` helper); `GET /workspace` now includes the signed-in user's `id`.
- **`src/auth/routes.ts`** — new public `GET /auth/invite/:token` (validates without requiring a session, used by the signup page); `POST /auth/signup` now accepts an optional `invite` token — when present and valid, the new user joins the invite's organization with its assigned role instead of creating a new one (org name becomes optional in that path); an invite tied to a specific email is enforced server-side.
- **`src/data/demoData.ts`** — `TICKETING_PROVIDERS`: Linear/Asana/GitHub Issues now correctly show `connected: false`.
- **Frontend**: new `frontend/src/components/team/TeamPanel.tsx` (member list with role select + remove, pending-invites list with revoke, an invite-generation modal that shows a copyable link) wired into `SettingsPage.tsx`'s Team & access section. `frontend/src/components/integrations/NotificationsPanel.tsx` rewritten to a real controlled `Toggle` + React-state fields. `frontend/src/components/ticketing/TicketingPanel.tsx` now shows a disabled "Coming soon" button (with an explanatory tooltip) instead of blank space for providers with no real connect flow, so it reads as intentional rather than broken. `frontend/src/pages/auth/AuthPages.tsx`'s signup form reads `?invite=`, validates it, hides the Organization name field and shows "Join {orgName}" context when present, and pre-fills/locks the email field if the invite specifies one.

### Verification

- `npx tsc --noEmit` (root + frontend) and `npm run build` clean. `npx vitest run` 15/15 (unchanged — this pass was Settings-UI/Team-focused, no pipeline logic changed).
- Live smoke test against the project owner's own running dev server (stopped only the `tsx watch` API process briefly to regenerate the Prisma client for the new `Invite` table — released the file lock exactly as in the earlier database-migration entries — then restarted it immediately): confirmed `GET /ticketing` no longer shows Linear as connected; ran the full invite lifecycle end-to-end — generated an invite as the demo admin, validated it via the public endpoint, signed up a brand-new user with it and confirmed they joined the *same* organization (not a new one, `projectCount` matched the existing org's real data), changed their role, removed them, revoked a second unused invite, and confirmed self-removal is correctly blocked with a clear error. Final `GET /team` state matches the pre-test baseline exactly (one Admin member, no pending invites) — the test cleaned up after itself.

### Open questions / next steps

- Invite emails are still delivered by hand (copy/paste the link) — a real SMTP-based "send this invite" button would be a natural follow-up if email infrastructure is ever added, but wasn't necessary to make this feature genuinely functional.

## 2026-07-21 — Roles & permissions fully wired (UI + API)

### Decision

- Completed end-to-end RBAC: the editable permission matrix in `/app/roles` now drives both API enforcement (`requirePermission` on ~30 mutating routes) and frontend gating (nav, Settings sections, Fix Log approve/revert, Dashboard simulate, team/integrations panels, Audit Trail page gate).
- Admin-only actions remain hardcoded outside the matrix (security policy writes, API key regenerate, disconnect-all, delete workspace) so a workspace can't lock itself out of destructive recovery paths.
- Danger zone export uses the `export_data` permission; other danger actions require Admin.

### Repository update

- **Backend**: `src/permissions.ts` (`getUserPermissions`), `GET /api/me/permissions`, `POST /api/fixes/:id/approve` (gated by `approve_autopilot`); project/repo/settings routes gated by permission keys.
- **Frontend**: `PermissionsContext` + `PermissionsProvider`, `PermissionGate`, `settingsAccess.ts`, rewritten `RolesPage`, permission-aware `SettingsPage`, `DashboardPage`, `FixLogPage`, `IssueRecordsPage`, `ProjectsPage`, `AuditTrailPage`, `OrganizationPage`, `TeamPanel`, `IntegrationsPanel`, `NotificationsPanel`, `TicketingPanel`, `AppLayout` (audit nav hidden without `view_audit_trail`).
- **Tests**: `tests/mvp.test.ts` — new `permissions RBAC` describe block (4 cases).

### Verification

- `npm run typecheck`, `frontend` `tsc --noEmit`, and `npx vitest run` — **19/19 passing**.

## 2026-07-21 (late) — RBAC + settings production hardening

### Fixes

- **PermissionsContext**: Admin always passes `can()`; workspace-role fallback if `/me/permissions` fails; error banner on Roles page.
- **Security**: `GET /settings` no longer leaks full `preferences` (OpenAI key); `GET /settings/api-key` Admin-only.
- **New live APIs**: `GET/PATCH /organization/profile`, `GET /settings/billing` (gated by `manage_billing`).
- **Settings**: removed stale `whoCanRevert` UI; billing loads real fix counts + AI usage; OpenAI max-diff/quota prefs persisted; `EditableSection` disables controls when role lacks permission.
- **Organization page**: fully wired to profile API (no fake Save buttons).

### Verification

- `npm run typecheck` + frontend `tsc` + **19/19** vitest tests passing.

## 2026-07-21 (late) — GitHub OAuth + invite flow fully wired

### What changed

- **OAuth redirects** now land on the UI origin (`APP_ORIGIN`, default `:5173` in dev) so session cookies work through the Vite proxy — not on bare `:3000`.
- **GitHub + invite**: opening `/signup?invite=…` and clicking "Continue with GitHub" joins the invited org with the assigned role (not a new workspace).
- **`GET /api/auth/config`**: frontend checks whether GitHub OAuth is configured before showing the button.
- **Invite links** from Settings → Team use `APP_ORIGIN` (`http://localhost:5173/signup?invite=…`), not the API port.
- **Last Admin guard**: can't demote the sole Admin via role dropdown.
- Shared **`src/auth/bootstrap.ts`** for org creation + invite join (email and GitHub paths).

### Files

- `src/config/appOrigin.ts`, `src/config/env.ts`, `src/auth/bootstrap.ts`, `src/auth/routes.ts`, `src/api.ts`
- `frontend/src/pages/auth/AuthPages.tsx`, `frontend/src/lib/api.ts`
- `.env.example`, `setup.md`

### Verification

- `npm run typecheck`, frontend `tsc`, `npx vitest run` — **19/19 passing**.

## 2026-07-21 (night) — Dynamic integrations + SaaS Projects page

### What changed

- **Integrations API** enriched: each provider returns `capabilities`, `pipelineReady`, `webhookUrl`, masked `configPreview`, and `updatedAt`. New routes: `POST /integrations/:key/test` (live GitHub token check via Octokit) and `POST /integrations/:key/sync` (GitHub repo sync; others return 400/501 when unsupported).
- **`IntegrationsPanel`** rebuilt: stats bar, per-provider cards driven by API capabilities, Test / Sync / Disconnect actions gated on `manage_integrations`, webhook URL copy, config preview, link to Projects for GitHub repo assignment.
- **Projects page** (SaaS layout): workspace sidebar, stats, repo table with move-between-projects, enable/mode toggles, GitHub sync, system **Unassigned** bucket.
- **Repo/project model**: new repos and GitHub sync land in **Unassigned**; deleting a project moves repos there; deleting a repo with fix history is blocked with a clear error; org bootstrap seeds Unassigned alongside General.

### Files

- `src/platforms/integrationMeta.ts`, `src/platforms/testConnection.ts`, `src/platforms/githubSync.ts`
- `src/api.ts`, `src/store/appStore.ts`, `src/auth/bootstrap.ts`
- `frontend/src/lib/api.ts`, `frontend/src/components/integrations/IntegrationsPanel.tsx`
- `frontend/src/pages/app/ProjectsPage.tsx`, `frontend/src/pages/app/SettingsPage.tsx`

### Verification

- Frontend lints clean on touched pages.
- `npx vitest run` — **23/24 passing** (one rollback test timed out at 5s — flaky/env, unrelated to this diff).

## 2026-07-21 (night, cont.) — SaaS Organization module

### What changed

- **`GET /organization/overview`** — aggregates profile, workspace metadata, stats (members, projects, repos, integrations), CI provider status, and optional billing usage when the caller has `manage_billing`.
- **Organization page rebuilt** — org header with avatar/plan/role badges, stats bar, tabbed layout (Overview · Profile & locale · Team), quick links to Projects/Integrations/Roles/Settings, integration status panel, plan usage meter for Billing Manager, read-only workspace IDs, Admin danger zone.
- **TeamPanel** — SaaS table layout with avatars, role-colored initials, pending invites section, improved invite modal.
- **Settings deep links** — `?section=integrations|billing|danger` now opens the correct Settings tab from Organization quick links.

### Files

- `src/store/appStore.ts`, `src/api.ts`
- `frontend/src/lib/api.ts`, `frontend/src/pages/app/OrganizationPage.tsx`
- `frontend/src/components/team/TeamPanel.tsx`, `frontend/src/pages/app/SettingsPage.tsx`

### Verification

- Backend + frontend `tsc --noEmit` passing.

## 2026-07-22 — SaaS Profile module

### What changed

- **User profile API** (`GET/PATCH /api/me/profile`, `PATCH /api/me/password`, `PATCH /api/me/preferences`, `DELETE /api/me/sessions/others`) — real account updates, password change, personal prefs stored in `org.preferences.userPreferences[userId]`, session list/revoke from DB.
- **Profile page rebuilt** — SaaS layout matching Organization: header with role-colored avatar, stats bar, tabs (Overview · Account · Preferences · Security).
- **Overview** — permission badges from live RBAC, locale summary vs org defaults, quick links, auth method (password / GitHub / both).
- **Account** — save name/email, password change when `hasPassword`, GitHub-only callout when applicable.
- **Preferences** — theme (localStorage), timezone/date/language overrides, personal notification toggles (persisted).
- **Security** — real active sessions from `Session` table, revoke other sessions, sign out.

### Files

- `src/auth/middleware.ts`, `src/auth/session.ts`, `src/store/appStore.ts`, `src/api.ts`
- `frontend/src/lib/api.ts`, `frontend/src/pages/app/ProfilePage.tsx`

### Verification

- Backend + frontend `tsc --noEmit` passing.

## 2026-07-22 (cont.) — SaaS Status module (integration-aware)

### What changed

- **`getWorkspaceStatus()`** (`src/status/workspaceStatus.ts`) — org-scoped status built from live integration rows, repo enablement, OpenAI key, notification channels, and recent fix outcomes (reverted/escalated).
- **`GET /api/status`** now returns dynamic components for core pipeline, each CI provider (with webhook URLs + pipeline-ready flags), ticketing, and notifications — aligned with Integrations panel data.
- **Status page rebuilt** — stats bar, health banner with GitHub/OpenAI callouts, tabs (Overview · Pipeline · Integrations · Incidents), webhook copy, links to Settings sections.

### Files

- `src/status/workspaceStatus.ts`, `src/api.ts`
- `frontend/src/lib/api.ts`, `frontend/src/pages/app/StatusPage.tsx`

### Verification

- Backend + frontend `tsc --noEmit` passing.

## 2026-07-22 (cont.) — Documentation modules wired (Fix Log, Issues, Audit, Changelog, Reports)

### What changed

- **Report generators** (`src/reports/generators.ts`) — changelog from merged fixes, incident post-mortems from fix + audit timeline, weekly digest with failure-pattern classification.
- **Stored reports** (`src/store/reportsStore.ts`, `org.preferences.storedReports`) — store/share/delete snapshots; share tokens via `GET /api/reports/share/:token`.
- **New API routes** — `GET /changelog`, `GET /reports`, `GET /reports/incident/:fixId`, `GET /reports/digest`, `POST /reports`, `POST /reports/:id/share`, `DELETE /reports/:id`, `GET /audit/fixes`.
- **Serializers** — `serializeFix` now exposes `at`; `listIssues` maps `repoLabel` → `repo`; audit entries return ISO timestamps.
- **Frontend pages rebuilt (SaaS-grade)** — Fix Log (dynamic repo filters, stats, `?fixId=` deep links), Issue Records (search, export .md, cross-links), Audit Trail (dynamic incident picker, export), Changelog (live API, copy/download/store), Reports (incident + digest + stored tabs, store/share/export).
- **Cross-navigation** — Fix ↔ Issue ↔ Audit ↔ Reports via query params and action buttons; single autonomous documentation loop.

### Files

- `src/reports/generators.ts`, `src/store/reportsStore.ts`, `src/store/appStore.ts`, `src/api.ts`
- `frontend/src/lib/api.ts`, `frontend/src/components/layout/AppLayout.tsx` (PageHeader actions)
- `frontend/src/pages/app/FixLogPage.tsx`, `IssueRecordsPage.tsx`, `AuditTrailPage.tsx`, `ChangelogPage.tsx`, `ReportsPage.tsx`

### Verification

- `npm run build` (backend tsc + frontend vite) passing.
- `npx vitest run` — 24/24 passing.

## 2026-07-22 (cont.) — SaaS Dashboard wired live

### What changed

- **`getWorkspaceDashboard()`** (`src/dashboard/workspaceDashboard.ts`) — all dashboard metrics computed from real Fix rows, audit timelines, activity log, and AI usage; supports `?project=` and `?days=7|30|90`.
- **`GET /api/dashboard`** — replaced static `dashboardStats()` / hardcoded attention/feed/branch/confidence with live aggregates (success rate, time-to-fix from audit, weekly bars, branch patterns, confidence breakdown, sparklines).
- **Dashboard page rebuilt** — SSE live refresh (stable, no re-render loops), project + period filters, cross-links to Fix Log / Issues / Audit / Status, attention items with fix deep links, live feed with timestamps + fix IDs, recent fixes strip, dynamic branch activity + confidence from API.

### Files

- `src/dashboard/workspaceDashboard.ts`, `src/api.ts`
- `frontend/src/lib/api.ts`, `frontend/src/pages/app/DashboardPage.tsx`

### Verification

- `npm run build` passing.
- `npx vitest run` — 24/24 passing.

## 2026-07-22 (cont.) — Dashboard polish: demo card + animated charts

### What changed

- **Pipeline demo card** — Replaced cryptic top-bar buttons (“Simulate main failure”, “Simulate feature/* comment”) with a labeled **Pipeline demo** card that explains each path:
  - **Main branch CI failure** — Autopilot on `main` (diagnose → fix → PR → Issue Record).
  - **Feature branch · existing PR** — Fix & propose on `feature/demo` with PR #318 (diagnosis comment, no auto-merge).
  - Uses the first enabled repo from workspace status (not hardcoded `acme/backend`); requires `manage_response_rules`.
- **Animated widgets** — New `DashboardCharts.tsx`: draw-on sparklines, stacked weekly activity bars, confidence breakdown strip, usage budget meter, success outcome ring. Stat tiles stagger in with `animate-slide-up`.
- **Backend scoping fix** — When no project filter is selected, dashboard counts all org fixes (not only synced GitHub repos), so KPIs populate for seeded demo data.
- **Usage card layout** — Budget meter label + gradient bar cleaned up (title / spend / meter order).

### Files

- `src/dashboard/workspaceDashboard.ts`
- `frontend/src/components/dashboard/DashboardCharts.tsx` (new)
- `frontend/src/components/ui/FormControls.tsx`
- `frontend/src/pages/app/DashboardPage.tsx`
- `frontend/tailwind.config.js`

### Verification

- `npm run build` passing.
- `npx vitest run` — 24/24 passing.

## 2026-07-22 (cont.) — Global search + notification inbox wired live

### What changed

- **`GET /api/search`** (`src/search/workspaceSearch.ts`) — org-scoped search across fixes, issue records, repos, projects, and nav pages; empty query returns recent fixes + quick links.
- **`GET /api/inbox`** (`src/inbox/workspaceInbox.ts`) — live notification feed from pending/escalated fixes, recent merges, and activity log; sorted newest-first with deep links to Fix Log / Issues / Audit.
- **Global search UI** — command palette (`⌘K` / `Ctrl+K`), debounced API, keyboard navigation, mobile search button; replaces static header placeholder.
- **Notification inbox UI** — bell badge with unread count, SSE auto-refresh on pipeline/activity events, dismiss/clear-all (per-user localStorage), action buttons linking to real records.

### Files

- `src/search/workspaceSearch.ts`, `src/inbox/workspaceInbox.ts`, `src/api.ts`
- `frontend/src/components/layout/GlobalSearch.tsx`, `NotificationInbox.tsx`, `AppLayout.tsx`
- `frontend/src/lib/api.ts`

### Verification

- `npm run build` passing.
- `npx vitest run` — 24/24 passing.

## 2026-07-22 (cont.) — Marketing site SaaS redesign + live public stats

### What changed

- **`GET /api/public/marketing`** — public endpoint (no auth) aggregating real PostgreSQL Fix metrics, activity feed, failure categories, integration status, and DORA industry context.
- **`POST /api/public/contact`** — contact form wired server-side (logged + JSON ack).
- **Home / About / Contact** — full SaaS-grade redesign: gradient hero, live metric strip, real incident feed (45s poll), industry vs Stitch gap chart, ROI calculator using measured auto-fix rate, integration badges (live/ready/planned).
- **Pricing page removed** — route and nav/footer links removed for now.
- **Header & footer** — sticky blur nav with logomark + lockup, live status pill, footer stats bar synced to public API.
- **Login / Signup** — premium split layout with live fleet metrics on the brand panel; card-style form with focus rings.
- **Privacy / Terms** — updated for PostgreSQL persistence; polished legal layout.

### Files

- `src/marketing/publicMarketing.ts`, `src/server.ts`
- `frontend/src/hooks/useMarketingStats.ts`, `frontend/src/components/marketing/MarketingShared.tsx`
- `frontend/src/pages/marketing/MarketingPages.tsx`, `frontend/src/pages/auth/AuthPages.tsx`
- `frontend/src/components/layout/MarketingLayout.tsx`, `Footer.tsx`, `frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/index.css`

### Verification

- `npm run build` passing.
- `npx vitest run` — 24/24 passing.

## 2026-07-22 — Multi-provider AI: Gemini + Copilot, test buttons fixed

### Decisions

- Extended AI providers to **OpenAI, Anthropic (Claude), Google Gemini, and Microsoft Copilot (Azure OpenAI)**.
- **Test buttons** accept pasted keys before save — API `POST /settings/ai-models/test` now accepts `apiKey`, `model`, `endpoint`, and `deployment` in the body.
- Claude connection test always uses **Haiku** (fast, widely available) instead of the selected diagnosis model.

### Implementation

- New providers: `src/ai/providers/gemini.ts`, `src/ai/providers/copilot.ts`.
- Updated `src/ai/config.ts`, `router.ts`, `testConnection.ts`, `catalog.ts`, `types.ts`, `src/config/env.ts`, `src/api.ts`.
- Settings UI: four provider key fields, Azure endpoint/deployment for Copilot, Test OpenAI / Claude / Gemini / Copilot buttons enabled when key is pasted OR saved.
- `.env.example`: `GEMINI_API_KEY`, `AZURE_OPENAI_*` vars.

### Verification

- `npm run build` — passing.
- `npm test` — 25/25 passing.

## 2026-07-22 — Live test repo populated (`testrepo/`)

### What changed

- **`testrepo/`** — Node project with deliberate `JWT_SECRET` CI failure, GitHub Actions workflow, branches for every Stitch trust level (`main`, `release/v1.0`, `feature/checkout-v2`, `dev`, `hotfix/auth-guard`).
- Seeded **`Khushalsarode/stitch-test-flow-repo`** on Acme Corp (project: Stitch Live Test).
- Dashboard simulate panel: 5 branch cards targeting the test repo.
- `npm run testrepo:setup` script to commit + push branches to GitHub.
- `vitest.config.ts` excludes testrepo from Stitch unit tests.

### Verification

- `npm test` — 25/25 passing.
- `testrepo` `npm test` fails without `JWT_SECRET` (expected CI red).

- `npm test` — 25/25 passing.
- `testrepo` `npm test` fails without `JWT_SECRET` (expected CI red).

## 2026-07-22 (cont.) — Live test repo: demo flows + webhook setup

### Added

- `testrepo/DEMO-FLOWS.md` — flows A–H (sandbox, live PR, release, feature PR comment, dev auto-merge, webhook, revert, auto-revert).
- `STITCH-LIVE-SETUP.md` — phased submission checklist after GitHub push.
- GitHub Actions: manual CI dispatch, verify-green workflow, auto-create `stitch`/`auto-fix` labels.
- Scripts: `npm run stitch:live-check`, `npm run testrepo:open-pr`, `testrepo/scripts/open-feature-pr.ps1`.
- Dashboard: Hotfix · live PR button, GitHub repo link on test repo.

## 2026-07-22 — Submission docs (README, setup, Devpost)

Rewrote **README.md**, **setup.md**, **STITCH-LIVE-SETUP.md** for practical hackathon submission (less theory). Added **DEVPOST-SUBMISSION.md** with copy-paste Devpost fields, video outline, checklist.

## Push log

No repository push has been performed or verified in this project journal yet.
