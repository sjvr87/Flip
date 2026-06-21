@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\GitScripts\sync-from-github.ps1" %*
