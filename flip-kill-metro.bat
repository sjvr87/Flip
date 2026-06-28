@echo off
REM Free port 8081 when Metro shows EADDRINUSE (address already in use).
cd /d "%~dp0"
echo.
echo == Flip kill Metro on 8081 ==
echo Closes stale Flip Metro / node listeners so a fresh bundler can start.
echo.
call scripts\kill-metro-port-8081.cmd
echo.
echo Done. Start Metro again with flip-dev-restart.bat or flip-reset-dev.bat
pause
exit /b 0
