#!/usr/bin/env pwsh
# Complete reset script for AnonChatGate
# This script clears the database and provides instructions to clear browser cache

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  AnonChatGate - Полная очистка системы                   ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Файл .env не найден!" -ForegroundColor Red
    Write-Host "   Убедитесь, что вы запускаете скрипт из корневой директории проекта." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Этот скрипт выполнит следующие действия:" -ForegroundColor Yellow
Write-Host "   1. Удалит все записи из базы данных (пользователи, комнаты, сообщения)" -ForegroundColor White
Write-Host "   2. Сбросит счетчики ID в базе данных" -ForegroundColor White
Write-Host "   3. Предоставит инструкции по очистке кеша браузера" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Вы уверены, что хотите продолжить? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "❌ Операция отменена." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🗑️  Очистка базы данных..." -ForegroundColor Cyan

# Run the clear database script
try {
    node clear_db.js
    if ($LASTEXITCODE -ne 0) {
        throw "Database clear failed"
    }
} catch {
    Write-Host "❌ Ошибка при очистке базы данных: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ База данных успешно очищена!                         ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📱 ВАЖНО: Очистка кеша в Telegram Mini App" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "Для полной очистки кеша выполните следующие действия:" -ForegroundColor White
Write-Host ""
Write-Host "1️⃣  Закройте мини-приложение в Telegram" -ForegroundColor Cyan
Write-Host "2️⃣  Откройте чат с ботом и отправьте команду: /start" -ForegroundColor Cyan
Write-Host "3️⃣  Нажмите кнопку '🚀 Открыть приложение'" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔄 Альтернативный метод (если проблемы остаются):" -ForegroundColor Yellow
Write-Host "   • На Android: Настройки -> Данные и хранилище -> Очистить кеш" -ForegroundColor White
Write-Host "   • На iOS: Закройте приложение полностью и перезапустите" -ForegroundColor White
Write-Host ""
Write-Host "💡 Для разработчиков:" -ForegroundColor Yellow
Write-Host "   • Версионирование URL добавлено автоматически" -ForegroundColor White
Write-Host "   • Заголовки no-cache добавлены в index.html" -ForegroundColor White
Write-Host "   • При каждом открытии бота URL обновляется" -ForegroundColor White
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ Очистка завершена!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
