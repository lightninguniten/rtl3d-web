@echo off
cd /d "%~dp0"
echo Downloading OSM aviation and maritime routes for offline map cache...
py -3 scripts\build_osm_aviation_data.py
if errorlevel 1 (
  echo.
  echo Failed. Check network connection and try again.
  pause
  exit /b 1
)
echo.
echo Done. Cached files:
echo   data\osm\aviation-layers-core.json   (routes + airports — fast load)
echo   data\osm\aviation-layers-detail.json (runways — background load)
echo   data\osm\aviation-infrastructure.json (raw archive)
echo Refresh the Public Safety page to use the cache.
pause
