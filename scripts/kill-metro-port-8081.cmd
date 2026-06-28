@echo off
REM Free Metro port 8081 before starting a new bundler (avoids EADDRINUSE).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-metro-port-8081.ps1"
exit /b %ERRORLEVEL%
