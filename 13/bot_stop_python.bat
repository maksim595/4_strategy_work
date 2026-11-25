@echo off
chcp 65001 >nul
setlocal
set "PORT=8082"
set "PID_FILE=%~dp0python_server.pid"

echo.
echo ══════════════════════════════════════════════
echo  ⏹️  Остановка Python-сервера на порту %PORT%
echo ══════════════════════════════════════════════
echo.

REM ═══════ 1. По PID-файлу ═══════
if exist "%PID_FILE%" (
    set /p PID=<"%PID_FILE%"
    echo Читаю PID из %PID_FILE%: %PID%
    if not "%PID%"=="" (
        taskkill /PID %PID% /F >nul 2>nul
        if errorlevel 1 (
            echo [WARN] Не удалось убить PID=%PID% (возможно, уже завершён)
        ) else (
            echo ✅ PID=%PID% завершён
        )
        del "%PID_FILE%"
    ) else (
        echo [WARN] PID-файл пуст
    )
) else (
    echo [WARN] PID-файл не найден. Убиваю процессы на порту %PORT%...
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
        if not "%%P"=="4" (
            echo   Убиваю PID=%%P...
            taskkill /PID %%P /F >nul 2>nul
        )
    )
)

REM ═══════ 2. Дополнительно: все python.exe ═══════
echo.
echo [Дополнительно] Проверка Python-процессов...
taskkill /IM python.exe /F >nul 2>nul
taskkill /IM pythonw.exe /F >nul 2>nul
taskkill /IM py.exe /F >nul 2>nul
echo ✅ Python очищен (если был)

REM ═══════ 3. Проверка порта ═══════
echo.
echo [Проверка] Порт %PORT%...
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo ✅ Порт %PORT% СВОБОДЕН. Сервер остановлен.
) else (
    echo ⚠️  Порт %PORT% всё ещё занят.
    echo    Проверьте: netstat -ano ^| findstr :%PORT%
)

echo.
echo ══════════════════════════════════════════════
pause