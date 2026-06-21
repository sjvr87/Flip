# Flip beta — EAS preview APK (no Metro). Launch with -ExecutionPolicy Bypass (see FLIP-BETA.txt).
# Do NOT paste lines that include the prompt, e.g. "PS C:\Users\tomas> ..."

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$packageJson = Join-Path $Root "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
  Write-Host ""
  Write-Host "ERROR: package.json not found at: $packageJson" -ForegroundColor Red
  Write-Host "Expected Flip repo root: $Root" -ForegroundColor Yellow
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "== Start Flip Beta (EAS Preview) ==" -ForegroundColor Cyan
Write-Host "Repo: $Root" -ForegroundColor DarkGray
Write-Host "Builds a standalone preview APK in the cloud (no Metro / dev server)." -ForegroundColor DarkGray
Write-Host "In PowerShell use npm.cmd (not bare npm)." -ForegroundColor DarkGray
Write-Host ""

function Invoke-EasCli {
  param([string[]]$EasArgs)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & npx --yes eas-cli @EasArgs
  $exit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  return $exit
}

Write-Host "[1/3] Checking EAS CLI..." -ForegroundColor Cyan
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$easVersion = (& npx --yes eas-cli --version 2>&1 | Out-String).Trim()
$easCheckExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($easCheckExit -ne 0 -or -not $easVersion -or $easVersion -match "(?i)error|ERR!") {
  Write-Host "ERROR: eas-cli not available." -ForegroundColor Red
  Write-Host "  Install: npm.cmd install -g eas-cli" -ForegroundColor Yellow
  Write-Host "  Or ensure npx can fetch eas-cli on this machine." -ForegroundColor Yellow
  Read-Host "Press Enter to close"
  exit 1
}
Write-Host "  eas-cli $easVersion" -ForegroundColor Green

Write-Host "[2/3] Checking Expo account..." -ForegroundColor Cyan
$ErrorActionPreference = 'Continue'
$whoami = (& npx --yes eas-cli whoami 2>&1 | Out-String).Trim()
$whoamiExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($whoamiExit -ne 0 -or $whoami -match "(?i)Not logged in|error|ERR!") {
  Write-Host ""
  Write-Host "You are not logged in to Expo." -ForegroundColor Yellow
  Write-Host "Run: npx eas-cli login" -ForegroundColor Yellow
  Write-Host ""
  $answer = Read-Host "Log in now? (y/N)"
  if ($answer -match '^[Yy]') {
    $loginExit = Invoke-EasCli @("login")
    if ($loginExit -ne 0) {
      Write-Host "ERROR: eas login failed." -ForegroundColor Red
      Read-Host "Press Enter to close"
      exit 1
    }
    $whoami = (& npx --yes eas-cli whoami 2>&1 | Out-String).Trim()
    Write-Host "  Logged in as: $whoami" -ForegroundColor Green
  } else {
    Write-Host "ERROR: Expo login required for EAS builds." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
} else {
  Write-Host "  Logged in as: $whoami" -ForegroundColor Green
}

Write-Host "[3/3] Starting EAS preview build (Android)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Build runs in Expo's cloud — typically 10-20 minutes." -ForegroundColor Yellow
Write-Host "  When finished, use the build page link to download/install the APK." -ForegroundColor Yellow
Write-Host "  No Metro or dev server needed on this PC." -ForegroundColor DarkGray
Write-Host ""

$buildExit = Invoke-EasCli @("build", "--profile", "preview", "--platform", "android", "--non-interactive")

if ($buildExit -ne 0) {
  Write-Host ""
  Write-Host "Non-interactive build failed — retrying with prompts enabled..." -ForegroundColor Yellow
  $buildExit = Invoke-EasCli @("build", "--profile", "preview", "--platform", "android")
}

if ($buildExit -ne 0) {
  Write-Host ""
  Write-Host "ERROR: EAS build failed." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "=== Beta build submitted ===" -ForegroundColor Green
Write-Host "Track progress at https://expo.dev (or the link printed above)."
Write-Host "When done, download the APK from the build page and install on your phone."
Write-Host ""
Write-Host "To list recent builds and get the latest APK URL:"
Write-Host "  npx eas-cli build:list --platform android --limit 5"
Write-Host ""
Read-Host "Press Enter to close"
exit 0
