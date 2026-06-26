@echo off
title Flip auto-sync
REM Usually started by flip-dev / flip-live. Leave running for automatic phone updates.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root — C:\Users\tomas\Documents\Flip
  pause
  exit /b 1
)
echo.
echo Starting Flip auto-sync (fix branch)...
echo Window must stay open. Log: logs\auto-sync.log
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-auto-sync.ps1"
echo.
echo Auto-sync stopped.
pause
exit /b %ERRORLEVEL%
