# 🚀 Деплой AguGram на Railway

## Предварительные требования

- Аккаунт на [Railway](https://railway.app) (можно войти через GitHub)
- Репозиторий проекта на GitHub
- Данные для переменных окружения (уже есть в .env)

---

## 📋 Пошаговая инструкция

### Шаг 1: Подготовка репозитория

1. Создайте репозиторий на GitHub (если ещё нет):
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Railway deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/agugram.git
   git push -u origin main
   ```

2. Убедитесь что `.env` НЕ закоммичен (он в .gitignore)

---

### Шаг 2: Создание проекта на Railway

1. Перейдите на https://railway.app и войдите через GitHub

2. Нажмите **"New Project"**

3. Выберите **"Deploy from GitHub repo"**

4. Выберите ваш репозиторий `agugram`

5. Railway автоматически определит Node.js проект

---

### Шаг 3: Настройка переменных окружения

В Railway Dashboard откройте ваш проект → **Variables** → **Raw Editor**

Вставьте следующие переменные (замените значения на свои):

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require

# Telegram Bot
TELEGRAM_BOT_TOKEN=8316828513:YOUR_BOT_TOKEN
TELEGRAM_ADMIN_ID=681943543

# ВАЖНО: Оставьте пустым - Railway автоматически подставит URL после деплоя
WEBAPP_URL=

# Security
JWT_SECRET=your_64_char_secret_key_here

# Production settings
NODE_ENV=production
DEV_MODE=false
PORT=3000
```

⚠️ **ВАЖНО**: `WEBAPP_URL` сначала оставьте пустым!

---

### Шаг 4: Первый деплой

1. После добавления переменных, нажмите **"Deploy"**

2. Дождитесь завершения сборки (2-5 минут)

3. После успешного деплоя, Railway покажет URL вашего приложения:
   ```
   https://agugram-production.up.railway.app
   ```

---

### Шаг 5: Обновление WEBAPP_URL

1. Скопируйте URL, который дал Railway

2. Вернитесь в **Variables** и добавьте:
   ```
   WEBAPP_URL=https://agugram-production.up.railway.app
   ```

3. Railway автоматически перезапустит приложение

---

### Шаг 6: Обновление Telegram Bot

После получения постоянного URL, обновите Menu Button бота:

**Вариант A: Автоматически (бот сам обновит)**

Бот автоматически вызывает `setChatMenuButton` при старте с новым URL.

**Вариант B: Вручную через BotFather**

1. Откройте @BotFather
2. `/mybots` → Выберите @AguGram_Bot
3. `Bot Settings` → `Menu Button`
4. Вставьте новый URL: `https://agugram-production.up.railway.app`

---

## ✅ Проверка работы

### 1. Проверка API
Откройте в браузере:
```
https://your-app.up.railway.app/api/health
```
Должен вернуть: `{"status":"ok"}`

### 2. Проверка Mini App
1. Откройте @AguGram_Bot в Telegram
2. Нажмите Menu Button или `/start`
3. Mini App должен открыться

### 3. Проверка WebSocket
В консоли браузера (F12) не должно быть ошибок WebSocket.

---

## 🔧 Решение проблем

### Ошибка сборки
```bash
# Проверьте логи в Railway Dashboard → Deployments → View Logs
```

### WebSocket не подключается
Проверьте что `WEBAPP_URL` установлен правильно (без слеша в конце).

### Bot не отвечает
1. Проверьте `TELEGRAM_BOT_TOKEN` в Variables
2. Посмотрите логи на ошибки polling

### База данных не подключается
1. Проверьте `DATABASE_URL` (должен начинаться с `postgresql://`)
2. Убедитесь что Neon database активна

---

## 📊 Мониторинг

Railway предоставляет:
- **Логи** в реальном времени
- **Метрики** использования ресурсов
- **Автоматический рестарт** при падении

---

## 💰 Стоимость

- **Бесплатно**: $5 кредитов/месяц (хватит на ~500 часов)
- **Hobby**: $5/месяц (без ограничений)
- **Pro**: $20/месяц (приоритетная поддержка)

---

## 🔄 Обновление приложения

При push в GitHub, Railway автоматически:
1. Запустит новую сборку
2. Задеплоит обновление
3. Сделает zero-downtime switch

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

---

## 📁 Созданные файлы для Railway

| Файл | Назначение |
|------|------------|
| `railway.json` | Конфигурация деплоя |
| `Procfile` | Команда запуска |
| `nixpacks.toml` | Настройки сборки |
| `.railwayignore` | Исключения при деплое |

---

## 🎉 Готово!

После выполнения всех шагов у вас будет:
- ✅ Постоянный HTTPS URL
- ✅ Работающий WebSocket чат
- ✅ Telegram Mini App
- ✅ Автоматические деплои из GitHub

**Ваш URL**: `https://agugram-production.up.railway.app`

---

## 📞 Поддержка

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
