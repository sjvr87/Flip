# Start flip-auto-sync in a minimized window if not already running.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root 'logs'
$LockFile = Join-Path $LogDir 'auto-sync.lock'

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

if (Test-Path $LockFile) {
    $existingPid = (Get-Content $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($existingPid -match '^\d+$') {
        $proc = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Flip auto-sync already running (PID $existingPid)." -ForegroundColor DarkGray
            exit 0
        }
    }
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

$autoSyncBat = Join-Path $Root 'flip-auto-sync.bat'
if (-not (Test-Path $autoSyncBat)) {
    Write-Host "Missing $autoSyncBat" -ForegroundColor Red
    exit 1
}

Write-Host 'Starting Flip auto-sync window (minimized)...' -ForegroundColor Cyan
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "`"$autoSyncBat`"" `
    -WorkingDirectory $Root `
    -WindowStyle Minimized | Out-Null

exit 0
