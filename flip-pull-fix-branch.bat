@echo off
REM One-shot: checkout fix branch, pull latest, reload JS on phone (Metro must be up).
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-fix-branch.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo Latest commit:
git log -1 --oneline
echo.
echo NOTE: Fixes are on THIS branch, not main. Do not git checkout main until PR #64 merges.
echo.
echo == Reload JS on phone (Metro must already be healthy) ==
echo    If still stale after reload: run flip-pull-fix-branch-reset.bat instead.
call flip-reload.bat
exit /b %ERRORLEVEL%
