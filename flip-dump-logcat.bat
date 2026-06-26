@echo off
REM Dump filtered logcat from USB device to logs\flip-logcat-*.txt (share with agent).
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo ERROR: adb not found at %ADB%
  pause
  exit /b 1
)

set "SERIAL=%FLIP_ADB_DEVICE%"
if "%SERIAL%"=="" set "SERIAL=R5CXC20L8ZN"

for /f "tokens=1,2" %%a in ('"%ADB%" devices ^| findstr /r "device$"') do (
  if "%%b"=="device" set "SERIAL=%%a"
)

if not exist "logs" mkdir logs
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%t"
set "OUT=logs\flip-logcat-%STAMP%.txt"

echo Writing last 4000 lines from %SERIAL% to %OUT%
echo Filters: ReactNativeJS, AndroidRuntime, Expo, Hermes, flip
echo.

"%ADB%" -s %SERIAL% logcat -d -v time ReactNativeJS:V ReactNative:V ExpoModules:V Hermes:V flip:V Flip:V social.flip.app:V AndroidRuntime:E *:S > "%OUT%" 2>&1

echo Done. Open %OUT% or paste the tail into Cursor chat.
echo Search for: Unable to resolve, 500, FATAL, TypeError
powershell -NoProfile -Command "Get-Content -Path '%OUT%' -Tail 80"
pause
