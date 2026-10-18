@echo off
rem AI4 Science - REST API launcher (http://localhost:8000/docs)
rem ASCII only: this file must never depend on the console code page.
setlocal EnableExtensions
cd /d "%~dp0"

set "PY=%~dp0venv\Scripts\python.exe"
set "HELPER=%~dp0scripts\web_helper.ps1"
set "PORT=8000"

if not exist "%~dp0main.py" (
    echo [ERROR] main.py was not found next to this script.
    echo [HINT]  Keep start_api.bat inside the project folder.
    pause
    exit /b 1
)

if not exist "%PY%" (
    echo [ERROR] Virtual environment interpreter not found:
    echo         %PY%
    echo [HINT]  Recreate it with: py -3 -m venv venv
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -Action status -Port %PORT% -Path "/health"
set "RC=%errorlevel%"

if "%RC%"=="0" (
    echo [AI4 Science] API is already running - opening http://localhost:%PORT%/docs
    start "" "http://localhost:%PORT%/docs"
    ping -n 3 127.0.0.1 >nul
    exit /b 0
)

if "%RC%"=="2" (
    echo [ERROR] Port %PORT% is occupied by another program.
    echo [HINT]  Close that program, or set another API_PORT in .env
    pause
    exit /b 1
)

echo [AI4 Science] Starting API service on port %PORT% ...
echo [AI4 Science] Swagger UI: http://localhost:%PORT%/docs
echo [AI4 Science] Press Ctrl+C in this window to stop the service.

start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HELPER%" -Action waitopen -Port %PORT% -Path "/docs"

"%PY%" main.py --mode api
set "RC=%errorlevel%"

echo.
echo [AI4 Science] Service stopped. Exit code: %RC%
pause
endlocal
