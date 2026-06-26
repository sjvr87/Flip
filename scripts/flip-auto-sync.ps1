# Watch origin for new commits, pull, and reload Metro on the phone.
# Run once while testing: flip-auto-sync.bat  (leave the window open; Ctrl+C to stop)
param(
    [int]$IntervalSec = 30,
    [switch]$NoReload
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-MetroHealthy {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 3
        $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
        return ($r.StatusCode -eq 200 -and $body -match 'running')
    } catch {
        return $false
    }
}

function Invoke-MetroReload {
    try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:8081/reload' -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
        Write-Host '  Metro reload sent.' -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  Metro reload failed: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

$branch = (git branch --show-current).Trim()
if (-not $branch) {
    Write-Host 'ERROR: not on a git branch.' -ForegroundColor Red
    exit 1
}

Write-Host '== Flip auto-sync ==' -ForegroundColor Cyan
Write-Host "Watching origin/$branch every ${IntervalSec}s (Ctrl+C to stop)"
Write-Host 'Requires Metro already running (flip-dev.bat once). JS pulls reload the app automatically.'
Write-Host ''

$lastRemote = (git rev-parse "origin/$branch" 2>$null).Trim()

while ($true) {
    $branch = (git branch --show-current).Trim()
    if (-not $branch) {
        Start-Sleep -Seconds $IntervalSec
        continue
    }

    $null = cmd /c "git fetch origin $branch 2>&1"
    $remote = (git rev-parse "origin/$branch" 2>$null).Trim()
    $local = (git rev-parse HEAD).Trim()

    if ($remote -and $remote -ne $lastRemote) {
        $stamp = Get-Date -Format 'HH:mm:ss'
        if ($remote -ne $local) {
            Write-Host "[$stamp] New commits — pulling origin/$branch..." -ForegroundColor Cyan
            $pullOut = cmd /c "git pull origin $branch 2>&1"
            Write-Host $pullOut

            if ($LASTEXITCODE -ne 0) {
                Write-Host '  Pull failed — fix conflicts manually, then auto-sync continues.' -ForegroundColor Yellow
            } else {
                git log -1 --oneline
                if (-not $NoReload -and (Test-MetroHealthy)) {
                    Invoke-MetroReload | Out-Null
                } elseif (-not (Test-MetroHealthy)) {
                    Write-Host '  Metro not on 8081 — run flip-dev.bat or flip-reload.bat when ready.' -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "[$stamp] Remote moved but local already matches." -ForegroundColor DarkGray
        }
        $lastRemote = $remote
    }

    Start-Sleep -Seconds $IntervalSec
}
