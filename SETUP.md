# 🚀 Инструкция по запуску проекта AnonChatGate

## Описание проекта

**AnonChatGate** - студенческая социальная сеть с анонимным чатом, реализованная как Telegram Mini App с использованием современного стека технологий.

### Технологический стек

**Backend:**
- Node.js + TypeScript
- Express.js (HTTP сервер)
- WebSocket (ws) для real-time чата
- PostgreSQL + Drizzle ORM (база данных)
- JWT для аутентификации
- Telegram Bot API

**Frontend:**
- React 18 + TypeScript
- Vite (сборщик)
- TailwindCSS + shadcn/ui (UI компоненты)
- Tanstack Query (управление состоянием API)
- Wouter (роутинг)

---

## Предварительные требования

Перед запуском проекта убедитесь, что у вас установлены:

1. **Node.js** версии 18.x или выше
   - Проверка: `node --version`
   - Скачать: https://nodejs.org/

2. **npm** или **yarn**
   - Проверка: `npm --version`

3. **PostgreSQL** база данных
   - Локальная установка или облачный сервис (Neon, Supabase, Railway и т.д.)
   - Проверка: `psql --version`

4. **Telegram Bot Token**
   - Создайте бота через [@BotFather](https://t.me/BotFather)
   - Сохраните полученный токен

---

## Установка и настройка

### Шаг 1: Клонирование и установка зависимостей

```bash
# Перейдите в директорию проекта
cd e:\it\AnonChatGate

# Установите зависимости
npm install
```

### Шаг 2: Настройка переменных окружения

Создайте файл `.env` в корне проекта со следующими переменными:

```env
# === Database Configuration ===
DATABASE_URL=postgresql://user:password@host:port/database_name
# Пример для Neon: postgresql://username:password@ep-xxx.region.neon.tech/dbname?sslmode=require
# Пример для локального: postgresql://postgres:password@localhost:5432/anonchatgate

# === Telegram Bot Configuration ===
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
# Пример: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789

# === Admin Configuration ===
TELEGRAM_ADMIN_ID=your_telegram_user_id
# Узнать свой ID можно через @userinfobot

# === Application URL ===
WEBAPP_URL=https://your-app-url.com
# Для разработки можно использовать ngrok или Replit URL
# Пример: https://anonchatgate.replit.app

# === Security ===
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
# Сгенерируйте длинный случайный ключ для продакшена

# === Development Settings ===
NODE_ENV=development
DEV_MODE=true
PORT=5000

# === Optional: Moderation Feature Flag ===
# ENABLE_MODERATION=false  # Отключить систему модерации (по умолчанию)
```

#### Как получить TELEGRAM_ADMIN_ID:

1. Отправьте любое сообщение боту [@userinfobot](https://t.me/userinfobot)
2. Скопируйте ваш User ID
3. Вставьте в `.env` файл

#### Как получить WEBAPP_URL для разработки:

**Вариант 1: Ngrok (рекомендуется для локальной разработки)**
```bash
# Установите ngrok: https://ngrok.com/download
ngrok http 5000

# Скопируйте HTTPS URL (например: https://abc123.ngrok.io)
# Вставьте в .env как WEBAPP_URL
```

**Вариант 2: Replit / Railway / Render**
- URL предоставляется автоматически платформой
- Используйте его в качестве WEBAPP_URL

### Шаг 3: Инициализация базы данных

```bash
# Создайте таблицы в базе данных
npm run db:push
```

Эта команда создаст следующие таблицы:
- `users` - пользователи приложения
- `rooms` - комнаты чата
- `messages` - сообщения

---

## Запуск проекта

### Режим разработки (Development)

```bash
npm run dev
```

**Что происходит:**
- ✅ Запускается Vite dev сервер на порту 5000
- ✅ Инициализируется Telegram bot
- ✅ Настраивается WebSocket сервер
- ✅ Включается hot-reload для frontend и backend
- ✅ Доступен dev endpoint `/api/auth/dev` для тестирования без Telegram

**Доступ к приложению:**
- Frontend: http://localhost:5000
- API: http://localhost:5000/api/health
- WebSocket: ws://localhost:5000/ws

### Тестирование в Development режиме

Для тестирования без Telegram Mini App:

1. Откройте http://localhost:5000
2. Будет автоматически использован dev auth endpoint
3. Создастся тестовый пользователь с tgId=999999

### Запуск через Telegram Bot

1. Убедитесь, что проект запущен и доступен по HTTPS (ngrok/Replit)
2. Откройте вашего бота в Telegram
3. Отправьте команду `/start`
4. Нажмите кнопку "🚀 Открыть приложение"

---

## Сборка для продакшена (Production)

### Шаг 1: Обновите .env для продакшена

```env
NODE_ENV=production
DEV_MODE=false
DATABASE_URL=your_production_database_url
TELEGRAM_BOT_TOKEN=your_bot_token
WEBAPP_URL=https://your-production-url.com
JWT_SECRET=very_long_and_secure_random_string_at_least_64_characters
```

### Шаг 2: Сборка приложения

```bash
# Сборка frontend и backend
npm run build
```

**Результат:**
- Frontend собирается в `dist/client/`
- Backend собирается в `dist/index.js`

### Шаг 3: Запуск production сервера

```bash
# Запуск собранного приложения
npm start
```

---

## Проверка работоспособности

### 1. Проверка API

```bash
# Health check endpoint
curl http://localhost:5000/api/health

# Ожидаемый ответ:
# {"ok":true,"timestamp":"2025-01-15T10:30:00.000Z"}
```

### 2. Проверка базы данных

```bash
# Подключитесь к PostgreSQL
psql $DATABASE_URL

# Проверьте таблицы
\dt

# Проверьте пользователей
SELECT * FROM users;
```

### 3. Проверка Telegram Bot

1. Отправьте `/start` боту
2. Должно прийти приветственное сообщение с кнопкой
3. При нажатии кнопки откроется приложение

### 4. Проверка WebSocket

Откройте Developer Tools в браузере → Network → WS:
- Должно быть подключение к `ws://localhost:5000/ws`
- Статус: `101 Switching Protocols`
- Messages: `auth_success`, `chat_history`

---

## Возможные проблемы и решения

### Проблема 1: "DATABASE_URL not found"

**Решение:**
```bash
# Убедитесь, что .env файл существует
cat .env

# Проверьте формат DATABASE_URL
echo $DATABASE_URL  # Linux/Mac
echo %DATABASE_URL% # Windows CMD
```

### Проблема 2: "TELEGRAM_BOT_TOKEN is required"

**Решение:**
- Проверьте `.env` файл
- Токен должен быть в формате: `1234567890:ABCdef...`
- Убедитесь, что нет пробелов или кавычек

### Проблема 3: Telegram Bot не отвечает

**Решение:**
```bash
# Проверьте валидность токена
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe

# Если ошибка - пересоздайте бота через @BotFather
```

### Проблема 4: WebSocket не подключается

**Решение:**
- Проверьте, что сервер запущен на правильном порту
- Убедитесь, что WebSocket path `/ws` доступен
- Проверьте CORS настройки для production

### Проблема 5: "Dev endpoint not available in production"

**Решение:**
- Это нормально для production режима
- `/api/auth/dev` доступен только в development
- Используйте Telegram Mini App для аутентификации

### Проблема 6: Port уже занят

**Решение:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <process_id> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9

# Или измените порт в .env
PORT=3000
```

---

## Скрипты package.json

```json
{
  "dev": "Запуск в режиме разработки с hot-reload",
  "build": "Сборка production версии (frontend + backend)",
  "start": "Запуск production сервера",
  "check": "TypeScript проверка типов",
  "db:push": "Синхронизация схемы БД (создание/обновление таблиц)"
}
```

---

## Архитектура проекта

```
AnonChatGate/
├── client/                 # Frontend приложение
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── lib/           # Утилиты (auth, queryClient)
│   │   └── hooks/         # Custom React hooks
│   └── index.html
│
├── server/                # Backend сервер
│   ├── index.ts          # Точка входа
│   ├── routes.ts         # API endpoints
│   ├── websocket.ts      # WebSocket обработчики
│   ├── telegram-bot.ts   # Telegram Bot логика
│   ├── auth.ts           # JWT аутентификация
│   ├── storage.ts        # Database operations
│   └── db.ts             # Drizzle ORM настройка
│
├── shared/               # Общий код (frontend + backend)
│   └── schema.ts        # Database schema + Zod validation
│
├── docs/                # Документация
│   └── moderation-system.md
│
├── .env                 # Переменные окружения (не в git)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Полезные команды

```bash
# Просмотр логов в реальном времени
npm run dev | grep WebSocket  # Фильтр по WebSocket

# Проверка TypeScript ошибок
npm run check

# Очистка и переустановка зависимостей
rm -rf node_modules package-lock.json
npm install

# Проверка размера bundle
npm run build
ls -lh dist/client/assets

# Тестирование API endpoints
curl -X POST http://localhost:5000/api/auth/dev \
  -H "Content-Type: application/json" \
  -d '{"tgId": 999999}'
```

---

## Дополнительная информация

### Документация

- [Moderation System](./docs/moderation-system.md) - описание системы модерации
- [Developer Plan](./developerplan.md) - план разработки и доработок

### Telegram Mini Apps

- [Официальная документация](https://core.telegram.org/bots/webapps)
- [Примеры](https://github.com/telegram-mini-apps-dev/tma.js)

### База данных

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## Контакты и поддержка

При возникновении проблем:

1. Проверьте этот файл SETUP.md
2. Прочитайте [Developer Plan](./developerplan.md)
3. Проверьте Issues в репозитории

---

*Документация создана: 15 октября 2025*
*Версия проекта: 1.0.0*
