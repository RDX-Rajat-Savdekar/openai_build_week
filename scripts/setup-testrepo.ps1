# Populates testrepo/ and pushes all Stitch demo branches to GitHub.
# Run from repo root:  npm run testrepo:setup

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Repo = Join-Path $Root "testrepo"

if (-not (Test-Path (Join-Path $Repo ".git"))) {
  Write-Error "testrepo/.git not found — clone https://github.com/Khushalsarode/stitch-test-flow-repo into testrepo/ first."
}

Push-Location $Repo

Write-Host "Installing npm dependencies..."
npm install

Write-Host "Verifying CI fails without JWT_SECRET (expected exit 1)..."
npm test
if ($LASTEXITCODE -eq 0) {
  Write-Error "Tests passed without JWT_SECRET — CI would not fail."
}
Write-Host "CI failure confirmed (exit $LASTEXITCODE)."

git config user.email "stitch-demo@stitch.dev"
git config user.name "Stitch Demo"

git add -A
$status = git status --porcelain
if ($status) {
  git commit -m "feat: Stitch live test repo (CI failure, branches, demo flows)"
  Write-Host "Committed changes."
} else {
  Write-Host "Working tree clean — nothing to commit."
}

$current = git branch --show-current
if ($current -eq "master" -or -not $current) {
  git branch -M main
}
git checkout main 2>$null
if ($LASTEXITCODE -ne 0) { git checkout -b main }

$branches = @(
  "main",
  "release/v1.0",
  "feature/checkout-v2",
  "dev",
  "hotfix/auth-guard"
)

foreach ($b in $branches) {
  if ($b -eq "main") { continue }
  git checkout main
  git checkout -B $b
  Write-Host "Branch ready: $b"
}

git checkout main

Write-Host ""
Write-Host "Pushing to origin (requires GitHub auth)..."
$pushOk = $true
try {
  git push -u origin main --force-with-lease
  foreach ($b in $branches) {
    if ($b -eq "main") { continue }
    git push -u origin $b --force-with-lease
  }
} catch {
  $pushOk = $false
  Write-Host "Push failed: $_" -ForegroundColor Red
  Write-Host "Push manually from testrepo/: git push -u origin main && git push origin release/v1.0 feature/checkout-v2 dev hotfix/auth-guard"
}

Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Test repo push complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. npm run db:seed"
Write-Host "  2. Set GITHUB_TOKEN + GITHUB_WEBHOOK_SECRET in .env"
Write-Host "  3. npm run stitch:live-check"
Write-Host "  4. npm run dev  →  demo@stitch.dev / demo1234"
Write-Host "  5. Settings → Integrations → GitHub → Connect"
Write-Host "  6. npm run testrepo:open-pr   (for Feature · comment demo)"
Write-Host ""
Write-Host "Webhook URL (after ngrok): https://YOUR-TUNNEL/webhooks/github"
Write-Host "Full guide: STITCH-LIVE-SETUP.md"
Write-Host "All flows:  testrepo/DEMO-FLOWS.md"
