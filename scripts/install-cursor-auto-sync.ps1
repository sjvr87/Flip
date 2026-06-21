# Installs Cursor auto sync-in / save-out hooks (runs on this PC for all projects).
# Run once per PC after cloning Flip.

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "cursor-hooks"
$cursorDir = Join-Path $env:USERPROFILE ".cursor"
$hooksDir = Join-Path $cursorDir "hooks"

if (-not (Test-Path $source)) {
    Write-Host "Missing folder: $source" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

New-Item -ItemType Directory -Force -Path $hooksDir | Out-Null
Copy-Item (Join-Path $source "*.ps1") $hooksDir -Force
Copy-Item (Join-Path $source "hooks.json") $cursorDir -Force

Write-Host "Cursor auto Git hooks installed." -ForegroundColor Green
Write-Host "  sessionStart -> git pull (sync in)"
Write-Host "  stop         -> git commit + push (save out)"
Write-Host "  Log: $hooksDir\auto-github.log"
Write-Host ""
Write-Host "Restart Cursor if hooks do not run immediately."
Read-Host "Press Enter to close"
