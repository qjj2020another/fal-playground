@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$stopped = 0;" ^
  "$listeners = Get-NetTCPConnection -LocalPort 14726 -State Listen -ErrorAction SilentlyContinue;" ^
  "foreach ($listener in $listeners) {" ^
  "  $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess) -ErrorAction SilentlyContinue;" ^
  "  if ($process -and $process.Name -eq 'node.exe' -and [string]$process.CommandLine -match 'server\.mjs') {" ^
  "    Stop-Process -Id $process.ProcessId -Force;" ^
  "    $stopped++;" ^
  "  }" ^
  "}" ^
  "if ($stopped -gt 0) {" ^
  "  Write-Host 'FAL Workbench stopped.' -ForegroundColor Green;" ^
  "} else {" ^
  "  Write-Host 'FAL Workbench is not running.' -ForegroundColor Yellow;" ^
  "}"

pause
