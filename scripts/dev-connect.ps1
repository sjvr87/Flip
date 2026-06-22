# Flip dev connect: pull, adb reverse, Metro (reuse or start one window), launch app.
# Metro and deep links use LAN IP (192.168.x.x) only — never 127.0.0.1 on the phone.
#
# Modes:
#   (default)        flip-dev.bat          - pull + adb + reuse Metro (or start one window)
#   -RestartMetro    flip-dev-restart.bat  - pull + adb; recycle Metro only if unhealthy (clear cache)
#   -Reconnect       flip-reconnect.bat    - post-crash: adb + fix stale Metro + launch (no pull, no cache clear)
#   -ConnectOnly     flip-connect.bat      - adb + launch only (Metro must already be healthy)
#   -ConnectOnly -Reload  flip-reload.bat  - adb + POST /reload (JS tweak, app already running)
param(
  [switch]$RestartMetro,
  [switch]$ConnectOnly,
  [switch]$Reload,
  [switch]$Reconnect
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "R3GL10HN64A" }

function Get-LanIp {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" -and $_.IPAddress -like "192.168.*" } |
    Select-Object -First 1).IPAddress
  if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" -and $_.IPAddress -notlike "169.254.*" } |
      Select-Object -First 1).IPAddress
  }
  return $ip
}

$script:LanIp = Get-LanIp

$modeLabel = if ($Reconnect) {
  "reconnect (post-crash)"
} elseif ($ConnectOnly) {
  if ($Reload) { "connect-only (reload)" } else { "connect-only" }
} elseif ($RestartMetro) {
  "full (restart Metro if needed)"
} else {
  "full (reuse Metro)"
}
Write-Host "== Flip dev-connect ($modeLabel) ==" -ForegroundColor Cyan

$skipPull = $ConnectOnly -or $Reconnect
if (-not $skipPull) {
  $branch = (git branch --show-current).Trim()
  Write-Host "[1/6] git pull origin $branch..."
  $ErrorActionPreference = 'Continue'
  $pull = (cmd /c "git pull origin $branch 2>&1")
  $ErrorActionPreference = 'Stop'
  Write-Host $pull
} else {
  Write-Host "[1/6] git pull - skipped ($modeLabel)" -ForegroundColor DarkGray
}

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

function Get-MetroListenPids([int]$Port = 8081) {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
}

function Test-MetroHealthy {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing -TimeoutSec 2
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
  $pids = Get-MetroListenPids $Port
  if ($pids.Count -eq 0) { return $false }
  foreach ($metroPid in $pids) {
    Write-Host "  Stopping process on port ${Port} (PID $metroPid)..." -ForegroundColor Yellow
    Stop-Process -Id $metroPid -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  return -not (Test-PortListening $Port)
}

function Start-MetroInNewWindow([switch]$ClearCache) {
  if ($ClearCache) {
    Write-Host "  Starting Metro (dev-client, LAN, clear cache) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window.cmd"
  } else {
    Write-Host "  Starting Metro (dev-client, LAN, no cache clear) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window-fast.cmd"
  }
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "start", "`"Flip Metro`"", "`"$launcher`""
}

function Wait-MetroHealthy([int]$TimeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $pollMs = 500
  while ((Get-Date) -lt $deadline) {
    if (Test-MetroHealthy) { return $true }
    Start-Sleep -Milliseconds $pollMs
    if ($pollMs -lt 2000) { $pollMs = [Math]::Min($pollMs * 2, 2000) }
  }
  return $false
}

function Ensure-MetroRunning {
  param(
    [switch]$ForceRecycle,
    [switch]$ClearCacheOnStart
  )

  $healthy = Test-MetroHealthy
  $portInUse = Test-PortListening 8081

  if ($ForceRecycle -and $healthy) {
    Write-Host "  Metro already healthy - skipping recycle." -ForegroundColor Green
    return $true
  }

  if ($ForceRecycle -or (-not $healthy -and $portInUse)) {
    if ($portInUse) {
      if ($ForceRecycle) {
        Write-Host "  Recycling unhealthy Metro on 8081..." -ForegroundColor Yellow
      } else {
        Write-Host "  Metro unhealthy but port 8081 in use - stopping stale listener..." -ForegroundColor Yellow
      }
      Stop-MetroOnPort 8081 | Out-Null
    }
    $healthy = $false
  }

  if ($healthy) {
    Write-Host "  Metro already running (packager-status:running) - reusing, no new window." -ForegroundColor Green
    return $true
  }

  if (Test-PortListening 8081) {
    Write-Host "  Port 8081 still in use without healthy /status - stopping stale listener..." -ForegroundColor Yellow
    Stop-MetroOnPort 8081 | Out-Null
  }

  $useClear = $ClearCacheOnStart.IsPresent -or ($ForceRecycle -and -not $healthy)
  Start-MetroInNewWindow -ClearCache:$useClear
  $timeout = if ($useClear) { 60 } else { 35 }
  if (Wait-MetroHealthy -TimeoutSec $timeout) {
    Write-Host "  Metro started OK." -ForegroundColor Green
    return $true
  }

  Write-Host "  Metro not responding on http://127.0.0.1:8081/status - check the Metro window." -ForegroundColor Red
  Write-MetroNotRunningBanner
  return $false
}

function Invoke-MetroReload {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8081/reload" -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "  Metro reload sent (POST /reload)." -ForegroundColor Green
    return $true
  } catch {
    Write-Host "  Metro reload failed: $($_.Exception.Message)" -ForegroundColor Yellow
    return $false
  }
}

