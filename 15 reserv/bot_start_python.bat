@echo off
chcp 65001 >nul
setlocal

set "PORT=8082"
set "HTML_FILE=my_strategy_025.html"
set "PID_FILE=%~dp0python_server.pid"

if not exist "%~dp0%HTML_FILE%" (
    echo [ERROR] Файл "%HTML_FILE%" не найден
    pause
    exit /b 1
)

REM ═══════ Проверка: порт занят? ═══════
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [WARN] Порт %PORT% уже занят. Проверьте: netstat -ano ^| findstr :%PORT%
    pause
    exit /b 1
)

REM ═══════ Поиск Python ═══════
where python >nul 2>nul && (set "PY=python") || (
    where py >nul 2>nul && (set "PY=py -3") || (
        echo [ERROR] Python не найден
        pause
        exit /b 1
    )
)

echo.
echo 🚀 Запуск Python http.server на http://localhost:%PORT%
echo 📁 Папка: %~dp0
echo 🐍 Python: %PY%
echo ⏹️  Остановка: bot_stop_python.bat
echo.

REM ═══════ Автооткрытие браузера через 2 сек ═══════
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%/%HTML_FILE%"

cd /d "%~dp0"

REM ═══════ Запуск Python с сохранением PID ═══════
REM Используем wmic для получения PID дочернего процесса
for /f "tokens=2 delims=," %%A in ('wmic process call create "%PY% -m http.server %PORT%" ^| findstr "ProcessId"') do (
    set "PID=%%A"
    echo !PID! > "%PID_FILE%"
    echo ✅ Python-сервер запущен. PID=!PID! сохранён в %PID_FILE%
    goto :after_pid
)
:after_pid

echo.
echo ⏹️ Для остановки: bot_stop_python.bat
echo.
echo ⚠️  ВАЖНО: не закрывайте это окно, пока сервер работает!
echo     (Или запустите через start /B, если хотите фоновый режим)
pause