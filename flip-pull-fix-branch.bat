@echo off
REM One-shot: checkout fix branch, pull latest, reload JS on phone (Metro must be up).
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo == Checkout cursor/fix-s25-feed-tabs-regression-56a3 ==
git fetch origin
git checkout cursor/fix-s25-feed-tabs-regression-56a3
if errorlevel 1 (
  echo checkout failed
  pause
  exit /b 1
)
git pull origin cursor/fix-s25-feed-tabs-regression-56a3
if errorlevel 1 (
  echo pull failed
  pause
  exit /b 1
)
echo.
echo Latest commit:
git log -1 --oneline
echo.
call flip-reload.bat
exit /b %ERRORLEVEL%