function Select-TargetSerials([string[]]$AllSerials) {
  if ($AllSerials.Count -eq 0) { return @() }
  if ($PreferredDevice -and ($AllSerials -contains $PreferredDevice)) {
    if ($AllSerials.Count -gt 1) {
      Write-Host "  Using preferred device $PreferredDevice (set FLIP_ADB_DEVICE to override)" -ForegroundColor DarkGray
    }
    return @($PreferredDevice)
  }
  if ($AllSerials.Count -gt 1 -and $PreferredDevice) {
    Write-Host "  Preferred device $PreferredDevice not found; using $($AllSerials -join ', ')" -ForegroundColor Yellow
  }
  return $AllSerials
}

function Ensure-AdbReverse([string[]]$TargetSerials, [string]$AdbPath) {
  $anyOk = $false
  foreach ($serial in $TargetSerials) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    & $AdbPath -s $serial wait-for-device 2>&1 | Out-Null
    & $AdbPath -s $serial shell input keyevent KEYCODE_WAKEUP 2>&1 | Out-Null
    & $AdbPath -s $serial reverse --remove tcp:8081 2>&1 | Out-Null

    $rev = (& $AdbPath -s $serial reverse tcp:8081 tcp:8081 2>&1 | Out-String).Trim()
    $list = (& $AdbPath -s $serial reverse --list 2>&1 | Out-String).Trim()

    if ($list -notmatch "tcp:8081") {
      Write-Host "  $serial : reverse missing after first try - reconnecting adb..." -ForegroundColor Yellow
      & $AdbPath -s $serial reconnect 2>&1 | Out-Null
      Start-Sleep -Milliseconds 800
      & $AdbPath -s $serial reverse --remove tcp:8081 2>&1 | Out-Null
      $rev = (& $AdbPath -s $serial reverse tcp:8081 tcp:8081 2>&1 | Out-String).Trim()
      $list = (& $AdbPath -s $serial reverse --list 2>&1 | Out-String).Trim()
    }

    $ErrorActionPreference = $prevEap

    if ($list -match "tcp:8081") {
      Write-Host "  $serial : reverse OK ($rev)" -ForegroundColor Green
      if ($list) { Write-Host "  reverse --list: $list" -ForegroundColor DarkGray }
      $anyOk = $true
    } else {
      Write-Host "  $serial : reverse FAILED - $rev" -ForegroundColor Red
    }
  }
  return $anyOk
}

