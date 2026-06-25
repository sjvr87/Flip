# create-test-account.ps1 — Phase 0 staging PDS test account creation (Windows)
#
# Usage:
#   $env:STAGING_PDS_HOST = "http://127.0.0.1:2583"
#   $env:STAGING_HANDLE   = "alice"
#   $env:STAGING_EMAIL    = "alice@example.com"
#   $env:STAGING_PASSWORD = "alice-app-password"
#   $env:STAGING_INVITE_CODE = "<invite-code>"
#   .\scripts\staging-pds\create-test-account.ps1

param(
    [string]$PdsHost     = $env:STAGING_PDS_HOST,
    [string]$Handle      = $env:STAGING_HANDLE,
    [string]$Email       = $env:STAGING_EMAIL,
    [string]$Password    = $env:STAGING_PASSWORD,
    [string]$InviteCode  = $env:STAGING_INVITE_CODE
)

if (-not $PdsHost)    { Write-Error "Set STAGING_PDS_HOST"; exit 1 }
if (-not $Handle)     { Write-Error "Set STAGING_HANDLE"; exit 1 }
if (-not $Email)      { Write-Error "Set STAGING_EMAIL"; exit 1 }
if (-not $Password)   { Write-Error "Set STAGING_PASSWORD"; exit 1 }
if (-not $InviteCode) { Write-Error "Set STAGING_INVITE_CODE"; exit 1 }

# Strip protocol prefix to build the full handle (e.g. alice.127.0.0.1:2583)
$HostOnly = $PdsHost -replace "^https?://", ""
$FullHandle = "${Handle}.${HostOnly}"

Write-Host "Creating account: $FullHandle on $PdsHost"

$Body = @{
    handle     = $FullHandle
    email      = $Email
    password   = $Password
    inviteCode = $InviteCode
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod `
        -Method Post `
        -Uri "${PdsHost}/xrpc/com.atproto.server.createAccount" `
        -ContentType "application/json" `
        -Body $Body

    Write-Host ""
    Write-Host "✅ Account created!" -ForegroundColor Green
    Write-Host "   DID:    $($Response.did)"
    Write-Host "   Handle: $FullHandle"
    Write-Host ""
    Write-Host "Sign in via Flip dev build:"
    Write-Host "  Handle:   $FullHandle"
    Write-Host "  Password: $Password"
    Write-Host "  Server:   $PdsHost"
} catch {
    Write-Error "Account creation failed: $_"
    exit 1
}
