@echo off
setlocal
cd /d "%~dp0"
echo Processing high-speed lightning videos (originals are not modified)...
py -3 scripts\speedup_quiet_hsv.py --all %*
echo.
echo Output folder: videos\highspeedvideos\processed\
endlocal
