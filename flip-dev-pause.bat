@echo off
REM Same as flip-dev.bat but keeps this window open so you can read the log.
cd /d "%~dp0"
call "%~dp0flip-dev.bat"
echo.
pause
