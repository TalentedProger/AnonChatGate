# Система модерации пользователей

## Общее описание

В приложении была реализована система модерации, которая требовала одобрения администратора для каждого нового пользователя перед доступом к функциям чата. Эта документация описывает архитектуру системы и процесс её отключения.

## Архитектура модерации

### Статусы пользователей

Пользователи могли иметь один из трёх статусов:
- `pending` - заявка на рассмотрении (по умолчанию)
- `approved` - одобрено администратором
- `rejected` - отклонено администратором

### База данных

В таблице `users` поле `status`:
```sql
status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending")
```

### Backend компоненты

#### 1. Telegram Bot (server/telegram-bot.ts)

**Команда /start:**
- Создавала новых пользователей со статусом `pending`
- Показывала разные сообщения в зависимости от статуса
- НЕ предоставляла кнопку запуска приложения для pending пользователей

**Команда /moderate (только для админа):**
- Показывала список пользователей на модерации
- Предоставляла inline клавиатуру для одобрения/отклонения
- Уведомляла пользователей об изменении статуса

**Callback handlers:**
- `approve_{userId}` - одобрение пользователя + отправка кнопки приложения
- `reject_{userId}` - отклонение пользователя + уведомление
- `next_user` - переход к следующему пользователю

#### 2. Аутентификация (server/auth.ts)

**JWT токены включали:**
```typescript
{
  userId: number;
  anonName: string;
  status: string;  // статус модерации
}
```

**Проверка статуса:**
- При обновлении токена проверялось соответствие статуса в токене и БД
- Если статус изменился, требовалась повторная аутентификация

#### 3. API роуты (server/routes.ts)

**POST /api/auth:**
- Создавал новых пользователей со статусом `pending`
- Возвращал токен с текущим статусом

**Middleware requireAuth:**
- НЕ проверял статус пользователя для доступа к API
- Проверял только валидность JWT токена

#### 3. WebSocket аутентификация (server/websocket.ts)

**Проверки статуса:**
- Строки 106-113: `if (user.status !== 'approved')` блокирует подключение к WebSocket
- Строки 158-163: `ws.userStatus !== 'approved'` блокирует отправку сообщений
- Строки 227-233: Рассылка сообщений только одобренным пользователям

**Поведение при отклонении:**
- Отправка `auth_error` с сообщением "User not approved for chat"
- Закрытие соединения с кодом `1008 'Not approved'`

#### 4. Database Storage (server/storage.ts)

Используется **Drizzle ORM + PostgreSQL**, а не MemStorage:
- `getPendingUsers()` - получение пользователей со статусом pending
- `updateUserStatus()` - изменение статуса пользователя
- `createUser()` - создание с автогенерацией anonName как `Student_{id}`

### Frontend компоненты

#### 1. Система аутентификации (client/src/lib/auth.ts)

**Ключевая проверка (строка 274):**
```typescript
isAuthenticated(): boolean {
  return !!(this.authState.token && this.authState.user && this.authState.status === 'approved');
}
```

**Логика:**
- Пользователь считается аутентифицированным только со статусом `approved`
- JWT токены содержат статус и проверяются при обновлении
- При изменении статуса требуется повторная аутентификация

#### 2. Chat Page (client/src/pages/chat.tsx)

**Использование модерации:**
- Строка 61: `enabled: !devMode && !auth.isAuthenticated()` - auth запрос пропускается для одобренных
- Строка 90: `if (!auth.user || !auth.isAuthenticated()) return` - WebSocket подключение только для одобренных
- Строки 250-260: Интерфейс чата показывается только при наличии токена

#### 3. Экран ожидания (client/src/components/pending-screen.tsx)

- Показывался пользователям со статусом `pending`
- Содержал кнопку "Обновить статус"
- Информировал о процессе модерации

#### 4. Экран отклонения (client/src/components/rejected-screen.tsx)

- Показывался пользователям со статусом `rejected`
- Предлагал связаться с поддержкой

#### 5. Логика отображения экранов

Экраны модерации вызывались при ошибках аутентификации в ChatPage, когда `isAuthenticated()` возвращал `false` для пользователей с неодобренным статусом.

## Процесс модерации

