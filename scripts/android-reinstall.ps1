# Rebuild debug APK, install, adb reverse (icon / native asset updates).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:GRADLE_USER_HOME = "C:\Users\tomas\.gradle"
if ($env:ADB) { $adb = $env:ADB } else {
  $adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
}
$env:ADB = $adb

Write-Host "== Flip android-reinstall ==" -ForegroundColor Cyan
Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "ADB=$env:ADB"

$npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
& $npm run android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $adb)) {
  Write-Host "WARN: adb not found — install done but reverse skipped." -ForegroundColor Yellow
  exit 0
}

$devicesOut = & $adb devices 2>&1 | Out-String
$serials = @()
foreach ($line in ($devicesOut -split "`n")) {
  if ($line -match "^\s*(\S+)\s+device\s*$") { $serials += $Matches[1] }
}
foreach ($serial in $serials) {
  & $adb -s $serial reverse tcp:8081 tcp:8081 | Out-Null
  Write-Host "adb reverse OK for $serial" -ForegroundColor Green
}
Write-Host "Done. Run npm run dev:connect for Metro if needed."
