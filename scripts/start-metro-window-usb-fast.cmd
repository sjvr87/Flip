@echo off
title Flip Metro
cd /d "%~dp0\.."
set CI=
set EXPO_NO_INTERACTIVE=
set EXPO_NO_TELEMETRY=1
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
echo Metro: LAN bind + hostname 127.0.0.1 for USB adb reverse
call npx expo start --dev-client --lan --port 8081
if errorlevel 1 pause
