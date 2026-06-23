@echo off
REM Verify Node, adb, ANDROID_HOME, S26 Ultra, Metro 8081. Prints next steps.
cd /d "%~dp0"
if not exist "package.json" (
  echo ERROR: package.json not found. Run from Flip repo root.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-android-dev-env.ps1"
exit /b %errorlevel%
