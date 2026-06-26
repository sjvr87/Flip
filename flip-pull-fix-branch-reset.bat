@echo off
REM Fix branch + clean Metro + launch (use when reload alone still looks stale).
REM NOT main — fixes live on cursor/fix-s25-feed-tabs-regression-56a3 until PR #64 merges.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo == Sync fix branch (NOT main until PR #64 merges) ==
git fetch origin
git checkout cursor/fix-s25-feed-tabs-regression-56a3
if errorlevel 1 goto fail
echo.
echo Latest commit (flip-reset-dev will pull again):
git log -1 --oneline
echo.
echo == Reset: pull + kill Metro + clear cache + launch (fresh LAN URL) ==
call flip-reset-dev.bat
exit /b %ERRORLEVEL%

:fail
echo Sync failed. See errors above.
pause
exit /b 1
