@echo off
REM One-command Expo dev client (tunnel): adb check + reverse + Metro.
cd /d "%~dp0\.."
adb devices
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --tunnel
