# Flip beta — cloud build for your phone. Double-click flip-beta.bat (see FLIP-BETA.txt).

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$packageJson = Join-Path $Root "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
  Write-Host ""
  Write-Host "Something went wrong: Flip was not found in the expected folder." -ForegroundColor Red
  Write-Host "  $Root" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Double-click flip-beta.bat from your Flip folder (where package.json lives)." -ForegroundColor Yellow
  Read-Host "Press Enter to close"
  exit 1
}

function Write-Big {
  param([string]$Text, [string]$Color = "Green")
  Write-Host ""
  Write-Host ("=" * 60) -ForegroundColor $Color
  Write-Host $Text -ForegroundColor $Color
  Write-Host ("=" * 60) -ForegroundColor $Color
  Write-Host ""
}

function Invoke-EasCli {
  param([string[]]$EasArgs)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & npx --yes eas-cli @EasArgs 2>&1
  $exit = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  return @{ Exit = $exit; Output = $output }
}

function Get-FlipEasProjectId {
  $appJsonPath = Join-Path $Root "app.json"
  if (-not (Test-Path -LiteralPath $appJsonPath)) { return $null }
  try {
    $app = Get-Content -LiteralPath $appJsonPath -Raw | ConvertFrom-Json
    $id = $app.expo.extra.eas.projectId
    if ($id -and ($id -as [string]).Trim()) { return ($id -as [string]).Trim() }
  } catch { }
  return $null
}

function Get-LatestBuildInstallUrl {
  $result = Invoke-EasCli @("build:list", "--platform", "android", "--limit", "1", "--json", "--non-interactive")
  if ($result.Exit -ne 0) { return $null }

  $text = ($result.Output | Out-String).Trim()
  try {
    $builds = $text | ConvertFrom-Json
    if (-not $builds) { return $null }
    $latest = if ($builds -is [array]) { $builds[0] } else { $builds }
    if ($latest.artifacts.applicationArchiveUrl) { return $latest.artifacts.applicationArchiveUrl }
    if ($latest.artifacts.buildUrl) { return $latest.artifacts.buildUrl }
    if ($latest.webUrl) { return $latest.webUrl }
  } catch { }

  $match = [regex]::Match($text, 'https://expo\.dev/\S+')
  if ($match.Success) { return $match.Value }
  return $null
}

function Get-UrlFromOutput {
  param($Output)
  $text = ($Output | Out-String)
  $matches = [regex]::Matches($text, 'https://expo\.dev/[^\s''"<>]+')
  if ($matches.Count -gt 0) { return $matches[$matches.Count - 1].Value }
  return $null
}

Write-Host ""
Write-Host "  Flip — install on your phone" -ForegroundColor Cyan
Write-Host "  This builds Flip in the cloud and gives you a link for your phone." -ForegroundColor DarkGray
Write-Host "  First time takes about 15 minutes. You only log in once." -ForegroundColor DarkGray
Write-Host ""

# --- Step 1: Expo account ---
Write-Host "Step 1 of 4: Checking your Expo account..." -ForegroundColor Cyan

$whoamiResult = Invoke-EasCli @("whoami")
$whoami = ($whoamiResult.Output | Out-String).Trim()
$loggedIn = $whoamiResult.Exit -eq 0 -and $whoami -and $whoami -notmatch '(?i)not logged in|error|ERR!'

if (-not $loggedIn) {
  Write-Host ""
  Write-Host "  You are not signed in yet (this is normal the first time)." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  What happens next:" -ForegroundColor White
  Write-Host "    1. Your web browser will open" -ForegroundColor White
  Write-Host "    2. Sign in to Expo, or create a free account" -ForegroundColor White
  Write-Host "    3. Come back here when the browser says you are logged in" -ForegroundColor White
  Write-Host ""
  Read-Host "Press Enter to open the login page"

  $loginResult = Invoke-EasCli @("login")
  $loginResult.Output | ForEach-Object { Write-Host $_ }

  if ($loginResult.Exit -ne 0) {
    Write-Host ""
    Write-Host "  Sign-in did not finish." -ForegroundColor Red
    Write-Host "  Try again: double-click flip-beta.bat and sign in when the browser opens." -ForegroundColor Yellow
    Write-Host "  Or run this in a browser yourself: https://expo.dev/login" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
  }

  $whoamiResult = Invoke-EasCli @("whoami")
  $whoami = ($whoamiResult.Output | Out-String).Trim()
  if ($whoamiResult.Exit -ne 0 -or -not $whoami) {
    Write-Host ""
    Write-Host "  Still not signed in. Finish logging in in the browser, then press Enter." -ForegroundColor Yellow
    Read-Host "Press Enter when you are done logging in"
    $whoamiResult = Invoke-EasCli @("whoami")
    $whoami = ($whoamiResult.Output | Out-String).Trim()
    if ($whoamiResult.Exit -ne 0 -or -not $whoami) {
      Write-Host "  Sign-in failed. Double-click flip-beta.bat and try again." -ForegroundColor Red
      Read-Host "Press Enter to close"
      exit 1
    }
  }
}

