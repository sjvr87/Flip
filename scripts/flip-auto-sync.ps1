# Watch origin for new commits, pull, and reload Metro on the phone.
# Usage:
#   flip-auto-sync.bat
#   flip-auto-sync-fix-branch.bat
#   powershell -File scripts/flip-auto-sync.ps1 -Branch cursor/fix-s25-feed-tabs-regression-56a3
param(
    [string]$Branch = '',
    [int]$IntervalSec = 20,
    [switch]$NoReload,
    [switch]$CheckoutBranch
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

function Sync-Branch {
    param([string]$TargetBranch, [switch]$ForceReload)

    if (-not $TargetBranch) {
        Write-Host 'ERROR: no branch to sync.' -ForegroundColor Red
        return $false
    }

    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] git fetch origin $TargetBranch..." -ForegroundColor Cyan
    & git fetch origin $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }

    $remote = (& git rev-parse "origin/$TargetBranch" 2>$null).Trim()
    if (-not $remote) {
        Write-Host "  WARN: origin/$TargetBranch not found. Check branch name and network." -ForegroundColor Yellow
        return $false
    }

    $local = (& git rev-parse HEAD 2>$null).Trim()
    $onBranch = (& git branch --show-current 2>$null).Trim()

    if ($onBranch -ne $TargetBranch) {
        if ($CheckoutBranch) {
            Write-Host "  Checking out $TargetBranch..." -ForegroundColor Cyan
            & git checkout $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }
            if ($LASTEXITCODE -ne 0) {
                Write-Host '  Checkout failed.' -ForegroundColor Red
                return $false
            }
            $local = (& git rev-parse HEAD 2>$null).Trim()
        } else {
            Write-Host "  On branch '$onBranch' but watching '$TargetBranch'." -ForegroundColor Yellow
            Write-Host "  Run flip-auto-sync-fix-branch.bat or pass -CheckoutBranch." -ForegroundColor Yellow
            return $false
        }
    }

    if ($local -eq $remote) {
        Write-Host '  Already up to date.' -ForegroundColor DarkGray
        if ($ForceReload -and (Test-MetroHealthy)) {
            Invoke-MetroReload | Out-Null
        }
        return $true
    }

    Write-Host "  Pulling origin/$TargetBranch..." -ForegroundColor Cyan
    & git pull origin $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  Pull failed — fix conflicts manually.' -ForegroundColor Red
        return $false
    }

    & git log -1 --oneline
    if (-not $NoReload) {
        if (Test-MetroHealthy) {
            Invoke-MetroReload | Out-Null
        } else {
            Write-Host '  Metro not on 8081 — run flip-dev.bat first, then leave this window open.' -ForegroundColor Yellow
        }
    }
    return $true
}

$watchBranch = $Branch
if (-not $watchBranch) {
    $watchBranch = (& git branch --show-current 2>$null).Trim()
}

if (-not $watchBranch) {
    Write-Host 'ERROR: not on a git branch. cd to Flip repo and try again.' -ForegroundColor Red
    exit 1
}

Write-Host '== Flip auto-sync ==' -ForegroundColor Cyan
Write-Host "Repo:    $Root"
Write-Host "Branch:  $watchBranch"
Write-Host "Poll:    every ${IntervalSec}s (Ctrl+C to stop)"
Write-Host 'Needs:   Metro healthy on 8081 (run flip-dev.bat once if not)'
Write-Host ''

# Sync immediately on start so you do not wait for the next agent push.
$null = Sync-Branch -TargetBranch $watchBranch -ForceReload

$lastRemote = (& git rev-parse "origin/$watchBranch" 2>$null).Trim()

while ($true) {
    $watchBranch = if ($Branch) { $Branch } else { (& git branch --show-current 2>$null).Trim() }
    if (-not $watchBranch) {
        Start-Sleep -Seconds $IntervalSec
        continue
    }

    & git fetch origin $watchBranch 2>&1 | Out-Null
    $remote = (& git rev-parse "origin/$watchBranch" 2>$null).Trim()
    $local = (& git rev-parse HEAD 2>$null).Trim()

    if ($remote -and $remote -ne $lastRemote) {
        if ($remote -ne $local) {
            $null = Sync-Branch -TargetBranch $watchBranch
        } else {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Remote updated; local already matches." -ForegroundColor DarkGray
            if (-not $NoReload -and (Test-MetroHealthy)) {
                Invoke-MetroReload | Out-Null
            }
        }
        $lastRemote = $remote
    } else {
        $metro = if (Test-MetroHealthy) { 'Metro OK' } else { 'Metro DOWN — run flip-dev.bat' }
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Watching $watchBranch ($metro)" -ForegroundColor DarkGray
    }

    Start-Sleep -Seconds $IntervalSec
}
