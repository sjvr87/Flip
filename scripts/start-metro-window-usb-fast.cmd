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
set REACT_NATIVE_PACKAGER_HOSTNAME=
echo Metro hostname: 127.0.0.1 (USB adb reverse)
call npm.cmd run start:localhost
if errorlevel 1 pause