function Start-FlipApp {
  param(
    [string]$Serial,
    [string]$AdbPath,
    [string]$DevServerHost
  )

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $AdbPath -s $Serial shell am force-stop social.flip.app 2>&1 | Out-Null

  if ($DevServerHost) {
    $encodedUrl = [System.Uri]::EscapeDataString("exp://${DevServerHost}:8081")
    $deepLink = "flip://expo-development-client/?url=$encodedUrl"
    $start = (& $AdbPath -s $Serial shell am start -a android.intent.action.VIEW -d "$deepLink" 2>&1 | Out-String).Trim()
  } else {
    $start = (& $AdbPath -s $Serial shell am start -n social.flip.app/.MainActivity 2>&1 | Out-String).Trim()
  }

  $ErrorActionPreference = $prevEap
  Write-Host "  $Serial : $start"
}

function Write-NoLanIpHelp {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  NO LAN IP FOUND - phone cannot reach Metro safely" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Flip dev uses your PC LAN address (192.168.x.x), not 127.0.0.1." -ForegroundColor Yellow
  Write-Host "Connect phone and PC to the same Wi-Fi, then re-run this script." -ForegroundColor Yellow
  Write-Host ""
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
  Write-Host "Then unplug, replug, and run flip-reconnect.bat or flip-dev.bat." -ForegroundColor Yellow
  Write-Host ""
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

$serials = Select-TargetSerials $serials

$reverseOk = $false
if ($unauthorized.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows unauthorized ($($unauthorized -join ', '))"
} elseif ($offline.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows offline ($($offline -join ', '))"
} elseif ($serials.Count -eq 0) {
  Write-UsbDeviceHelp "no device listed"
} else {
  Write-Host "[3/6] adb reverse tcp:8081 tcp:8081"
  $reverseOk = Ensure-AdbReverse -TargetSerials $serials -AdbPath $adb
}

if ($ConnectOnly -and -not $Reconnect) {
  $metroHealthy = Test-MetroHealthy
  Write-Host "[4/6] Metro - skipped (connect-only)" -ForegroundColor DarkGray
  if (-not $metroHealthy) {
    Write-Host "  WARN: Metro /status is NOT running. Run flip-dev.bat or flip-reconnect.bat." -ForegroundColor Yellow
    Write-MetroNotRunningBanner
  } else {
    Write-Host "  Metro /status: running (reused)" -ForegroundColor Green
  }

  if ($Reload -and $metroHealthy -and $serials.Count -gt 0) {
    Write-Host "[5/6] Reload JS via Metro"
    Invoke-MetroReload | Out-Null
  } elseif ($serials.Count -gt 0) {
    Write-Host "[5/6] Launch Flip on device"
    if (-not $script:LanIp) {
      Write-NoLanIpHelp
      exit 1
    }
    foreach ($serial in $serials) {
      Start-FlipApp -Serial $serial -AdbPath $adb -DevServerHost $script:LanIp
    }
  } else {
    Write-Host "[5/6] Launch/reload - skipped (no device)" -ForegroundColor Yellow
  }

  Write-Host ""
  Write-Host "=== Status (connect-only) ===" -ForegroundColor Cyan
  Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
  Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped" } else { "FAILED" }))
  Write-Host ("Metro /status: {0}" -f $(if ($metroHealthy) { "running" } else { "NOT running" }))
  Write-Host ""
  Write-Host "Tip: after crash use flip-reconnect.bat. JS-only: flip-reload.bat. Stale Metro: flip-dev-restart.bat"
  exit $(if ($metroHealthy -or $serials.Count -eq 0) { 0 } else { 1 })
}

if ($Reconnect) {
  Write-Host "[4/6] Metro (reconnect - fix stale listener if needed, no cache clear)"
  if ($env:CI -eq "true" -or $env:CI -eq "1") {
    Write-Host "  WARN: CI=$env:CI disables Metro watch/reload. Unset CI for local dev." -ForegroundColor Yellow
  }

  $metroHealthy = Ensure-MetroRunning -ClearCacheOnStart:$false
  if (-not $metroHealthy) {
    Write-Host "ERROR: Metro must be running before launching the app." -ForegroundColor Red
    exit 1
  }

  Write-Host "[5/6] Launch Flip with dev-server URL"
  if ($serials.Count -gt 0) {
    if (-not $script:LanIp) {
      Write-NoLanIpHelp
      exit 1
    }
    foreach ($serial in $serials) {
      Start-FlipApp -Serial $serial -AdbPath $adb -DevServerHost $script:LanIp
    }
  } else {
    Write-Host "  Skipped (no device)." -ForegroundColor Yellow
  }

  $finalMetroHealthy = Test-MetroHealthy
  Write-Host ""
  Write-Host "=== Status (reconnect) ===" -ForegroundColor Cyan
  Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
  Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped" } else { "FAILED" }))
  Write-Host ("Metro /status: {0}" -f $(if ($finalMetroHealthy) { "running" } else { "NOT running" }))
  Write-Host ""
  Write-Host "Scripts: flip-reload.bat (JS tweak) | flip-dev-restart.bat (force Metro clear cache)"
  exit $(if ($finalMetroHealthy) { 0 } else { 1 })
}

# --- Full dev-connect (pull + Metro + launch) ---

$willRecycleMetro = $RestartMetro.IsPresent -and (-not (Test-MetroHealthy))
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

$metroHealthy = Ensure-MetroRunning -ForceRecycle:$RestartMetro.IsPresent -ClearCacheOnStart:$RestartMetro.IsPresent
if (-not $metroHealthy) {
  Write-Host "ERROR: Metro must be running before launching the app. Not starting Flip on device." -ForegroundColor Red
  exit 1
}

Write-Host "[5/6] Launch Flip on device"
if ($serials.Count -gt 0) {
  if (-not $script:LanIp) {
    Write-NoLanIpHelp
    exit 1
  }
  foreach ($serial in $serials) {
    Start-FlipApp -Serial $serial -AdbPath $adb -DevServerHost $script:LanIp
  }
} else {
  Write-Host "  Skipped (no device)." -ForegroundColor Yellow
}

$finalMetroHealthy = Test-MetroHealthy

Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped (no device)" } else { "FAILED" }))
Write-Host ("Metro /status: {0}" -f $(if ($finalMetroHealthy) { "running" } else { "NOT running" }))
if ($script:LanIp) {
  Write-Host "Dev server URL: exp://${script:LanIp}:8081 (LAN only; 127.0.0.1 is not used)"
} else {
  Write-Host "Dev server URL: (no LAN IP - connect PC and phone to same Wi-Fi)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "=== Scripts ===" -ForegroundColor Cyan
Write-Host "- flip-dev.bat: first connect / sync branch - pull + adb + reuse Metro"
Write-Host "- flip-reconnect.bat: after crash - adb + fix Metro + launch (fast, no pull)"
Write-Host "- flip-connect.bat: adb + launch only (Metro already healthy)"
Write-Host "- flip-reload.bat: adb + POST /reload (JS tweak, app already running)"
Write-Host "- flip-dev-restart.bat: pull + force Metro recycle if unhealthy (clear cache)"
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host "- Beta/preview app [flip-beta.bat] is standalone - it cannot load live JS from your PC"
Write-Host "- After crash: flip-reconnect.bat (not flip-dev.bat - avoids git pull wait)"
Write-Host "- Stale Metro: flip-dev-restart.bat or npm run dev:connect:restart"
Write-Host "- Metro stuck in CI mode: close Metro, unset CI, run flip-dev-restart.bat"
Write-Host "- USB: data cable, USB debugging on, accept RSA fingerprint on phone"
Write-Host "- LAN: phone on same Wi-Fi as PC ($($script:LanIp)), allow Node through Windows Firewall on 8081"
Write-Host "- Do not pick 127.0.0.1 in dev launcher; use RESET on Recently Opened if it appears"
Write-Host "- Dev client only (not Expo Go); package social.flip.app"
Write-Host "- Crash 'OkHttp TaskRunner' / MessageDeflater: dev-only Metro WebSocket race - flip-reconnect.bat or flip-dev-restart.bat"

if (-not $finalMetroHealthy) {
  Write-MetroNotRunningBanner
  Write-Host "ERROR: Metro /status is NOT running. Re-run dev:connect after Metro is healthy." -ForegroundColor Red
  exit 1
}

exit 0
