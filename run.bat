@echo off
setlocal enabledelayedexpansion
title StudyTs
cd /d "%~dp0"

echo WARNING: THIS PROJECT STILL IN DEV
echo.

reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>nul

:: Check and install Node.js 22.12+ if missing
call :find_node
call :node_ok
if %errorlevel% neq 0 (
  where winget >nul 2>nul
  if !errorlevel! equ 0 (
    echo Installing Node.js LTS via winget...
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    call :find_node
  )
)
call :node_ok
if %errorlevel% neq 0 (
  echo Node.js 22.12 or newer is required. Install from https://nodejs.org
  pause
  exit /b 1
)

:: Ensure .env exists with required Prisma database URL
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
  ) else (
    echo DATABASE_URL="file:./studyts.db" > ".env"
  )
)

:: Start application
node start.cjs

if %errorlevel% neq 0 (
  echo.
  echo StudyTS exited with an error - see above.
  pause
)
exit /b %errorlevel%

:find_node
for %%P in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs" "%LocalAppData%\Programs\nodejs") do (
  if exist "%%~P\node.exe" set "PATH=%%~P;!PATH!"
)
exit /b 0

:node_ok
where node >nul 2>nul
if %errorlevel% neq 0 exit /b 1
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
exit /b %errorlevel%
