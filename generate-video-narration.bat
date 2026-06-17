@echo off
setlocal
cd /d "%~dp0.."
if not defined GEMINI_API_KEY (
  echo Set GEMINI_API_KEY before running this script.
  exit /b 1
)
py -3 tools\generate_video_narration.py %*
endlocal
