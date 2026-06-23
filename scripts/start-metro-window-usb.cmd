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
echo Metro hostname: %REACT_NATIVE_PACKAGER_HOSTNAME% (USB adb reverse, clear cache)
call npx expo start --dev-client --port 8081 --localhost --clear
if errorlevel 1 pause
