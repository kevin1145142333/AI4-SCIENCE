@echo off
rem AI4 Science - stop the web service listening on port 8501
rem ASCII only: this file must never depend on the console code page.
setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\web_helper.ps1" -Action stop -Port 8501
set "RC=%errorlevel%"

echo.
if "%RC%"=="0" (
    echo [AI4 Science] Web service stopped.
) else (
    echo [AI4 Science] Nothing was stopped.
)
ping -n 4 127.0.0.1 >nul
endlocal