1. **Регистрация:** Пользователь запускал `/start` → создавался с `pending`
2. **Ожидание:** Показывался pending-screen в приложении
3. **Модерация:** Админ использовал `/moderate` для просмотра заявок
4. **Решение:** Админ одобрял/отклонял через inline кнопки
5. **Уведомление:** Пользователь получал уведомление + доступ к приложению (если одобрен)

## Удаление системы модерации

### Изменения в коде

**Конкретные изменения по файлам:**

1. **server/telegram-bot.ts:**
   - В функции создания пользователя: изменить `status: 'pending'` на `status: 'approved'`
   - В обработчике /start: удалить условную логику по статусам, всегда показывать одобренное сообщение
   - Добавить inline кнопку с `web_app: { url: WEBAPP_URL }` в ответ на `/start`
   - Удалить команду `/moderate` полностью (функция bot.onText(/\/moderate/...))
   - Удалить все callback handlers (функция bot.on('callback_query'...))

2. **server/routes.ts:**
   - В POST /api/auth: изменить `status: 'pending'` на `status: 'approved'` при создании пользователей
   - В POST /api/auth/dev: установить `status: 'approved'` для всех тестовых пользователей

3. **server/websocket.ts:**
   - В функции handleAuth: удалить блок проверки статуса пользователя
   - В функции handleSendMessage: удалить проверку статуса для отправки сообщений
   - В broadcast логике: убрать условие проверки статуса, оставить только проверку подключения

4. **client/src/lib/auth.ts:**
   - В функции isAuthenticated(): убрать проверку `this.authState.status === 'approved'` или заменить на `true`

5. **Frontend очистка:**
   - Удалить `client/src/components/pending-screen.tsx`
   - Удалить `client/src/components/rejected-screen.tsx`
   - Удалить упоминания модерации из home.tsx
   - Убрать обработчики `onRefreshStatus` и модерационные компоненты из ChatPage

6. **База данных:**
   ```sql
   -- Обновить всех существующих пользователей (через execute_sql_tool)
   UPDATE users SET status = 'approved' WHERE status IN ('pending', 'rejected');
   ```
   
   **Примечание:** Используйте доступную команду миграции в проекте или execute_sql_tool для выполнения SQL.

### Переменные окружения

**Действующие переменные:**
- `TELEGRAM_ADMIN_ID` или `ADMIN_ID`: '681943543' (по умолчанию)
- `TELEGRAM_BOT_TOKEN` или `BOT_TOKEN`: токен бота для команд модерации
- `WEBAPP_URL`: URL для кнопки приложения

**Для восстановления модерации:**
```env
ENABLE_MODERATION=true  # контроль включения/выключения модерации
```

**Development auth endpoint:**
- `/api/auth/dev` создает пользователей с `status: 'approved'` для tgId=999999
- Защищен проверками: `NODE_ENV !== 'production'`, `DEV_MODE === 'true'` и другими мерами безопасности

## Восстановление модерации

### Шаги для включения обратно:

1. Вернуть все удалённые компоненты из этой документации
2. Изменить дефолтный статус обратно на `'pending'`
3. Добавить проверки статуса в middleware и Layout
4. Восстановить команды бота и UI экраны
5. Установить `ENABLE_MODERATION=true`

### Пример реализации feature flag:

```typescript
// В server/websocket.ts:
if (process.env.ENABLE_MODERATION === 'true' && user.status !== 'approved') {
  // блокировать подключение
}

// В server/telegram-bot.ts:
const defaultStatus = process.env.ENABLE_MODERATION === 'true' ? 'pending' : 'approved';

// В client/src/lib/auth.ts (для Vite):
const requireApproval = import.meta.env.VITE_ENABLE_MODERATION === 'true';
return !!(token && user && (!requireApproval || status === 'approved'));
```

### Дополнительные улучшения для будущего:

- Автоматическое одобрение через время
- Массовые операции модерации  
- Логирование действий модераторов
- API для внешних модераторов
- Причины отклонения заявок
- Уведомления о статусе через WebSocket

## Административные данные

- **Админ ID:** `process.env.TELEGRAM_ADMIN_ID` (по умолчанию: '681943543')
- **Storage:** PostgreSQL через Drizzle ORM (server/storage.ts -> DatabaseStorage)
- **WebSocket path:** `/ws` с JWT аутентификацией
- **Уведомления:** Через Telegram Bot API

---

*Документация создана: 14 сентября 2025*  
*Система модерации отключена для обеспечения свободного доступа к приложению*