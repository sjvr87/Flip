@echo off
title Flip sync now
REM One shot: fix branch + pull + reload phone (same reload path as flip-reload.bat)
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo.
echo == Flip sync now ==
call flip-pull-fix-branch.bat
if errorlevel 1 (
  echo.
  echo Sync failed — see above.
  pause
  exit /b 1
)
echo.
echo Done. Check phone — commit above should match what you see after reload.
pause
exit /b 0
