#!/usr/bin/env bash
# Create a test account on the Flip staging PDS.
# Usage: STAGING_PDS_HOST=localhost:2583 STAGING_PDS_INVITE=<code> ./create-test-account.sh
#
# Required env vars:
#   STAGING_PDS_HOST   - PDS hostname (e.g. localhost:2583 or staging.flip.app)
#   STAGING_PDS_INVITE - Invite code from com.atproto.server.createInviteCode
#
# Optional env vars:
#   STAGING_HANDLE     - Desired handle (default: alice)
#   STAGING_EMAIL      - Email (default: alice@test.flip.app)
#   STAGING_PASSWORD   - Password (default: randomly generated)

set -euo pipefail

: "${STAGING_PDS_HOST:?Set STAGING_PDS_HOST (e.g. localhost:2583 or staging.flip.app)}"
: "${STAGING_PDS_INVITE:?Set STAGING_PDS_INVITE to a valid invite code}"

HANDLE="${STAGING_HANDLE:-alice}"
EMAIL="${STAGING_EMAIL:-${HANDLE}@test.flip.app}"
PASSWORD="${STAGING_PASSWORD:-$(openssl rand -base64 16)}"

# Determine protocol
if [[ "$STAGING_PDS_HOST" == localhost* ]] || [[ "$STAGING_PDS_HOST" == 127.* ]]; then
    PROTOCOL="http"
else
    PROTOCOL="https"
fi

PDS_URL="${PROTOCOL}://${STAGING_PDS_HOST}"

echo "Creating account on ${PDS_URL}"
echo "  Handle: ${HANDLE}.staging.flip.app"
echo "  Email:  ${EMAIL}"

RESPONSE=$(curl -s -X POST "${PDS_URL}/xrpc/com.atproto.server.createAccount" \
    -H "Content-Type: application/json" \
    -d "{
        \"handle\": \"${HANDLE}.staging.flip.app\",
        \"email\": \"${EMAIL}\",
        \"password\": \"${PASSWORD}\",
        \"inviteCode\": \"${STAGING_PDS_INVITE}\"
    }")

echo ""
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

# Check for DID in response
DID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('did',''))" 2>/dev/null || echo "")

if [ -n "$DID" ]; then
    echo ""
    echo "Account created successfully!"
    echo "  DID:      ${DID}"
    echo "  Handle:   ${HANDLE}.staging.flip.app"
    echo "  Password: ${PASSWORD}"
    echo ""
    echo "To sign in from Flip dev build:"
    echo "  1. Tap 'Use app password instead'"
    echo "  2. Handle: ${HANDLE}.staging.flip.app"
    echo "  3. Password: ${PASSWORD}"
    echo "  4. Server: staging.flip.app"
else
    echo ""
    echo "Account creation may have failed. Check the response above."
    exit 1
fi
