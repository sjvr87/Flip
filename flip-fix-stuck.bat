@echo off
REM When Flip stays on "Reloading" / "Connecting to development server" and feed never loads:
REM 1) stop auto-sync reload loop  2) pull fix branch  3) full Metro reset + USB launch
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo.
echo == Flip fix stuck ==
echo Plug phone in USB (DATA cable). USB debugging ON. Tap Allow on phone.
echo.
call flip-pause-auto-sync.bat
echo.
echo Pulling fix branch...
git fetch origin cursor/fix-s25-feed-tabs-regression-56a3
git checkout cursor/fix-s25-feed-tabs-regression-56a3
git pull origin cursor/fix-s25-feed-tabs-regression-56a3
echo.
call flip-reset-dev.bat
exit /b %ERRORLEVEL%
