# Gets the latest project from GitHub (pull + npm install).
# Run this when you start working on a PC.

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

Write-Host "Flip — sync from GitHub" -ForegroundColor Cyan
Write-Host "Folder: $repoRoot`n"

& $git pull

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "`nInstalling/updating dependencies..." -ForegroundColor Cyan
    npm install
} else {
    Write-Host "`nNode/npm not in PATH. Run 'npm install' manually after opening a new terminal." -ForegroundColor Yellow
}

Write-Host "`nDone. You have the latest code from GitHub." -ForegroundColor Green
Read-Host "Press Enter to close"
