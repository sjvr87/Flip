#!/usr/bin/env bash
# create-test-account.sh — Phase 0 staging PDS test account creation
#
# Usage:
#   export STAGING_PDS_HOST=http://127.0.0.1:2583
#   export STAGING_HANDLE=alice
#   export STAGING_EMAIL=alice@example.com
#   export STAGING_PASSWORD=alice-app-password
#   export STAGING_INVITE_CODE=<invite-code>
#   bash scripts/staging-pds/create-test-account.sh
#
# Requires: curl, jq

set -euo pipefail

: "${STAGING_PDS_HOST:?Set STAGING_PDS_HOST (e.g. http://127.0.0.1:2583)}"
: "${STAGING_HANDLE:?Set STAGING_HANDLE (e.g. alice)}"
: "${STAGING_EMAIL:?Set STAGING_EMAIL}"
: "${STAGING_PASSWORD:?Set STAGING_PASSWORD}"
: "${STAGING_INVITE_CODE:?Set STAGING_INVITE_CODE}"

echo "Creating account: ${STAGING_HANDLE} on ${STAGING_PDS_HOST}"

RESPONSE=$(curl -s -X POST "${STAGING_PDS_HOST}/xrpc/com.atproto.server.createAccount" \
  -H "Content-Type: application/json" \
  -d "{
    \"handle\": \"${STAGING_HANDLE}.${STAGING_PDS_HOST#*://}\",
    \"email\": \"${STAGING_EMAIL}\",
    \"password\": \"${STAGING_PASSWORD}\",
    \"inviteCode\": \"${STAGING_INVITE_CODE}\"
  }")

echo "$RESPONSE" | jq .

DID=$(echo "$RESPONSE" | jq -r '.did // empty')
if [[ -z "$DID" ]]; then
  echo "ERROR: account creation failed — check response above" >&2
  exit 1
fi

echo ""
echo "✅ Account created!"
echo "   DID:    $DID"
echo "   Handle: ${STAGING_HANDLE}.${STAGING_PDS_HOST#*://}"
echo ""
echo "Sign in via Flip dev build:"
echo "  Handle:   ${STAGING_HANDLE}.${STAGING_PDS_HOST#*://}"
echo "  Password: ${STAGING_PASSWORD}"
echo "  Server:   ${STAGING_PDS_HOST}"
