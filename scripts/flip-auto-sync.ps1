# Watch origin for new commits, pull, and reload Flip on the phone (adb + Metro).
# Started automatically by flip-dev.bat, or double-click flip-auto-sync.bat.
param(
    [string]$Branch = 'cursor/fix-s25-feed-tabs-regression-56a3',
    [int]$IntervalSec = 5,
    [switch]$NoReload,
    [bool]$CheckoutBranch = $true
)

$ErrorActionPreference = 'Continue'

# Cursor/CI can set CI=1 and disable Metro hot reload on the dev machine.
if ($env:CI) {
    Remove-Item Env:CI -ErrorAction SilentlyContinue
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$LogDir = Join-Path $Root 'logs'
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}
$LogFile = Join-Path $LogDir 'auto-sync.log'
$LockFile = Join-Path $LogDir 'auto-sync.lock'

if (Test-Path $LockFile) {
    $existingPid = (Get-Content $LockFile -Raw -ErrorAction SilentlyContinue).Trim()
    if ($existingPid -match '^\d+$') {
        $proc = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Flip auto-sync already running (PID $existingPid)." -ForegroundColor DarkGray
            exit 0
        }
    }
}
Set-Content -Path $LockFile -Value $PID -NoNewline

function Write-Log {
    param([string]$Message, [string]$Color = 'White')
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line -ForegroundColor $Color
}

function Test-MetroHealthy {
    try {
        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 3
        $body = if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { [string]$r.Content }
        return ($r.StatusCode -eq 200 -and $body -match 'running')
    } catch {
        return $false
    }
}

function Invoke-MetroReloadDirect {
    try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:8081/reload' -Method POST -UseBasicParsing -TimeoutSec 5 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Invoke-PhoneReload {
    if ($NoReload) {
        return $true
    }

    $devConnect = Join-Path $PSScriptRoot 'dev-connect.ps1'
    if (Test-Path $devConnect) {
        Write-Log 'Reloading phone (adb + Metro)...' 'Cyan'
        & $devConnect -ConnectOnly -Reload 2>&1 | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -eq 0) {
            Write-Log 'Phone reload OK.' 'Green'
            return $true
        }
    }

    if (Test-MetroHealthy) {
        Write-Log 'USB reload failed - trying Metro /reload (Wi-Fi; keep Flip open on phone)...' 'Yellow'
        if (Invoke-MetroReloadDirect) {
            Write-Log 'Metro reload sent (Wi-Fi path).' 'Green'
            return $true
        }
    }

    Write-Log 'Phone reload FAILED. Plug in USB + USB debugging, then run flip-connect.bat' 'Red'
    return $false
}

function Get-ShortSha {
    param([string]$Ref)
    $full = (& git rev-parse $Ref 2>$null).Trim()
    if (-not $full) { return '???????' }
    return $full.Substring(0, [Math]::Min(7, $full.Length))
}

function Sync-Branch {
    param([string]$TargetBranch, [switch]$ForceReload)

    if (-not $TargetBranch) {
        Write-Log 'ERROR: no branch to sync.' 'Red'
        return $false
    }

    Write-Log "git fetch origin $TargetBranch..." 'Cyan'
    & git fetch origin $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }

    $remote = (& git rev-parse "origin/$TargetBranch" 2>$null).Trim()
    if (-not $remote) {
        Write-Log "origin/$TargetBranch not found — check network or branch name." 'Yellow'
        return $false
    }

    $local = (& git rev-parse HEAD 2>$null).Trim()
    $onBranch = (& git branch --show-current 2>$null).Trim()

    if ($onBranch -ne $TargetBranch) {
        if ($CheckoutBranch) {
            Write-Log "Checking out $TargetBranch..." 'Cyan'
            & git checkout $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }
            if ($LASTEXITCODE -ne 0) {
                Write-Log 'Checkout failed.' 'Red'
                return $false
            }
            $local = (& git rev-parse HEAD 2>$null).Trim()
        } else {
            Write-Log "On '$onBranch' but watching '$TargetBranch'." 'Yellow'
            return $false
        }
    }

    $remoteShort = Get-ShortSha "origin/$TargetBranch"
    $localShort = Get-ShortSha 'HEAD'

    if ($local -eq $remote) {
        Write-Log "Up to date ($localShort)." 'DarkGray'
        if ($ForceReload) {
            Invoke-PhoneReload | Out-Null
        }
        return $true
    }

    Write-Log "Behind remote ($localShort -> $remoteShort). Pulling..." 'Cyan'
    & git pull origin $TargetBranch 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Log 'Pull failed — fix conflicts manually.' 'Red'
        return $false
    }

    $pulled = (& git log -1 --oneline 2>$null).Trim()
    Write-Log "Pulled: $pulled" 'Green'
    Write-Log 'Files on disk changed — Metro hot-reload + phone reload...' 'Cyan'
    Invoke-PhoneReload | Out-Null
    return $true
}

try {
    if (-not (Test-Path (Join-Path $Root 'package.json'))) {
        Write-Log 'ERROR: Run from Flip repo root (package.json missing).' 'Red'
        exit 1
    }

    $watchBranch = if ($Branch) { $Branch } else { (& git branch --show-current 2>$null).Trim() }
    if (-not $watchBranch) {
        Write-Log 'ERROR: not on a git branch.' 'Red'
        exit 1
    }

    Write-Host ''
    Write-Log '== Flip auto-sync ==' 'Cyan'
    Write-Log "Repo:   $Root"
    Write-Log "Branch: $watchBranch"
    Write-Log "Poll:   every ${IntervalSec}s (Ctrl+C to stop)"
    Write-Log "Log:    $LogFile"
    Write-Log 'Phone: USB (best) or same Wi-Fi with Flip open. Metro must be running.'
    Write-Host ''

    $null = Sync-Branch -TargetBranch $watchBranch

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
        $localShort = Get-ShortSha 'HEAD'
        $remoteShort = Get-ShortSha "origin/$watchBranch"
        $metro = if (Test-MetroHealthy) { 'Metro OK' } else { 'Metro DOWN' }

        if ($remote -and $remote -ne $lastRemote) {
            if ($remote -ne $local) {
                $null = Sync-Branch -TargetBranch $watchBranch
            } else {
                Write-Log "Remote moved; local matches ($localShort). Reloading phone..." 'DarkGray'
                Invoke-PhoneReload | Out-Null
            }
            $lastRemote = $remote
        } elseif ($local -and $remote -and $local -ne $remote) {
            Write-Log "BEHIND remote ($localShort vs $remoteShort) — pulling now..." 'Yellow'
            $null = Sync-Branch -TargetBranch $watchBranch
            $lastRemote = $remote
        } else {
            Write-Log "Watching $watchBranch  local=$localShort  remote=$remoteShort  ($metro)" 'DarkGray'
        }

        Start-Sleep -Seconds $IntervalSec
    }
} finally {
    if (Test-Path $LockFile) {
        Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
    }
}
