@echo off
REM After plugging phone in USB: connect adb + launch Flip (Metro must be up).
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: Run from Flip repo root.
  pause
  exit /b 1
)
echo.
echo == Flip USB connect ==
echo Plug phone in with a DATA cable. USB debugging ON. Tap Allow on phone.
echo.
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if exist "%ADB%" (
  "%ADB%" devices -l
  echo.
)
call flip-connect.bat
if errorlevel 1 (
  echo.
  echo Still no device? flip-adb-devices.bat
  pause
  exit /b 1
)
echo.
echo Connected. flip-live auto-sync will reload when agents push.
pause
exit /b 0
