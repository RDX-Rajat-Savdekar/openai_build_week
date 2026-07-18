# OpenAI Build Week — project brief

Source of truth: https://openai.devpost.com/rules (reviewed July 18, 2026).

## The opportunity

Build a real, runnable project using **Codex and GPT-5.6**. The strongest fit for an agentic-AI project is the **Developer Tools** track, which explicitly includes agentic workflows, testing, DevOps, and security. Work & Productivity is also a good home if the primary beneficiary is an operations, sales, support, or back-office team.

Submission deadline: **July 21, 2026, 5:00 pm Pacific**. The submission window opened July 13. Winners are expected around August 12.

The four tracks are:

- Apps for Your Life
- Work & Productivity
- Developer Tools
- Education

Each track has a $15,000 first prize and $10,000 second prize. A project can compete for only one prize, so pick the category whose user/problem story is clearest.

## Recommended agentic project directions

### 1. ChangePilot — safe autonomous software-change agent

**Track:** Developer Tools

An agent that turns a GitHub issue into a verified pull request: it maps the codebase, proposes a plan, edits in an isolated workspace, runs tests, explains failures, asks for approval at risky steps, and produces an evidence-backed PR summary. Its key differentiator is not merely code generation but a visible safety/control layer: scoped permissions, checkpoints, test evidence, rollback-ready patches, and an audit trail.

Why it can score: it is a non-trivial agentic workflow with a clean live demo and a specific developer pain point. It can show deep Codex use while yielding an immediately testable output.

### 2. Incident Commander — production-incident investigation agent

**Track:** Developer Tools or Work & Productivity

An agentic incident room that connects logs, traces, deploy history, runbooks, and on-call notes. It constructs a timeline, forms and tests hypotheses, identifies likely root causes, drafts mitigations, and prepares a stakeholder update. High-impact actions remain human-approved.

Demo moment: introduce a deliberately broken deployment, let the agent trace the regression, cite the evidence, propose a rollback, and generate the postmortem draft.

### 3. Spec-to-Ship — product delivery swarm with human gates

**Track:** Work & Productivity

From a short product request, specialist agents create a spec, UX acceptance criteria, implementation plan, working prototype, tests, and launch checklist. A human decides at explicit gates; agents never silently widen scope. The product should focus on one concrete internal workflow (for example, customer-support tooling requests), not generic “multi-agent project management.”

### 4. TestForge — autonomous regression hunter

**Track:** Developer Tools

An agent that learns an application’s intended behavior from code, issues, and existing tests; generates targeted regression tests; runs them in a sandbox; minimizes flaky failures; and files reproducible bug reports with evidence. A compelling niche is web-app accessibility, payments, or API compatibility.

### 5. PolicyGuard — agentic compliance-by-construction for AI workflows

**Track:** Developer Tools or Work & Productivity

A gateway/SDK that enables other agents to use sensitive tools safely. It converts natural-language policies into preflight checks, redacts sensitive data, requires approval for high-impact operations, records provenance, and offers a replayable audit log. Choose a narrow vertical such as finance operations or customer-data exports to keep the demo credible.

## Best bet

Build **ChangePilot** if you want the clearest match to the rules and the shortest path to a strong demo. Make it sharply scoped: “turn one labelled issue in a TypeScript service into a tested PR with a human approval gate.” Avoid positioning it as a general autonomous engineer; judges will reward a complete, reliable experience more than broad claims.

Minimum lovable demo:

1. Select a real but self-contained issue in a seeded demo repository.
2. Agent explores the codebase and writes a change plan with file-level rationale.
3. User approves the plan.
4. Agent implements the change, runs tests/lint, and repairs one induced failure.
5. It creates a PR-style diff, test evidence, risk summary, and rollback notes.
6. Show the audit trail of tool calls and human approvals.

## Submission checklist

### Build eligibility

- Use **Codex and GPT-5.6**; this is a required developer-tool combination.
- It must be installed/runnable consistently on its intended platform and work as shown.
- New work must be created during the submission period. A pre-existing project is allowed only if it is meaningfully extended after July 13 using Codex/GPT-5.6.
- For pre-existing work, document exactly what is new, with evidence such as dated commits and timestamped Codex session logs.
- You must be authorized to use every third-party SDK, API, dataset, and asset.

### Devpost materials

- Select the single best-fitting category.
- Write an English description explaining features and functionality.
- Upload a **public YouTube** demo link. The video must be **under 3 minutes**, include audio, clearly demonstrate the project, and explain how Codex and GPT-5.6 were used. Do not rely on judges watching past 3 minutes.
- Provide a code repository URL. It must be public with relevant licensing, or private and shared with **testing@devpost.com** and **build-week-event@openai.com**.
- README: explain how Codex collaborated throughout the project; distinguish where it accelerated execution from the product, engineering, and design decisions you made. This is expressly important to judging.
- Provide the **`/feedback` Codex Session ID** for the project thread where most core functionality was built.
- Provide a working demo URL, test build, or site. If private, include credentials. It must be free and unrestricted for judging through the end of judging.
- For a plugin or developer tool: include installation instructions, supported platforms, and a way to test it without rebuilding (demo, sandbox, or test account).

## How to optimize for judging

The four equally weighted criteria are:

1. **Technological implementation:** substantial, skillful Codex use and a working non-trivial build.
2. **Design:** a complete, coherent runnable product experience—not a technical proof of concept.
3. **Potential impact:** a concrete real audience/problem and proof that the demo addresses it.
4. **Quality of idea:** creative, novel, and differentiated from existing concepts.

Practical implications:

- Pick one persona and one costly workflow; show before/after in the opening 20 seconds.
- Build one end-to-end path exceptionally well, including failure/approval states.
- Make the agent’s reasoning observable as evidence and decisions, rather than exposing hidden chain-of-thought.
- Keep external integrations minimal and reliable; a seeded local/demo environment is safer for the video.
- Treat the README and video as first-class product artifacts: they may be judged even if the project is not tested.
- Do not submit copyrighted music, third-party trademarks, or material without permission. The work must be original and owned by you/team.
- Save a Devpost draft early. Once the deadline passes, you cannot alter the evaluated submission.

## Suggested three-minute video outline

- 0:00–0:20 — persona, painful workflow, and result.
- 0:20–1:45 — live end-to-end agent demonstration, including an approval gate and verification.
- 1:45–2:20 — show the resulting artifact (PR, test report, audit trail) and measurable benefit.
- 2:20–2:50 — architecture at a glance and the role of GPT-5.6/Codex.
- 2:50–3:00 — close with impact and where the project can go next.

## Important rules to avoid surprises

- You may make multiple submissions, but each must be unique and substantially different.
- Team/organization entries need an authorized representative.
- Entrants must be in an OpenAI API-supported country/territory and meet the stated eligibility criteria; notable listed exclusions include Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, and Syria.
- You retain project IP; OpenAI receives a non-exclusive license for judging and promotion-related use under the rules.
- Free $100 credits could be requested by registered entrants by July 17, 12 pm PT, while supplies lasted; that request deadline has passed as of this brief. Monitor any paid usage yourself.
- The optional Devpost plugin is only a helper; the official rules and website control.
