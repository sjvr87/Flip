@echo off
title Flip LIVE
REM Run ONCE — phone updates by itself when agents push (USB + Metro + auto-sync).
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from C:\Users\tomas\Documents\Flip
  pause
  exit /b 1
)
echo.
echo ============================================================
echo   FLIP LIVE - app updates on your phone automatically
echo   - USB: plug in phone for best auto-reload (or same Wi-Fi + Flip open)
echo   - Leave this PC awake; Metro stays running
echo   - Agents push to GitHub -^> auto-sync pulls + reloads (~5s)
echo   Log: logs\auto-sync.log
echo ============================================================
echo.
call "%~dp0flip-dev.bat"
exit /b %ERRORLEVEL%
