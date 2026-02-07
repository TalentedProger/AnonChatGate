# Безопасность приложения AnonChatGate

**Дата обновления:** 15 октября 2025

## Обзор

Данный документ описывает меры безопасности, реализованные в приложении AnonChatGate для защиты от распространенных угроз и обеспечения безопасности пользовательских данных.

---

## 1. Rate Limiting (Защита от спама)

### API Endpoints

**Реализация:** `server/index.ts` (строки 139-164)

**Параметры:**
- **Общий лимит API:** 100 запросов за 15 минут с одного IP
- **Лимит аутентификации:** 10 попыток за 15 минут с одного IP
- **Отключено в development:** Для удобства тестирования

**Библиотека:** `express-rate-limit`

```typescript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { 
    message: 'Слишком много запросов с этого IP, пожалуйста, попробуйте позже.' 
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { 
    message: 'Слишком много попыток аутентификации, пожалуйста, попробуйте позже.' 
  }
});
```

**Применение:**
- `/api/*` - общий лимит
- `/api/auth` - строгий лимит для аутентификации

### WebSocket Messages

**Реализация:** `server/websocket.ts` (строки 12-69)

**Параметры:**
- **Лимит сообщений:** 10 сообщений в минуту на пользователя
- **Окно времени:** 60 секунд
- **Автоочистка:** Каждые 5 минут удаляются истекшие записи

**Механизм:**
```typescript
const MESSAGE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;
const userMessageCounts = new Map<number, RateLimitData>();

function checkRateLimit(userId: number): { 
  allowed: boolean; 
  remaining: number; 
  resetIn: number 
}
```

**Ответ при превышении:**
```json
{
  "type": "error",
  "message": "Слишком много сообщений. Попробуйте через X секунд.",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetIn": 45000
}
```

---

## 2. Input Sanitization (Защита от XSS)

### WebSocket Messages

**Реализация:** `server/websocket.ts` (строки 71-92, 343-352)

**Библиотека:** `validator`

**Функция sanitization:**
```typescript
function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove all HTML tags and entities
  let sanitized = validator.stripLow(input);
  
  // Escape HTML special characters
  sanitized = validator.escape(sanitized);
  
  // Remove script patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}
```

**Применяется к:**
- Все сообщения чата перед сохранением в БД

### Profile Data

**Реализация:** `server/routes.ts` (строки 13-50, 367-408)

**Функции:**

1. **Текстовые поля** (`sanitizeText`):
   - `displayName` - имя пользователя
   - `bio` - описание профиля
   - `direction` - направление обучения

2. **URL поля** (`sanitizeUrl`):
   - `avatarUrl` - аватар пользователя
   - `socialLinks` - ссылки на соцсети
   - `photos` - массив URL фотографий

**Валидация URL:**
```typescript
function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  if (!validator.isURL(trimmed, { 
    protocols: ['http', 'https'],
    require_protocol: true 
  })) {
    return null;
  }
  
  return trimmed;
}
```

**Что блокируется:**
- HTML теги: `<script>`, `<iframe>`, `<img>`, и т.д.
- JavaScript: `javascript:`, `data:`, `vbscript:`
- Event handlers: `onclick=`, `onerror=`, и т.д.
- SQL инъекции: символы экранируются
- Невалидные URL: только http/https протоколы

---

## 3. Environment Validation

**Реализация:** `server/index.ts` (строки 14-133)

**Проверяется при запуске сервера:**

### Обязательные переменные (для всех режимов):
- `DATABASE_URL` - подключение к БД
- `JWT_SECRET` - секрет для JWT токенов

### Production-специфичные проверки:

1. **JWT_SECRET длина:**
   - Минимум: 32 символа
   - Уровень: ERROR (блокирует запуск)

2. **WEBAPP_URL протокол:**
   - Требование: HTTPS
   - Уровень: WARNING

3. **DATABASE_URL SSL:**
   - Требование: `sslmode=require` или `ssl=true`
   - Уровень: WARNING

4. **DEV_MODE отключен:**
   - Не должен быть `true` в production
   - Уровень: ERROR (блокирует запуск)

5. **TELEGRAM_BOT_TOKEN:**
   - Опционально
   - Уровень: WARNING

### Вывод при проблемах:

```
================================================================================
ENVIRONMENT VALIDATION RESULTS
================================================================================

❌ ERRORS:
   JWT_SECRET: JWT_SECRET must be at least 32 characters in production
   DEV_MODE: DEV_MODE should not be enabled in production

⚠️  WARNINGS:
   WEBAPP_URL: WEBAPP_URL should use HTTPS in production
   TELEGRAM_BOT_TOKEN: Telegram bot token not provided - bot features will be disabled

================================================================================

❌ Server startup aborted due to environment validation errors.
Please fix the issues above and try again.
```

**Поведение:**
- **ERRORS:** Останавливают запуск сервера (`process.exit(1)`)
- **WARNINGS:** Показывают предупреждение, но позволяют продолжить

