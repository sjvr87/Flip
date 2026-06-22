@echo off
REM Nuclear dev reset: kill Metro on 8081, clear cache, adb reverse, launch LAN deep link.
REM Use when app won't connect, crashes on launch, or dev launcher shows broken servers.
REM Deep link bypasses the expo-dev-client picker entirely.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
call npm.cmd run dev:connect:reset
if errorlevel 1 (
  echo.
  echo Reset failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Done. Metro runs in a separate window titled "Flip Metro" on the taskbar.
echo       This window is the reset script only - you can close it.
exit /b 0
