# Verify Flip Android dev environment (Samsung S26 Ultra / flagship).
# Checks: node, adb, ANDROID_HOME, JDK, device, Metro 8081.
# Prints pass/fail and suggested next steps.

$ErrorActionPreference = "Continue"

$PreferredDevice = if ($env:FLIP_ADB_DEVICE) { $env:FLIP_ADB_DEVICE.Trim() } else { "R3GL10HN64A" }
$Root = Split-Path -Parent $PSScriptRoot
$failures = @()
$warnings = @()

function Write-Check {
    param([string]$Label, [bool]$Ok, [string]$Detail)
    $icon = if ($Ok) { "[OK]" } else { "[FAIL]" }
    $color = if ($Ok) { "Green" } else { "Red" }
    Write-Host ("  {0,-6} {1,-22} {2}" -f $icon, $Label, $Detail) -ForegroundColor $color
    if (-not $Ok) { $script:failures += $Label }
}

function Write-Warn {
    param([string]$Label, [string]$Detail)
    Write-Host ("  [WARN] {0,-22} {1}" -f $Label, $Detail) -ForegroundColor Yellow
    $script:warnings += $Label
}

function Find-Adb {
    if (Get-Command adb -ErrorAction SilentlyContinue) { return "adb" }
    $sdkAdb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    if (Test-Path $sdkAdb) { return $sdkAdb }
    if ($env:ANDROID_HOME) {
        $homeAdb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
        if (Test-Path $homeAdb) { return $homeAdb }
    }
    return $null
}

function Get-JavaVersion {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $out = & java -version 2>&1 | Out-String
    $ErrorActionPreference = $prev
    if ($out -match 'version "(\d+)') {
        return [int]$Matches[1]
    }
    return $null
}

function Test-MetroHealthy {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/status" -UseBasicParsing -TimeoutSec 3
        return ($r.Content -match "packager-status:running")
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "Flip Android dev environment check" -ForegroundColor Cyan
Write-Host "Preferred device: $PreferredDevice (FLIP_ADB_DEVICE to override)"
Write-Host ""

# Node
$nodeOk = $false
$nodeVer = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (& node --version 2>$null)
    $nodeOk = $true
}
Write-Check -Label "Node.js" -Ok $nodeOk -Detail $(if ($nodeVer) { $nodeVer } else { "not found" })

# ANDROID_HOME
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) { $sdkPath = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$sdkOk = Test-Path $sdkPath
Write-Check -Label "ANDROID_HOME" -Ok $sdkOk -Detail $(if ($sdkOk) { $sdkPath } else { "not set / missing" })

# adb
$adb = Find-Adb
$adbOk = $null -ne $adb
Write-Check -Label "adb" -Ok $adbOk -Detail $(if ($adbOk) { $adb } else { "not found" })

# JDK
$javaMajor = Get-JavaVersion
$jdkOk = $null -ne $javaMajor -and $javaMajor -ge 17
$jdkDetail = if ($javaMajor) { "Java $javaMajor" } else { "java not on PATH" }
Write-Check -Label "JDK" -Ok $jdkOk -Detail $jdkDetail
if ($javaMajor -and $javaMajor -lt 17) {
    Write-Warn -Label "JDK version" -Detail "Need JDK 17+ for Gradle (see DEV_BUILD_ANDROID.md)"
}

# Device
$deviceOk = $false
$deviceDetail = "not connected"
$serials = @()
if ($adbOk) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $lines = & $adb devices 2>&1
    $ErrorActionPreference = $prev
    foreach ($line in $lines) {
        if ($line -match '^(\S+)\s+device\s*$') {
            $serials += $Matches[1]
        }
    }
    if ($serials.Count -eq 0) {
        $deviceDetail = "no device (adb devices empty)"
    } elseif ($serials -contains $PreferredDevice) {
        $deviceOk = $true
        $deviceDetail = "$PreferredDevice connected"
    } elseif ($serials.Count -eq 1) {
        $deviceOk = $true
        $deviceDetail = "$($serials[0]) connected"
        if ($serials[0] -ne $PreferredDevice) {
            Write-Warn -Label "Device serial" -Detail "Expected $PreferredDevice, got $($serials[0])"
        }
    } else {
        $deviceDetail = "multiple devices: $($serials -join ', ') - set FLIP_ADB_DEVICE"
    }
}
Write-Check -Label "Device" -Ok $deviceOk -Detail $deviceDetail

# Metro
$metroOk = Test-MetroHealthy
Write-Check -Label "Metro 8081" -Ok $metroOk -Detail $(if ($metroOk) { "packager-status:running" } else { "not responding" })

# android/ folder
$androidDir = Join-Path $Root "android"
$hasAndroid = Test-Path $androidDir
if (-not $hasAndroid) {
    Write-Warn -Label "android/" -Detail "missing - run npm run android:dev:setup"
}

Write-Host ""

if ($failures.Count -eq 0) {
    Write-Host "All checks passed." -ForegroundColor Green
    if (-not $metroOk) {
        Write-Host "Next: .\flip-dev.bat" -ForegroundColor Cyan
    } else {
        Write-Host "Next: .\flip-connect.bat (Metro up) or .\flip-reload.bat (JS tweak)" -ForegroundColor Cyan
    }
    exit 0
}

Write-Host "Some checks failed. Suggested fixes:" -ForegroundColor Yellow
Write-Host ""

if ($failures -contains "Node.js") {
    Write-Host "  Node.js  -> install Node 20+ from https://nodejs.org"
}
if ($failures -contains "ANDROID_HOME" -or $failures -contains "adb") {
    Write-Host "  SDK/adb  -> install Android Studio + SDK; see docs/DEV_BUILD_ANDROID.md Part 2-3"
}
if ($failures -contains "JDK") {
    Write-Host "  JDK      -> set JAVA_HOME to Android Studio jbr or Temurin 17"
}
if ($failures -contains "Device") {
    Write-Host "  Device   -> enable USB debugging, data cable, allow RSA prompt"
    Write-Host "             then: adb devices"
}
if ($failures -contains "Metro 8081") {
    if ($deviceOk) {
        Write-Host "  Metro    -> .\flip-dev.bat  (or .\flip-reset-dev.bat if stuck)"
    } else {
        Write-Host "  Metro    -> fix device first, then .\flip-dev.bat"
    }
}
if (-not $hasAndroid) {
    Write-Host "  android/ -> npm run android:dev:setup  (first-time prebuild + build)"
}

Write-Host ""
exit 1
