#!/usr/bin/env pwsh
# Быстрое исправление ошибок Telegram бота

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Исправление ошибки Telegram Bot polling                 ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔍 Проверяем запущенные процессы Node.js..." -ForegroundColor Yellow

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Найдено процессов Node.js: $($nodeProcesses.Count)" -ForegroundColor Yellow
    Write-Host ""
    
    $stopProcesses = Read-Host "Остановить все процессы Node.js? (yes/no)"
    
    if ($stopProcesses -eq "yes") {
        Write-Host "🛑 Останавливаем процессы Node.js..." -ForegroundColor Red
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
        Write-Host "✅ Все процессы Node.js остановлены" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "⚠️  Процессы не остановлены. Это может вызвать конфликты." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Процессы Node.js не найдены" -ForegroundColor Green
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

Write-Host "📋 СЛЕДУЮЩИЕ ШАГИ:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Убедитесь, что ngrok запущен:" -ForegroundColor White
Write-Host "    В отдельном терминале:" -ForegroundColor Gray
Write-Host "    ngrok http 3000" -ForegroundColor Yellow
Write-Host ""

Write-Host "2️⃣  Проверьте .env файл:" -ForegroundColor White
Write-Host "    WEBAPP_URL должен содержать актуальный ngrok URL" -ForegroundColor Gray
Write-Host "    Пример: https://abc-def.ngrok-free.app" -ForegroundColor Yellow
Write-Host ""

Write-Host "3️⃣  Запустите сервер:" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor Yellow
Write-Host ""

Write-Host "4️⃣  Проверьте логи на наличие:" -ForegroundColor White
Write-Host "    ✅ Telegram bot initialized" -ForegroundColor Green
Write-Host "    ✅ serving on port 3000" -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 ВАЖНАЯ ИНФОРМАЦИЯ:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ошибка 'polling_error: EFATAL' обычно означает:" -ForegroundColor White
Write-Host "  • Другой экземпляр бота уже запущен" -ForegroundColor Gray
Write-Host "  • Проблемы с сетевым соединением" -ForegroundColor Gray
Write-Host "  • Временная недоступность Telegram API" -ForegroundColor Gray
Write-Host ""
Write-Host "Теперь эта ошибка НЕ остановит сервер." -ForegroundColor Green
Write-Host "Сервер продолжит работать, бот попытается переподключиться." -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

$startServer = Read-Host "Запустить сервер сейчас? (yes/no)"

if ($startServer -eq "yes") {
    Write-Host ""
    Write-Host "🚀 Запускаем сервер..." -ForegroundColor Cyan
    Write-Host ""
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ Готово! Запустите сервер вручную когда будете готовы." -ForegroundColor Green
    Write-Host "   Команда: npm run dev" -ForegroundColor Yellow
    Write-Host ""
}
