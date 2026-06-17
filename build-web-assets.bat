@echo off
cd /d "%~dp0"
py -3 scripts\build_web_assets.py %*
