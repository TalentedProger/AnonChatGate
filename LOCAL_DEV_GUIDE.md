# 🚀 Руководство по локальному запуску

Это руководство описывает, как запустить AguGram (Telegram Mini App) локально для разработки.

## 📋 Предварительные требования

1. **Node.js 18+** - [Скачать](https://nodejs.org/)
2. **ngrok** или **localtunnel** - для создания HTTPS туннеля
3. **PostgreSQL база данных** (Neon или локальная)
4. **Telegram Bot Token** - получить у [@BotFather](https://t.me/BotFather)

## 🔧 Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd AnonChatGate

# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env
```

## ⚙️ Конфигурация .env

```env
# Обязательные
DATABASE_URL=postgresql://...
JWT_SECRET=your-super-secret-key-at-least-64-characters
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Опциональные
NODE_ENV=development
PORT=3000
WEBAPP_URL=https://your-ngrok-url.ngrok-free.dev
```

## 🌐 Запуск с ngrok (рекомендуется)

### Шаг 1: Запустить ngrok

Откройте **отдельный терминал** и выполните:

```bash
ngrok http 3000
```

Вы увидите что-то вроде:
```
Forwarding  https://abc-def-ghi.ngrok-free.dev -> http://localhost:3000
```

### Шаг 2: Обновить WEBAPP_URL

Скопируйте HTTPS URL из ngrok и обновите `.env`:

```env
WEBAPP_URL=https://abc-def-ghi.ngrok-free.dev
```

### Шаг 3: Запустить сервер

```bash
npm run dev
```

### Автоматический запуск (PowerShell)

Вы можете использовать скрипт `start-dev.ps1`:

```powershell
# Полный запуск (ngrok уже должен быть запущен отдельно)
.\start-dev.ps1

# С localtunnel
.\start-dev.ps1 -Tunnel localtunnel

# Если туннель уже запущен
.\start-dev.ps1 -SkipTunnel
```

## 🌐 Альтернатива: localtunnel

Если ngrok не работает, можно использовать localtunnel:

```bash
# Установить глобально (если не установлен)
npm install -g localtunnel

# Запустить
lt --port 3000
```

**Примечание:** localtunnel может быть медленнее и менее стабильным, чем ngrok.

## ⚠️ Распространённые проблемы

### 1. Ошибка `ENOTFOUND api.telegram.org`

**Причина:** Нет подключения к Telegram API (часто блокируется в некоторых регионах)

**Решение:**
- Используйте VPN для доступа к api.telegram.org
- Или запустите бота на сервере без блокировки

### 2. Ошибка `ECONNRESET` при polling

**Причина:** Нестабильное сетевое соединение или VPN

**Решение:**
- Проверьте стабильность VPN/интернет соединения
- Бот автоматически переподключится при восстановлении связи
- Веб-приложение продолжит работать даже без бота

### 3. Ошибка `409 Conflict`

**Причина:** Другой экземпляр бота уже запущен с тем же токеном

**Решение:**
```powershell
# Остановить все процессы Node.js
Get-Process node | Stop-Process -Force

# Или в PowerShell скрипт
.\start-dev.ps1  # Он предложит остановить процессы
```

### 4. Мини-приложение не загружается

**Возможные причины:**

1. **ngrok не запущен** - убедитесь, что ngrok работает
2. **WEBAPP_URL устарел** - ngrok создаёт новый URL при каждом запуске
3. **Несоответствие портов** - проверьте, что сервер и ngrok используют один порт

**Проверка:**
```powershell
# Проверить ngrok туннели
Invoke-RestMethod http://127.0.0.1:4040/api/tunnels

# Проверить .env
Get-Content .env | Select-String "WEBAPP_URL"
```

### 5. WebSocket не подключается

**Причина:** Неправильная конфигурация или CORS

**Решение:**
1. Откройте DevTools в Telegram (если доступно) или браузере
2. Проверьте консоль на ошибки CORS
3. Убедитесь, что `WEBAPP_URL` соответствует текущему ngrok URL

## 🔍 Отладка

### Логи сервера
Логи выводятся в терминал с timestamp и уровнем:
```
[13:43:20 UTC] INFO: Server started on port 3000
[13:43:20 UTC] ERROR: [Telegram Bot] Polling error: EFATAL
```

### Проверка ngrok
Откройте http://127.0.0.1:4040 для веб-интерфейса ngrok с инспекцией запросов.

### Тестирование без Telegram

В режиме разработки доступен dev endpoint:

```bash
# Создать тестового пользователя (только в development)
curl -X POST http://localhost:3000/api/auth/dev \
  -H "Content-Type: application/json" \
  -d '{"nickname": "TestUser"}'
```

## 📱 Тестирование в Telegram

1. Откройте своего бота в Telegram
2. Отправьте `/start`
3. Нажмите кнопку "🚀 Открыть приложение"
4. Приложение должно открыться внутри Telegram

## 🔄 Горячая перезагрузка

Vite обеспечивает HMR (Hot Module Replacement):
- Изменения в клиентском коде применяются мгновенно
- Изменения в серверном коде требуют перезапуска

## 📚 Дополнительные ресурсы

- [Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [ngrok Documentation](https://ngrok.com/docs)
- [Vite Documentation](https://vitejs.dev/)
