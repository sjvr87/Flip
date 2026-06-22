# Verify Flip Android dev prerequisites on Windows (Samsung S26 Ultra reference).
# Checks: Node, adb, ANDROID_HOME, connected device, Metro on 8081.
# Prints pass/fail and suggested next commands.

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "R3GL10HN64A" }

$script:passCount = 0
$script:failCount = 0
$nextSteps = [System.Collections.Generic.List[string]]::new()

function Write-Check {
    param(
        [string]$Label,
        [bool]$Ok,
        [string]$Detail = "",
        [string]$Fix = ""
    )
    if ($Ok) {
        $script:passCount++
        $suffix = if ($Detail) { " - $Detail" } else { "" }
        Write-Host "  PASS  $Label$suffix" -ForegroundColor Green
    } else {
        $script:failCount++
        $suffix = if ($Detail) { " - $Detail" } else { "" }
        Write-Host "  FAIL  $Label$suffix" -ForegroundColor Red
        if ($Fix) { $nextSteps.Add($Fix) | Out-Null }
    }
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

Write-Host "== Flip Android dev environment check ==" -ForegroundColor Cyan
Write-Host "Project: $Root"
Write-Host "Preferred device: $PreferredDevice (override with FLIP_ADB_DEVICE)"
Write-Host ""

# Node
$nodeOk = $false
$nodeDetail = ""
try {
    $nodeVer = (& node --version 2>&1 | Out-String).Trim()
    if ($nodeVer -match "^v\d+") {
        $nodeOk = $true
        $nodeDetail = $nodeVer
    } else {
        $nodeDetail = "node not on PATH"
    }
} catch {
    $nodeDetail = "node not found"
}
Write-Check -Label "Node.js" -Ok $nodeOk -Detail $nodeDetail `
    -Fix "Install Node 20+ and add to PATH: https://nodejs.org/"

# ANDROID_HOME
$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $defaultSdk) { $androidHome = $defaultSdk }
}
$androidHomeOk = $false
$androidHomeDetail = ""
if ($androidHome -and (Test-Path $androidHome)) {
    $androidHomeOk = $true
    $androidHomeDetail = $androidHome
} elseif ($androidHome) {
    $androidHomeDetail = "path missing: $androidHome"
} else {
    $androidHomeDetail = "ANDROID_HOME not set"
}
Write-Check -Label "ANDROID_HOME" -Ok $androidHomeOk -Detail $androidHomeDetail `
    -Fix "Set ANDROID_HOME to %LOCALAPPDATA%\Android\Sdk (see docs/DEV_BUILD_ANDROID.md Part 3)"

# adb
$adb = $null
if ($androidHomeOk) {
    $adb = Join-Path $androidHome "platform-tools\adb.exe"
}
if (-not $adb -or -not (Test-Path $adb)) {
    $adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
}
$adbOk = Test-Path $adb
$adbDetail = if ($adbOk) { (& $adb version 2>&1 | Select-Object -First 1 | Out-String).Trim() } else { "adb.exe not found" }
Write-Check -Label "adb" -Ok $adbOk -Detail $adbDetail `
    -Fix "Install Android SDK Platform-Tools via Android Studio SDK Manager"

# Device
$deviceOk = $false
$deviceDetail = "not checked (adb missing)"
if ($adbOk) {
    $devicesOut = (& $adb devices 2>&1 | Out-String).Trim()
    $deviceLines = @($devicesOut -split "`n" | Where-Object { $_ -match "^\S+\s+device\s*$" })
    $connectedSerials = @($deviceLines | ForEach-Object { ($_ -split "\s+")[0] })

    if ($connectedSerials.Count -eq 0) {
        $deviceDetail = "no device in 'device' state (run: adb devices)"
    } elseif ($connectedSerials -contains $PreferredDevice) {
        $deviceOk = $true
        $deviceDetail = "$PreferredDevice (device)"
    } elseif ($connectedSerials.Count -eq 1) {
        $deviceOk = $true
        $deviceDetail = "$($connectedSerials[0]) (device)"
    } else {
        $deviceDetail = "multiple devices: $($connectedSerials -join ', ') - set FLIP_ADB_DEVICE=$PreferredDevice"
    }
}
Write-Check -Label "Android device" -Ok $deviceOk -Detail $deviceDetail `
    -Fix "Plug S26 Ultra via USB, enable USB debugging, accept RSA prompt, USB mode = File transfer"

# Metro 8081
$metroOk = Test-MetroStatusUrl "http://127.0.0.1:8081"
$metroDetail = if ($metroOk) { "http://127.0.0.1:8081/status = running" } else { "port 8081 not healthy" }
Write-Check -Label "Metro (8081)" -Ok $metroOk -Detail $metroDetail `
    -Fix "Run flip-dev.bat or flip-reset-dev.bat to start Metro (one Flip Metro window)"

# LAN IP (informational - not a hard fail)
$lanScript = Join-Path $PSScriptRoot "get-lan-ip.ps1"
$lanIp = $null
if (Test-Path $lanScript) {
    $lanIp = (& $lanScript -Quiet 2>$null | Select-Object -First 1)
}
if ($lanIp) {
    $lanMetroOk = Test-MetroStatusUrl "http://${lanIp}:8081"
    $lanDetail = "$lanIp" + $(if ($lanMetroOk) { " (Metro LAN OK)" } else { " (Metro not reachable on LAN - check firewall)" })
    Write-Check -Label "LAN IP" -Ok $true -Detail $lanDetail
} else {
    Write-Check -Label "LAN IP" -Ok $false -Detail "no Wi-Fi IPv4 - phone needs same network as PC" `
        -Fix "Connect PC to the same Wi-Fi as the phone (Flip deep links use LAN IP, not 127.0.0.1)"
}

Write-Host ""
Write-Host "Summary: $script:passCount passed, $script:failCount failed" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($script:failCount -eq 0) {
    Write-Host "Ready for Flip dev. Next:" -ForegroundColor Green
    if (-not $metroOk) {
        Write-Host "  .\flip-dev.bat"
    } elseif (-not $deviceOk) {
        Write-Host "  Connect phone, then .\flip-connect.bat"
    } else {
        Write-Host "  .\flip-dev.bat          (sync + connect)"
        Write-Host "  .\flip-reload.bat       (JS-only tweak)"
        Write-Host "  npm run android:dev     (native / camera rebuild)"
    }
} else {
    Write-Host "Suggested fixes:" -ForegroundColor Yellow
    $seen = @{}
    foreach ($step in $nextSteps) {
        if (-not $seen.ContainsKey($step)) {
            $seen[$step] = $true
            Write-Host "  - $step"
        }
    }
    Write-Host ""
    Write-Host "Docs: docs/ANDROID_FLAGSHIP_DEV.md | docs/DEV_BUILD_ANDROID.md"
}

exit $(if ($script:failCount -gt 0) { 1 } else { 0 })
