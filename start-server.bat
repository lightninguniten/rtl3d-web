@echo off
cd /d "%~dp0"
echo Starting RTL3D web server at http://127.0.0.1:8765/
echo Press Ctrl+C to stop.
start "" "http://127.0.0.1:8765/"
py -m http.server 8765 --bind 127.0.0.1
