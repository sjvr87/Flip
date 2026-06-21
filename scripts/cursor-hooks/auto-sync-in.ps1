# Auto sync IN: git pull when a Cursor agent session starts.

$ErrorActionPreference = "SilentlyContinue"

function Get-GitExe {
    if (Get-Command git -ErrorAction SilentlyContinue) { return "git" }
    $gitExe = "C:\Program Files\Git\bin\git.exe"
    if (Test-Path $gitExe) { return $gitExe }
    return $null
}

function Get-WorkspaceRoot {
    param([string]$Raw)

    if ([string]::IsNullOrWhiteSpace($Raw)) { return $null }

    try {
        $json = $Raw | ConvertFrom-Json
    } catch {
        return $null
    }

    foreach ($key in @("workspace_roots", "workspaceRoots", "project_path", "projectPath", "cwd", "rootPath")) {
        $value = $json.$key
        if ($value -is [System.Array] -and $value.Count -gt 0) {
            return [string]$value[0]
        }
        if ($value -is [string] -and $value) {
            return $value
        }
    }

    return $null
}

$log = Join-Path $env:USERPROFILE ".cursor\hooks\auto-github.log"
$raw = [Console]::In.ReadToEnd()
$workspace = Get-WorkspaceRoot -Raw $raw

if (-not $workspace -or -not (Test-Path $workspace)) { exit 0 }

$git = Get-GitExe
if (-not $git) { exit 0 }

Set-Location $workspace
$repoRoot = & $git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { exit 0 }

Set-Location $repoRoot.Trim()
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$stamp] SYNC IN: $repoRoot" | Add-Content $log
& $git pull 2>&1 | Add-Content $log

exit 0
