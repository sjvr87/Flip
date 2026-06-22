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
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-lan-ip.ps1" -Quiet 2^>nul`) do set REACT_NATIVE_PACKAGER_HOSTNAME=%%i
if defined REACT_NATIVE_PACKAGER_HOSTNAME (
  echo Metro hostname: %REACT_NATIVE_PACKAGER_HOSTNAME% ^(LAN^)
) else (
  echo WARN: No LAN IP found - phone may not reach Metro. Connect PC to Wi-Fi.
)
call npm.cmd run start:clear
if errorlevel 1 pause
