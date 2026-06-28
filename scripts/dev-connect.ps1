# Flip dev connect: pull, adb reverse, Metro (reuse or start one window), launch app.
# USB (preferred): adb reverse + exp://127.0.0.1:8081 — no Wi-Fi or firewall needed.
# Wi-Fi fallback: exp://LAN_IP:8081 when USB reverse is unavailable.
#
# Modes:
#   (default)        flip-dev.bat           - pull + adb + reuse Metro (or start one window)
#   -RestartMetro    flip-dev-restart.bat   - pull + adb; recycle Metro if unhealthy (clear cache)
#   -Reconnect       flip-reconnect.bat     - pull + adb; fix stale Metro + launch (post-crash)
#   -Reset           flip-reset-dev.bat     - pull current branch, kill Metro, clear cache, launch
#   -ConnectOnly     flip-connect.bat       - adb + launch only (Metro must already be healthy)
#   -ConnectOnly -Reload  flip-reload.bat   - adb + POST /reload (no pull — JS already on disk)
#   -NoLaunch        flip-sync.bat          - adb reverse + wait for Metro; no pull, no launch
param(
  [switch]$RestartMetro,
  [switch]$ConnectOnly,
  [switch]$Reload,
  [switch]$Reconnect,
  [switch]$Reset,
  [switch]$NoLaunch,
  [switch]$WaitForDevice
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$DeviceFile = Join-Path $Root ".flip-adb-device"
$savedDevice = ""
if (Test-Path $DeviceFile) {
  $savedDevice = (Get-Content $DeviceFile -Raw -ErrorAction SilentlyContinue).Trim()
}

$PreferredDevice = if ($env:FLIP_ADB_DEVICE) {
  $env:FLIP_ADB_DEVICE.Trim()
} elseif ($savedDevice) {
  $savedDevice
} else {
  ""
}

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
  "reset (pull + kill Metro, fresh start)"
} elseif ($Reconnect) {
  "reconnect (pull + post-crash)"
} elseif ($NoLaunch) {
  "sync (adb reverse + Metro, no launch)"
} elseif ($ConnectOnly) {
  if ($Reload) { "connect-only (reload)" } else { "connect-only" }
} elseif ($RestartMetro) {
  "full (restart Metro if needed)"
} else {
  "full (reuse Metro)"
}
Write-Host "== Flip dev-connect ($modeLabel) ==" -ForegroundColor Cyan

