# Flip dev connect: pull, adb reverse, Metro (dev-client + clear), launch app.
param(
  [switch]$RestartMetro,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== Flip dev-connect ==" -ForegroundColor Cyan

Write-Host "[1/6] git pull origin main..."
$ErrorActionPreference = 'Continue'
$pull = (cmd /c "git pull origin main 2>&1")
$ErrorActionPreference = 'Stop'
Write-Host $pull

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Host "ERROR: adb not found at $adb" -ForegroundColor Red
  Write-Host "Install Android SDK platform-tools or set ANDROID_HOME." -ForegroundColor Yellow
  exit 1
}

function Test-PortListening([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $conn
}

function Get-MetroListenPid([int]$Port = 8081) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) { return $conn.OwningProcess }
  return $null
}

function Test-MetroHealthy {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing -TimeoutSec 3
    $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
    return ($r.StatusCode -eq 200 -and $body -match "running")
  } catch {
    return $false
  }
}

function Stop-MetroOnPort([int]$Port = 8081) {
  $metroPid = Get-MetroListenPid $Port
  if (-not $metroPid) { return $false }
  Write-Host "  Stopping process on port ${Port} (PID $metroPid)..." -ForegroundColor Yellow
  Stop-Process -Id $metroPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  return -not (Test-PortListening $Port)
}

Write-Host "[2/6] adb devices"
$devicesOut = & $adb devices 2>&1 | Out-String
Write-Host $devicesOut.TrimEnd()

$serials = @()
foreach ($line in ($devicesOut -split "`n")) {
  if ($line -match "^\s*(\S+)\s+device\s*$") {
    $serials += $Matches[1]
  }
}

$reverseOk = $false
if ($serials.Count -eq 0) {
  Write-Host "WARN: No device in 'device' state - enable USB debugging, accept RSA prompt, use a data USB cable." -ForegroundColor Yellow
} else {
  Write-Host "[3/6] adb reverse tcp:8081 tcp:8081"
  foreach ($serial in $serials) {
    $rev = & $adb -s $serial reverse tcp:8081 tcp:8081 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  $serial : reverse OK ($rev)" -ForegroundColor Green
      $reverseOk = $true
    } else {
      Write-Host "  $serial : reverse FAILED - $rev" -ForegroundColor Red
    }
  }
  $reverseList = (& $adb -s $serials[0] reverse --list 2>&1 | Out-String).Trim()
  if ($reverseList) { Write-Host "  reverse --list: $reverseList" }
}

Write-Host "[4/6] Metro on port 8081"
$metroHealthy = Test-MetroHealthy
$portInUse = Test-PortListening 8081

if ($env:CI -eq "true" -or $env:CI -eq "1") {
  Write-Host "  WARN: CI=$env:CI disables Metro watch/reload. Unset CI for local dev." -ForegroundColor Yellow
}

if ($RestartMetro) {
  if ($portInUse) {
    Write-Host "  -RestartMetro: recycling Metro on 8081..." -ForegroundColor Yellow
    Stop-MetroOnPort 8081 | Out-Null
  }
  $metroHealthy = $false
  $portInUse = Test-PortListening 8081
} elseif (-not $metroHealthy -and $portInUse) {
  Write-Host "  Port 8081 in use but /status not healthy - recycling..." -ForegroundColor Yellow
  Stop-MetroOnPort 8081 | Out-Null
  $metroHealthy = $false
  $portInUse = Test-PortListening 8081
}

if ($metroHealthy -and -not $RestartMetro) {
  Write-Host "  Metro already running (packager-status:running)." -ForegroundColor Green
} elseif ($portInUse) {
  Write-Host "  Port 8081 in use; assuming Metro is running. Use -RestartMetro to force a fresh server." -ForegroundColor Yellow
  $metroHealthy = Test-MetroHealthy
} else {
  Write-Host "  Starting Metro (dev-client, clear cache) in new window..."
  $npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
  $metroArgs = if ($Lan) { "run start:lan" } else { "run start:clear" }
  $envBlock = "`$env:CI=`$null; Remove-Item Env:CI -ErrorAction SilentlyContinue; Remove-Item Env:EXPO_NO_INTERACTIVE -ErrorAction SilentlyContinue; Set-Location '$Root'; & '$npm' $metroArgs"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $envBlock -WorkingDirectory $Root
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if (Test-MetroHealthy) { $metroHealthy = $true; break }
  }
  if (-not $metroHealthy) {
    Write-Host "  Metro not responding yet on http://127.0.0.1:8081/status - check the Metro window." -ForegroundColor Yellow
  } else {
    Write-Host "  Metro started OK." -ForegroundColor Green
  }
}

Write-Host "[5/6] Launch Flip on device"
if ($serials.Count -gt 0) {
  foreach ($serial in $serials) {
    & $adb -s $serial shell am force-stop social.flip.app 2>&1 | Out-Null
    $start = & $adb -s $serial shell am start -n social.flip.app/.MainActivity 2>&1
    Write-Host "  $serial : $start"
  }
} else {
  Write-Host "  Skipped (no device)." -ForegroundColor Yellow
}

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" -and $_.IPAddress -like "192.168.*" } |
  Select-Object -First 1).IPAddress
if (-not $lanIp) {
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1).IPAddress
}

Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped (no device)" } else { "FAILED" }))
Write-Host ("Metro /status: {0}" -f $(if (Test-MetroHealthy) { "running" } else { "NOT running" }))
Write-Host "USB URL: exp://127.0.0.1:8081 (requires adb reverse)"
if ($lanIp) { Write-Host "LAN URL: exp://${lanIp}:8081 (npm run start:lan + same Wi-Fi)" }
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host "- Stale Metro / port conflict: npm run dev:connect -- -RestartMetro"
Write-Host "- Metro stuck in CI mode: close Metro, unset CI, run npm run start:clear"
Write-Host "- USB: data cable, USB debugging on, accept RSA fingerprint on phone"
Write-Host "- LAN: npm run start:lan, phone on same Wi-Fi as PC ($lanIp), allow Node through Windows Firewall on 8081"
Write-Host "- Dev client only (not Expo Go); package social.flip.app"
