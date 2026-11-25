@echo off
chcp 65001 >nul
setlocal
set "PORT=8084"
set "HTML_FILE=my_strategy_025.html"
set "PID_FILE=%~dp0server.pid"

if not exist "%~dp0%HTML_FILE%" (
    echo [ERROR] Файл "%HTML_FILE%" не найден
    pause
    exit /b 1
)

netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [WARN] Порт %PORT% уже занят
    pause
    exit /b 1
)

echo.
echo 🚀 Запуск PowerShell-сервера на http://localhost:%PORT%
echo 📁 Папка: %~dp0
echo.

REM Автооткрытие браузера
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%/%HTML_FILE%"

REM Запуск server.ps1 в новом окне PowerShell
start "BOT_SERVER_%PORT%" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0server.ps1" -Port %PORT% -Root "%~dp0"

REM Подождать и найти PID нового PowerShell
timeout /t 2 /nobreak >nul
for /f "tokens=2" %%P in ('tasklist /FI "WINDOWTITLE eq BOT_SERVER_%PORT%*" /FO LIST ^| findstr "PID:"') do (
    echo %%P > "%PID_FILE%"
    echo ✅ Сервер запущен. PID=%%P сохранён в %PID_FILE%
    goto :after_pid
)
:after_pid

echo.
echo ⏹️ Для остановки: bot_stop_powershell.bat
pause