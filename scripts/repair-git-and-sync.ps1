# Repair common Windows .git permission / corrupt-object issues, then sync feed branch.
# Run from PowerShell 7 (Admin recommended):
#   cd C:\Users\tomas\Documents\Flip
#   powershell -ExecutionPolicy Bypass -File .\scripts\repair-git-and-sync.ps1
#
# Or one-liner without a local pull (downloads this script from GitHub):
#   iwr -useb https://raw.githubusercontent.com/sjvr87/Flip/cursor/tiktok-feed-polish-753c/scripts/repair-git-and-sync.ps1 | iex

$ErrorActionPreference = 'Stop'
$Branch = 'cursor/tiktok-feed-polish-753c'
$ExpectedHead = '48ae6a8'

$repoRoot = $PSScriptRoot | Split-Path -Parent
if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    Write-Error "Not a git repo: $repoRoot"
}

Set-Location $repoRoot
Write-Host "== Repair git in $repoRoot ==" -ForegroundColor Cyan

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning 'Not running as Administrator — if repair fails, reopen PowerShell as Admin.'
}

try {
    takeown /F .git /R /D Y 2>$null | Out-Null
    icacls .git /grant "${env:USERNAME}:(OI)(CI)F" /T 2>$null | Out-Null
} catch {
    Write-Warning "takeown/icacls skipped: $_"
}

$badObject = Join-Path $repoRoot '.git\objects\8e\d2d3aa8201280a7518bcfcb45cc8b8f7381849'
if (Test-Path $badObject) {
    Write-Host "Removing unreadable object: $badObject"
    Remove-Item -Force $badObject -ErrorAction SilentlyContinue
}

Write-Host "Fetching $Branch ..."
git fetch origin $Branch

Write-Host "Resetting to origin/$Branch ..."
git checkout -B $Branch "origin/$Branch" 2>$null
if ($LASTEXITCODE -ne 0) {
    git checkout $Branch 2>$null
}
git reset --hard "origin/$Branch"

$head = (git rev-parse --short HEAD).Trim()
Write-Host "HEAD is now: $head" -ForegroundColor Green

if ($head -ne $ExpectedHead) {
    Write-Warning "Expected $ExpectedHead — you may still be on an older commit. Try Admin PowerShell or pause OneDrive on this folder."
} else {
    Write-Host "Synced to latest feed polish fix ($ExpectedHead)." -ForegroundColor Green
    Write-Host "Run: .\flip-reload.bat  (Metro already up) or .\flip-dev.bat"
}
