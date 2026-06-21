@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\GitScripts\save-to-github.ps1" %*
