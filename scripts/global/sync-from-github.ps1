# Global: sync any Git repo from GitHub (pull + npm install if present).
# Usage:
#   - Double-click (pick folder if needed)
#   - Or from a repo folder: powershell -File sync-from-github.ps1
#   - Or with path: powershell -File sync-from-github.ps1 "C:\path\to\repo"

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

    Write-Host "Sync from GitHub" -ForegroundColor Cyan
    Write-Host "Repo: $repoRoot`n"

    & $git pull

    if (Test-Path (Join-Path $repoRoot "package.json")) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Host "`nInstalling/updating npm dependencies..." -ForegroundColor Cyan
            npm install
        } else {
            Write-Host "`nNode/npm not in PATH. Run 'npm install' manually if needed." -ForegroundColor Yellow
        }
    }

    Write-Host "`nDone." -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Read-Host "Press Enter to close"
}
