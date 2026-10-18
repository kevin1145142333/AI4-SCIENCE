@echo off
rem AI4 Science - Web UI launcher (background, survives closing VS Code)
rem ASCII only: this file must never depend on the console code page.
setlocal EnableExtensions
cd /d "%~dp0"

set "PY=%~dp0venv\Scripts\python.exe"
set "HELPER=%~dp0scripts\web_helper.ps1"
set "PORT=8501"

if not exist "%~dp0main.py" (
    echo [ERROR] main.py was not found next to this script.
    pause
    exit /b 1
)

if not exist "%PY%" (
    echo [ERROR] Virtual environment interpreter not found:
    echo         %PY%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -Action status -Port %PORT% -Path "/ui/api/system"
set "RC=%errorlevel%"

if "%RC%"=="0" (
    echo [AI4 Science] Service is already running - opening http://localhost:%PORT%
    start "" "http://localhost:%PORT%"
    exit /b 0
)

if "%RC%"=="2" (
    echo [ERROR] Port %PORT% is occupied by another program.
    pause
    exit /b 1
)

echo [AI4 Science] Starting web service in the background (port %PORT%) ...
start "AI4 Science Web" /min "%PY%" main.py --mode web

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -Action waitready -Port %PORT% -Path "/ui/api/system" -TimeoutSeconds 150
set "RC=%errorlevel%"

if "%RC%"=="0" (
    echo [AI4 Science] Ready: http://localhost:%PORT%
    start "" "http://localhost:%PORT%"
    echo [AI4 Science] The service keeps running after you close this window.
    echo [AI4 Science] To stop it later, run stop_web.bat
    ping -n 6 127.0.0.1 >nul
    exit /b 0
)

echo [ERROR] The service did not become ready in time.
echo [HINT]  Run start_web.bat instead to see the live error output.
pause
exit /b 1
