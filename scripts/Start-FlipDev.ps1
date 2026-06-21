# Flip dev — PowerShell-safe entry. Launch with -ExecutionPolicy Bypass (see FLIP-DEV.txt).
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

$devConnect = Join-Path $PSScriptRoot "dev-connect.ps1"
if (-not (Test-Path -LiteralPath $devConnect)) {
  Write-Host "ERROR: dev-connect.ps1 not found at: $devConnect" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host "== Start Flip Dev ==" -ForegroundColor Cyan
Write-Host "Repo: $Root" -ForegroundColor DarkGray
Write-Host "In PowerShell use npm.cmd (not bare npm)." -ForegroundColor DarkGray
Write-Host ""

try {
  & $devConnect -RestartMetro
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "dev-connect exited with code $LASTEXITCODE"
  }
} catch {
  Write-Host ""
  Write-Host "ERROR: Flip dev failed - $($_.Exception.Message)" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "Leave this window open while Metro is running." -ForegroundColor Green
exit 0
