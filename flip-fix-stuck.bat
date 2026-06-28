@echo off
REM When Flip stays on "Reloading" and feed never loads:
REM 1) stop auto-sync reload loop  2) pull fix branch  3) full Metro reset + launch
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo.
echo == Flip fix stuck ==
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
