# One command: fix branch + Metro + wait for USB + launch Flip + auto-sync + reload.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$ensure = Join-Path $PSScriptRoot 'ensure-fix-branch.ps1'
$devConnect = Join-Path $PSScriptRoot 'dev-connect.ps1'
$startAutoSync = Join-Path $PSScriptRoot 'start-flip-auto-sync.ps1'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  FLIP OPEN - pull latest, connect phone, launch dev app' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

& $ensure
if ($LASTEXITCODE -ne 0) { exit 1 }

& $devConnect -WaitForDevice
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ''
Write-Host 'Starting auto-sync (minimized)...' -ForegroundColor Cyan
& $startAutoSync

Write-Host ''
Write-Host 'Reloading JS on phone...' -ForegroundColor Cyan
& $devConnect -ConnectOnly -Reload

$head = (& git log -1 --oneline 2>$null).Trim()
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  FLIP OPEN OK - $head" -ForegroundColor Green
Write-Host '  Leave PC awake. Agents push -> auto-sync reloads (~5s).' -ForegroundColor Green
Write-Host '  Log: logs\auto-sync.log' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ''
exit 0
