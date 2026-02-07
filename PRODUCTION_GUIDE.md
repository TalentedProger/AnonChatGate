# 🚀 AguGram - Production Deployment Guide

## Проблема с туннелями

Cloudflare Tunnel и ngrok дают **временные URL**, которые меняются при перезапуске.
Для production нужен **постоянный URL**.

## Бесплатные варианты хостинга

### 1. Railway.app (Рекомендуется)

**Плюсы:** Простой деплой, поддержка WebSocket, бесплатный tier (500 часов/месяц)

```bash
# 1. Установите Railway CLI
npm install -g @railway/cli

# 2. Войдите в аккаунт
railway login

# 3. Создайте проект
railway init

# 4. Добавьте переменные окружения
railway variables set DATABASE_URL="ваш_neon_url"
railway variables set TELEGRAM_BOT_TOKEN="ваш_токен"
railway variables set TELEGRAM_ADMIN_ID="ваш_id"
railway variables set JWT_SECRET="ваш_секрет"
railway variables set NODE_ENV="production"

# 5. Деплой
railway up

# 6. Получите URL
railway domain
```

После деплоя установите URL в WEBAPP_URL и обновите Menu Button бота.

---

### 2. Render.com

**Плюсы:** Бесплатный tier, автодеплой с GitHub, поддержка WebSocket

1. Зарегистрируйтесь на [render.com](https://render.com)
2. Подключите GitHub репозиторий
3. Создайте Web Service:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Добавьте Environment Variables
5. Получите URL вида `https://agugram.onrender.com`

---

### 3. Fly.io

**Плюсы:** Edge computing, быстрый, бесплатный tier

```bash
# 1. Установите flyctl
curl -L https://fly.io/install.sh | sh

# 2. Войдите
fly auth login

# 3. Создайте приложение
fly launch

# 4. Настройте секреты
fly secrets set DATABASE_URL="..."
fly secrets set TELEGRAM_BOT_TOKEN="..."

# 5. Деплой
fly deploy
```

---

### 4. Replit (Уже настроено)

Проект изначально разработан для Replit:

1. Импортируйте репозиторий на [replit.com](https://replit.com)
2. Настройте Secrets (переменные окружения)
3. Нажмите Run
4. URL будет вида `https://agugram.replit.app`

---

## Настройка после деплоя

### 1. Обновите WEBAPP_URL

```bash
# В .env или переменных хостинга
WEBAPP_URL=https://ваш-постоянный-url.com
```

### 2. Обновите Menu Button в боте

Через @BotFather:
1. Отправьте `/mybots`
2. Выберите @AguGram_Bot
3. Bot Settings → Menu Button → Configure menu button
4. Введите URL: `https://ваш-постоянный-url.com`
5. Текст кнопки: `🚀 Открыть`

Или через API (автоматически при запуске сервера).

### 3. Проверьте работу

1. Откройте @AguGram_Bot в Telegram
2. Нажмите кнопку меню или отправьте /start
3. Приложение должно открыться

---

## Локальная разработка

Для локальной разработки используйте туннели:

```powershell
# Вариант 1: Cloudflare Tunnel (бесплатно, без регистрации)
npx cloudflared tunnel --url http://localhost:3000

# Вариант 2: ngrok (требует регистрацию)
ngrok http 3000

# Вариант 3: localtunnel (бесплатно)
npx localtunnel --port 3000
```

После запуска туннеля:
1. Скопируйте HTTPS URL
2. Обновите WEBAPP_URL в .env
3. Перезапустите сервер: `npm run dev`

---

## Быстрый старт (Windows)

```batch
# Запустите start.bat или:
.\start-production.ps1 -TunnelType cloudflare
```

Это автоматически:
- Запустит Cloudflare Tunnel
- Запустит сервер
- Обновит Menu Button в боте
- Отправит уведомление админу

---

## Troubleshooting

### Бот не отвечает
- Проверьте `TELEGRAM_BOT_TOKEN`
- Убедитесь что api.telegram.org доступен

### Mini App не открывается
- Проверьте что URL начинается с `https://`
- Проверьте WEBAPP_URL в .env
- Убедитесь что сервер запущен и доступен

### Ошибка CORS
- URL туннеля должен быть в списке разрешённых origin
- Проверьте server/index.ts - там автоматически разрешены *.trycloudflare.com и *.ngrok-free.dev

### WebSocket не подключается
- Убедитесь что хостинг поддерживает WebSocket
- Проверьте что используется wss:// для HTTPS
