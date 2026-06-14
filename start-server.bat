@echo off
cd /d "%~dp0"

netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Server already running at http://127.0.0.1:8765/
  echo Close the existing server window or stop the Python process before starting another.
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

echo Starting RTL3D web server at http://127.0.0.1:8765/
echo Press Ctrl+C to stop.
start "" "http://127.0.0.1:8765/"
py -m http.server 8765 --bind 127.0.0.1
