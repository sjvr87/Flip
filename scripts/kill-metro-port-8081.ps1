# Kill any process listening on Metro port 8081 (Windows).
param([switch]$Quiet)

$ErrorActionPreference = 'SilentlyContinue'
$pids = @(
    Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)

if ($pids.Count -eq 0) {
    if (-not $Quiet) {
        Write-Host 'Port 8081: nothing listening.'
    }
    exit 0
}

foreach ($pid in $pids) {
    if (-not $pid) { continue }
    if (-not $Quiet) {
        Write-Host "Stopping process on port 8081 (PID $pid)..."
    }
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 800

$remaining = @(
    Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)
foreach ($pid in $remaining) {
    if (-not $pid) { continue }
    if (-not $Quiet) {
        Write-Host "Force-killing remaining PID $pid on port 8081..."
    }
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

if (-not $Quiet) {
    if (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host 'WARN: port 8081 still in use.' -ForegroundColor Yellow
        exit 1
    }
    Write-Host 'Port 8081 is free.'
}

exit 0
