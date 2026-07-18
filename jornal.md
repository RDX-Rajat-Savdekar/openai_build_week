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

## 2026-07-19 - Initial repository and Build Week direction

### Context

- Inspected the starter repository and its Build Week project brief.
- The existing brief recommended **ChangePilot**, a human-gated agent that converts a scoped issue into a tested pull request.
- Confirmed that the repository was still primarily a planning repository rather than an implemented application.

### Ideas explored

- ChangePilot: safe issue-to-PR software-change agent.
- Incident Commander: evidence-driven production incident investigator.
- PolicyForge/PolicyGuard: agent policy and authorization safety layer.
- ToolTwin: agent-tool contract generator and adversarial tester.
- TracePatch: agent failure debugger that diagnoses a trace, proposes a repair, replays it, and produces evidence.

### Direction developed

- TracePatch emerged as the strongest differentiated direction because the core product is active repair rather than another trace viewer.
- The proposed product loop became:
  - failed trace;
  - evidence-linked diagnosis;
  - generated behavioral regression scenario;
  - human-reviewed patch;
  - safe replay;
  - before/after verification.
- A seeded customer-support refund scenario was selected as the clearest demonstration candidate.
- Three initial failure categories were identified:
  - authorization failure;
  - tool-contract failure;
  - trajectory failure.

### Status

- This was product exploration, not a final implementation commitment.
- No application code was created during this stage.

## 2026-07-19 - TracePatch CI merged product plan

### Decision

- Combined the original TracePatch incident-repair concept with **TracePatch CI**.
- The merged product now has two connected loops:
  1. Convert a failed trace into a reviewed repair and reusable regression scenario.
  2. Run the accumulated scenario pack against base and candidate agent versions when prompts, models, tools, policies, or routing change.
- The durable product unit is the regression scenario; the trace is the evidence used to generate it.
- Blocking CI decisions should rely on deterministic assertions. GPT-5.6 supplies diagnosis, scenario drafting, patch proposals, explanations, and replayed agent behavior, but not unchecked authority.
- Replay should use mocked tools so state-changing operations cannot affect external systems.
- The local PR-check simulator is P0. A live GitHub Check integration is optional.
- The MVP should patch only bounded agent configuration surfaces: instructions, policies, tool schemas, and routing.

### Repository update

- Created `plan/tracepatch-ci-implementation-plan.md`.
- The plan contains product scope, workflows, architecture diagrams, repository structure, data contracts, agent responsibilities, detection logic, replay design, CI rules, APIs, persistence, security boundaries, implementation phases, testing, risks, demo script, and definition of done.
- Left `plan/accessibility-regression-agent-plan.md` unchanged.

### Verification

- Confirmed the new plan exists and contains 25 major sections.
- Checked code-fence balance, Mermaid block presence, placeholder markers, and replacement-character encoding issues.
- The checks found no `TODO`, `TBD`, `FIXME`, or Unicode replacement characters.
- Git-based diff verification was unavailable because `git` was not present on the current PowerShell `PATH`.

### Current implementation priority

- Build the reliable vertical slice first:
  1. seeded support agent and mocked tools;
  2. unsafe high-value refund trace;
  3. deterministic approval assertion;
  4. bounded prompt/policy repair;
  5. original-versus-patched replay;
  6. base-versus-candidate CI result.

## 2026-07-19 - Project journal established and alternative plan reviewed

### Decision

- `jornal.md` is now the durable timeline for major project conversations, decisions, implementation changes, verification, commits, and pushes.
- Updated `AGENTS.md` so future Codex sessions preserve and append to this journal.
- Historical entries must not be silently rewritten; later corrections should be appended.

### Alternative project in the repository

- The other plan is **A11y Sentinel**, a PR-aware accessibility regression agent.
- Its core workflow is: inspect a UI pull-request diff, map changes to affected routes and user journeys, run Playwright and axe-core checks on base and candidate versions, report only net-new accessibility regressions, propose a minimal repair, require approval, and re-verify.
- A comparative product assessment is being provided in the accompanying conversation response.

### Files changed

- Created `jornal.md`.
- Updated `AGENTS.md` with the journal-maintenance protocol.

## 2026-07-19 - TracePatch CI project dashboard created

### Decision and design update

- Created a visual HTML dashboard that translates the detailed implementation plan into six navigable sections: overview, workflow, architecture, build plan, design decisions, and scope/demo.
- Kept the current status explicit: product planning is complete and application implementation has not started.
- Estimated the hackathon MVP at 22 focused implementation hours plus a 2-4 hour contingency buffer.
- Preserved the existing technical decisions: one TypeScript application, canonical JSON trace input, GPT-5.6 for semantic analysis, deterministic assertions for blocking CI, mocked replay tools, human-approved bounded patches, SQLite plus versioned scenarios, and local CI before GitHub integration.

### Repository update

- Created `plan/tracepatch-project-dashboard.html` as a standalone interactive webpage.
- The page includes the incident-repair loop, pull-request CI loop, layered system architecture, main steps for every product section, phase-by-phase status, effort estimates, explicit design justifications, P0 scope, exclusions, and the three-minute demo arc.

### Verification

- Rendered and opened the standalone page in a headless browser.
- Confirmed all six section controls and six content panels are present.
- Confirmed the primary section interaction switches to the architecture view.
- Checked the 736-pixel target layout and found no horizontal overflow.
- Captured a visual preview and reviewed the rendered architecture/status view.

## 2026-07-19 - Three-phase incremental delivery strategy adopted

### Decision

- Reorganized implementation into three gated delivery phases:
  1. **MVP proof of concept:** one complete unsafe-refund path proving trace-to-test-to-replay behavior.
  2. **Enhanced working product:** three failure categories, GPT-5.6 diagnosis and bounded repair, scenario registry, CI comparison, safety controls, and complete product screens.
  3. **Release and submission:** feature freeze, final testing, clean-install validation, documentation, deployment/judge path, recording, and Devpost submission.
- Adopted test-driven development for all phases using the red, green, verify, refactor, and record loop.
- Defined a hard gate between phases. Work must not advance until the current phase's automated tests and acceptance criteria pass.
- If time becomes constrained, the team should submit a polished, tested MVP rather than an unstable partial second phase.

### Timeline

- Phase 1 MVP: 8 focused hours.
- Phase 2 enhanced product: 9 focused hours.
- Phase 3 release/submission: 5 focused hours.
- Contingency: 2-4 hours.
- Total estimate remains 22 focused implementation hours plus contingency.

### Repository updates

- Added the three-phase strategy, tests, gates, final validation, and time-constrained delivery rule to `plan/tracepatch-ci-implementation-plan.md`.
- Updated `plan/tracepatch-project-dashboard.html` with an interactive **3-phase roadmap** section.

### Verification

- Confirmed the dashboard contains exactly three delivery-phase sections.
- Confirmed the roadmap navigation opens the updated section.
- Checked the rendered 736-pixel layout and found no horizontal overflow.
- Visually reviewed all three phases, the TDD loop, time allocation, and incremental delivery rule.

## Push log

No repository push has been performed or verified in this project journal yet.
