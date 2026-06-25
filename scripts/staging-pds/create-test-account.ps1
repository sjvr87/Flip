# Create a test account on a staging PDS via com.atproto.server.createAccount
# Usage (PowerShell):
#   $env:STAGING_PDS_HOST = "http://127.0.0.1:2583"
#   $env:STAGING_HANDLE = "alice.staging.flip.app"
#   $env:STAGING_EMAIL = "alice@example.com"
#   $env:STAGING_INVITE_CODE = "<from-pds-admin>"
#   .\create-test-account.ps1

param(
    [string]$PdsHost = $env:STAGING_PDS_HOST,
    [string]$Handle = $env:STAGING_HANDLE,
    [string]$Email = $env:STAGING_EMAIL,
    [string]$Password = $env:STAGING_PASSWORD,
    [string]$InviteCode = $env:STAGING_INVITE_CODE
)

$ErrorActionPreference = "Stop"

function Write-Err($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

if (-not $PdsHost) { Write-Err "Set STAGING_PDS_HOST (e.g. http://127.0.0.1:2583)" }
if (-not $Handle) { Write-Err "Set STAGING_HANDLE (e.g. alice.staging.flip.app)" }
if (-not $Email) { Write-Err "Set STAGING_EMAIL" }
if (-not $InviteCode) { Write-Err "Set STAGING_INVITE_CODE from PDS admin" }

if (-not $Password) {
    $Password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Write-Host "Generated password (save this):" -ForegroundColor Yellow
}

$base = $PdsHost.TrimEnd("/")
$uri = "$base/xrpc/com.atproto.server.createAccount"

$body = @{
    email      = $Email
    handle     = $Handle
    password   = $Password
    inviteCode = $InviteCode
} | ConvertTo-Json

Write-Host "Creating account on $uri ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body
}
catch {
    $detail = $_.ErrorDetails.Message
    if (-not $detail) { $detail = $_.Exception.Message }
    Write-Err "createAccount failed: $detail"
}

Write-Host ""
Write-Host "=== Staging test account created ===" -ForegroundColor Green
Write-Host "DID:      $($response.did)"
Write-Host "Handle:   $($response.handle)"
Write-Host "Password: $Password"
Write-Host ""
Write-Host "Flip manual login:" -ForegroundColor Cyan
Write-Host "  1. Dev build -> Sign in -> Use app password instead"
Write-Host "  2. Handle: $($response.handle)"
Write-Host "  3. App password: (password above — or create app password via PDS if available)"
$pdsHostForApp = $PdsHost -replace "^https?://", ""
Write-Host "  4. Server: $pdsHostForApp  (include http:// prefix if local HTTP, e.g. http://127.0.0.1:2583)"
Write-Host ""
Write-Host "Phase 0: photo posts only. Video requires video.bsky.app (not for staging DIDs)."
