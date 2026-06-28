@echo off
REM One double-click: get latest fix branch on phone (checkout + pull + reload).
cd /d "%~dp0"
call flip-sync-now.bat
