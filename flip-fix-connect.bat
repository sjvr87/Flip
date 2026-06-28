@echo off
REM "Connecting to development server" / 99%% bundle stall — USB reconnect without full cache clear.
REM Plug phone in USB (data cable), USB debugging ON, tap Allow.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo.
echo == Flip fix connect ==
echo Stops auto-sync, then adb reverse + Metro + exp://127.0.0.1:8081 launch.
echo Do NOT reopen Flip from the app icon — let this script launch it.
echo.
call flip-pause-auto-sync.bat
echo.
call flip-reconnect.bat
exit /b %ERRORLEVEL%
