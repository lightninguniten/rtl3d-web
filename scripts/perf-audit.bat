@echo off
setlocal EnableDelayedExpansion
REM RTL3D performance baseline — Lighthouse on key routes.
REM Requires: Node.js, Chrome/Chromium (used by Lighthouse).
REM Run start-server.bat first.

cd /d "%~dp0.."
set OUT=logs\performance
if not exist "%OUT%" mkdir "%OUT%"

echo RTL3D performance audit
echo Output: %OUT%\
echo.

call :run home           http://127.0.0.1:8765/
call :run our-mission    http://127.0.0.1:8765/our-mission/
call :run tnb-power      http://127.0.0.1:8765/tnb-power/
call :run did-met-alert  http://127.0.0.1:8765/did-met-alert/
call :run lf             http://127.0.0.1:8765/lf/
call :run vhf            http://127.0.0.1:8765/vhf/

echo.
echo Parsing metrics summary...
py -3 scripts\parse_perf_metrics.py
if errorlevel 1 (
  echo Warning: metrics summary parse failed.
)

echo.
echo Done. See %OUT%\PERFORMANCE-REVIEW-*.md, lighthouse-*.json, metrics-summary.json
exit /b 0

:run
echo === Lighthouse: %~1 ===
call npx --yes lighthouse "%~2" --quiet ^
  --chrome-flags="--headless --no-sandbox --disable-gpu" ^
  --only-categories=performance ^
  --output=json ^
  --output-path="%OUT%\lighthouse-%~1.json"
exit /b 0
