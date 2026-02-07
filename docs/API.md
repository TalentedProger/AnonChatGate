# 📚 API Documentation - AguGram

**Версия API:** 1.0  
**Base URL:** `https://your-domain.com/api`  
**Последнее обновление:** 5 декабря 2025

---

## 📋 Содержание

1. [Аутентификация](#аутентификация)
2. [Профиль пользователя](#профиль-пользователя)
3. [Сообщения](#сообщения)
4. [Загрузка файлов](#загрузка-файлов)
5. [Статистика](#статистика)
6. [Новости](#новости)
7. [WebSocket API](#websocket-api)
8. [Коды ошибок](#коды-ошибок)

---

## Аутентификация

Все защищённые эндпоинты требуют JWT токен в заголовке:
```
Authorization: Bearer <token>
```

### POST /api/auth

Аутентификация через Telegram Mini App initData.

**Request Body:**
```json
{
  "initData": "query_id=...&user=...&auth_date=...&hash=..."
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "tgId": "123456789",
    "username": "john_doe",
    "anonName": "Student_1",
    "displayName": "john",
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Hello world",
    "university": "МГУ",
    "faculty": "ИТ",
    "course": 3,
    "interests": ["coding", "music"],
    "photos": ["/uploads/photo1.jpg"],
    "status": "approved",
    "profileCompleted": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - Invalid initData format
- `401` - Invalid initData signature
- `401` - InitData expired (older than 24h)

---

### POST /api/auth/refresh

Обновление access token с помощью refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400` - Refresh token is required
- `401` - Invalid or expired refresh token

---

### POST /api/auth/dev 🔒

**DEV ONLY** - Создание тестового пользователя (только в development mode).

**Request Body:**
```json
{
  "tgId": "123456789",
  "username": "test_user"
}
```

**Response (200 OK):**
```json
{
  "user": { ... },
  "token": "...",
  "refreshToken": "..."
}
```

---

## Профиль пользователя

### GET /api/profile 🔐

Получение профиля текущего пользователя.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "profile": {
    "id": 1,
    "tgId": "123456789",
    "username": "john_doe",
    "anonName": "Student_1",
    "displayName": "john",
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Software developer",
    "university": "МГУ",
    "faculty": "ИТ",
    "course": 3,
    "interests": ["coding", "gaming"],
    "photos": ["/uploads/photo.jpg"],
    "status": "approved",
    "profileCompleted": true
  }
}
```

---

### PATCH /api/profile 🔐

Обновление профиля пользователя.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "displayName": "john_updated",
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio",
  "university": "МФТИ",
  "faculty": "ФПМИ",
  "course": 4,
  "interests": ["AI", "blockchain"],
  "photos": ["/uploads/new_photo.jpg"]
}
```

**Response (200 OK):**
```json
{
  "profile": { ... },
  "message": "Profile updated successfully"
}
```

**Errors:**
- `400` - Validation failed (with details)
- `409` - Username already taken

---

### GET /api/check-username/:username

Проверка доступности имени пользователя.

**Parameters:**
- `username` (path) - Имя для проверки (3-30 символов, буквы, цифры, _ и -)

**Response (200 OK):**
```json
{
  "available": true,
  "error": null
}
```

или

```json
{
  "available": false,
  "error": "Имя пользователя уже занято"
}
```

---

## Сообщения

### GET /api/messages/:roomId?

Получение истории сообщений комнаты.

**Parameters:**
- `roomId` (path, optional) - ID комнаты. Если не указан, возвращает глобальную комнату.

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Количество сообщений
- `paginated` (optional) - `true` для пагинации
- `cursor` (optional) - ID сообщения для пагинации
- `direction` (optional) - `before` или `after` относительно cursor

**Response (200 OK) - без пагинации:**
```json
{
  "messages": [
    {
      "id": 1,
      "content": "Hello world!",
      "createdAt": "2025-12-05T12:00:00.000Z",
      "user": {
        "id": 1,
        "anonName": "Student_1"
      }
    }
  ]
}
```

**Response (200 OK) - с пагинацией:**
```json
{
  "messages": [...],
  "hasMore": true,
  "nextCursor": 50,
  "prevCursor": null,
  "totalCount": 150
}
```

---

## Загрузка файлов

### POST /api/upload/image 🔐

Загрузка одного изображения.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` - Файл изображения (JPEG, PNG, GIF, WebP, max 5MB)

**Response (200 OK):**
```json
{
  "success": true,
  "url": "/uploads/1733406000000-abc123.jpg",
  "filename": "1733406000000-abc123.jpg"
}
```

---

### POST /api/upload/images 🔐

Загрузка нескольких изображений (до 5).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images` - Массив файлов изображений

**Response (200 OK):**
```json
{
  "success": true,
  "urls": [
    "/uploads/1733406000000-abc123.jpg",
    "/uploads/1733406000001-def456.jpg"
  ],
  "count": 2
}
```

---

## Статистика

### GET /api/statistics/user 🔐

Получение статистики текущего пользователя.

**Response (200 OK):**
```json
{
  "profileViews": 42,
  "friendRequests": 5,
  "sentMessages": 150,
  "popularity": 85
}
```

---

### POST /api/statistics/profile-view 🔐

Записать просмотр профиля.

**Request Body:**
```json
{
  "profileUserId": 5
}
```

**Response (200 OK):**
```json
{
  "message": "View recorded"
}
```

---

### GET /api/statistics/chat/:roomId?

Получение статистики чата.

**Response (200 OK):**
```json
{
  "totalUsers": 150,
  "onlineUsers": 42
}
```

---

### GET /api/statistics/last-message/:roomId

Получение последнего сообщения в комнате.

**Response (200 OK):**
```json
{
  "lastMessage": {
    "id": 500,
    "content": "Last message text",
    "createdAt": "2025-12-05T12:00:00.000Z",
    "userId": 1,
    "anonName": "Student_1"
  }
}
```

---

### GET /api/statistics/top-users

Получение топ популярных пользователей.

**Query Parameters:**
- `limit` (optional, default: 10) - Количество пользователей

**Response (200 OK):**
```json
{
  "topUsers": [
    {
      "userId": 1,
      "anonName": "Student_1",
      "popularity": 150
    }
  ]
}
```

---

## Новости

### GET /api/news

Получение ленты новостей.

**Query Parameters:**
- `limit` (optional, default: 5) - Количество новостей

**Response (200 OK):**
```json
{
  "news": [
    {
      "id": 1,
      "title": "Добро пожаловать!",
      "content": "Текст новости...",
      "imageUrl": "/uploads/news1.jpg",
      "createdAt": "2025-12-05T10:00:00.000Z",
      "authorName": "Student_1"
    }
  ]
}
```

---

### POST /api/news 🔐

Создание новости (требует авторизации).

**Request Body:**
```json
{
  "title": "Заголовок новости",
  "content": "Текст новости",
  "imageUrl": "/uploads/news_image.jpg"
}
```

**Response (201 Created):**
```json
{
  "news": {
    "id": 2,
    "title": "Заголовок новости",
    "content": "Текст новости",
    "imageUrl": "/uploads/news_image.jpg",
    "authorId": 1,
    "createdAt": "2025-12-05T12:00:00.000Z"
  }
}
```

---

## WebSocket API

**URL:** `wss://your-domain.com/ws`

### Подключение

После установки соединения необходимо отправить auth сообщение:

```json
{
  "type": "auth",
  "token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Типы сообщений

#### Отправка сообщения
```json
{
  "type": "message",
  "content": "Hello world!",
  "roomId": 1
}
```

#### Получение сообщения
```json
{
  "type": "message",
  "id": 123,
  "content": "Hello world!",
  "roomId": 1,
  "userId": 1,
  "anonName": "Student_1",
  "createdAt": "2025-12-05T12:00:00.000Z"
}
```

#### Индикатор печати
```json
{
  "type": "typing",
  "roomId": 1,
  "isTyping": true
}
```

#### Уведомление о печати
```json
{
  "type": "user_typing",
  "userId": 1,
  "anonName": "Student_1",
  "roomId": 1,
  "isTyping": true
}
```

#### Статус доставки
```json
{
  "type": "message_delivered",
  "messageId": 123,
  "deliveredTo": [1, 2, 3]
}
```

#### Статус прочтения
```json
{
  "type": "message_read",
  "messageId": 123,
  "readBy": [1, 2]
}
```

#### Количество онлайн
```json
{
  "type": "online_count",
  "count": 42,
  "totalUsers": 150
}
```

#### Ошибка
```json
{
  "type": "error",
  "message": "Rate limit exceeded"
}
```

### Rate Limiting

- Максимум 10 сообщений за 10 секунд
- Максимальный размер сообщения: 100KB
- Максимальная длина текста: 1000 символов

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Bad Request - неверный формат запроса |
| 401 | Unauthorized - требуется авторизация или токен недействителен |
| 403 | Forbidden - доступ запрещён |
| 404 | Not Found - ресурс не найден |
| 409 | Conflict - конфликт (например, username занят) |
| 429 | Too Many Requests - превышен лимит запросов |
| 500 | Internal Server Error - внутренняя ошибка сервера |

### Формат ошибки

```json
{
  "error": "Error message",
  "details": [
    {
      "path": ["field"],
      "message": "Field validation error"
    }
  ]
}
```

---

## Rate Limiting

### API Endpoints
- **Общий лимит:** 100 запросов за 15 минут
- **Auth endpoints:** 20 запросов за 15 минут

### WebSocket
- **Сообщения:** 10 сообщений за 10 секунд
- **Размер:** максимум 100KB на сообщение

---

## Легенда

- 🔐 - Требует авторизации (Bearer token)
- 🔒 - Только для разработки (DEV mode)

---

*Документация создана автоматически на основе API эндпоинтов проекта AguGram*
