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

function Write-MetroNotRunningBanner {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  METRO NOT RUNNING - app will crash or not load JS" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
}

function Stop-MetroOnPort([int]$Port = 8081) {
  $metroPid = Get-MetroListenPid $Port
  if (-not $metroPid) { return $false }
  Write-Host "  Stopping process on port ${Port} (PID $metroPid)..." -ForegroundColor Yellow
  Stop-Process -Id $metroPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  return -not (Test-PortListening $Port)
}

function Start-MetroInNewWindow {
  Write-Host "  Starting Metro (dev-client, clear cache) in new window..."
  $npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
  $metroArgs = if ($Lan) { "run start:lan" } else { "run start:clear" }
  $envBlock = "`$env:CI=`$null; Remove-Item Env:CI -ErrorAction SilentlyContinue; Remove-Item Env:EXPO_NO_INTERACTIVE -ErrorAction SilentlyContinue; Set-Location '$Root'; & '$npm' $metroArgs"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", $envBlock -WorkingDirectory $Root
}

function Wait-MetroHealthy([int]$TimeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if (Test-MetroHealthy) { return $true }
  }
  return $false
}

function Ensure-MetroRunning([switch]$ForceRecycle) {
  $healthy = Test-MetroHealthy
  $portInUse = Test-PortListening 8081

  if ($ForceRecycle -or (-not $healthy -and $portInUse)) {
    if ($portInUse) {
      if ($ForceRecycle) {
        Write-Host "  -RestartMetro: recycling Metro on 8081..." -ForegroundColor Yellow
      } else {
        Write-Host "  Metro unhealthy but port 8081 in use - auto-recycling (same as -RestartMetro)..." -ForegroundColor Yellow
      }
      Stop-MetroOnPort 8081 | Out-Null
    }
    $healthy = $false
  }

  if ($healthy) {
    Write-Host "  Metro already running (packager-status:running)." -ForegroundColor Green
    return $true
  }

  if (Test-PortListening 8081) {
    Write-Host "  Port 8081 still in use without healthy /status - stopping stale listener..." -ForegroundColor Yellow
    Stop-MetroOnPort 8081 | Out-Null
  }

  Start-MetroInNewWindow
  if (Wait-MetroHealthy) {
    Write-Host "  Metro started OK." -ForegroundColor Green
    return $true
  }

  Write-Host "  Metro not responding on http://127.0.0.1:8081/status - check the Metro window." -ForegroundColor Red
  Write-MetroNotRunningBanner
  return $false
}

Write-Host "[2/6] adb devices"
$devicesOut = & $adb devices 2>&1 | Out-String
Write-Host $devicesOut.TrimEnd()

$serials = @()
$unauthorized = @()
$offline = @()
foreach ($line in ($devicesOut -split "`n")) {
  if ($line -match "^\s*(\S+)\s+device\s*$") {
    $serials += $Matches[1]
  } elseif ($line -match "^\s*(\S+)\s+unauthorized\s*$") {
    $unauthorized += $Matches[1]
  } elseif ($line -match "^\s*(\S+)\s+offline\s*$") {
    $offline += $Matches[1]
  }
}

function Write-UsbDeviceHelp {
  param([string]$Reason)
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  PHONE NOT READY FOR USB DEV - $Reason" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "On your Samsung phone:" -ForegroundColor Yellow
  Write-Host "  1. Use a data USB cable (not charge-only)"
  Write-Host "  2. Settings -> Developer options -> USB debugging ON"
  Write-Host "  3. When plugged in, tap Allow on the USB debugging prompt"
  Write-Host "  4. USB mode: File transfer / MTP (not Charging only)"
  Write-Host ""
  Write-Host "Then unplug, replug, and run flip-dev.bat again." -ForegroundColor Yellow
  Write-Host ""
}

$reverseOk = $false
if ($unauthorized.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows unauthorized ($($unauthorized -join ', '))"
} elseif ($offline.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows offline ($($offline -join ', '))"
} elseif ($serials.Count -eq 0) {
  Write-UsbDeviceHelp "no device listed"
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

# Stop Flip before killing Metro so RN dev WebSockets close cleanly (avoids OkHttp
# TaskRunner NPE in MessageDeflater when Metro is recycled under a live connection).
$willRecycleMetro = $RestartMetro.IsPresent -or ((-not (Test-MetroHealthy)) -and (Test-PortListening 8081))
if ($willRecycleMetro -and $serials.Count -gt 0) {
  Write-Host "[3b/6] Stop Flip before Metro recycle"
  foreach ($serial in $serials) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $adb -s $serial shell am force-stop social.flip.app 2>&1 | Out-Null
    $ErrorActionPreference = $prevEap
    Write-Host "  $serial : force-stop OK" -ForegroundColor Green
  }
}

Write-Host "[4/6] Metro on port 8081"
if ($env:CI -eq "true" -or $env:CI -eq "1") {
  Write-Host "  WARN: CI=$env:CI disables Metro watch/reload. Unset CI for local dev." -ForegroundColor Yellow
}

$metroHealthy = Ensure-MetroRunning -ForceRecycle:$RestartMetro.IsPresent
if (-not $metroHealthy) {
  Write-Host "ERROR: Metro must be running before launching the app. Not starting Flip on device." -ForegroundColor Red
  exit 1
}

Write-Host "[5/6] Launch Flip on device"
if ($serials.Count -gt 0) {
  foreach ($serial in $serials) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $adb -s $serial shell am force-stop social.flip.app 2>&1 | Out-Null
    $start = (& $adb -s $serial shell am start -n social.flip.app/.MainActivity 2>&1 | Out-String).Trim()
    $ErrorActionPreference = $prevEap
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

$finalMetroHealthy = Test-MetroHealthy

Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped (no device)" } else { "FAILED" }))
Write-Host ("Metro /status: {0}" -f $(if ($finalMetroHealthy) { "running" } else { "NOT running" }))
Write-Host "USB URL: exp://127.0.0.1:8081 (requires adb reverse)"
if ($lanIp) { Write-Host "LAN URL: exp://${lanIp}:8081 (npm run start:lan + same Wi-Fi)" }
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host "- Must run flip-dev.bat (or npm run dev:connect:restart) - opening Flip alone does not start Metro"
Write-Host "- Beta/preview app [flip-beta.bat] is standalone - it cannot load live JS from your PC"
Write-Host "- Stale Metro / port conflict: npm run dev:connect -- -RestartMetro"
Write-Host "- Metro stuck in CI mode: close Metro, unset CI, run npm run start:clear"
Write-Host "- USB: data cable, USB debugging on, accept RSA fingerprint on phone"
Write-Host "- LAN: npm run start:lan, phone on same Wi-Fi as PC ($lanIp), allow Node through Windows Firewall on 8081"
Write-Host "- Dev client only (not Expo Go); package social.flip.app"
Write-Host "- Crash 'OkHttp TaskRunner' / MessageDeflater: dev-only Metro WebSocket race — re-run flip-dev.bat"

if (-not $finalMetroHealthy) {
  Write-MetroNotRunningBanner
  Write-Host "ERROR: Metro /status is NOT running. Re-run dev:connect after Metro is healthy." -ForegroundColor Red
  exit 1
}

exit 0
