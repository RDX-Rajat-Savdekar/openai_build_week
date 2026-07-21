# OpenAI Build Week — project brief

Source of truth: https://openai.devpost.com/rules

## Deadline

**Submission Period ends Tuesday, July 21, 2026, 5:00 PM Pacific Time.** As of the last update to this file (2026-07-20), that is inside the final day. Treat everything below as scoped for a same-day-to-next-day build, not a multi-week plan.

- Registration: July 9 – July 21, 2026
- Submission: July 13 – July 21, 2026, 5:00 PM PT
- Judging: July 22 – August 5, 2026
- Winners announced: on or around August 12, 2026

## The chosen project: Stitch

**Track: Developer Tools** — fits directly: "Tools for developers, including testing, DevOps, agentic workflows, and security."

Stitch is a webhook-triggered agent: CI fails, a webhook fires, GPT-5.6 diagnoses the failure from logs, Codex writes a fix against the real repo, the fix is validated, and a PR opens automatically — no one has to open a chat window to start the loop. Full product description: [README.md](README.md). Full architecture and build plan: [plan/stitch-implementation-plan.md](plan/stitch-implementation-plan.md).

The repository previously explored a different direction (TracePatch CI, an agent-trace regression tester). That material is preserved under [ex-idea/](ex-idea/) for reference; it is not part of this submission.

## Required to submit

- Build a real, runnable project using **Codex and GPT-5.6**.
- Choose one category: Apps for Your Life, Work & Productivity, **Developer Tools**, or Education. — chosen: **Developer Tools**.
- Submit an English project description explaining the features and functionality.
- Include a **public YouTube demo video under three minutes** with audio. It must demo the project and explain how Codex and GPT-5.6 were used.
- Provide a public code repository with an appropriate license, or a private repository shared with `testing@devpost.com` and `build-week-event@openai.com`.
- In the README, describe how Codex was used, where it accelerated delivery, and which product/engineering/design decisions you made.
- Provide the `/feedback` Codex Session ID for the project thread where the majority of core functionality was built.
- Make the project available to judges at no cost through the judging period through a working website, demo, or test build. Provide credentials if it is private.
- For a plugin or developer tool (this is one), include installation instructions, supported platforms, and a way to test it without rebuilding.

## Build constraints

- The project must work as shown in its video and description.
- New projects must be created during the submission period. Existing projects must be meaningfully extended with Codex/GPT-5.6 after July 13, 2026; document the new work with dated commits, Codex session logs, or equivalent. (Stitch is a new direction started within the submission period — the prior TracePatch CI material in `ex-idea/` is explicitly not being submitted, so this does not apply as a pre-existing-project disclosure, but keep commit history clean regardless.)
- You need authorization for all third-party APIs, SDKs, data, and assets.
- The submission must be your/team's original work and must not infringe third-party rights.

## Judging criteria

Four equally weighted criteria:

1. **Technological implementation** — substantial, skillful Codex use and a working, non-trivial build.
2. **Design** — a complete, coherent runnable product experience, not just a technical proof of concept.
3. **Potential impact** — a concrete real audience/problem, and proof the demo actually addresses it.
4. **Quality of idea** — creative, novel, differentiated from existing tools.

Given the time remaining, a small and reliable end-to-end slice (GitHub-only, `main`-branch auto-fix, one seeded demo repo) beats a broad but flaky multi-platform build. See the "Scope note" in [README.md](README.md) for the cut line. For **potential impact** and **quality of idea**, the full-vision mockup and roadmap ([plan/stitch-project-dashboard.html](plan/stitch-project-dashboard.html), [plan/stitch-implementation-plan.md](plan/stitch-implementation-plan.md) section 16) are useful supporting material for the written project description and the demo video's closing seconds — they show this isn't a one-off script, without overclaiming what's actually built (the video and description still must match the working project, per the build constraints above).

## Practical reminders

- Save a Devpost draft early — once the deadline passes, the submission can't be altered.
- Keep the demo video under 3 minutes with audio explicitly covering how Codex and OpenAI were used; judges are not required to watch past 3:00.
- Capture the `/feedback` Codex Session ID as soon as the core build session happens — don't leave it for the last minute.
- No copyrighted music or third-party trademarks in the video without permission.
- **Copy-paste Devpost fields:** [DEVPOST-SUBMISSION.md](DEVPOST-SUBMISSION.md)
- **Live demo recording:** [STITCH-LIVE-SETUP.md](STITCH-LIVE-SETUP.md)
