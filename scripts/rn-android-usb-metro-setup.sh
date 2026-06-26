#!/usr/bin/env bash
# Flip Android USB + Metro setup (Expo dev-client).
# Bash equivalent of rn-android-usb-metro-setup.ps1 — Git Bash / WSL / macOS / Linux.
#
# Usage:
#   ./scripts/rn-android-usb-metro-setup.sh
#   METRO_PORT=8082 ./scripts/rn-android-usb-metro-setup.sh
#   SKIP_BUILD=1 ./scripts/rn-android-usb-metro-setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

METRO_PORT="${METRO_PORT:-8081}"
MULTIVERSE_PORT=8788
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

resolve_adb() {
  if [[ -n "${ADB:-}" ]]; then
    echo "$ADB"
    return
  fi
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -z "$sdk" && -n "${LOCALAPPDATA:-}" ]]; then
    sdk="$LOCALAPPDATA/Android/Sdk"
  fi
  if [[ -n "$sdk" && -x "$sdk/platform-tools/adb" ]]; then
    echo "$sdk/platform-tools/adb"
  elif [[ -n "$sdk" && -f "$sdk/platform-tools/adb.exe" ]]; then
    echo "$sdk/platform-tools/adb.exe"
  else
    echo "adb"
  fi
}

ADB="$(resolve_adb)"

echo "== Flip rn-android-usb-metro-setup (Metro port $METRO_PORT) =="

metro_healthy() {
  local port="$1"
  curl -sf --max-time 3 "http://127.0.0.1:${port}/status" 2>/dev/null | grep -q running
}

port_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":${port} "
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an 2>/dev/null | grep -q ":${port}.*LISTEN"
  else
    return 1
  fi
}

write_usb_checklist() {
  local reason="$1"
  echo ""
  echo "============================================================"
  echo "  PHONE NOT READY FOR USB DEV - $reason"
  echo "============================================================"
  echo ""
  echo "Checklist:"
  echo "  1. Use a data USB cable (not charge-only)"
  echo "  2. Settings -> Developer options -> USB debugging ON"
  echo "  3. When plugged in, tap Allow on the USB debugging RSA prompt"
  echo "  4. USB mode: File transfer / MTP (not Charging only)"
  echo "  5. Run: adb devices   (should show <serial>    device)"
  echo "  6. Re-run: ./scripts/rn-android-usb-metro-setup.sh"
  echo ""
}

adb_reverse_port() {
  local serial="$1"
  local port="$2"
  "$ADB" -s "$serial" reverse --remove "tcp:${port}" 2>/dev/null || true
  "$ADB" -s "$serial" reverse "tcp:${port}" "tcp:${port}" || true
  if ! "$ADB" -s "$serial" reverse --list 2>/dev/null | grep -q "tcp:${port}"; then
    echo "  $serial : tcp:${port} reverse missing - reconnecting adb..."
    "$ADB" -s "$serial" reconnect 2>/dev/null || true
    sleep 1
    "$ADB" -s "$serial" reverse --remove "tcp:${port}" 2>/dev/null || true
    "$ADB" -s "$serial" reverse "tcp:${port}" "tcp:${port}" || true
  fi
  if "$ADB" -s "$serial" reverse --list 2>/dev/null | grep -q "tcp:${port}"; then
    echo "  $serial : reverse tcp:${port} OK"
    return 0
  fi
  echo "  $serial : reverse tcp:${port} FAILED"
  return 1
}

start_metro_background() {
  local port="$1"
  local lan_ip=""
  if [[ -f "$ROOT/scripts/get-lan-ip.ps1" ]] && command -v powershell >/dev/null 2>&1; then
    lan_ip="$(powershell -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/get-lan-ip.ps1" -Quiet 2>/dev/null | head -n1 || true)"
  fi

  export CI=""
  export EXPO_NO_TELEMETRY=1
  export EXPO_PUBLIC_USE_RN_FETCH=1
  if [[ -n "$lan_ip" ]]; then
    export REACT_NATIVE_PACKAGER_HOSTNAME="$lan_ip"
    echo "  Metro hostname: $lan_ip (LAN)"
  fi

  echo "  Starting Metro on port $port (--clear) in background..."
  if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]]; then
    # Git Bash on Windows: new cmd window
    cmd.exe //c "start \"Flip Metro $port\" cmd /k \"cd /d $ROOT && npx expo start --dev-client --lan --port $port --clear\""
  else
    nohup npx expo start --dev-client --lan --port "$port" --clear >"$ROOT/.flip-metro-${port}.log" 2>&1 &
    echo "  Metro log: $ROOT/.flip-metro-${port}.log (PID $!)"
  fi
}

wait_metro_healthy() {
  local port="$1"
  local deadline=$((SECONDS + 120))
  while (( SECONDS < deadline )); do
    if metro_healthy "$port"; then
      return 0
    fi
    sleep 1
  done
  metro_healthy "$port"
}

