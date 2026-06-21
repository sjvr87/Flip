# Installs global Git save/sync scripts to this PC (any repo, any app).
# Run once per PC: double-click install-global-git-scripts.bat

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "global"
$target = Join-Path $env:USERPROFILE "GitScripts"
$desktop = [Environment]::GetFolderPath("Desktop")

if (-not (Test-Path $source)) {
    Write-Host "Missing folder: $source" -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $source "*") $target -Force

@(
    @{ Name = "Save to GitHub.bat"; Script = "save-to-github.ps1" },
    @{ Name = "Sync from GitHub.bat"; Script = "sync-from-github.ps1" }
) | ForEach-Object {
    $batPath = Join-Path $desktop $_.Name
    @"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "$target\$($_.Script)" %*
"@ | Set-Content -Path $batPath -Encoding ASCII
}

Write-Host "Installed global Git scripts." -ForegroundColor Green
Write-Host "  $target"
Write-Host "  Desktop shortcuts: Save to GitHub, Sync from GitHub"
Read-Host "Press Enter to close"
