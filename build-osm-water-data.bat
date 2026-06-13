@echo off

cd /d "%~dp0"

echo Downloading OSM water infrastructure for offline map cache...

py -3 scripts\build_osm_water_data.py

if errorlevel 1 (

  echo.

  echo Failed. Check network connection and try again.

  pause

  exit /b 1

)

echo.

echo Done. Cached files: data\osm\water-layers.json (fast load) and water-infrastructure.json.
echo Refresh the DID ^& MET page — second load uses browser IndexedDB cache.

pause

