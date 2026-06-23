@echo off
REM adb prep + launch Flip with LAN deep link. Metro must already be healthy. No git pull, no Metro recycle.
REM After crash (also fixes stale Metro): flip-reconnect.bat
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1" -ConnectOnly
if errorlevel 1 (
  echo.
  echo Connect failed. See errors above.
  pause
  exit /b 1
)
exit 0
