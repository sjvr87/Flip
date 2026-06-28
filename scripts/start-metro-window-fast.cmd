@echo off
title Flip Metro
cd /d "%~dp0\.."
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo.
  pause
  exit /b 1
)
set CI=
set EXPO_NO_TELEMETRY=1
set EXPO_PUBLIC_USE_RN_FETCH=1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-metro-healthy.ps1" >nul 2>&1
if not errorlevel 1 (
  echo Metro already running on port 8081 - reusing existing bundler.
  echo Close the "Flip Metro" taskbar window first if you need a fresh start, or run flip-kill-metro.bat
  exit /b 0
)
call "%~dp0kill-metro-port-8081.cmd"
if defined FLIP_DEV_HOSTNAME (
  set REACT_NATIVE_PACKAGER_HOSTNAME=%FLIP_DEV_HOSTNAME%
  echo Metro hostname: %REACT_NATIVE_PACKAGER_HOSTNAME% ^(from dev-connect^)
) else (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0get-lan-ip.ps1" -Quiet 2^>nul`) do set REACT_NATIVE_PACKAGER_HOSTNAME=%%i
  if defined REACT_NATIVE_PACKAGER_HOSTNAME (
    echo Metro hostname: %REACT_NATIVE_PACKAGER_HOSTNAME% ^(LAN^)
  ) else (
    echo WARN: No LAN IP - use USB + adb reverse ^(flip-reconnect.bat^) or connect PC to Wi-Fi.
  )
)
call npm.cmd run start
if errorlevel 1 pause
