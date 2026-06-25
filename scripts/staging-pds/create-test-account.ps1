# Create a test account on the Flip staging PDS.
# Usage: $env:STAGING_PDS_HOST="localhost:2583"; $env:STAGING_PDS_INVITE="<code>"; .\create-test-account.ps1
#
# Required env vars:
#   STAGING_PDS_HOST   - PDS hostname (e.g. localhost:2583 or staging.flip.app)
#   STAGING_PDS_INVITE - Invite code from com.atproto.server.createInviteCode
#
# Optional env vars:
#   STAGING_HANDLE     - Desired handle (default: alice)
#   STAGING_EMAIL      - Email (default: alice@test.flip.app)
#   STAGING_PASSWORD   - Password (default: randomly generated)

$ErrorActionPreference = 'Stop'

if (-not $env:STAGING_PDS_HOST) {
    Write-Error "Set STAGING_PDS_HOST (e.g. localhost:2583 or staging.flip.app)"
    exit 1
}
if (-not $env:STAGING_PDS_INVITE) {
    Write-Error "Set STAGING_PDS_INVITE to a valid invite code"
    exit 1
}

$Handle = if ($env:STAGING_HANDLE) { $env:STAGING_HANDLE } else { "alice" }
$Email = if ($env:STAGING_EMAIL) { $env:STAGING_EMAIL } else { "${Handle}@test.flip.app" }
$Password = if ($env:STAGING_PASSWORD) { $env:STAGING_PASSWORD } else {
    $bytes = [byte[]]::new(16)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    [Convert]::ToBase64String($bytes)
}

$Protocol = if ($env:STAGING_PDS_HOST -match '^(localhost|127\.)') { "http" } else { "https" }
$PdsUrl = "${Protocol}://$($env:STAGING_PDS_HOST)"

Write-Host "Creating account on $PdsUrl"
Write-Host "  Handle: ${Handle}.staging.flip.app"
Write-Host "  Email:  $Email"

$Body = @{
    handle     = "${Handle}.staging.flip.app"
    email      = $Email
    password   = $Password
    inviteCode = $env:STAGING_PDS_INVITE
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri "$PdsUrl/xrpc/com.atproto.server.createAccount" `
        -Method Post `
        -ContentType "application/json" `
        -Body $Body

    Write-Host ""
    Write-Host "Account created successfully!" -ForegroundColor Green
    Write-Host "  DID:      $($Response.did)"
    Write-Host "  Handle:   ${Handle}.staging.flip.app"
    Write-Host "  Password: $Password"
    Write-Host ""
    Write-Host "To sign in from Flip dev build:"
    Write-Host "  1. Tap 'Use app password instead'"
    Write-Host "  2. Handle: ${Handle}.staging.flip.app"
    Write-Host "  3. Password: $Password"
    Write-Host "  4. Server: staging.flip.app"
}
catch {
    Write-Host ""
    Write-Host "Account creation failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
    exit 1
}
