@echo off
chcp 65001 >nul
rem AI4 Science - Web 界面 (http://localhost:8501)
cd /d "%~dp0"

rem 若 8501 已在监听，直接打开页面并退出，避免端口冲突
netstat -ano | findstr ":8501" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo [AI4 Science] 8501 端口已在运行，正在打开浏览器...
  start "" "http://localhost:8501"
  timeout /t 2 /nobreak >nul
  exit /b 0
)

call venv\Scripts\activate.bat

rem 服务启动需要几秒，稍后自动打开浏览器
start "" /min cmd /c "timeout /t 5 /nobreak >nul && explorer http://localhost:8501"

echo [AI4 Science] 正在启动，浏览器将自动打开 http://localhost:8501
python main.py --mode web
pause

