@echo off
cd /d "%~dp0"

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  REM Port is occupied — health-check before trusting it
  py -3 -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8765/',timeout=2); sys.exit(0)" >nul 2>&1
  if not errorlevel 1 (
    echo Server already running at http://127.0.0.1:8765/
    start "" "http://127.0.0.1:8765/"
    exit /b 0
  )
  REM Health probe failed (zombie / wrong process) — kill and restart
  echo Stale server on port 8765 detected -- restarting...
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
  )
  timeout /t 1 /nobreak >nul
)

echo Starting RTL3D web server at http://127.0.0.1:8765/
echo Press Ctrl+C to stop.
start "" "http://127.0.0.1:8765/"
py -3 -m http.server 8765 --bind 127.0.0.1
