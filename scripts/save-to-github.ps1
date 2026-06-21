# Saves all project changes to GitHub (add + commit + push).
# Usage: double-click save-to-github.bat, or run this script from the repo.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$git = "git"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $gitExe = "C:\Program Files\Git\bin\git.exe"
    if (Test-Path $gitExe) {
        $git = $gitExe
    } else {
        Write-Host "Git not found. Install Git for Windows first." -ForegroundColor Red
        Read-Host "Press Enter to close"
        exit 1
    }
}

Write-Host "Flip — save to GitHub" -ForegroundColor Cyan
Write-Host "Folder: $repoRoot`n"

& $git status

$changes = & $git status --porcelain
if ($changes) {
    $defaultMessage = "save $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $message = Read-Host "Commit message (Enter for '$defaultMessage')"
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = $defaultMessage
    }

    & $git add .
    & $git commit -m $message
} else {
    Write-Host "`nNo file changes to commit." -ForegroundColor Yellow
}

Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
& $git push

Write-Host "`nDone. Your work is on GitHub." -ForegroundColor Green
Read-Host "Press Enter to close"
