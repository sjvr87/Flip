# Flip dev connect: pull, adb reverse, Metro (dev-client + clear if not running).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== Flip dev-connect ==" -ForegroundColor Cyan

Write-Host "[1/4] git pull origin main..."
$ErrorActionPreference = 'Continue'
$pull = (cmd /c "git pull origin main 2>&1")
$ErrorActionPreference = 'Stop'
Write-Host $pull

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  Write-Host "ERROR: adb not found at $adb" -ForegroundColor Red
  exit 1
}

Write-Host "[2/4] adb devices"
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
  Write-Host "WARN: No device in 'device' state — connect USB debugging and retry." -ForegroundColor Yellow
} else {
  Write-Host "[3/4] adb reverse tcp:8081 tcp:8081"
  foreach ($serial in $serials) {
    $rev = & $adb -s $serial reverse tcp:8081 tcp:8081 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  $serial : reverse OK ($rev)" -ForegroundColor Green
      $reverseOk = $true
    } else {
      Write-Host "  $serial : reverse FAILED — $rev" -ForegroundColor Red
    }
  }
}

function Test-PortListening([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  return $null -ne $conn
}

$metroRunning = Test-PortListening 8081
if ($metroRunning) {
  Write-Host "[4/4] Metro: port 8081 already in use — skipping start (assumes Expo/Metro running)." -ForegroundColor Yellow
} else {
  Write-Host "[4/4] Starting Metro (dev-client, clear cache) in background..."
  $npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }
  Start-Process -FilePath $npm -ArgumentList "run", "start:clear" -WorkingDirectory $Root -WindowStyle Normal
  Start-Sleep -Seconds 3
  $metroRunning = Test-PortListening 8081
}

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== Status ===" -ForegroundColor Cyan
Write-Host ("Device(s): {0}" -f ($(if ($serials.Count) { $serials -join ", " } else { "(none)" })))
Write-Host ("adb reverse 8081: {0}" -f $(if ($reverseOk) { "OK" } elseif ($serials.Count -eq 0) { "skipped (no device)" } else { "FAILED" }))
Write-Host ("Metro on 8081: {0}" -f $(if ($metroRunning) { "running" } else { "not detected yet — check Metro window" }))
Write-Host "On phone: open Flip dev client -> loads from Metro via USB reverse."
Write-Host "URLs: exp://127.0.0.1:8081 (USB) | exp://${lanIp}:8081 (LAN)"


