@echo off
REM Full dev connect: pull, adb reverse, reuse Metro if healthy (one window max).
REM After native deps change, rebuild once: npm run android:dev
REM Force Metro recycle: flip-dev-restart.bat
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
call npm.cmd run dev:connect
if errorlevel 1 (
  echo.
  echo Dev connect failed. See errors above.
  pause
  exit /b 1
)
echo.
echo Done. Metro runs in its own window if it was started - you can close this one.
exit /b 0
