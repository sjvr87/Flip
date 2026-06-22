# Flip dev connect: pull, adb reverse, Metro (reuse or start one window), launch app.
# Deep links always use LAN IP (192.168.x.x) - never 127.0.0.1 - bypassing the dev launcher picker.
# adb reverse tcp:8081 is set for USB fallback; scripts still launch exp://LAN:8081 via deep link.
#
# Modes:
#   (default)        flip-dev.bat           - pull + adb + reuse Metro (or start one window)
#   -RestartMetro    flip-dev-restart.bat   - pull + adb; recycle Metro if unhealthy (clear cache)
#   -Reconnect       flip-reconnect.bat     - post-crash: adb + fix stale Metro + launch (no pull)
#   -Reset           flip-reset-dev.bat     - kill Metro, clear cache, fresh start, adb reverse, launch
#   -ConnectOnly     flip-connect.bat       - adb + launch only (Metro must already be healthy)
#   -ConnectOnly -Reload  flip-reload.bat   - adb + POST /reload (JS tweak, app already running)
param(
  [switch]$RestartMetro,
  [switch]$ConnectOnly,
  [switch]$Reload,
  [switch]$Reconnect,
  [switch]$Reset
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "R3GL10HN64A" }

function Get-LanIp {
  $getLanScript = Join-Path $PSScriptRoot "get-lan-ip.ps1"
  if (Test-Path $getLanScript) {
    return (& $getLanScript -Quiet 2>$null | Select-Object -First 1)
  }
  return $null
}

$script:LanIp = Get-LanIp

function Invoke-AdbQuiet {
  param([string]$AdbPath, [string[]]$AdbArgs)
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & $AdbPath @AdbArgs 2>&1
  $ErrorActionPreference = $prevEap
  return $out
}

function Invoke-AdbString {
  param([string]$AdbPath, [string[]]$AdbArgs)
  return (Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs $AdbArgs | Out-String).Trim()
}

$modeLabel = if ($Reset) {
  "reset (kill Metro, fresh start)"
} elseif ($Reconnect) {
  "reconnect (post-crash)"
} elseif ($ConnectOnly) {
  if ($Reload) { "connect-only (reload)" } else { "connect-only" }
} elseif ($RestartMetro) {
  "full (restart Metro if needed)"
} else {
  "full (reuse Metro)"
}
Write-Host "== Flip dev-connect ($modeLabel) ==" -ForegroundColor Cyan

$skipPull = $ConnectOnly -or $Reconnect -or $Reset
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

function Test-MetroStatusUrl([string]$BaseUrl) {
  try {
    $r = Invoke-WebRequest -Uri "${BaseUrl}/status" -UseBasicParsing -TimeoutSec 3
    $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
    return ($r.StatusCode -eq 200 -and $body -match "running")
  } catch {
    return $false
  }
}

function Test-MetroHealthy {
  return (Test-MetroStatusUrl "http://127.0.0.1:8081")
}

function Test-MetroLanHealthy {
  if (-not $script:LanIp) { return $false }
  return (Test-MetroStatusUrl "http://${script:LanIp}:8081")
}

function Write-MetroNotRunningBanner {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  METRO NOT RUNNING - app will crash or not load JS" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
}

