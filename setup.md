# Stitch — setup & run

Get Stitch running locally in ~10 minutes. For recording the GitHub demo, use **[STITCH-LIVE-SETUP.md](STITCH-LIVE-SETUP.md)** instead.

| URL | What |
|-----|------|
| http://localhost:5173 | Frontend (use this in dev) |
| http://localhost:3000 | API + webhooks |

---

## Prerequisites

- Node.js **20+**
- PostgreSQL **14+**
- Optional: OpenAI/Claude/Gemini keys, GitHub PAT, Slack webhook (see `.env.example`)

---

## Quick start

```bash
npm install
npm run frontend:install

cp .env.example .env
# Minimum: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/stitch?schema=public"

createdb stitch   # or: psql -U postgres -c "CREATE DATABASE stitch;"

npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:5173** → sign in or use demo account below.

**Production (single port):**

```bash
npm run build && npm start   # http://localhost:3000
```

---

## Demo login (after seed)

**Password for all:** `demo1234`

| Email | Role | Use for |
|-------|------|---------|
| `demo@stitch.dev` | Admin | Full demo + settings |
| `tara@stitch.dev` | Developer | Approve/revert fixes |
| `james@stitch.dev` | Release Manager | Integrations + branch rules |
| `compliance@stitch.dev` | Security | Audit read-only |

Fresh signup at `/signup` creates a **new empty org** (not Acme demo data).

---

## First thing to try (no GitHub needed)

1. Login as `demo@stitch.dev`
2. **Dashboard** → **Main · sandbox**
3. Watch Fix Log + SSE toast — full pipeline with demo PR URL

---

## GitHub: two different connections

**Common confusion — both are real, both are needed for different jobs:**

| | **Continue with GitHub** (login page) | **Settings → Integrations → GitHub → Connect** |
|---|---|---|
| **Purpose** | Who you are | CI automation for the workspace |
| **Stores** | OAuth token on your user | PAT + webhook secret on the org |
| **Sync repos** | ✅ Yes | ✅ Yes (uses PAT if set, else OAuth) |
| **Live PR / webhooks** | ❌ No | ✅ Yes |

**For live demo you must Connect in Integrations** — paste:

- **Personal access token** — scopes: `repo`, `workflow`
- **Webhook secret** — any random string (same in `.env` `GITHUB_WEBHOOK_SECRET` and GitHub repo webhook)

Optional: put the same PAT in `.env` as `GITHUB_TOKEN` for server startup defaults.

### Enable “Continue with GitHub” (optional)

1. Create OAuth App at https://github.com/settings/developers  
2. Callback URL: `http://localhost:5173/api/auth/github/callback`  
3. Set in `.env`: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_ORIGIN=http://localhost:5173`

This is **login only** — still Connect Integrations for the pipeline.

---

## Environment variables (the ones that matter)

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `DATABASE_URL` | **Yes** | Postgres connection |
| `OPENAI_API_KEY` | No | Live AI (demo fallback works without) |
| `ANTHROPIC_API_KEY` | No | Claude in Settings |
| `GEMINI_API_KEY` | No | Gemini in Settings |
| `GITHUB_TOKEN` | For live PR | GitHub API |
| `GITHUB_WEBHOOK_SECRET` | For webhooks | HMAC verify |
| `SLACK_WEBHOOK_URL` | No | Slack notifications |
| `STITCH_TEST_REPO` | No | Default test repo name (see `.env.example`) |

Full list: `.env.example`

---

## Live test repo

GitHub: **`Khushalsarode/stitch-test-flow-repo`** (folder `testrepo/`)

```bash
npm run testrepo:setup      # push branches to your GitHub
npm run db:seed             # registers repo on Acme org
npm run stitch:live-check   # validate .env
```

**Step-by-step recording guide:** [STITCH-LIVE-SETUP.md](STITCH-LIVE-SETUP.md)  
**Every branch flow:** [testrepo/DEMO-FLOWS.md](testrepo/DEMO-FLOWS.md)

---

## npm scripts

| Command | What |
|---------|------|
| `npm run dev` | API :3000 + UI :5173 |
| `npm run build` | Compile + frontend production build |
| `npm test` | 25 vitest tests |
| `npm run db:seed` | Seed Acme Corp demo data |
| `npm run testrepo:setup` | Push test repo branches |
| `npm run testrepo:open-pr` | Open feature PR for comment demo |
| `npm run stitch:live-check` | Pre-flight before live demo |

---

## AI models (Settings → AI models)

- Pick **different providers** for diagnosis vs fix (e.g. Claude diagnosis + OpenAI fix)
- **Test** buttons work with pasted keys before Save
- Providers: OpenAI, Anthropic, Gemini, Copilot (Azure OpenAI)

Without keys: pipeline uses deterministic JWT guard patch (good enough for sandbox demo).

---

## Webhook URL (local)

```
POST http://localhost:3000/webhooks/github
```

For GitHub to reach your machine, tunnel with ngrok:

```bash
ngrok http 3000
# Use https://xxxx.ngrok-free.app/webhooks/github in GitHub webhook settings
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page on :3000 in dev | Use **:5173**, or `npm run build` first |
| 401 on API calls | Log in — session cookie required |
| Can't reach database | Postgres running? Check `DATABASE_URL` |
| Live PR buttons disabled | Integrations → GitHub → Connect (PAT + secret) |
| Simulate works, webhook doesn't | Repo enabled in Settings → Repositories; webhook secret matches |
| Prisma errors | `npm run db:migrate` |

---

## What's real vs demo UI

**Real (Postgres, per org):** auth, fixes, issues, audit, integrations, notifications, repos, projects, RBAC, Jira, AI settings, danger zone export/delete.

**Mostly UI/mock:** billing plans, some roadmap widgets, Linear/Asana ticketing.

Design mockup (not served): `plan/stitch-project-dashboard.html`

---

## Submission docs

- [README.md](README.md) — project overview  
- [DEVPOST-SUBMISSION.md](DEVPOST-SUBMISSION.md) — copy-paste Devpost fields  
- [STITCH-LIVE-SETUP.md](STITCH-LIVE-SETUP.md) — record live demo  
- [openai_project.md](openai_project.md) — hackathon rules  

## License

MIT
