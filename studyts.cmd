@echo off
setlocal
cd /d "%~dp0"

if "%1"=="" goto default_run
if "%1"=="run" goto default_run
if "%1"=="dev" goto default_run
if "%1"=="app" goto run_app
if "%1"=="qa" goto run_qa
if "%1"=="test" goto run_qa
if "%1"=="edge" goto run_edge

npm --silent run %*
goto end

:default_run
node start.cjs
goto end

:run_app
node scripts/browser_qa/run.js --app
goto end

:run_edge
node scripts/browser_qa/run.js --open --browser msedge
goto end

:run_qa
node scripts/browser_qa/run.js
goto end

:end
exit /b %errorlevel%
