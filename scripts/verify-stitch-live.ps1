# Validates Stitch is ready for live GitHub testing.
# Run from repo root: npm run stitch:live-check

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root ".env"
$Ok = $true

function Warn($msg) { Write-Host "WARN: $msg" -ForegroundColor Yellow }
function Ok($msg) { Write-Host "OK:   $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; $script:Ok = $false }

Write-Host "`nStitch live readiness check`n" -ForegroundColor Cyan

if (-not (Test-Path $EnvFile)) {
  Fail ".env missing — copy .env.example and fill in DATABASE_URL, GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET"
} else {
  Ok ".env exists"
  $content = Get-Content $EnvFile -Raw
  foreach ($key in @("DATABASE_URL", "GITHUB_TOKEN", "GITHUB_WEBHOOK_SECRET")) {
    if ($content -match "$key=\s*\S+" -and $content -notmatch "$key=\s*$") { Ok "$key set" }
    else { Warn "$key empty — sandbox simulate works; live PR + webhook need it" }
  }
}

$TestRepo = Join-Path $Root "testrepo"
if (Test-Path (Join-Path $TestRepo "auth\token.js")) { Ok "testrepo/ populated" }
else { Fail "testrepo/ missing auth/token.js" }

if (Test-Path (Join-Path $TestRepo ".git")) { Ok "testrepo/ has git remote" }
else { Warn "testrepo/.git missing" }

Push-Location $Root
try {
  $null = npm run db:generate 2>&1
} catch {}

Write-Host ""
if ($Ok) {
  Write-Host "Ready for live testing. Next: npm run testrepo:setup → npm run db:seed → npm run dev" -ForegroundColor Green
  Write-Host "Full guide: STITCH-LIVE-SETUP.md`n"
} else {
  Write-Host "Fix failures above, then re-run.`n" -ForegroundColor Red
  exit 1
}