# Pull latest on current branch unless fast connect/reload/sync only.
# Reset + Reconnect pull — stale local tree was launching old JS despite GitHub updates.
$skipPull = $ConnectOnly -or $NoLaunch
if (-not $skipPull) {
  $branch = (git branch --show-current).Trim()
  Write-Host ('[1/6] git fetch origin {0}...' -f $branch)
  $ErrorActionPreference = 'Continue'
  $null = cmd /c "git fetch origin $branch 2>&1"
  Write-Host ('[1/6] git pull origin {0}...' -f $branch)
  $pull = (cmd /c "git pull origin $branch 2>&1")
  $ErrorActionPreference = 'Stop'
  Write-Host $pull
} else {
  Write-Host ('[1/6] git pull - skipped ({0})' -f $modeLabel) -ForegroundColor DarkGray
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

function Set-MetroPackagerHostname {
  param([bool]$PreferUsbReverse)

  if ($PreferUsbReverse) {
    $env:FLIP_DEV_HOSTNAME = '127.0.0.1'
    Write-Host '  Metro will advertise 127.0.0.1 (USB adb reverse — no Wi-Fi required).' -ForegroundColor Cyan
    return
  }

  Remove-Item Env:FLIP_DEV_HOSTNAME -ErrorAction SilentlyContinue
  if ($script:LanIp) {
    Write-Host "  Metro will advertise LAN $($script:LanIp) (Wi-Fi path)." -ForegroundColor DarkGray
  }
}

function Get-DevServerHost {
  param([bool]$ReverseOk)

  if ($ReverseOk) {
    return '127.0.0.1'
  }
  if ($script:LanIp) {
    return $script:LanIp
  }
  return $null
}

function Start-MetroInNewWindow {
  param(
    [switch]$ClearCache,
    [bool]$PreferUsbReverse = $false
  )

  Set-MetroPackagerHostname -PreferUsbReverse:$PreferUsbReverse

  if ($ClearCache) {
    Write-Host "  Starting Metro (dev-client, port 8081, clear cache) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window.cmd"
  } else {
    Write-Host "  Starting Metro (dev-client, port 8081) in new window..."
    $launcher = Join-Path $PSScriptRoot "start-metro-window-fast.cmd"
  }
  # cmd /k keeps a visible console; title matches taskbar search ("Flip Metro").
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "title Flip Metro & call `"$launcher`"" `
    -WorkingDirectory $Root `
    -WindowStyle Normal
  Write-MetroWindowHint -StartedNew $true
}

function Wait-MetroHealthy([int]$TimeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $pollMs = 500
  $lastLog = [DateTime]::MinValue
  while ((Get-Date) -lt $deadline) {
    $localhostOk = Test-MetroHealthy
    $lanOk = Test-MetroLanHealthy
    if ($localhostOk -and ($lanOk -or -not $script:LanIp)) { return $true }
    if (((Get-Date) - $lastLog).TotalSeconds -ge 5) {
      $remaining = [Math]::Max(0, [int]($deadline - (Get-Date)).TotalSeconds)
      $status = "localhost=$localhostOk"
      if ($script:LanIp) { $status += ", LAN $($script:LanIp)=$lanOk" }
      Write-Host "  Waiting for Metro /status ($status, ${remaining}s left)..." -ForegroundColor DarkGray
      $lastLog = Get-Date
    }
    Start-Sleep -Milliseconds $pollMs
    if ($pollMs -lt 2000) { $pollMs = [Math]::Min($pollMs * 2, 2000) }
  }
  return ((Test-MetroHealthy) -and ((Test-MetroLanHealthy) -or -not $script:LanIp))
}

function Ensure-MetroRunning {
  param(
    [switch]$ForceRecycle,
    [switch]$ClearCacheOnStart,
    [bool]$PreferUsbReverse = $false
  )

  if ($ForceRecycle) {
    Write-Host "  Force-recycling Metro on 8081..." -ForegroundColor Yellow
    Stop-AllMetroOnPort 8081 | Out-Null
    Start-MetroInNewWindow -ClearCache:$ClearCacheOnStart -PreferUsbReverse:$PreferUsbReverse
    $timeout = if ($ClearCacheOnStart) { 120 } else { 90 }
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
    Start-MetroInNewWindow -ClearCache:$false -PreferUsbReverse:$PreferUsbReverse
    if (Wait-MetroHealthy -TimeoutSec 90) {
      Write-Host "  Metro restarted with reachable hostname." -ForegroundColor Green
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
  Start-MetroInNewWindow -ClearCache:$useClear -PreferUsbReverse:$PreferUsbReverse
  $timeout = if ($useClear) { 120 } else { 90 }
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

  if ($AllSerials.Count -eq 1) {
    $only = $AllSerials[0]
    if ($PreferredDevice -and $PreferredDevice -ne $only) {
      Write-Host "  Using connected device $only (preferred $PreferredDevice not plugged in)" -ForegroundColor Yellow
    }
    return @($only)
  }

  if ($PreferredDevice -and ($AllSerials -contains $PreferredDevice)) {
    Write-Host "  Using preferred device $PreferredDevice (set FLIP_ADB_DEVICE to override)" -ForegroundColor DarkGray
    return @($PreferredDevice)
  }

  if ($PreferredDevice) {
    Write-Host "  Preferred device $PreferredDevice not found; using $($AllSerials -join ', ')" -ForegroundColor Yellow
  } else {
    Write-Host ('  Multiple devices - using all: {0}. Set FLIP_ADB_DEVICE to one serial.' -f ($AllSerials -join ', ')) -ForegroundColor Yellow
  }
  return $AllSerials
}

function Save-ConnectedDevice([string[]]$TargetSerials) {
  if ($TargetSerials.Count -ne 1) { return }
  try {
    Set-Content -Path $DeviceFile -Value $TargetSerials[0] -NoNewline
    Write-Host "  Saved device $($TargetSerials[0]) to .flip-adb-device" -ForegroundColor DarkGray
  } catch {
    # non-fatal
  }
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
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("kill-server")
      Start-Sleep -Milliseconds 600
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("start-server")
      Start-Sleep -Milliseconds 400
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
      Write-Host "  $serial : unplug USB, replug data cable, tap Allow on phone, re-run flip-reconnect.bat" -ForegroundColor Yellow
    }
  }
  return $anyOk
}

function Escape-DeepLinkUrlParam {
  param([string]$Url)
  return [System.Uri]::EscapeDataString($Url)
}

function Start-FlipApp {
  param(
    [string]$Serial,
    [string]$AdbPath,
    [string]$DevServerHost
  )

  if (-not (Wait-MetroHealthy -TimeoutSec 120)) {
    Write-Host "  $Serial : Metro not healthy - refusing to launch (avoids DevLauncher manifest loop)" -ForegroundColor Red
    return $false
  }

  $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $Serial, "shell", "am", "force-stop", "social.flip.app")
  Start-Sleep -Milliseconds 400

  if ($DevServerHost) {
    # Base exp:// URL only — route paths break DevLauncherManifestParser.downloadManifest.
    # Home tab is set via Tabs initialRouteName="index" in src/app/(tabs)/_layout.tsx.
    $metroUrl = "exp://${DevServerHost}:8081"
    $encodedUrl = Escape-DeepLinkUrlParam $metroUrl
    $deepLink = "flip://expo-development-client/?url=$encodedUrl"
    $start = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @(
      "-s", $Serial, "shell", "am", "start",
      "-a", "android.intent.action.VIEW",
      "-d", $deepLink
    )
    Write-Host "  $Serial : $start"
    Write-Host "  $Serial : deep link $metroUrl (bypasses dev launcher picker)" -ForegroundColor DarkGray
  } else {
    $start = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $Serial, "shell", "am", "start", "-n", "social.flip.app/.MainActivity")
    Write-Host "  $Serial : $start"
  }
  return $true
}

function Write-NoDevServerHelp {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  NO DEV SERVER PATH - phone cannot reach Metro" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Best fix (USB data cable):" -ForegroundColor Yellow
  Write-Host "  1. Plug phone in USB, enable USB debugging, tap Allow"
  Write-Host "  2. Run flip-reconnect.bat or flip-reset-dev.bat"
  Write-Host "  Scripts use adb reverse + exp://127.0.0.1:8081 (no Wi-Fi needed)."
  Write-Host ""
  Write-Host "Wi-Fi fallback: PC + phone on same network; allow Node through Windows Firewall on 8081." -ForegroundColor Yellow
  Write-Host ""
}

function Launch-FlipOnDevices {
  param(
    [string[]]$TargetSerials,
    [string]$AdbPath,
    [bool]$ReverseOk
  )

  if ($TargetSerials.Count -eq 0) {
    return $true
  }

  $devHost = Get-DevServerHost -ReverseOk $ReverseOk
  if (-not $devHost) {
    Write-NoDevServerHelp
    return $false
  }

  if ($devHost -eq '127.0.0.1') {
    Write-Host "  Launch via USB tunnel: exp://127.0.0.1:8081 (adb reverse)" -ForegroundColor Cyan
  } else {
    Write-Host "  Launch via Wi-Fi: exp://${devHost}:8081" -ForegroundColor Cyan
  }

  foreach ($serial in $TargetSerials) {
    Start-FlipApp -Serial $serial -AdbPath $AdbPath -DevServerHost $devHost | Out-Null
  }
  return $true
}

function Get-AdbDeviceSerials {
  param([string]$AdbPath)
  $devicesOut = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("devices")
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
  return @{
    Output = $devicesOut
    Serials = $serials
    Unauthorized = $unauthorized
    Offline = $offline
  }
}

function Wait-ForUsbDevice {
  param(
    [string]$AdbPath,
    [int]$TimeoutSec = 45
  )
  Write-Host ""
  Write-Host ('Waiting up to {0}s for phone on USB - plug in + tap Allow on phone...' -f $TimeoutSec) -ForegroundColor Yellow
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $scan = Get-AdbDeviceSerials -AdbPath $AdbPath
    if ($scan.Unauthorized.Count -gt 0) {
      Write-Host "  Phone detected but UNAUTHORIZED - tap Allow USB debugging on phone." -ForegroundColor Red
    } elseif ($scan.Serials.Count -gt 0) {
      Write-Host "  Device found: $($scan.Serials -join ', ')" -ForegroundColor Green
      return $scan
    } else {
      Write-Host "  (no device yet...)" -ForegroundColor DarkGray
    }
    Start-Sleep -Seconds 2
  }
  return Get-AdbDeviceSerials -AdbPath $AdbPath
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
  Write-Host "Then unplug, replug, and run flip-usb-connect.bat or flip-reconnect.bat." -ForegroundColor Yellow
  Write-Host "Wi-Fi only: keep Flip open on same network as PC; auto-sync can still POST Metro /reload." -ForegroundColor DarkGray
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
    Write-Host "Launch URL: exp://${script:LanIp}:8081 (Wi-Fi) or exp://127.0.0.1:8081 (USB reverse)"
    Write-Host ("Metro LAN /status: {0}" -f $(if ($finalLanHealthy) { "running" } else { "NOT reachable - run flip-reset-dev.bat" }))
  } else {
    Write-Host "Launch URL: (no LAN IP - connect PC and phone to same Wi-Fi)" -ForegroundColor Yellow
  }
  return $finalMetroHealthy
}

Write-Host '[2/6] adb devices'
$deviceScan = Get-AdbDeviceSerials -AdbPath $adb
Write-Host $deviceScan.Output

$unauthorized = @($deviceScan.Unauthorized)
$offline = @($deviceScan.Offline)
$serials = Select-TargetSerials @($deviceScan.Serials)

$shouldWaitForDevice = $WaitForDevice.IsPresent -and -not $ConnectOnly -and -not $NoLaunch -and $serials.Count -eq 0
if ($shouldWaitForDevice) {
  $deviceScan = Wait-ForUsbDevice -AdbPath $adb -TimeoutSec 45
  Write-Host $deviceScan.Output
  $unauthorized = @($deviceScan.Unauthorized)
  $offline = @($deviceScan.Offline)
  $serials = Select-TargetSerials @($deviceScan.Serials)
}

$reverseOk = $false
if ($unauthorized.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows unauthorized ($($unauthorized -join ', '))"
} elseif ($offline.Count -gt 0) {
  Write-UsbDeviceHelp "adb shows offline ($($offline -join ', '))"
} elseif ($serials.Count -eq 0) {
  Write-UsbDeviceHelp "no device listed"
} else {
  Write-Host '[3/6] adb reverse tcp:8081 tcp:8081'
  $reverseOk = Ensure-AdbReverse -TargetSerials $serials -AdbPath $adb
  Save-ConnectedDevice -TargetSerials $serials
}

if ($env:CI -eq "true" -or $env:CI -eq "1") {
  Write-Host "  WARN: CI=$env:CI disables Metro watch/reload. Unset CI for local dev." -ForegroundColor Yellow
}

# --- Reset mode: kill Metro, fresh start, launch ---
if ($Reset) {
  if ($serials.Count -gt 0) {
    Write-Host '[3b/6] Stop Flip before Metro reset'
    foreach ($serial in $serials) {
      $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "shell", "am", "force-stop", "social.flip.app")
      Write-Host "  $serial : force-stop OK" -ForegroundColor Green
    }
  }

  Write-Host '[4/6] Metro reset (kill all on 8081, clear cache, fresh start)'
  $metroHealthy = Ensure-MetroRunning -ForceRecycle -ClearCacheOnStart -PreferUsbReverse:$reverseOk
  if (-not $metroHealthy) {
    Write-Host "ERROR: Metro must be running before launching the app." -ForegroundColor Red
    exit 1
  }

  Write-Host '[5/6] Launch Flip on device'
  if ($serials.Count -gt 0) {
    if (-not (Launch-FlipOnDevices -TargetSerials $serials -AdbPath $adb -ReverseOk $reverseOk)) {
      exit 1
    }
  } else {
    Write-Host "  Skipped (no device)." -ForegroundColor Yellow
  }

  $ok = Write-DevStatus -ReverseOk $reverseOk
  Write-Host ""
  Write-Host '=== When app will not connect ===' -ForegroundColor Cyan
  Write-Host "- Run flip-reset-dev.bat (this script)"
  Write-Host "- USB data cable + flip-reconnect.bat (exp://127.0.0.1:8081 via adb reverse)"
  Write-Host "- Do NOT reopen Flip manually — use a script so the deep link bypasses stale dev launcher URLs"
  Write-Host "- Wi-Fi fallback: same network as PC; allow Node through Windows Firewall on 8081"
  exit $(if ($ok) { 0 } else { 1 })
}

if ($NoLaunch) {
  Write-Host '[4/6] Metro (sync - wait for /status, no launch)'
  $metroHealthy = Wait-MetroHealthy -TimeoutSec 120
  if (-not $metroHealthy) {
    Write-Host "  Metro /status not ready after 120s. Run flip-dev.bat or flip-reset-dev.bat." -ForegroundColor Red
    Write-MetroNotRunningBanner
  } else {
    Write-Host "  Metro /status: running (localhost + LAN)" -ForegroundColor Green
  }

  Write-Host '[5/6] Launch - skipped (NoLaunch; open Flip manually when ready)' -ForegroundColor DarkGray

  Write-Host ""
  Write-Host "=== Status (sync) ===" -ForegroundColor Cyan
  Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
  Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped" } else { "FAILED" }))
  Write-Host ("Metro /status: {0}" -f $(if ($metroHealthy) { "running" } else { "NOT running" }))
  if ($metroHealthy -and $reverseOk) {
    Write-Host ""
    Write-Host "Metro ready, reverse OK - open Flip manually when ready" -ForegroundColor Green
  }
  Write-Host ""
  Write-Host "Tip: launch app: flip-connect.bat | JS reload: flip-reload.bat | full reset: flip-reset-dev.bat"
  exit $(if ($metroHealthy -or $serials.Count -eq 0) { 0 } else { 1 })
}

if ($ConnectOnly -and -not $Reconnect) {
  Write-Host '[4/6] Metro (connect-only - wait for /status before launch)'
  $metroHealthy = Wait-MetroHealthy -TimeoutSec 120
  if (-not $metroHealthy) {
    Write-Host "  Metro /status not ready after 120s. Run flip-reset-dev.bat." -ForegroundColor Red
    Write-MetroNotRunningBanner
  } else {
    Write-Host "  Metro /status: running (localhost + LAN)" -ForegroundColor Green
  }

  if ($Reload -and $metroHealthy) {
    if ($serials.Count -gt 0) {
      Write-Host '[5/6] Reload JS via Metro (USB + adb reverse)'
    } else {
      Write-Host '[5/6] Reload JS via Metro only (no USB - phone must be on same Wi-Fi with Flip open)' -ForegroundColor Yellow
    }
    $reloaded = Invoke-MetroReload
    if (-not $reloaded) {
      exit 1
    }
  } elseif ($serials.Count -gt 0) {
    Write-Host '[5/6] Launch Flip on device'
    if (-not (Launch-FlipOnDevices -TargetSerials $serials -AdbPath $adb -ReverseOk $reverseOk)) {
      exit 1
    }
  } else {
    Write-Host '[5/6] Launch/reload - skipped (no device)' -ForegroundColor Yellow
    if (-not $Reload) {
      Write-Host '  Plug USB + run flip-usb-connect.bat - or open Flip on Wi-Fi for Metro-only reload.' -ForegroundColor DarkGray
    }
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
  Write-Host '[4/6] Metro (reconnect - recycle when USB reverse so hostname matches 127.0.0.1)'
  $metroHealthy = Ensure-MetroRunning -ForceRecycle:$reverseOk -ClearCacheOnStart:$false -PreferUsbReverse:$reverseOk
  if (-not $metroHealthy) {
    Write-Host "ERROR: Metro must be running before launching the app." -ForegroundColor Red
    exit 1
  }

  Write-Host '[5/6] Launch Flip on device'
  if ($serials.Count -gt 0) {
    if (-not (Launch-FlipOnDevices -TargetSerials $serials -AdbPath $adb -ReverseOk $reverseOk)) {
      exit 1
    }
  } else {
    Write-Host "  Skipped (no device)." -ForegroundColor Yellow
  }

  $ok = Write-DevStatus -ReverseOk $reverseOk
  Write-Host ""
  Write-Host "Scripts: flip-reset-dev.bat (nuclear) | flip-reload.bat (JS tweak)"
  Write-Host "Tip: do not tap Flip icon after crash — reopening uses a stale dev-server URL."
  exit $(if ($ok) { 0 } else { 1 })
}

# --- Full dev-connect (pull + Metro + launch) ---

if ($RestartMetro -and $serials.Count -gt 0) {
  Write-Host '[3b/6] Stop Flip before Metro recycle'
  foreach ($serial in $serials) {
    $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "shell", "am", "force-stop", "social.flip.app")
    Write-Host "  $serial : force-stop OK" -ForegroundColor Green
  }
}

Write-Host '[4/6] Metro on port 8081'
$forceRecycle = $RestartMetro.IsPresent -and (-not (Test-MetroHealthy))
$metroHealthy = Ensure-MetroRunning -ForceRecycle:$forceRecycle -ClearCacheOnStart:$RestartMetro.IsPresent -PreferUsbReverse:$reverseOk
if (-not $metroHealthy) {
  Write-Host "ERROR: Metro must be running before launching the app. Not starting Flip on device." -ForegroundColor Red
  exit 1
}

Write-Host '[5/6] Launch Flip on device'
if ($serials.Count -gt 0) {
  if (-not (Launch-FlipOnDevices -TargetSerials $serials -AdbPath $adb -ReverseOk $reverseOk)) {
    exit 1
  }
} else {
  Write-Host "  Skipped (no device)." -ForegroundColor Yellow
}

$ok = Write-DevStatus -ReverseOk $reverseOk
Write-Host ""
Write-Host "=== Scripts ===" -ForegroundColor Cyan
Write-Host "- flip-reset-dev.bat: pull + kill Metro + clear cache + adb reverse + launch"
Write-Host "- flip-dev.bat: first connect / sync branch - pull + adb + reuse Metro"
Write-Host "- flip-reconnect.bat: pull + adb + fix Metro + launch (after crash)"
Write-Host "- flip-connect.bat: adb + launch only (Metro already healthy)"
Write-Host "- flip-reload.bat: adb + POST /reload (JS tweak, app already running)"
Write-Host "- flip-sync.bat: adb reverse + wait for Metro (no launch; phone stays on current app)"
Write-Host "- flip-dev-restart.bat: pull + force Metro recycle if unhealthy (clear cache)"
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host '- App will not connect at all: flip-reset-dev.bat or flip-reconnect.bat (USB cable plugged in)'
Write-Host "- Do NOT reopen Flip from the app icon after a failed load — that reuses a stale dev-server URL"
Write-Host "- USB: data cable + adb reverse -> exp://127.0.0.1:8081 (preferred; no Wi-Fi required)"
Write-Host "- Wi-Fi: same network as PC ($($script:LanIp)); allow Node through Windows Firewall on 8081"
Write-Host "- Dev client only (not Expo Go); package social.flip.app"

if (-not $ok) {
  Write-MetroNotRunningBanner
  Write-Host "ERROR: Metro /status is NOT running. Run flip-reset-dev.bat." -ForegroundColor Red
  exit 1
}

exit 0
