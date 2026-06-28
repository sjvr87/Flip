# Pull branch, connect phone, start/reuse Metro, launch Flip, then stream logcat for live debugging.
# Run from repo root: flip-dev-live.bat  (or flip-dev-live.bat -Reset for cache clear)
param(
  [switch]$Reset,
  [switch]$RestartMetro,
  [switch]$ConnectOnly,
  [switch]$Reload
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$connectArgs = @()
if ($Reset) { $connectArgs += "-Reset" }
elseif ($RestartMetro) { $connectArgs += "-RestartMetro" }
elseif ($ConnectOnly) {
  $connectArgs += "-ConnectOnly"
  if ($Reload) { $connectArgs += "-Reload" }
}

Write-Host "== Flip dev-live (connect + logcat) ==" -ForegroundColor Cyan

& (Join-Path $PSScriptRoot "dev-connect.ps1") @connectArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Host "WARN: adb not found — skipping logcat window." -ForegroundColor Yellow
  exit 0
}

$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "" }
$devicesOut = & $adb devices 2>&1 | Out-String
$serials = @()
foreach ($line in ($devicesOut -split "`n")) {
  if ($line -match "^\s*(\S+)\s+device\s*$") {
    $serials += $Matches[1]
  }
}

$serial = $null
if ($PreferredDevice -and ($serials -contains $PreferredDevice)) {
  $serial = $PreferredDevice
} elseif ($serials.Count -eq 1) {
  $serial = $serials[0]
} elseif ($serials.Count -gt 1) {
  $serial = $serials[0]
  Write-Host "Multiple devices — logcat on $serial (set FLIP_ADB_DEVICE to override)" -ForegroundColor Yellow
}

if (-not $serial) {
  Write-Host "No device for logcat — connect USB debugging and re-run." -ForegroundColor Yellow
  exit 0
}

$logDir = Join-Path $Root "logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "flip-logcat-$stamp.txt"

Write-Host ""
Write-Host "Opening logcat window (also writing $logFile)" -ForegroundColor Cyan
Write-Host "  Filters: ReactNativeJS, Flip, expo, Hermes, AndroidRuntime errors" -ForegroundColor DarkGray
Write-Host ""

$logcatCmd = @"
title Flip logcat & echo Flip logcat — $serial & echo Log file: $logFile & echo. & "$adb" -s $serial logcat -c & "$adb" -s $serial logcat -v time ReactNativeJS:V ReactNative:V ExpoModules:V Hermes:V flip:V Flip:V social.flip.app:V AndroidRuntime:E *:S 2>&1 | tee -a "$logFile"
"@

# tee may be unavailable on older Windows — fallback to Out-File in script block
$psLogcat = @"
`$log = '$logFile'
& '$adb' -s '$serial' logcat -c
& '$adb' -s '$serial' logcat -v time ReactNativeJS:V ReactNative:V ExpoModules:V Hermes:V flip:V Flip:V social.flip.app:V AndroidRuntime:E *:S 2>&1 |
  ForEach-Object { `$_; Add-Content -Path `$log -Value `$_ }
"@

Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoExit", "-NoProfile", "-Command", $psLogcat `
  -WorkingDirectory $Root `
  -WindowStyle Normal

Write-Host "Done. Metro + app should be running; watch 'Flip logcat' window for JS errors." -ForegroundColor Green
Write-Host "After agent pushes JS: flip-reload.bat (or shake device -> Reload)" -ForegroundColor DarkGray
