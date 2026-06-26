@echo off
REM Full native rebuild + Expo dev client (tunnel): adb, run:android, then Metro.
cd /d "%~dp0\.."
adb devices
adb reverse tcp:8081 tcp:8081
npx expo run:android
npx expo start --dev-client --tunnel
