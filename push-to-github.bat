@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set REPO=https://github.com/lightninguniten/rtl3d-web.git

where git >nul 2>&1
if errorlevel 1 (
  echo Git is not installed or not on PATH.
  echo Install from https://git-scm.com/download/win then run this script again.
  pause
  exit /b 1
)

echo Pushing RTL3D web to %REPO%
echo.

if not exist .git (
  git init
  git branch -M main
)

git remote remove origin 2>nul
git remote add origin %REPO%

git add .
git status
echo.

set GIT_NAME=
set GIT_EMAIL=
for /f "delims=" %%i in ('git config user.name 2^>nul') do set GIT_NAME=%%i
for /f "delims=" %%i in ('git config user.email 2^>nul') do set GIT_EMAIL=%%i

if not defined GIT_NAME (
  echo Git needs your name and email for the commit (stored only for this commit, not global config).
  set /p GIT_NAME=Your name (e.g. Nabil Ahmad):
  set /p GIT_EMAIL=Your email (e.g. you@uniten.edu.my):
)

if not defined GIT_NAME (
  echo Name is required.
  pause
  exit /b 1
)
if not defined GIT_EMAIL (
  echo Email is required.
  pause
  exit /b 1
)

set /p CONFIRM=Commit and push to GitHub? [Y/N]:
if /I not "%CONFIRM%"=="Y" (
  echo Cancelled.
  pause
  exit /b 0
)

git -c user.name="%GIT_NAME%" -c user.email="%GIT_EMAIL%" commit -m "Initial commit: RTL3D interactive web"
if errorlevel 1 (
  git -c user.name="%GIT_NAME%" -c user.email="%GIT_EMAIL%" commit -m "Update RTL3D interactive web"
  if errorlevel 1 (
    echo.
    echo Commit failed. If nothing changed, check: git status
    pause
    exit /b 1
  )
)

git push -u origin main
if errorlevel 1 (
  echo.
  echo Push failed. Common fixes:
  echo   - Sign in to GitHub when the browser opens
  echo   - Or use a Personal Access Token as password: https://github.com/settings/tokens
  echo   - Then run: git push -u origin main
  pause
  exit /b 1
)

echo.
echo Done. Next steps on GitHub:
echo   1. Open https://github.com/lightninguniten/rtl3d-web/settings/pages
echo   2. Source: GitHub Actions
echo   3. Wait ~2 min, then open:
echo      https://lightninguniten.github.io/rtl3d-web/
echo.
pause
