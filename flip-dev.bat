@echo off
REM First connect / sync branch: git pull + adb + Metro + auto-sync watcher (minimized).
REM When nothing works: flip-reset-dev.bat
REM After crash (fast): flip-reconnect.bat
REM JS tweak while app runs: flip-reload.bat
REM Stuck Metro / native deps: flip-dev-restart.bat (rebuild native: npm run android:dev)
cd /d "%~dp0"
if not exist "package.json" (
  echo.
  echo ERROR: package.json not found in:
  echo   %~dp0
  echo.
  echo Double-click flip-dev.bat from the Flip repo folder, or run scripts\flip-dev.cmd with its full path.
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-connect.ps1"
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-flip-auto-sync.ps1"
exit /b 0
