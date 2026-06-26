# Flip Android USB + Metro setup (Expo dev-client).
# Restarts adb, sets reverse for Metro + multiverse API, ensures Metro, runs android:dev.
#
# Usage:
#   .\scripts\rn-android-usb-metro-setup.ps1
#   $env:METRO_PORT = 8082; .\scripts\rn-android-usb-metro-setup.ps1
#   .\scripts\rn-android-usb-metro-setup.ps1 -MetroPort 8082
#   .\scripts\rn-android-usb-metro-setup.ps1 -SkipBuild   # adb + Metro only
#
# Flip daily dev normally uses port 8081 (flip-dev.bat / dev-connect). Use 8082 only when
# you need a second Metro instance (e.g. two branches side by side).

param(
  [int]$MetroPort = $(if ($env:METRO_PORT) { [int]$env:METRO_PORT } else { 8081 }),
  [switch]$SkipBuild,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$MultiversePort = 8788
$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "" }

Write-Host "== Flip rn-android-usb-metro-setup (Metro port $MetroPort) ==" -ForegroundColor Cyan

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

function Test-PortListening([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $conn
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

function Test-MetroHealthy([int]$Port) {
  return (Test-MetroStatusUrl "http://127.0.0.1:${Port}")
}

function Get-LanIp {
  $getLanScript = Join-Path $PSScriptRoot "get-lan-ip.ps1"
  if (Test-Path $getLanScript) {
    return (& $getLanScript -Quiet 2>$null | Select-Object -First 1)
  }
  return $null
}

function Write-UsbDeviceChecklist {
  param([string]$Reason)
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host "  PHONE NOT READY FOR USB DEV - $Reason" -ForegroundColor Red
  Write-Host "============================================================" -ForegroundColor Red
  Write-Host ""
  Write-Host "Checklist:" -ForegroundColor Yellow
  Write-Host "  1. Use a data USB cable (not charge-only)"
  Write-Host "  2. Settings -> Developer options -> USB debugging ON"
  Write-Host "  3. When plugged in, tap Allow on the USB debugging RSA prompt"
  Write-Host "  4. USB mode: File transfer / MTP (not Charging only)"
  Write-Host "  5. Run: adb devices   (should show <serial>    device)"
  Write-Host "  6. Re-run: .\scripts\rn-android-usb-metro-setup.ps1"
  Write-Host ""
}

function Select-TargetSerials([string[]]$AllSerials) {
  if ($AllSerials.Count -eq 0) { return @() }
  if ($PreferredDevice -and ($AllSerials -contains $PreferredDevice)) {
    if ($AllSerials.Count -gt 1) {
      Write-Host "  Using FLIP_ADB_DEVICE=$PreferredDevice" -ForegroundColor DarkGray
    }
    return @($PreferredDevice)
  }
  if (-not $PreferredDevice -and $AllSerials.Count -eq 1) {
    Write-Host "  Auto-selected device $($AllSerials[0]) (set FLIP_ADB_DEVICE to pin)" -ForegroundColor DarkGray
    return $AllSerials
  }
  if ($AllSerials.Count -gt 1) {
    Write-Host "  Multiple devices: $($AllSerials -join ', ') - set FLIP_ADB_DEVICE to pick one" -ForegroundColor Yellow
  }
  return $AllSerials
}

function Set-AdbReverse {
  param(
    [string]$AdbPath,
    [string[]]$TargetSerials,
    [int]$LocalPort,
    [int]$RemotePort = $LocalPort
  )
  $anyOk = $false
  $tag = "tcp:${LocalPort}"
  foreach ($serial in $TargetSerials) {
    $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--remove", $tag)
    $rev = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", $tag, "tcp:${RemotePort}")
    $list = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--list")
    if ($list -notmatch [regex]::Escape($tag)) {
      Write-Host "  $serial : $tag reverse missing - reconnecting adb..." -ForegroundColor Yellow
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reconnect")
      Start-Sleep -Milliseconds 800
      $null = Invoke-AdbQuiet -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--remove", $tag)
      $rev = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", $tag, "tcp:${RemotePort}")
      $list = Invoke-AdbString -AdbPath $AdbPath -AdbArgs @("-s", $serial, "reverse", "--list")
    }
    if ($list -match [regex]::Escape($tag)) {
      Write-Host "  $serial : reverse $tag OK ($rev)" -ForegroundColor Green
      $anyOk = $true
    } else {
      Write-Host "  $serial : reverse $tag FAILED - $rev" -ForegroundColor Red
    }
  }
  return $anyOk
}

function Start-MetroInBackground([int]$Port) {
  $lanIp = Get-LanIp
  $title = if ($Port -eq 8081) { "Flip Metro" } else { "Flip Metro $Port" }

  $lines = @(
    '@echo off',
    "title $title",
    "cd /d `"$Root`"",
    'set CI=',
    'set EXPO_NO_TELEMETRY=1',
    'set EXPO_PUBLIC_USE_RN_FETCH=1'
  )
  if ($lanIp) {
    $lines += "set REACT_NATIVE_PACKAGER_HOSTNAME=$lanIp"
    $lines += "echo Metro hostname: $lanIp (LAN)"
  } else {
    $lines += 'echo WARN: No LAN IP - connect PC to Wi-Fi for phone reachability.'
  }
  $lines += "call npx.cmd expo start --dev-client --lan --port $Port --clear"
  $lines += 'if errorlevel 1 pause'

  $tempBat = Join-Path $env:TEMP "flip-metro-$Port-$([Guid]::NewGuid().ToString('N').Substring(0,8)).cmd"
  Set-Content -Path $tempBat -Value ($lines -join "`r`n") -Encoding ASCII

  Write-Host "  Starting Metro on port $Port with --clear in background window..." -ForegroundColor Cyan
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k", "call `"$tempBat`"" `
    -WorkingDirectory $Root `
    -WindowStyle Normal
}

function Wait-MetroHealthy([int]$Port, [int]$TimeoutSec = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-MetroHealthy $Port) { return $true }
    Start-Sleep -Milliseconds 750
  }
  return (Test-MetroHealthy $Port)
}

function Ensure-Metro([int]$Port) {
  if (Test-MetroHealthy $Port) {
    Write-Host "  Metro already healthy on port $Port (packager-status:running) - reusing." -ForegroundColor Green
    return $true
  }

  if (Test-PortListening $Port) {
    Write-Host "  Port $Port in use but Metro /status unhealthy - leaving listener alone; starting new window anyway." -ForegroundColor Yellow
  }

  Start-MetroInBackground -Port $Port
  if (Wait-MetroHealthy -Port $Port -TimeoutSec 120) {
    Write-Host "  Metro started OK on port $Port." -ForegroundColor Green
    return $true
  }

  Write-Host "  Metro not responding on http://127.0.0.1:${Port}/status - check the Metro window." -ForegroundColor Red
  return $false
}

# --- [1] Restart adb ---
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Host "ERROR: adb not found at $adb" -ForegroundColor Red
  Write-Host "Install Android SDK platform-tools or set ANDROID_HOME." -ForegroundColor Yellow
  exit 2
}

Write-Host "[1/6] Restarting adb..."
$null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("kill-server")
Start-Sleep -Milliseconds 400
$null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("start-server")

# --- [2] Check devices ---
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

$reverseMetroOk = $false
$reverseMultiverseOk = $false

if ($unauthorized.Count -gt 0) {
  Write-UsbDeviceChecklist "adb shows unauthorized ($($unauthorized -join ', '))"
  exit 1
} elseif ($offline.Count -gt 0) {
  Write-UsbDeviceChecklist "adb shows offline ($($offline -join ', '))"
  exit 1
} elseif ($serials.Count -eq 0) {
  Write-UsbDeviceChecklist "no device listed"
  exit 1
}

# --- [3] adb reverse ---
Write-Host "[3/6] adb reverse tcp:${MetroPort} + tcp:${MultiversePort}"
foreach ($serial in $serials) {
  $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "wait-for-device")
  $null = Invoke-AdbQuiet -AdbPath $adb -AdbArgs @("-s", $serial, "shell", "input", "keyevent", "KEYCODE_WAKEUP")
}
$reverseMetroOk = Set-AdbReverse -AdbPath $adb -TargetSerials $serials -LocalPort $MetroPort
$reverseMultiverseOk = Set-AdbReverse -AdbPath $adb -TargetSerials $serials -LocalPort $MultiversePort

# --- [4] npm install ---
if (-not $SkipInstall) {
  Write-Host "[4/6] npm install (if needed)"
  if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    Write-Host "  node_modules missing - running npm install..."
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    Write-Host "  node_modules present - skipping npm install" -ForegroundColor DarkGray
  }
} else {
  Write-Host "[4/6] npm install - skipped" -ForegroundColor DarkGray
}

# --- [5] Metro ---
Write-Host "[5/6] Metro on port $MetroPort"
$metroOk = Ensure-Metro -Port $MetroPort

# --- [6] Android build ---
$buildOk = $false
if (-not $SkipBuild) {
  Write-Host "[6/6] npm run android:dev (Gradle assembleDebug + adb install)"
  & npm.cmd run android:dev
  $buildOk = ($LASTEXITCODE -eq 0)
} else {
  Write-Host "[6/6] android:dev - skipped" -ForegroundColor DarkGray
  $buildOk = $true
}

# --- Summary ---
Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host ("Device(s): {0}" -f ($serials -join ", "))
Write-Host ("adb reverse tcp:${MetroPort}: {0}" -f $(if ($reverseMetroOk) { "OK" } else { "FAILED" }))
Write-Host ("adb reverse tcp:${MultiversePort}: {0}" -f $(if ($reverseMultiverseOk) { "OK" } else { "FAILED" }))
Write-Host ("Metro /status (port ${MetroPort}): {0}" -f $(if ($metroOk) { "running" } else { "NOT running" }))
if (-not $SkipBuild) {
  Write-Host ("android:dev build: {0}" -f $(if ($buildOk) { "OK" } else { "FAILED" }))
}
$lan = Get-LanIp
if ($lan) {
  Write-Host "Dev URL: exp://${lan}:${MetroPort}"
}
Write-Host ""
Write-Host "Tip: Flip daily dev uses port 8081 (flip-dev.bat). Use METRO_PORT=8082 only for a second Metro." -ForegroundColor DarkGray

if (-not $metroOk) { exit 3 }
if (-not $SkipBuild -and -not $buildOk) { exit 4 }
exit 0
