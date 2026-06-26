@echo off
title Flip KEEP SYNC
REM Start or confirm auto-sync watcher (pull + reload every ~5s when agents push).
REM Run once per PC session after flip-open.bat or flip-live.bat.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from C:\Users\tomas\Documents\Flip
  pause
  exit /b 1
)
echo.
echo ============================================================
echo   FLIP KEEP SYNC - phone updates when agents push to GitHub
echo   - Watches fix branch every ~5 seconds
echo   - git pull + reload on your phone (USB or Wi-Fi + Flip open)
echo   - Leave PC awake; Metro must be running (flip-open.bat)
echo   Log: logs\auto-sync.log
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-fix-branch.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-flip-auto-sync.ps1"
echo.
echo If a minimized "Flip auto-sync" window is on the taskbar, you are set.
echo To verify: open logs\auto-sync.log (should show "Watching" lines).
echo.
pause
exit /b 0
