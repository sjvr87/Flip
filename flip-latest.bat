@echo off
REM One double-click: get latest fix branch on phone (checkout + pull + reload).
REM If app still broken: flip-pull-fix-branch-reset.bat
cd /d "%~dp0"
call flip-pull-fix-branch.bat
exit /b %ERRORLEVEL%
