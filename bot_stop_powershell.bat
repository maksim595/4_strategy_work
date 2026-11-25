@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "PORT=8084"
set "PID_FILE=%~dp0server.pid"

echo.
echo ⏹️  Остановка PowerShell-сервера (порт %PORT%)
echo.

REM ═══════ 1. Мой PID ═══════
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq cmd.exe" /FO LIST ^| findstr "PID:"') do (
    set "MY_PID=%%P"
    goto :got_pid
)
:got_pid
echo Мой PID: %MY_PID%

REM ═══════ 2. По PID-файлу ═══════
if exist "%PID_FILE%" (
    set /p PID=<"%PID_FILE%"
    echo Читаю PID из %PID_FILE%: !PID!
    if not "!PID!"=="" (
        if "!PID!"=="%MY_PID%" (
            echo ⚠️ PID совпадает с моим — пропускаю
        ) else (
            echo Убиваю PID=!PID!...
            taskkill /PID !PID! /F >nul 2>nul
            if errorlevel 1 (
                echo [WARN] Не удалось убить PID=!PID!
            ) else (
                echo ✅ PID=!PID! завершён
            )
        )
        del "%PID_FILE%"
    ) else (
        echo [WARN] PID-файл пуст
    )
) else (
    echo [WARN] PID-файл не найден. Ищу по заголовку окна...
    for /f "tokens=2" %%P in ('tasklist /FI "WINDOWTITLE eq BOT_SERVER_%PORT%*" /FO LIST ^| findstr "PID:"') do (
        echo   Убиваю PID=%%P...
        taskkill /PID %%P /F >nul 2>nul
    )
)

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
pause