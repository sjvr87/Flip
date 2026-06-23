@echo off
title Flip Metro
cd /d "%~dp0\.."
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo.
  pause
  exit /b 1
)
set CI=
set EXPO_NO_INTERACTIVE=
set EXPO_NO_TELEMETRY=1
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
echo Metro: LAN bind (0.0.0.0) + packager hostname 127.0.0.1 for USB adb reverse
call npx expo start --dev-client --lan --port 8081
if errorlevel 1 pause
