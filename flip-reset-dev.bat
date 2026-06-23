@echo off
REM Nuclear dev reset: kill Metro on 8081, clear cache, adb reverse, launch USB/LAN deep link (127.0.0.1 when adb reverse OK).
REM Use when app won't connect, crashes on launch, or dev launcher shows broken servers.
REM Deep link bypasses the expo-dev-client picker entirely.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1" -Reset
if errorlevel 1 (
  echo.
  echo Reset failed. See errors above.
  pause
  exit /b 1
)
exit 0
