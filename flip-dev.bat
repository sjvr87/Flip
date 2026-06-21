@echo off
cd /d "C:\Users\tomas\Documents\Flip"
npm.cmd run dev:connect -- -RestartMetro
if errorlevel 1 pause
