@echo off
cd /d "%~dp0"
echo Downloading OSM power infrastructure for offline map cache...
py -3 scripts\build_osm_power_data.py
if errorlevel 1 (
  echo.
  echo Failed. Check network connection and try again.
  pause
  exit /b 1
)
echo.
echo Done. Refresh the TNB page in your browser.
pause
