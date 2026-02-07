# 🚀 Руководство по запуску и деплою AnonChatGate

**Версия:** 2.0.1  
**Дата:** 5 декабря 2025

---

## 📋 Содержание

1. [Требования](#1-требования)
2. [Локальная разработка](#2-локальная-разработка)
3. [Настройка переменных окружения](#3-настройка-переменных-окружения)
4. [Настройка Telegram бота](#4-настройка-telegram-бота)
5. [Запуск проекта](#5-запуск-проекта)
6. [Деплой на хостинг](#6-деплой-на-хостинг)
7. [Анализ совместимости с Vercel](#7-анализ-совместимости-с-vercel)
8. [Рекомендуемые альтернативы](#8-рекомендуемые-альтернативы)

---

## 1. Требования

### Системные требования
- **Node.js** 18.x или выше
- **npm** 9.x или выше
- **Git**

### Проверка установки
```powershell
node --version   # v18.0.0+
npm --version    # 9.0.0+
```

### Внешние сервисы
- **PostgreSQL база данных** (рекомендуется [Neon](https://neon.tech) - бесплатный tier)
- **Telegram Bot** (создаётся через [@BotFather](https://t.me/BotFather))
- **Ngrok** (для локальной разработки) - [скачать](https://ngrok.com/download)

---

## 2. Локальная разработка

### Шаг 1: Клонирование и установка

```powershell
# Клонировать репозиторий
git clone https://github.com/TalentedProger/AnonChatGate.git
cd AnonChatGate

# Установить зависимости
npm install
```

### Шаг 2: Создание базы данных

1. Зарегистрируйтесь на [Neon](https://neon.tech) (бесплатно)
2. Создайте новый проект
3. Скопируйте Connection String (Pooled connection)

---

## 3. Настройка переменных окружения

### Создайте файл `.env` в корне проекта:

```dotenv
# === База данных ===
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# === Telegram Bot ===
TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather
TELEGRAM_ADMIN_ID=ваш_telegram_user_id

# === URL приложения ===
# Для локальной разработки используйте ngrok URL
WEBAPP_URL=https://your-ngrok-url.ngrok-free.app

# === Безопасность ===
# ВАЖНО: Сгенерируйте уникальный секрет!
JWT_SECRET=ваш_уникальный_секрет_минимум_64_символа

# === Режим работы ===
NODE_ENV=development
DEV_MODE=true
PORT=3000
```

### Генерация JWT_SECRET:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Получение TELEGRAM_ADMIN_ID:

Отправьте любое сообщение боту [@userinfobot](https://t.me/userinfobot) - он вернёт ваш User ID.

---

## 4. Настройка Telegram бота

### Шаг 1: Создание бота

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot`
3. Введите имя бота (например: "AguGram")
4. Введите username бота (например: "agugram_bot")
5. Скопируйте токен

### Шаг 2: Настройка Mini App

1. Отправьте BotFather `/mybots`
2. Выберите вашего бота
3. Bot Settings → Menu Button → Configure menu button
4. Введите URL вашего приложения (HTTPS обязателен!)

### Шаг 3: Настройка Web App URL

```
/setmenubutton
```
- URL: `https://your-app-url.com`
- Button text: "Открыть приложение"

---

## 5. Запуск проекта

### Режим разработки

**Терминал 1 - Ngrok (для HTTPS):**
```powershell
ngrok http 3000
```
Скопируйте HTTPS URL и вставьте в `.env` как `WEBAPP_URL`

**Терминал 2 - Сервер:**
```powershell
# Инициализация БД (первый раз)
npm run db:push

# Запуск dev сервера
npm run dev
```

### Проверка работы

1. Откройте http://localhost:3000 в браузере
2. В Telegram откройте вашего бота
3. Отправьте `/start`
4. Нажмите "Открыть приложение"

### Production сборка

```powershell
# Сборка
npm run build

# Запуск
npm start
```

---

## 6. Деплой на хостинг

### Требования к хостингу

Для полноценной работы AnonChatGate необходим хостинг с поддержкой:

| Функция | Требование | Причина |
|---------|-----------|---------|
| **WebSocket** | ✅ Обязательно | Реальтайм чат |
| **Long-running process** | ✅ Обязательно | Telegram bot polling |
| **Persistent connections** | ✅ Обязательно | WebSocket соединения |
| **Node.js runtime** | ✅ Обязательно | Express сервер |
| **File uploads** | ⚠️ Желательно | Загрузка аватаров |

---

## 7. Анализ совместимости с Vercel

### ❌ Vercel НЕ подходит для этого проекта

**Критические ограничения Vercel:**

| Проблема | Описание | Влияние |
|----------|----------|---------|
| **Serverless Functions** | Vercel использует serverless модель - функции "засыпают" после выполнения | Telegram bot перестанет получать сообщения |
| **Нет WebSocket** | Vercel не поддерживает persistent WebSocket соединения | Чат не будет работать в реальном времени |
| **Timeout 10-60 сек** | Максимальное время выполнения функции ограничено | Long-polling Telegram невозможен |
| **Нет файловой системы** | Serverless функции не сохраняют состояние между вызовами | Загрузка файлов не работает |
| **Cold starts** | Функции "холодно" запускаются при каждом вызове | Задержки 1-5 секунд |

### Детальный анализ компонентов:

```
┌──────────────────────────────────────────────────────────────────┐
│                    AnonChatGate Architecture                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐      ┌─────────────────┐      ┌──────────────┐ │
│  │   Frontend  │ ───► │  Express Server │ ◄─── │ Telegram Bot │ │
│  │   (React)   │      │    (Node.js)    │      │  (Polling)   │ │
│  └─────────────┘      └────────┬────────┘      └──────────────┘ │
│        │                       │                      │          │
│        │              ┌────────▼────────┐            │          │
│        │              │ WebSocket Server│            │          │
│        └──────────────┤   (Real-time)   │────────────┘          │
│                       └────────┬────────┘                        │
│                                │                                 │
│                       ┌────────▼────────┐                        │
│                       │   PostgreSQL    │                        │
│                       │     (Neon)      │                        │
│                       └─────────────────┘                        │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  ❌ Vercel: Serverless - не поддерживает постоянные процессы     │
│  ✅ Railway/Render: Containers - поддерживает всё необходимое    │
└──────────────────────────────────────────────────────────────────┘
```

### Что пришлось бы переделать для Vercel:

1. **WebSocket → Server-Sent Events или Polling** - потеря реалтайма
2. **Telegram Bot → Webhook** - но Vercel timeout не подходит
3. **File uploads → S3/Cloudinary** - дополнительная сложность
4. **Разделение на 2 проекта** - фронтенд + отдельный бэкенд

**Вывод: Переделка архитектуры нецелесообразна и убьёт ключевые функции.**

---

## 8. Рекомендуемые альтернативы

### 🏆 Рекомендация #1: Railway

**Почему Railway лучший выбор:**

| Преимущество | Описание |
|-------------|----------|
| ✅ Полная совместимость | WebSocket, Telegram polling - всё работает |
| ✅ Бесплатный tier | $5 бесплатно каждый месяц |
| ✅ Простой деплой | Подключение GitHub репозитория |
| ✅ PostgreSQL included | Можно создать БД прямо в Railway |
| ✅ Автоматический HTTPS | SSL сертификаты из коробки |

**Деплой на Railway:**

```bash
# 1. Установить Railway CLI
npm install -g @railway/cli

# 2. Войти в аккаунт
railway login

# 3. Создать проект
railway init

# 4. Добавить PostgreSQL
railway add --database postgres

# 5. Настроить переменные окружения
railway variables set TELEGRAM_BOT_TOKEN=ваш_токен
railway variables set JWT_SECRET=ваш_секрет
# ... остальные переменные

# 6. Деплой
railway up
```

### 🥈 Рекомендация #2: Render

**Преимущества:**
- ✅ WebSocket поддержка
- ✅ Бесплатный tier для web services
- ✅ Автодеплой из GitHub
- ⚠️ Бесплатный tier "засыпает" через 15 минут без активности

**Деплой на Render:**

1. Создайте аккаунт на [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repository
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Добавьте Environment Variables
7. Create Web Service

### 🥉 Рекомендация #3: Fly.io

**Преимущества:**
- ✅ Docker-based деплой
- ✅ Бесплатный tier (до 3 VM)
- ✅ WebSocket поддержка
- ✅ Глобальная сеть (низкая задержка)

**Деплой на Fly.io:**

```bash
# 1. Установить flyctl
iwr https://fly.io/install.ps1 -useb | iex

# 2. Войти
fly auth login

# 3. Создать приложение
fly launch

# 4. Настроить секреты
fly secrets set TELEGRAM_BOT_TOKEN=ваш_токен
fly secrets set DATABASE_URL=ваш_url
fly secrets set JWT_SECRET=ваш_секрет

# 5. Деплой
fly deploy
```

---

## 📊 Сравнительная таблица хостингов

| Платформа | WebSocket | Telegram Bot | Бесплатный tier | Сложность деплоя |
|-----------|-----------|--------------|-----------------|------------------|
| **Vercel** | ❌ | ❌ | ✅ Unlimited | ⭐ Низкая |
| **Railway** | ✅ | ✅ | ✅ $5/мес | ⭐⭐ Средняя |
| **Render** | ✅ | ✅ | ⚠️ Sleep | ⭐⭐ Средняя |
| **Fly.io** | ✅ | ✅ | ✅ 3 VM | ⭐⭐⭐ Высокая |
| **VPS (DigitalOcean)** | ✅ | ✅ | ❌ $5/мес | ⭐⭐⭐⭐ Высокая |

---

## 🔧 Подготовка к деплою

### Чеклист перед деплоем:

- [ ] Сменить JWT_SECRET на уникальный (64+ символов)
- [ ] Проверить что .env НЕ в репозитории
- [ ] Настроить все environment variables на хостинге
- [ ] Проверить DATABASE_URL с SSL (`?sslmode=require`)
- [ ] Убедиться что WEBAPP_URL использует HTTPS
- [ ] Отключить DEV_MODE (`DEV_MODE=false`)
- [ ] Установить NODE_ENV=production

### Переменные окружения для production:

```dotenv
NODE_ENV=production
DEV_MODE=false
DATABASE_URL=postgresql://...?sslmode=require
TELEGRAM_BOT_TOKEN=ваш_токен
TELEGRAM_ADMIN_ID=ваш_id
WEBAPP_URL=https://your-production-url.com
JWT_SECRET=очень_длинный_уникальный_секрет_минимум_64_символа
PORT=3000
```

---

## ❓ FAQ

### Q: Почему не Vercel?
**A:** Vercel использует serverless модель, которая не поддерживает persistent WebSocket соединения и long-running процессы (Telegram bot polling). Переделка архитектуры под Vercel потребует отказа от реалтайм-чата.

### Q: Можно ли фронтенд на Vercel, а бэкенд отдельно?
**A:** Технически да, но это усложняет архитектуру:
- Нужно настраивать CORS
- WebSocket всё равно нужен отдельный сервер
- Telegram bot должен быть где-то запущен постоянно
- Усложняется деплой и поддержка

### Q: Какой хостинг выбрать для MVP?
**A:** **Railway** - лучший баланс простоты и функциональности. $5 бесплатно каждый месяц, простой деплой, всё работает из коробки.

### Q: Что делать если Railway закончится бесплатный tier?
**A:** Варианты:
1. Оплатить (~$5-20/месяц)
2. Мигрировать на Render (но есть sleep)
3. Развернуть на VPS (DigitalOcean $5/мес)

---

*Документ создан: 5 декабря 2025*