Write-Host "  Signed in as: $whoami" -ForegroundColor Green
Write-Host ""

# --- Step 2: EAS project ---
Write-Host "Step 2 of 4: Checking Flip cloud setup..." -ForegroundColor Cyan

$projectId = Get-FlipEasProjectId
if (-not $projectId) {
  Write-Host ""
  Write-Host "  Flip needs a one-time cloud setup (about 1 minute)." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  In the questions below:" -ForegroundColor White
  Write-Host "    - Press Enter to accept defaults when unsure" -ForegroundColor White
  Write-Host "    - Say Yes to create or link a project for Flip" -ForegroundColor White
  Write-Host ""
  Read-Host "Press Enter to start setup"

  $initResult = Invoke-EasCli @("init")
  $initResult.Output | ForEach-Object { Write-Host $_ }

  if ($initResult.Exit -ne 0) {
    Write-Host ""
    Write-Host "  Cloud setup did not finish." -ForegroundColor Red
    Write-Host "  Double-click flip-beta.bat and try again." -ForegroundColor Yellow
    Write-Host "  If it keeps failing, check your internet connection." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
  }

  $projectId = Get-FlipEasProjectId
  if (-not $projectId) {
    Write-Host ""
    Write-Host "  Setup ran but Flip is still not linked." -ForegroundColor Red
    Write-Host "  Double-click flip-beta.bat and run setup again." -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 1
  }
}

Write-Host "  Flip is set up in the cloud." -ForegroundColor Green
Write-Host ""

# --- Step 3: Cloud build ---
Write-Host "Step 3 of 4: Building Flip for your phone..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Please wait — this usually takes about 15 minutes." -ForegroundColor Yellow
Write-Host "  You can leave this window open and do something else." -ForegroundColor DarkGray
Write-Host "  Do not close this window until you see a link at the end." -ForegroundColor DarkGray
Write-Host ""

$buildResult = Invoke-EasCli @("build", "--profile", "preview", "--platform", "android", "--non-interactive")
$buildResult.Output | ForEach-Object { Write-Host $_ }

if ($buildResult.Exit -ne 0) {
  Write-Host ""
  Write-Host "  Build needs a quick answer — follow the prompt below." -ForegroundColor Yellow
  Write-Host ""
  $buildResult = Invoke-EasCli @("build", "--profile", "preview", "--platform", "android")
  $buildResult.Output | ForEach-Object { Write-Host $_ }
}

if ($buildResult.Exit -ne 0) {
  Write-Host ""
  Write-Host "  The build did not finish." -ForegroundColor Red
  Write-Host ""
  Write-Host "  Things to try:" -ForegroundColor Yellow
  Write-Host "    - Check your internet connection" -ForegroundColor Yellow
  Write-Host "    - Wait a few minutes and double-click flip-beta.bat again" -ForegroundColor Yellow
  Write-Host "    - Make sure you finished signing in (Step 1)" -ForegroundColor Yellow
  Read-Host "Press Enter to close"
  exit 1
}

# --- Step 4: Install link ---
Write-Host ""
Write-Host "Step 4 of 4: Done!" -ForegroundColor Green

$installUrl = Get-UrlFromOutput $buildResult.Output
if (-not $installUrl) {
  $installUrl = Get-LatestBuildInstallUrl
}

if ($installUrl) {
  Write-Big "OPEN THIS LINK ON YOUR PHONE TO INSTALL FLIP:`n`n  $installUrl"
} else {
  Write-Big "BUILD FINISHED — open expo.dev on your phone, sign in with the same account, and open the latest Android build."
}

Write-Host "  How to install on your Samsung phone:" -ForegroundColor White
Write-Host "    1. Copy the link above (or open expo.dev in Chrome on your phone)" -ForegroundColor White
Write-Host "    2. Tap Install or Download" -ForegroundColor White
Write-Host "    3. If Android asks, allow installs from this browser" -ForegroundColor White
Write-Host "    4. Open Flip from your home screen" -ForegroundColor White
Write-Host ""
Write-Host "  This Flip app works WITHOUT your PC." -ForegroundColor Green
Write-Host "  You do NOT need flip-dev.bat or to keep your computer on." -ForegroundColor Green
Write-Host "  Use Flip like any normal app on your phone." -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to close"
exit 0
