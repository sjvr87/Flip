# Checkout and pull the active fix branch (agents push here until PR merges).
param(
    [string]$Branch = 'cursor/fix-s25-feed-tabs-regression-56a3'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path (Join-Path $Root 'package.json'))) {
    Write-Host 'ERROR: package.json missing — run from Flip repo root.' -ForegroundColor Red
    exit 1
}

Write-Host "== Fix branch: $Branch ==" -ForegroundColor Cyan
Write-Host "[git] fetch origin $Branch..."
$ErrorActionPreference = 'Continue'
$null = cmd /c "git fetch origin $Branch 2>&1"
$ErrorActionPreference = 'Stop'

$onBranch = (& git branch --show-current 2>$null).Trim()
if ($onBranch -ne $Branch) {
    Write-Host "[git] checkout $Branch..."
    & git checkout $Branch 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: checkout $Branch failed." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[git] pull origin $Branch..."
$pull = cmd /c "git pull origin $Branch 2>&1"
Write-Host $pull
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: pull failed.' -ForegroundColor Red
    exit 1
}

$head = (& git log -1 --oneline 2>$null).Trim()
Write-Host ""
Write-Host "READY: $head" -ForegroundColor Green
exit 0
