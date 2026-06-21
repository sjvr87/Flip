# Start Flip dev: repo root check, then dev-connect with Metro restart.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$packageJson = Join-Path $Root "package.json"
if (-not (Test-Path -LiteralPath $packageJson)) {
  Write-Host "ERROR: package.json not found at: $packageJson" -ForegroundColor Red
  Write-Host "Expected Flip repo root: $Root" -ForegroundColor Yellow
  exit 1
}

$devConnect = Join-Path $PSScriptRoot "dev-connect.ps1"
if (-not (Test-Path -LiteralPath $devConnect)) {
  Write-Host "ERROR: dev-connect.ps1 not found at: $devConnect" -ForegroundColor Red
  exit 1
}

Write-Host "== Start Flip Dev ==" -ForegroundColor Cyan
Write-Host "Repo: $Root" -ForegroundColor DarkGray

try {
  & $devConnect -RestartMetro
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "dev-connect exited with code $LASTEXITCODE"
  }
} catch {
  Write-Host ""
  Write-Host "ERROR: Flip dev failed - $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "SUCCESS: Flip dev started (Metro restart + connect)." -ForegroundColor Green
exit 0
