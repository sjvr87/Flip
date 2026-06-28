# One-shot: clone Flip (if needed), checkout feed-polish branch, connect phone.
# Run from PowerShell 7: irm "https://raw.githubusercontent.com/sjvr87/Flip/cursor/tiktok-feed-polish-753c/scripts/bootstrap-and-connect.ps1" | iex
# Or from an existing clone:  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-and-connect.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = "C:\Users\tomas\Documents\Flip"
$Branch = "cursor/tiktok-feed-polish-753c"

if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    Write-Host "Cloning Flip into $RepoRoot ..."
    New-Item -Path $RepoRoot -ItemType Directory -Force | Out-Null
    git clone https://github.com/sjvr87/Flip.git $RepoRoot
}

Set-Location $RepoRoot
Write-Host "Syncing branch $Branch ..."
git fetch origin
git checkout $Branch
git pull origin $Branch

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies ..."
    npm.cmd install
}

Write-Host "Connecting device + Metro + launch ..."
npm.cmd run dev:connect
