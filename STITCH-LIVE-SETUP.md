# Stitch — live demo setup (submission recording)

Do this **after** you push `testrepo/` to GitHub. Total time: ~15–20 minutes.

Test repo: **https://github.com/Khushalsarode/stitch-test-flow-repo**

---

## Before you start — checklist

- [ ] Postgres running locally  
- [ ] Node 20+ installed  
- [ ] GitHub PAT with `repo` + `workflow` on the test repo  
- [ ] (Optional) ngrok for webhook recording  

---

## Step 1 — Push test repo

From Stitch repo root:

```powershell
npm run testrepo:setup
```

Confirm on GitHub:

- [ ] Branches: `main`, `release/v1.0`, `feature/checkout-v2`, `dev`, `hotfix/auth-guard`
- [ ] Actions → **CI** failed on `main` (red — that’s correct)
- [ ] Labels `stitch` + `auto-fix` exist

---

## Step 2 — Start Stitch

```powershell
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stitch?schema=public
GITHUB_TOKEN=ghp_your_pat_here
GITHUB_WEBHOOK_SECRET=pick-any-random-string
OPENAI_API_KEY=sk-...          # optional — demo fallback works without
```

```powershell
npm run db:migrate
npm run db:seed
npm run stitch:live-check
npm run dev
```

Login: **http://localhost:5173** → `demo@stitch.dev` / `demo1234`

---

## Step 3 — Connect GitHub (required for live PR)

**Settings → Integrations → GitHub → Connect**

| Field | Value |
|-------|--------|
| Personal access token | Same as `GITHUB_TOKEN` in `.env` |
| Webhook secret | Same as `GITHUB_WEBHOOK_SECRET` |

Click **Connect**. Status should show **Connected**.

**Settings → Repositories** → confirm `Khushalsarode/stitch-test-flow-repo` is **enabled** (project: Stitch Live Test).

> **Note:** “Continue with GitHub” on login is separate — it does **not** enable live PRs. You still need this Integrations step.

---

## Step 4 — Record Dashboard flows (no webhook)

Open **Dashboard → Try the autonomous loop**

| Button | What to say on camera |
|--------|------------------------|
| **Main · sandbox** | “CI fails — Stitch runs the full loop offline” |
| **Main · live PR** | “Same failure — real branch and PR on GitHub” |
| **Release · pending** | “Fix & propose — human approves in Fix Log” |
| **Feature · comment** | Run `npm run testrepo:open-pr` first — “comments on PR, no new PR” |
| **Dev · auto-merge** | “Dev branch — auto-merge when allowed” |
| **Hotfix · live PR** | “Urgent path on hotfix branch” |

After each: open **Fix Log** → show diagnosis, PR link, Audit.

---

## Step 5 — Record webhook demo (best for submission)

### A. Start tunnel

```powershell
ngrok http 3000
```

Copy the `https://` URL.

### B. Add GitHub webhook

Repo → **Settings → Webhooks → Add webhook**

| Field | Value |
|-------|--------|
| Payload URL | `https://YOUR-NGROK.ngrok-free.app/webhooks/github` |
| Content type | `application/json` |
| Secret | your `GITHUB_WEBHOOK_SECRET` |
| Events | **Workflow runs** only |

### C. Trigger failure

Either:

- Push empty commit to `main`, **or**
- Actions → **CI** → **Run workflow**

### D. Show in Stitch

- Dashboard SSE feed updates  
- New Fix Log entry  
- GitHub PR opened (if branch = Autopilot path)  

---

## Step 6 — Revert demo (optional, 30 seconds)

1. Merge or approve a fix from Fix Log  
2. **Revert this fix** → enter reason  
3. Show **Reverted** status + Issue record update  

---

## Step 7 — Prove CI goes green (optional)

After merging Stitch’s JWT guard fix:

- Actions → **Verify fix (green path)** → Run workflow  
- Or locally: `$env:JWT_SECRET="x"; npm test` in `testrepo/`

---

## Quick reference — what each branch does

| Branch | Stitch mode | Output |
|--------|-------------|--------|
| `main` | Autopilot | Opens PR |
| `release/v1.0` | Fix & propose | PR, pending review |
| `feature/checkout-v2` | Diagnose & suggest | Comment on PR #1 |
| `dev` | Autopilot + auto-merge | PR + merge |
| `hotfix/auth-guard` | Autopilot (urgent) | Opens PR |

---

## If something breaks during recording

| Symptom | Fix |
|---------|-----|
| Live PR button greyed out | Integrations → Connect GitHub |
| PR skipped in Fix Log | PAT missing `repo` scope; repo disabled |
| Webhook 401 | Webhook secret mismatch |
| Webhook 404 repo | Run `npm run db:seed`; enable repo |
| Patch apply failed | Re-run `npm run testrepo:setup` — file must match demo diff |
| No AI diagnosis | OK — demo fallback still opens PR with JWT guard fix |

**Fallback for video:** Dashboard **Main · sandbox** always works without GitHub.

---

## More detail

- [testrepo/DEMO-FLOWS.md](testrepo/DEMO-FLOWS.md) — flows A–H  
- [setup.md](setup.md) — install + env  
- [DEVPOST-SUBMISSION.md](DEVPOST-SUBMISSION.md) — Devpost copy + video outline  

---

## After recording

1. Paste **Codex Session ID** into README + DEVPOST-SUBMISSION.md  
2. Upload video to YouTube (public, < 3 min)  
3. Submit on Devpost before **5:00 PM PT July 21, 2026**  
