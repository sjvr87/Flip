@echo off
REM adb reverse + wait for Metro. Does NOT force-stop or launch Flip (phone stays on current app).
REM Launch when ready: flip-connect.bat | JS reload while app runs: flip-reload.bat
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1" -NoLaunch
if errorlevel 1 (
  echo.
  echo Sync failed. See errors above.
  pause
  exit /b 1
)
exit 0
