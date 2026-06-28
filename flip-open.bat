@echo off
title OPEN FLIP
REM Double-click this — pulls fix branch, connects USB, launches Flip, starts auto-sync.
cd /d "%~dp0"
if not exist "package.json" (
  echo.
  echo ERROR: package.json not found in:
  echo   %~dp0
  echo.
  echo Double-click flip-open.bat from C:\Users\tomas\Documents\Flip
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\flip-open.ps1"
if errorlevel 1 (
  echo.
  echo OPEN FLIP failed — see errors above.
  echo Plug phone USB + USB debugging ON, then run flip-open.bat again.
  pause
  exit /b 1
)
pause
exit /b 0
