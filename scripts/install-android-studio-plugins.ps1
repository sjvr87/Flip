# Install recommended Android Studio marketplace plugins for Flip (Expo RN + Kotlin native).
# Uses JetBrains CLI: studio64.exe installPlugins <plugin-id>
# Close Android Studio first - only one instance can run at a time.

$ErrorActionPreference = "Stop"

$PluginIds = @(
    @{ Id = "com.developerphil.adbidea"; Name = "ADB Idea"; Required = $true }
)

function Find-AndroidStudioExe {
    $candidates = @(
        (Join-Path ${env:ProgramFiles} "Android\Android Studio\bin\studio64.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Android\Android Studio\bin\studio64.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Android Studio\bin\studio64.exe")
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    $glob = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Google") -Filter "studio64.exe" -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($glob) { return $glob.FullName }
    return $null
}

function Get-AndroidStudioConfigDir {
    $roaming = Join-Path $env:APPDATA "Google"
    $match = Get-ChildItem -Path $roaming -Directory -Filter "AndroidStudio*" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($match) { return $match.FullName }
    return $null
}

function Test-BundledPlugin {
    param([string]$PluginId, [string]$ConfigDir)
    $bundled = Join-Path $ConfigDir "bundled_plugins.txt"
    if (-not (Test-Path $bundled)) { return $false }
    return (Select-String -Path $bundled -Pattern "^\Q$PluginId\E\|" -Quiet)
}

function Test-InstalledPlugin {
    param([string]$PluginId, [string]$ConfigDir)
    if (Test-BundledPlugin -PluginId $PluginId -ConfigDir $ConfigDir) { return $true }
    $pluginsRoot = Join-Path $ConfigDir "plugins"
    if (-not (Test-Path $pluginsRoot)) { return $false }
    $hits = Get-ChildItem -Path $pluginsRoot -Recurse -Filter "plugin.xml" -ErrorAction SilentlyContinue |
        Where-Object {
            $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
            $content -and ($content -match [regex]::Escape($PluginId))
        }
    return ($null -ne $hits -and $hits.Count -gt 0)
}

function Test-AndroidStudioRunning {
    return $null -ne (Get-Process -Name "studio64" -ErrorAction SilentlyContinue)
}

$studio = Find-AndroidStudioExe
if (-not $studio) {
    Write-Host "Android Studio not found (studio64.exe)." -ForegroundColor Red
    Write-Host "Install from https://developer.android.com/studio"
    exit 1
}

$configDir = Get-AndroidStudioConfigDir
Write-Host "Android Studio: $studio"
if ($configDir) { Write-Host "Config:         $configDir" }
Write-Host ""

# Bundled with Android Studio - no marketplace install needed.
$bundled = @(
    @{ Id = "org.jetbrains.kotlin"; Name = "Kotlin" },
    @{ Id = "org.jetbrains.plugins.gradle"; Name = "Gradle" },
    @{ Id = "org.jetbrains.android"; Name = "Android" }
)
foreach ($p in $bundled) {
    $ok = $configDir -and (Test-BundledPlugin -PluginId $p.Id -ConfigDir $configDir)
    if ($ok) {
        $status = "bundled (skip)"
    } else {
        $status = "expected bundled - check Settings, Plugins"
    }
    Write-Host ("  {0,-22} {1}" -f $p.Name, $status)
}
Write-Host ""

$toInstall = @()
foreach ($p in $PluginIds) {
    $installed = $configDir -and (Test-InstalledPlugin -PluginId $p.Id -ConfigDir $configDir)
    if ($installed) {
        Write-Host ("  {0,-22} already installed" -f $p.Name) -ForegroundColor Green
    } else {
        Write-Host ("  {0,-22} not installed" -f $p.Name) -ForegroundColor Yellow
        $toInstall += $p.Id
    }
}

if ($toInstall.Count -eq 0) {
    Write-Host ""
    Write-Host "All recommended plugins are present." -ForegroundColor Green
    exit 0
}

if (Test-AndroidStudioRunning) {
    Write-Host ""
    Write-Host "Android Studio is running. Close it, then re-run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\install-android-studio-plugins.ps1"
    Write-Host ""
    Write-Host 'Or install manually: Settings, Plugins, Marketplace, search ADB Idea'
    Write-Host "  https://plugins.jetbrains.com/plugin/7380-adb-idea"
    exit 2
}

Write-Host ""
Write-Host "Installing: $($toInstall -join ', ')"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$output = & $studio installPlugins @toInstall 2>&1
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap

if ($output) { $output | ForEach-Object { Write-Host $_ } }

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "Plugin install finished. Restart Android Studio." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "CLI install failed (exit $exitCode). See docs/ANDROID_STUDIO_PLUGINS.md" -ForegroundColor Red
exit $exitCode
