# Global: save any Git repo to GitHub (add + commit + push).
# Usage:
#   - Double-click (pick folder if needed)
#   - Or from a repo folder: powershell -File save-to-github.ps1
#   - Or with path: powershell -File save-to-github.ps1 "C:\path\to\repo"

$ErrorActionPreference = "Stop"

function Get-GitExe {
    if (Get-Command git -ErrorAction SilentlyContinue) { return "git" }
    $gitExe = "C:\Program Files\Git\bin\git.exe"
    if (Test-Path $gitExe) { return $gitExe }
    throw "Git not found. Install Git for Windows: https://git-scm.com/download/win"
}

function Resolve-RepoRoot {
    param([string]$StartPath)

    if ($StartPath) {
        $StartPath = (Resolve-Path $StartPath).Path
        Set-Location $StartPath
    }

    $git = Get-GitExe
    $root = & $git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0 -and $root) {
        return $root.Trim()
    }

    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Select the project folder (must be a Git repo)"
    $dialog.ShowNewFolderButton = $false

    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw "No folder selected."
    }

    Set-Location $dialog.SelectedPath
    $root = & $git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "That folder is not a Git repo. Run 'git init' or 'git clone' first."
    }

    return $root.Trim()
}

try {
    $git = Get-GitExe
    $repoRoot = Resolve-RepoRoot -StartPath $args[0]
    Set-Location $repoRoot

    Write-Host "Save to GitHub" -ForegroundColor Cyan
    Write-Host "Repo: $repoRoot`n"

    & $git status

    $changes = & $git status --porcelain
    if ($changes) {
        $defaultMessage = "save $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        $message = Read-Host "Commit message (Enter for '$defaultMessage')"
        if ([string]::IsNullOrWhiteSpace($message)) {
            $message = $defaultMessage
        }

        & $git add .
        & $git commit -m $message
    } else {
        Write-Host "`nNo file changes to commit." -ForegroundColor Yellow
    }

    Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
    & $git push

    Write-Host "`nDone." -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Read-Host "Press Enter to close"
}
