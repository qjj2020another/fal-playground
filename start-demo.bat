@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$healthUrl = 'http://127.0.0.1:14726/api/health';" ^
  "try {" ^
  "  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2;" ^
  "  if ($health.service -eq 'fal-playground-demo') {" ^
  "    Write-Host 'FAL Workbench is already running: http://127.0.0.1:14726' -ForegroundColor Yellow;" ^
  "    exit 0;" ^
  "  }" ^
  "} catch {}" ^
  "$process = Start-Process -FilePath 'node' -ArgumentList 'server.mjs' -WorkingDirectory '%~dp0' -WindowStyle Hidden -PassThru;" ^
  "$ready = $false;" ^
  "for ($attempt = 0; $attempt -lt 30; $attempt++) {" ^
  "  Start-Sleep -Milliseconds 100;" ^
  "  if ($process.HasExited) { break; }" ^
  "  try {" ^
  "    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1;" ^
  "    if ($health.service -eq 'fal-playground-demo') { $ready = $true; break; }" ^
  "  } catch {}" ^
  "}" ^
  "if ($ready) {" ^
  "  Write-Host 'FAL Workbench started: http://127.0.0.1:14726' -ForegroundColor Green;" ^
  "  exit 0;" ^
  "}" ^
  "if ($process.HasExited) {" ^
  "  Write-Host 'FAL Workbench failed to start.' -ForegroundColor Red;" ^
  "  exit 1;" ^
  "}" ^
  "Write-Host 'FAL Workbench is still starting: http://127.0.0.1:14726' -ForegroundColor Yellow;"

echo.
pause