---

## 4. Authentication & Authorization

### JWT Tokens

**Генерация:** `server/auth.ts`

**Параметры:**
- Алгоритм: HS256 (HMAC SHA-256)
- Expiration: 
  - Access token: 24 часа
  - Refresh token: 30 дней

**Содержимое токена:**
```typescript
{
  userId: number,
  anonName: string,
  status: string,
  iat: number, // issued at
  exp: number  // expiration
}
```

### Middleware Protection

**Реализация:** `server/routes.ts` (строки 85-101)

```typescript
function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.substring(7);
  const user = verifyAuthToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}
```

**Защищенные endpoints:**
- `GET /api/profile` - получение профиля
- `PATCH /api/profile` - обновление профиля
- `POST /api/upload/*` - загрузка файлов (если реализовано)

### WebSocket Authentication

**Реализация:** `server/websocket.ts` (строки 110-184)

**Механизм:**
1. Клиент отправляет `{ type: 'auth', token: '...' }`
2. Сервер проверяет JWT токен
3. При успехе загружается история чата
4. При ошибке соединение закрывается

**Коды закрытия:**
- `1008` - Authentication required / Invalid token
- `1011` - Message error / Internal error

---

## 5. Database Security

### SQL Injection Protection

**Используется:** Drizzle ORM с prepared statements

**Пример безопасного запроса:**
```typescript
const users = await db.select()
  .from(users)
  .where(eq(users.displayName, username.toLowerCase()));
```

**Drizzle автоматически:**
- Экранирует специальные символы
- Использует параметризованные запросы
- Предотвращает SQL инъекции

### Connection Security

**Production требования:**
- SSL/TLS соединение обязательно
- Проверяется при старте через environment validation

---

## 6. Development Mode Safeguards

### Dev-только endpoints

**Реализация:** `server/routes.ts` (строки 115-136)

**Endpoint:** `POST /api/auth/dev`

**Защита (3 уровня):**

1. **NODE_ENV check:**
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     return res.status(403).json({ error: 'Dev endpoint not available in production' });
   }
   ```

2. **DEV_MODE flag:**
   ```typescript
   if (process.env.DEV_MODE !== 'true') {
     return res.status(403).json({ error: 'Dev endpoint disabled' });
   }
   ```

3. **JWT_SECRET length:**
   ```typescript
   if (jwtSecret && jwtSecret.length > 50) {
     return res.status(403).json({ error: 'Dev endpoint not available with production secrets' });
   }
   ```

**Логирование попыток:**
```typescript
console.warn(`[SECURITY] Dev endpoint access attempt blocked in production from IP: ${req.ip}`);
```

---

## 7. Best Practices

### Implemented

✅ **Fail-fast principle:** Environment validation при старте  
✅ **Defense in depth:** Несколько уровней защиты  
✅ **Input validation:** Все пользовательские данные валидируются  
✅ **Output encoding:** Escape при выводе данных  
✅ **Least privilege:** Минимальные права для endpoints  
✅ **Secure defaults:** Безопасные настройки по умолчанию  
✅ **Error handling:** Не раскрывает внутренние детали  
✅ **Rate limiting:** Защита от DDoS и брутфорса  

### Recommended for future

⏳ **HTTPS enforcement:** Force redirect в production  
⏳ **CORS policy:** Whitelist разрешенных доменов  
⏳ **CSP headers:** Content Security Policy  
⏳ **CSRF protection:** Для state-changing операций  
⏳ **Password hashing:** Если будет добавлена password auth  
⏳ **Audit logging:** Логирование критичных операций  
⏳ **Security headers:** Helmet.js middleware  
⏳ **Vulnerability scanning:** Регулярные npm audit  

---

## 8. Security Checklist

### Pre-deployment

- [ ] Environment validation проходит успешно
- [ ] JWT_SECRET >= 32 символов (production)
- [ ] DATABASE_URL использует SSL
- [ ] WEBAPP_URL использует HTTPS
- [ ] DEV_MODE отключен в production
- [ ] Rate limiting включен
- [ ] Input sanitization работает
- [ ] TypeScript compilation без ошибок
- [ ] npm audit выполнен
- [ ] Secrets не в git репозитории

### Runtime monitoring

- [ ] Логи проверяются регулярно
- [ ] Rate limit нарушения отслеживаются
- [ ] Failed auth attempts мониторятся
- [ ] Database connection pool healthy
- [ ] Memory usage в норме
- [ ] WebSocket connections tracked

---

## 9. Security Contacts

**В случае обнаружения уязвимости:**

1. Не публиковать информацию публично
2. Сообщить разработчикам напрямую
3. Дать время на исправление (responsible disclosure)

---

## 10. Changelog

**15 октября 2025:**
- Добавлен rate limiting для API и WebSocket
- Реализован input sanitization (XSS protection)
- Добавлена environment validation
- Усилена защита dev endpoints
- Документирована система безопасности

---

*Документ будет обновляться по мере добавления новых мер безопасности*
