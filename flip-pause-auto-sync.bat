@echo off
REM Stop the Flip auto-sync watcher (stops reload loop when agents keep pushing).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lock = Join-Path (Get-Location) 'logs\auto-sync.lock';" ^
  "if (-not (Test-Path $lock)) { Write-Host 'Flip auto-sync is not running (no lock file).'; exit 0 };" ^
  "$pidText = (Get-Content $lock -Raw).Trim();" ^
  "if ($pidText -match '^\d+$') { Stop-Process -Id ([int]$pidText) -Force -ErrorAction SilentlyContinue; Write-Host \"Stopped auto-sync PID $pidText.\" } else { Write-Host 'Invalid lock file.' };" ^
  "Remove-Item $lock -Force -ErrorAction SilentlyContinue;" ^
  "Write-Host 'Restart later: flip-keep-sync.bat or flip-dev.bat'"
exit /b 0