ensure_metro() {
  local port="$1"
  if metro_healthy "$port"; then
    echo "  Metro already healthy on port $port (packager-status:running) - reusing."
    return 0
  fi
  if port_listening "$port"; then
    echo "  Port $port in use but Metro /status unhealthy - starting new Metro anyway."
  fi
  start_metro_background "$port"
  if wait_metro_healthy "$port"; then
    echo "  Metro started OK on port $port."
    return 0
  fi
  echo "  Metro not responding on http://127.0.0.1:${port}/status"
  return 1
}

# [1] Restart adb
echo "[1/6] Restarting adb..."
"$ADB" kill-server 2>/dev/null || true
sleep 0.4
"$ADB" start-server

# [2] Check devices
echo "[2/6] adb devices"
devices_out="$("$ADB" devices)"
echo "$devices_out"

serials=()
unauthorized=()
offline=()
while IFS= read -r line; do
  if [[ "$line" =~ ^[[:space:]]*([^[:space:]]+)[[:space:]]+device[[:space:]]*$ ]]; then
    serials+=("${BASH_REMATCH[1]}")
  elif [[ "$line" =~ ^[[:space:]]*([^[:space:]]+)[[:space:]]+unauthorized[[:space:]]*$ ]]; then
    unauthorized+=("${BASH_REMATCH[1]}")
  elif [[ "$line" =~ ^[[:space:]]*([^[:space:]]+)[[:space:]]+offline[[:space:]]*$ ]]; then
    offline+=("${BASH_REMATCH[1]}")
  fi
done <<< "$devices_out"

if [[ -n "${FLIP_ADB_DEVICE:-}" ]]; then
  filtered=()
  for s in "${serials[@]}"; do
    if [[ "$s" == "$FLIP_ADB_DEVICE" ]]; then
      filtered+=("$s")
    fi
  done
  if [[ ${#filtered[@]} -gt 0 ]]; then
    serials=("${filtered[@]}")
    echo "  Using FLIP_ADB_DEVICE=$FLIP_ADB_DEVICE"
  fi
elif [[ ${#serials[@]} -eq 1 ]]; then
  echo "  Auto-selected device ${serials[0]} (set FLIP_ADB_DEVICE to pin)"
fi

if [[ ${#unauthorized[@]} -gt 0 ]]; then
  write_usb_checklist "adb shows unauthorized (${unauthorized[*]})"
  exit 1
elif [[ ${#offline[@]} -gt 0 ]]; then
  write_usb_checklist "adb shows offline (${offline[*]})"
  exit 1
elif [[ ${#serials[@]} -eq 0 ]]; then
  write_usb_checklist "no device listed"
  exit 1
fi

# [3] adb reverse
echo "[3/6] adb reverse tcp:${METRO_PORT} + tcp:${MULTIVERSE_PORT}"
reverse_metro_ok=0
reverse_multiverse_ok=0
for serial in "${serials[@]}"; do
  "$ADB" -s "$serial" wait-for-device
  "$ADB" -s "$serial" shell input keyevent KEYCODE_WAKEUP 2>/dev/null || true
  adb_reverse_port "$serial" "$METRO_PORT" && reverse_metro_ok=1 || true
  adb_reverse_port "$serial" "$MULTIVERSE_PORT" && reverse_multiverse_ok=1 || true
done

# [4] npm install
if [[ "$SKIP_INSTALL" != "1" ]]; then
  echo "[4/6] npm install (if needed)"
  if [[ ! -d node_modules ]]; then
    echo "  node_modules missing - running npm install..."
    npm install
  else
    echo "  node_modules present - skipping npm install"
  fi
else
  echo "[4/6] npm install - skipped"
fi

# [5] Metro
echo "[5/6] Metro on port $METRO_PORT"
metro_ok=0
ensure_metro "$METRO_PORT" && metro_ok=1 || true

# [6] Android build
build_ok=0
if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "[6/6] npm run android:dev (Gradle assembleDebug + adb install)"
  if npm run android:dev; then
    build_ok=1
  fi
else
  echo "[6/6] android:dev - skipped"
  build_ok=1
fi

echo ""
echo "=== Status ==="
echo "Device(s): ${serials[*]}"
echo "adb reverse tcp:${METRO_PORT}: $([[ $reverse_metro_ok -eq 1 ]] && echo OK || echo FAILED)"
echo "adb reverse tcp:${MULTIVERSE_PORT}: $([[ $reverse_multiverse_ok -eq 1 ]] && echo OK || echo FAILED)"
echo "Metro /status (port ${METRO_PORT}): $([[ $metro_ok -eq 1 ]] && echo running || echo NOT running)"
if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "android:dev build: $([[ $build_ok -eq 1 ]] && echo OK || echo FAILED)"
fi
echo ""
echo "Tip: Flip daily dev uses port 8081 (flip-dev.bat). Use METRO_PORT=8082 only for a second Metro."

[[ $metro_ok -eq 1 ]] || exit 3
if [[ "$SKIP_BUILD" != "1" && $build_ok -ne 1 ]]; then
  exit 4
fi
exit 0
