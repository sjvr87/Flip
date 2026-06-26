@echo off
REM Show USB phones + how to pin one for adb (S25/S26 Ultra etc.)
cd /d "%~dp0"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo adb not found. Install Android SDK platform-tools.
  pause
  exit /b 1
)
echo == adb devices ==
"%ADB%" devices -l
echo.
if exist ".flip-adb-device" (
  echo Saved in repo: 
  type .flip-adb-device
  echo.
)
if not "%FLIP_ADB_DEVICE%"=="" (
  echo FLIP_ADB_DEVICE=%FLIP_ADB_DEVICE%
  echo.
)
echo To pin your phone, copy its serial from above, then:
echo   setx FLIP_ADB_DEVICE "YOUR_SERIAL_HERE"
echo Or just plug in one phone — flip-dev auto-detects it.
pause
