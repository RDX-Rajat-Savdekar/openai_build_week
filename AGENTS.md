<claude-mem-context>
# Memory Context

# [openai_build_week] recent context, 2026-07-20

Project pivoted from TracePatch CI to **Stitch** — see [jornal.md](jornal.md) entry dated 2026-07-20 for the decision record. Prior material is archived under `ex-idea/`, not part of the active submission.
</claude-mem-context>

## What this repository is

The Build Week submission for **Stitch** (stitch.dev): a webhook-triggered agent that diagnoses failed CI runs with GPT-5.6, writes a fix with Codex against the real repository, validates it, and opens a PR — autonomously, without a human opening a chat session to start the loop.

Read [README.md](README.md) for the product pitch and architecture, and [plan/stitch-implementation-plan.md](plan/stitch-implementation-plan.md) for the full build plan, data contracts, and phasing.

## Deadline context

Submission closes **July 21, 2026, 5:00 PM PT**. Prioritize a small, reliable, demoable slice over broad but unfinished coverage. The agreed MVP cut line: **GitHub Actions only, `main`-branch aggressive auto-fix, one seeded demo repo.** GitLab support and the full branch-aware matrix are stretch goals — build the branch router so they're a config addition, not a rewrite, but do not block the MVP on them. For the current, up-to-date breakdown of what's built vs. mockup-only vs. not started, read `plan/stitch-implementation-plan.md` section 14 rather than trusting a memory of a past conversation — it drifts, that file is kept current.

## Project journal

- Maintain `jornal.md` at the repository root as the chronological project record.
- At the end of every substantive conversation, append the date, decisions made, implementation updates, files changed, verification performed, and open questions or next steps.
- When a commit or push is made, record the branch, commit hash, push destination, and a concise summary. Never claim a commit or push occurred unless it was verified.
- Preserve earlier entries. Corrections should be appended or clearly marked rather than silently rewriting project history.

## Working conventions for this build

- Stack: Node.js + TypeScript + Express, Octokit for GitHub, the OpenAI SDK for GPT-5.6 (diagnosis) and Codex (fix generation), `simple-git` for repo operations, `dotenv` for config. The project is ESM (`"type": "module"` + `tsconfig.json` `module`/`moduleResolution: "nodenext"`) because Octokit v21 is ESM-only — every relative import needs an explicit `.js` extension (e.g. `from "./config/env.js"`), even though the source files are `.ts`. This was a real, non-obvious debugging session; don't rediscover it.
- Keep the diagnosis step (GPT-5.6, read-only, produces an explanation) and the fix-generation step (Codex, writes a patch) as distinct, separately testable units — this separation is also what the demo narrates, so don't collapse it for convenience.
- Anything that changes external state (opening a PR, posting to Slack, merging) must be behind the branch-router's config, not hardcoded — that config is the thing that has to survive a live demo across two different branch types.
- Track the `/feedback` Codex Session ID for the thread where the majority of core functionality gets built — it's a required submission field and easy to lose track of after the fact.
- Do not commit or push without being asked, per standing repository practice.
- `plan/stitch-project-dashboard.html` is a full-vision product mockup (illustrative, static, sample data) — design reference only, never served. The real UI is `frontend/` (React + Vite + Tailwind); the legacy vanilla-JS `public/` dashboard was removed 2026-07-21 once `frontend/` reached full parity with it. Don't build a mockup-only feature into `frontend/`/`src/` just because it exists in the HTML mockup; only do so when asked. `plan/stitch-implementation-plan.md` section 8.6 has the technical spec for anything still mockup-only.
- New feature ideas that come up in conversation (from the project owner, from review, from your own judgment) belong in `plan/stitch-implementation-plan.md` section 16 ("Roadmap / post-MVP") — and mirrored into the mockup's **Roadmap** page — not scattered into ad hoc notes or left only in chat/journal history. Give each one a priority (Now/Next/Later/Future) using the same scale already defined there. Keep the two in sync; don't let the plan doc and the mockup describe two different roadmaps.