function Stop-AllMetroOnPort([int]$Port = 8081) {
  $pids = Get-MetroListenPids $Port
  if ($pids.Count -eq 0) { return $true }
  foreach ($metroPid in $pids) {
    Write-Host "  Stopping process on port ${Port} (PID $metroPid)..." -ForegroundColor Yellow
    Stop-Process -Id $metroPid -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 2
  $remaining = Get-MetroListenPids $Port
  foreach ($metroPid in $remaining) {
    Write-Host "  Force-killing remaining PID $metroPid on port ${Port}..." -ForegroundColor Yellow
    Stop-Process -Id $metroPid -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  return -not (Test-PortListening $Port)
}

function Write-MetroWindowHint {
  param([bool]$StartedNew)

  Write-Host ""
  if ($StartedNew) {
    Write-Host '  >>> Metro window: a separate Command Prompt titled "Flip Metro" should appear on the taskbar.' -ForegroundColor Cyan
  } else {
    Write-Host '  >>> Metro reused: find the existing "Flip Metro" window on the taskbar (no new window opened).' -ForegroundColor Cyan
  }
  Write-Host "      Bundler log, QR code, and exp://LAN:8081 live there. This connect window is NOT Metro." -ForegroundColor DarkGray
  Write-Host ""
}

function Start-MetroInNewWindow([switch]$ClearCache) {
  if ($ClearCache) {
    Write-Host "  Starting Metro (dev-client, LAN, port 8081, clear cache) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window.cmd"
  } else {
    Write-Host "  Starting Metro (dev-client, LAN, port 8081) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window-fast.cmd"
  }
  # cmd /k keeps a visible console; title matches taskbar search ("Flip Metro").
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "title Flip Metro & call `"$launcher`"" `
    -WorkingDirectory $Root `
    -WindowStyle Normal
  Write-MetroWindowHint -StartedNew $true
}

function Wait-MetroHealthy([int]$TimeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $pollMs = 500
  while ((Get-Date) -lt $deadline) {
    if ((Test-MetroHealthy) -and (Test-MetroLanHealthy)) { return $true }
    if ((Test-MetroHealthy) -and -not $script:LanIp) { return $true }
    Start-Sleep -Milliseconds $pollMs
    if ($pollMs -lt 2000) { $pollMs = [Math]::Min($pollMs * 2, 2000) }
  }
  return (Test-MetroHealthy)
}

function Ensure-MetroRunning {
  param(
    [switch]$ForceRecycle,
    [switch]$ClearCacheOnStart
  )

  if ($ForceRecycle) {
    Write-Host "  Force-recycling Metro on 8081..." -ForegroundColor Yellow
    Stop-AllMetroOnPort 8081 | Out-Null
    Start-MetroInNewWindow -ClearCache:$ClearCacheOnStart
    $timeout = if ($ClearCacheOnStart) { 90 } else { 60 }
    if (Wait-MetroHealthy -TimeoutSec $timeout) {
      Write-Host "  Metro started OK (localhost + LAN)." -ForegroundColor Green
      return $true
    }
    Write-Host "  Metro not responding after recycle - check the Metro window." -ForegroundColor Red
    Write-MetroNotRunningBanner
    return $false
  }

  $healthy = Test-MetroHealthy
  $lanHealthy = Test-MetroLanHealthy
  $portInUse = Test-PortListening 8081

  if ($healthy -and -not $lanHealthy -and $script:LanIp) {
    Write-Host "  Metro OK on localhost but not LAN ($($script:LanIp)) - recycling..." -ForegroundColor Yellow
    Stop-AllMetroOnPort 8081 | Out-Null
    Start-MetroInNewWindow -ClearCache:$false
    if (Wait-MetroHealthy -TimeoutSec 60) {
      Write-Host "  Metro restarted with LAN hostname." -ForegroundColor Green
      return $true
    }
    Write-MetroNotRunningBanner
    return $false
  }

  if ($healthy -and $lanHealthy) {
    Write-Host "  Metro already running (packager-status:running, LAN OK) - reusing." -ForegroundColor Green
    Write-MetroWindowHint -StartedNew $false
    return $true
  }

  if (-not $healthy -and $portInUse) {
    Write-Host "  Metro unhealthy but port 8081 in use - stopping stale listener..." -ForegroundColor Yellow
    Stop-AllMetroOnPort 8081 | Out-Null
  }

  if (Test-PortListening 8081) {
    Write-Host "  Port 8081 still in use - force stopping..." -ForegroundColor Yellow
    Stop-AllMetroOnPort 8081 | Out-Null
  }

  $useClear = $ClearCacheOnStart.IsPresent
  Start-MetroInNewWindow -ClearCache:$useClear
  $timeout = if ($useClear) { 90 } else { 60 }
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
    $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "wait-for-device")
    $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "shell", "input", "keyevent", "KEYCODE_WAKEUP")
    $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--remove", "tcp:8081")

    $rev = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "tcp:8081", "tcp:8081")
    $list = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--list")

    if ($list -notmatch "tcp:8081") {
      Write-Host "  $serial : reverse missing - reconnecting adb..." -ForegroundColor Yellow
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reconnect")
      Start-Sleep -Milliseconds 800
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--remove", "tcp:8081")
      $rev = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "tcp:8081", "tcp:8081")
      $list = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--list")
    }

    if ($list -match "tcp:8081") {
      Write-Host "  $serial : reverse OK ($rev)" -ForegroundColor Green
      $anyOk = $true
    } else {
      Write-Host "  $serial : reverse FAILED - $rev" -ForegroundColor Red
    }
  }
  return $anyOk
}

# Expo Router home tab (src/app/(tabs)/index.tsx). Explicit /--/ path prevents the dev
# client from restoring the last route (e.g. Create/camera) after reconnect scripts.
$script:DevMetroHomePath = "/--/(tabs)/index"

function Escape-DeepLinkUrlParam {
  param([string]$Url)
  # EscapeDataString leaves () unreserved; adb shell treats them as metacharacters.
  $encoded = [System.Uri]::EscapeDataString($Url)
  return $encoded.Replace('(', '%28').Replace(')', '%29')
}

function Start-FlipApp {
  param(
    [string]$Serial,
    [string]$AdbPath,
    [string]$DevServerHost
  )

  $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $Serial, "shell", "am", "force-stop", "social.flip.app")
  Start-Sleep -Milliseconds 400

  if ($DevServerHost) {
    $metroUrl = "exp://${DevServerHost}:8081$($script:DevMetroHomePath)"
    $encodedUrl = Escape-DeepLinkUrlParam $metroUrl
    $deepLink = "flip://expo-development-client/?url=$encodedUrl"
    $start = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @(
      "-s", $Serial, "shell", "am", "start",
      "-a", "android.intent.action.VIEW",
      "-d", $deepLink
    )
    Write-Host "  $Serial : $start"
    Write-Host "  $Serial : deep link $metroUrl (Home tab; bypasses dev launcher picker)" -ForegroundColor DarkGray
  } else {
    $start = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $Serial, "shell", "am", "start", "-n", "social.flip.app/.MainActivity")
    Write-Host "  $Serial : $start"
  }
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
  Write-Host "Then unplug, replug, and run flip-reset-dev.bat or flip-reconnect.bat." -ForegroundColor Yellow
  Write-Host ""
}

function Write-DevStatus {
  param([bool]$ReverseOk)
  $finalMetroHealthy = Test-MetroHealthy
  $finalLanHealthy = Test-MetroLanHealthy
  Write-Host ""
  Write-Host "=== Status ===" -ForegroundColor Cyan
  Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
  Write-Host ("adb reverse 8081: {0}" -f $(if ($ReverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped" } else { "FAILED" }))
  Write-Host ("Metro /status: {0}" -f $(if ($finalMetroHealthy) { "running" } else { "NOT running" }))
  if ($finalMetroHealthy) {
    Write-Host 'Metro window: taskbar -> Command Prompt titled "Flip Metro" (bundler / QR / connection URL)'
  }
  if ($script:LanIp) {
    Write-Host "Launch URL: exp://${script:LanIp}:8081$($script:DevMetroHomePath) (Home tab; bypasses dev launcher picker)"
    Write-Host ("Metro LAN /status: {0}" -f $(if ($finalLanHealthy) { "running" } else { "NOT reachable - run flip-reset-dev.bat" }))
  } else {
    Write-Host "Launch URL: (no LAN IP - connect PC and phone to same Wi-Fi)" -ForegroundColor Yellow
  }
  return $finalMetroHealthy
}

Write-Host "[2/6] adb devices"
$devicesOut = Invoke-AdbString -AdbPath $adb -AdbArgs @("devices")
Write-Host $devicesOut

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

if ($env:CI -eq "true" -or $env:CI -eq "1") {
  Write-Host "  WARN: CI=$env:CI disables Metro watch/reload. Unset CI for local dev." -ForegroundColor Yellow
}

# --- Reset mode: kill Metro, fresh start, launch ---
if ($Reset) {
  if ($serials.Count -gt 0) {
    Write-Host "[3b/6] Stop Flip before Metro reset"
    foreach ($serial in $serials) {
      $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "shell", "am", "force-stop", "social.flip.app")
      Write-Host "  $serial : force-stop OK" -ForegroundColor Green
    }
  }

  Write-Host "[4/6] Metro reset (kill all on 8081, clear cache, fresh start)"
  $metroHealthy = Ensure-MetroRunning -ForceRecycle -ClearCacheOnStart
  if (-not $metroHealthy) {
    Write-Host "ERROR: Metro must be running before launching the app." -ForegroundColor Red
    exit 1
  }

  Write-Host "[5/6] Launch Flip with LAN dev-server URL"
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

  $ok = Write-DevStatus -ReverseOk $reverseOk
  Write-Host ""
  Write-Host "=== When app won't connect ===" -ForegroundColor Cyan
  Write-Host "- Run flip-reset-dev.bat (this script)"
  Write-Host "- Dev launcher cached 127.0.0.1: tap RESET on Recently Opened (scripts bypass picker via deep link)"
  Write-Host "- Same Wi-Fi as PC ($($script:LanIp)); allow Node through Windows Firewall on 8081"
  exit $(if ($ok) { 0 } else { 1 })
}

if ($ConnectOnly -and -not $Reconnect) {
  $metroHealthy = Test-MetroHealthy
  Write-Host "[4/6] Metro - skipped (connect-only)" -ForegroundColor DarkGray
  if (-not $metroHealthy) {
    Write-Host "  WARN: Metro /status is NOT running. Run flip-reset-dev.bat." -ForegroundColor Yellow
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
  Write-Host "Tip: nothing works? flip-reset-dev.bat | after crash: flip-reconnect.bat | JS-only: flip-reload.bat"
  exit $(if ($metroHealthy -or $serials.Count -eq 0) { 0 } else { 1 })
}

if ($Reconnect) {
  Write-Host "[4/6] Metro (reconnect - fix stale listener if needed, no cache clear)"
  $metroHealthy = Ensure-MetroRunning -ClearCacheOnStart:$false
  if (-not $metroHealthy) {
    Write-Host "ERROR: Metro must be running before launching the app." -ForegroundColor Red
    exit 1
  }

  Write-Host "[5/6] Launch Flip with LAN dev-server URL"
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

  $ok = Write-DevStatus -ReverseOk $reverseOk
  Write-Host ""
  Write-Host "Scripts: flip-reset-dev.bat (nuclear) | flip-reload.bat (JS tweak)"
  exit $(if ($ok) { 0 } else { 1 })
}

# --- Full dev-connect (pull + Metro + launch) ---

if ($RestartMetro -and $serials.Count -gt 0) {
  Write-Host "[3b/6] Stop Flip before Metro recycle"
  foreach ($serial in $serials) {
    $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "shell", "am", "force-stop", "social.flip.app")
    Write-Host "  $serial : force-stop OK" -ForegroundColor Green
  }
}

Write-Host "[4/6] Metro on port 8081"
$forceRecycle = $RestartMetro.IsPresent -and (-not (Test-MetroHealthy))
$metroHealthy = Ensure-MetroRunning -ForceRecycle:$forceRecycle -ClearCacheOnStart:$RestartMetro.IsPresent
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

$ok = Write-DevStatus -ReverseOk $reverseOk
Write-Host ""
Write-Host "=== Scripts ===" -ForegroundColor Cyan
Write-Host "- flip-reset-dev.bat: kill Metro + clear cache + adb reverse + launch (when nothing works)"
Write-Host "- flip-dev.bat: first connect / sync branch - pull + adb + reuse Metro"
Write-Host "- flip-reconnect.bat: after crash - adb + fix Metro + launch (fast, no pull)"
Write-Host "- flip-connect.bat: adb + launch only (Metro already healthy)"
Write-Host "- flip-reload.bat: adb + POST /reload (JS tweak, app already running)"
Write-Host "- flip-dev-restart.bat: pull + force Metro recycle if unhealthy (clear cache)"
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host "- App won't connect at all: flip-reset-dev.bat"
Write-Host "- Dev launcher cached 127.0.0.1: tap RESET on Recently Opened (deep link bypasses picker)"
Write-Host "- Beta/preview app [flip-beta.bat] is standalone - it cannot load live JS from your PC"
Write-Host "- LAN: phone on same Wi-Fi as PC ($($script:LanIp)), allow Node through Windows Firewall on 8081"
Write-Host "- USB: data cable, USB debugging on, accept RSA fingerprint on phone"
Write-Host "- Dev client only (not Expo Go); package social.flip.app"

if (-not $ok) {
  Write-MetroNotRunningBanner
  Write-Host "ERROR: Metro /status is NOT running. Run flip-reset-dev.bat." -ForegroundColor Red
  exit 1
}

exit 0
