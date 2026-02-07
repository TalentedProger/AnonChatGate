@echo off
chcp 65001 >nul
echo.
echo ══════════════════════════════════════════════════
echo   AguGram - Быстрый запуск
echo ══════════════════════════════════════════════════
echo.

:: Остановка существующих процессов
echo [1/4] Остановка существующих процессов...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: Запуск Cloudflare Tunnel
echo [2/4] Запуск Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /c "npx cloudflared tunnel --url http://localhost:3000"
timeout /t 5 /nobreak >nul

:: Запуск сервера
echo [3/4] Запуск сервера...
start "AguGram Server" cmd /c "npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ══════════════════════════════════════════════════
echo   AguGram запущен!
echo.
echo   Откройте Telegram и найдите @AguGram_Bot
echo   Нажмите кнопку "Открыть" в меню бота
echo.
echo   После запуска туннеля:
echo   1. Скопируйте URL из окна "Cloudflare Tunnel"
echo   2. Обновите WEBAPP_URL в .env
echo   3. Перезапустите сервер (Ctrl+C в окне сервера)
echo ══════════════════════════════════════════════════
echo.
pause
