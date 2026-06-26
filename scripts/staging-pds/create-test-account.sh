#!/usr/bin/env bash
# Create a test account on a staging PDS via com.atproto.server.createAccount
#
#   export STAGING_PDS_HOST=http://127.0.0.1:2583
#   export STAGING_HANDLE=alice.staging.flip.app
#   export STAGING_EMAIL=alice@example.com
#   export STAGING_INVITE_CODE=<from-pds-admin>
#   ./create-test-account.sh

set -euo pipefail

PDS_HOST="${STAGING_PDS_HOST:-}"
HANDLE="${STAGING_HANDLE:-}"
EMAIL="${STAGING_EMAIL:-}"
PASSWORD="${STAGING_PASSWORD:-}"
INVITE="${STAGING_INVITE_CODE:-}"

die() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$PDS_HOST" ]] || die "Set STAGING_PDS_HOST (e.g. http://127.0.0.1:2583)"
[[ -n "$HANDLE" ]] || die "Set STAGING_HANDLE"
[[ -n "$EMAIL" ]] || die "Set STAGING_EMAIL"
[[ -n "$INVITE" ]] || die "Set STAGING_INVITE_CODE from PDS admin"

if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 24)"
  echo "Generated password (save this):"
fi

BASE="${PDS_HOST%/}"
URI="${BASE}/xrpc/com.atproto.server.createAccount"

BODY=$(jq -n \
  --arg email "$EMAIL" \
  --arg handle "$HANDLE" \
  --arg password "$PASSWORD" \
  --arg inviteCode "$INVITE" \
  '{email: $email, handle: $handle, password: $password, inviteCode: $inviteCode}')

echo "Creating account on $URI ..."

RESPONSE=$(curl -fsS -X POST "$URI" \
  -H "Content-Type: application/json" \
  -d "$BODY") || die "createAccount request failed"

DID=$(echo "$RESPONSE" | jq -r '.did')
OUT_HANDLE=$(echo "$RESPONSE" | jq -r '.handle')

echo ""
echo "=== Staging test account created ==="
echo "DID:      $DID"
echo "Handle:   $OUT_HANDLE"
echo "Password: $PASSWORD"
echo ""
echo "Flip manual login:"
echo "  1. Dev build -> Sign in -> Use app password instead"
echo "  2. Handle: $OUT_HANDLE"
echo "  3. App password: (password above)"
echo "  4. Server: $PDS_HOST (use full URL with http:// for local indigo)"
echo ""
echo "Phase 0: photo posts only. Video requires video.bsky.app (not for staging DIDs)."
