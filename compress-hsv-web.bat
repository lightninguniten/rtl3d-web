@echo off
setlocal
cd /d "%~dp0"

set "FFMPEG=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
if not exist "%FFMPEG%" (
  where ffmpeg >nul 2>&1 || (
    echo ffmpeg not found. Install with: winget install Gyan.FFmpeg
    exit /b 1
  )
  set "FFMPEG=ffmpeg"
)

set "IN_DIR=videos\highspeedvideos"
set "OUT_DIR=%IN_DIR%\web"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo Compressing high-speed videos for web (originals unchanged)...
echo Output: %OUT_DIR%\
echo.

for %%F in (
  "Y20260515H152823_CINE1_427_CC_2RL.mp4"
  "Y202606 6H065544_CINE24_447_cloudactivity.mp4"
  "Y20260612H184527_CINE4_450_NCGDL.mp4"
  "Y20260612H184902_CINE7_451_NCGDL.mp4"
  "Y20260612H185048_CINE9_453_NCGDL.mp4"
) do (
  echo Encoding %%~F
  "%FFMPEG%" -hide_banner -y -i "%IN_DIR%\%%~F" -an ^
    -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart ^
    "%OUT_DIR%\%%~F"
  if errorlevel 1 exit /b 1
)

echo.
echo Re-encoding longer clips with bitrate cap...
for %%F in (
  "Y202606 6H065544_CINE24_447_cloudactivity.mp4"
  "Y20260612H184902_CINE7_451_NCGDL.mp4"
  "Y20260612H185048_CINE9_453_NCGDL.mp4"
) do (
  echo Capping %%~F
  "%FFMPEG%" -hide_banner -y -i "%IN_DIR%\%%~F" -an ^
    -c:v libx264 -preset slow -crf 24 -maxrate 2000k -bufsize 4000k ^
    -pix_fmt yuv420p -movflags +faststart ^
    "%OUT_DIR%\%%~F"
  if errorlevel 1 exit /b 1
)

echo.
echo Done.
endlocal
