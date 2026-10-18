@echo off
rem AI4 Science - CLI example:
rem   start_cli.bat --query "perovskite solar cell stability" --trl --hypotheses
rem ASCII only: this file must never depend on the console code page.
setlocal EnableExtensions
cd /d "%~dp0"

set "PY=%~dp0venv\Scripts\python.exe"

if not exist "%PY%" (
    echo [ERROR] Virtual environment interpreter not found:
    echo         %PY%
    echo [HINT]  Recreate it with: py -3 -m venv venv
    pause
    exit /b 1
)

if "%~1"=="" (
    echo [AI4 Science] No arguments given. Example:
    echo   start_cli.bat --query "perovskite solar cell stability" --trl --hypotheses
    echo.
)

"%PY%" main.py --mode cli %*
set "RC=%errorlevel%"

echo.
echo [AI4 Science] CLI finished. Exit code: %RC%
pause
endlocal
