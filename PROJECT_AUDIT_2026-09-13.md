# Технический аудит AnonChatGate / AguGram

**Дата:** 13 сентября 2026 года  
**Объект:** Telegram Mini App — анонимный общий чат и студенческая социальная сеть АГУ  
**Ветка:** `main`  
**Вердикт:** **публичный запуск сейчас не рекомендуется**; проект подходит как функциональный прототип и после устранения P0/P1 — как закрытый пилот.

> В отчёте не приведены значения секретов, Telegram ID, персональные данные пользователей и адрес базы. Проверка рабочей БД выполнялась только читающими запросами.

## 1. Краткий вывод

У проекта уже есть полноценный технический фундамент: React-интерфейс, сервер Express, PostgreSQL/Drizzle, Telegram Mini App-аутентификация, JWT, WebSocket-чат, профили, загрузка изображений, избранное, статистика, новости, миграции и deployment-конфигурации. Production-сборка и строгая проверка TypeScript проходят, 63 unit-теста зелёные.

Но готовность документации заметно завышена. В текущем состоянии есть блокеры безопасности, целостности данных и эксплуатации:

1. Текущие `DATABASE_URL`, `TELEGRAM_BOT_TOKEN` и `JWT_SECRET` найдены в истории Git. Их необходимо считать скомпрометированными и ротировать.
2. Refresh token принимается там же, где access token: фактически токен на 7 дней можно использовать для доступа к REST API и WebSocket.
3. История сообщений и последнее сообщение комнаты доступны без авторизации.
4. Telegram webhook не проверяет секретный заголовок, поэтому принимает поддельные updates.
5. Ответ на friend request содержит IDOR: любой авторизованный пользователь может изменить любую заявку по её ID.
6. Загрузчик сохраняет расширение из имени клиента и затем раздаёт файл с того же origin. Это создаёт риск stored XSS и кражи JWT из `localStorage`.
7. Миграции не способны воспроизвести базу с нуля, runner пропускает `005–007`, а фактическая БД уже имеет schema drift и лишена важных unique/check constraints.
8. «Студент АГУ» никак не проверяется: зарегистрироваться может любой Telegram-пользователь. Модерации контента, жалоб, блокировок и банов нет.
9. При 50–100 активных участниках схема read/delivery receipts создаёт примерно `4 × (U − 1)` запросов к БД на каждое сообщение — около 400 запросов при 100 онлайн только ради отметок доставки/прочтения.
10. Текущий `WEBAPP_URL` не отвечает на `/api/health`; действующий публичный экземпляр по конфигурации недоступен либо URL устарел.

**Рекомендуемый статус продукта:**

- локальная разработка: **готово**;
- демонстрация одному разработчику/небольшой группе: **условно готово**;
- закрытый пилот до 10 человек: **после P0 и ключевых P1**;
- публичный запуск на 50–100 человек: **не готово без исправлений и нагрузочного теста**.

## 2. Что было проверено

Проверены основные каталоги и конфигурации:

- `client/` — страницы, Telegram SDK-интеграция, управление JWT, REST-клиент и WebSocket-клиент;
- `server/` — запуск, конфигурация, auth, REST routes, WebSocket, Telegram-бот, storage, statistics, logging;
- `shared/` — Drizzle-схема и Zod-схемы;
- `migrations/` и `apply-migrations.js` — полнота и порядок миграций;
- deployment-файлы Railway/Render/Nixpacks/Procfile;
- `.env.example`, правила игнорирования и Git-история секретов;
- 45 Markdown-документов проекта;
- фактическая схема и агрегированные счётчики подключённой PostgreSQL, без чтения персональных записей.

Выполнены проверки:

| Проверка | Результат |
|---|---|
| `npm run check` | успешно |
| `npm test` | 3 файла, 63/63 теста успешно |
| `npm run build` | успешно |
| `npm audit` | 0 известных уязвимостей на момент проверки |
| Production bundle | JS 745,66 KB, gzip 226,91 KB; предупреждение Vite о chunk > 500 KB |
| Подключение к PostgreSQL | успешно, read-only |
| Текущий `WEBAPP_URL/api/health` | недоступен в двух проверках |
| Реальный нагрузочный тест | не выполнялся: нет изолированного staging и безопасной тестовой БД |

Ограничение аудита: оценка 10/50/100 ниже основана на архитектуре и количестве операций. Она не заменяет измерения на staging с тем же тарифом хостинга и БД, что будет в production.

## 3. Архитектура и текущий функционал

### 3.1 Технологии

- Frontend: React 18, TypeScript, Vite, Wouter, TanStack Query, Tailwind/Radix UI.
- Backend: Node.js 20+, Express 4, TypeScript.
- Realtime: `ws`, один WebSocket endpoint `/ws`.
- Данные: PostgreSQL/Neon, Drizzle ORM.
- Telegram: `node-telegram-bot-api`, webhook в production, polling в development.
- Auth: Telegram `initData` HMAC + access/refresh JWT.
- Файлы: Multer и локальный каталог `uploads/`.
- Deploy: Railway, Render и Nixpacks-конфигурации.

### 3.2 Реализовано и реально присутствует в коде

- проверка подписи Telegram Mini App `initData` и `auth_date` до 24 часов;
- создание/получение пользователя по Telegram ID;
- access JWT на 15 минут и refresh JWT на 7 дней;
- заполнение профиля: имя, курс, направление, описание, пол, ссылки, аватар и фото;
- общий WebSocket-чат с историей, пагинацией, reply, typing, online count и receipts;
- избранный пользователь раз в месяц на уровне бизнес-логики;
- новости, рейтинг популярности и уведомления в интерфейсе;
- rate limiting HTTP и отправки сообщений;
- Zod-валидация, HTML escaping текста, проверка MIME и magic bytes изображений;
- structured logging через Pino с redaction;
- production-сборка и статическая раздача клиента.

### 3.3 Что фактически не завершено или не работает

- Нет проверки принадлежности к АГУ.
- Модерация пользователей отключена; каждый новый пользователь получает `approved`.
- Нет жалоб на сообщения/профили, блокировок, mute, банов, антиспама по содержимому и панели модератора.
- Нет создания friend requests и фоновой задачи «в начале месяца». Метод storage существует, но не вызывается; в рабочей БД заявок нет.
- Статистика пользователя и запись просмотра профиля всегда получают `401`: middleware пишет `req.user.userId`, а контроллер читает `req.user.id` (`server/statistics.ts:23-29`, `63-70`).
- Клиент нигде не вызывает endpoint записи просмотра профиля; UI ожидает `views`, которого API не возвращает.
- Создание новостей также не работает из-за `req.user.id`; после исправления потребует отдельной admin-роли, иначе новости сможет создавать любой пользователь.
- Смена аватара/фото на странице профиля показывает `Coming Soon`, хотя upload endpoints и загрузка при регистрации существуют (`client/src/pages/profile.tsx:159-179`, `627`).
- Нет редактирования/удаления сообщений, удаления аккаунта, экспорта данных и управления активными сессиями.
- Приватные чаты отсутствуют; `join_room` всегда возвращает глобальную комнату.
- Reply metadata доверяется клиенту: можно подделать автора и текст цитаты, сервер не сверяет `replyTo.id` с исходным сообщением.

## 4. Сильные стороны

1. **Рациональный стек для MVP.** Один Node.js-процесс и PostgreSQL позволяют быстро развивать продукт без лишней инфраструктуры.
2. **Серверная проверка Telegram HMAC.** Это важная базовая защита, и алгоритм реализован на сервере, а не доверен `initDataUnsafe`.
3. **Короткий access token и автоматический refresh.** Идея корректная, хотя разграничение типов токена сейчас сломано.
4. **Параметризованные запросы через Drizzle.** Риск классической SQL injection низкий.
5. **Есть ограничения размеров.** WebSocket payload ограничен 100 KB, текст — 1000 символов, файл — 5 MB, количество фото — 5.
6. **Есть пагинация и полезные индексы сообщений.** Запрос последних сообщений не обязан читать всю таблицу.
7. **Файл проверяется не только по заявленному MIME, но и по magic bytes.** Это лучше обычного Multer file filter.
8. **Сборка, strict TypeScript и unit-тесты работают.** Это хорошая отправная точка для стабилизации.
9. **Логи структурированы и часть чувствительных полей редактируется.** Есть отдельные события auth/WebSocket/HTTP.
10. **Интерфейс уже выглядит как продукт, а не технический экран.** Есть Telegram fullscreen/safe area, профили, чат, reply и мобильная навигация.

## 5. Критические и высокие риски

### P0-SEC-01. Действующие секреты находятся в Git-истории

**Факт:** `.env` сейчас игнорируется и не отслеживается, но `git log --all -- .env` показывает старые коммиты. Поиск без вывода значений обнаружил текущие `DATABASE_URL`, `TELEGRAM_BOT_TOKEN` и `JWT_SECRET` в шести исторических коммитах каждый. Подключение к БД с текущим `DATABASE_URL` успешно.

**Риск:** получение полного доступа к БД, управление ботом и выпуск поддельных JWT любым, кто имел доступ к истории репозитория. Приватность репозитория снижает вероятность, но не отменяет компрометацию.

**Что сделать немедленно:**

1. Сменить пароль/credential PostgreSQL и завершить старые соединения.
2. Отозвать Telegram Bot Token через BotFather и создать новый.
3. Сгенерировать новый JWT secret; это инвалидирует все существующие access/refresh tokens.
4. Удалить `.env` и credential-like строки из всей Git-истории через `git filter-repo`, затем force-push и попросить участников переклонировать репозиторий.
5. Подключить secret scanning/pre-commit и хранить production secrets только в secret store платформы.

### P0-AUTH-01. Refresh token можно использовать как access token

`generateRefreshToken()` добавляет `type: 'refresh'` и выдаёт токен на 7 дней (`server/auth.ts:47-61`), но `verifyAuthToken()` не запрещает `type: 'refresh'` (`server/auth.ts:64-80`). REST middleware и WebSocket используют именно `verifyAuthToken()`.

**Результат:** компрометация refresh token даёт прямой доступ ко всем защищённым endpoint и WebSocket на 7 дней. Задуманный 15-минутный access lifetime не выполняет защитную функцию.

**Исправление:** обязательные claims `typ`, `iss`, `aud`, `sub`, разные secrets/keys или как минимум строгий reject любого `typ !== 'access'`; refresh rotation с хранением hash/jti в БД и отзывом использованного токена.

### P0-DATA-01. История чата доступна без авторизации

`GET /api/messages/:roomId?` не использует `requireAuth` (`server/routes.ts:738-804`). Также публичен `GET /api/statistics/last-message/:roomId` (`server/routes.ts:899-906`).

**Риск:** любой посетитель знает/перебирает room ID и читает сообщения, постоянные user ID и псевдонимы. UI-защита маршрута не является защитой API.

**Исправление:** обязательная авторизация, проверка `approved`, completed profile и membership комнаты; одинаковая политика для REST и WebSocket; security integration tests.

### P0-UPLOAD-01. Риск stored XSS на origin приложения

Имя файла сохраняет расширение из `originalname` (`server/routes.ts:42-52`). Magic bytes проверяются, но файл не перекодируется и расширение не заменяется на фактически определённое (`server/routes.ts:83-105`). Затем `/uploads` публично раздаётся тем же Express origin (`server/routes.ts:882-887`).

Атакующий может загрузить polyglot с допустимой сигнатурой изображения и HTML-расширением/содержимым. Если браузер интерпретирует ответ как HTML, скрипт выполняется на origin приложения. JWT и refresh token находятся в `localStorage` (`client/src/lib/auth.ts:117-126`), что резко увеличивает последствия.

**Исправление:** decode + re-encode изображения библиотекой обработки, генерируемое сервером имя без пользовательского basename, расширение по детектированному MIME, `Content-Disposition: attachment` там, где просмотр не нужен, `X-Content-Type-Options: nosniff`, отдельный object-storage/CDN origin без cookies и app scripts. Добавить тест polyglot/extension mismatch.

### P0-WEBHOOK-01. Telegram webhook не аутентифицирован

`POST /api/telegram-webhook` принимает произвольный JSON и передаёт в `bot.processUpdate()` (`server/routes.ts:254-280`). При `setWebhook` не задаётся secret token (`server/telegram-bot.ts:208-217`).

**Риск:** поддельные updates, мусорные пользователи, попытки заставить бота отправлять сообщения, расход Telegram rate limit и засорение логов/БД.

**Исправление:** случайный `TELEGRAM_WEBHOOK_SECRET`, передача `secret_token` в `setWebhook`, строгая проверка `X-Telegram-Bot-Api-Secret-Token` до парсинга/обработки, отдельный rate limit для webhook и тест отрицательного сценария.

### P0-AUTHZ-01. IDOR в ответе на уведомление

`POST /api/notifications/:requestId/respond` получает `userId`, но не использует его для проверки владельца (`server/routes.ts:1115-1142`). Storage обновляет запись только по `requestId` (`server/storage.ts:355-363`).

**Риск:** любой вошедший пользователь может принять/отклонить чужую заявку, если угадает последовательный ID.

**Исправление:** atomic update по `id AND to_user_id AND status='pending'`; возвращать 404/403 при несовпадении; integration test двух пользователей.

### P0-DB-01. Миграции не воспроизводимы, production schema drift

Проблемы:

- нет начальной миграции, создающей `users`, `rooms`, `messages`;
- `apply-migrations.js` запускает только `001`, `002`, `003`, `008` (`apply-migrations.js:29-59`) и пропускает `005–007`;
- `003` создаёт старую `friend_requests` без `month_key`, а `007` использует `CREATE TABLE IF NOT EXISTS`, поэтому не обновит уже существующую таблицу;
- startup auto-migration выполняет только reply columns и проглатывает ошибку (`server/db.ts:22-43`);
- нет migration journal/lock и транзакционного применения версии;
- фактическая БД не имеет unique constraints для `favorites(user_id, month_key)`, `friend_requests(...)`, `profile_views(profile_user_id, viewer_user_id)` и не имеет ожидаемых status checks.

**Риск:** новый deploy не поднимается с чистой БД, разные среды имеют разные ограничения, гонки создают дубликаты, поведение ORM не соответствует данным.

**Исправление:** создать baseline + последовательные Drizzle migrations, migration journal, schema-drift check в CI, отдельную команду deploy migration; убрать ad hoc ALTER из startup. До добавления unique constraints проверить и дедуплицировать данные.

### P1-ABUSE-01. Нет модерации и подтверждения статуса студента

Любой корректный Telegram `initData` создаёт пользователя со статусом `approved` (`server/routes.ts:408-415`, `server/telegram-bot.ts:279-285`). Реальной модерации сообщений/профилей нет.

Для анонимного общего чата это эксплуатационный блокер: спам, травля и запрещённый контент появятся раньше сложных архитектурных проблем.

**Минимум для пилота:** allowlist/инвайты или университетская верификация, report, block/mute, rate limits, moderator queue, ban/suspend, удаление сообщения, audit log действий модератора и понятные правила сообщества.

### P1-RATE-01. HTTP rate limit сломает общую сеть/NAT

Общий лимит — 100 запросов за 15 минут на IP, auth — 20 (`server/config.ts:25-32`, `server/index.ts:170-201`). `trust proxy` не настроен. На Railway/Render адресом может оказаться reverse proxy; в кампусной сети десятки студентов могут иметь один публичный IP.

**Риск:** группа из 10–50 человек быстро получает `429`, а при неверной обработке proxy один клиент может заблокировать всех.

**Исправление:** корректный `trust proxy` для выбранной платформы; разные лимиты для auth, refresh, read API, uploads и webhook; ключ после auth — user ID; Redis-backed limiter для нескольких инстансов; сценарий load test с одним NAT IP.

### P1-WS-01. WebSocket допускает дешёвый DoS и не контролирует комнаты

- Неавторизованное соединение может оставаться открытым неограниченно; auth timeout отсутствует.
- Origin WebSocket не проверяется.
- Rate limit применяется только к `send_message`; typing, join и receipts не ограничены.
- `PING_INTERVAL_MS` объявлен, но heartbeat/ping-pong не реализован.
- Нет проверки `bufferedAmount`/backpressure для медленных клиентов.
- `join_room` игнорирует запрошенную комнату, а broadcast нового сообщения идёт всем авторизованным клиентам (`server/websocket.ts:480-486`, `508-516`).
- Клиент может передать произвольный `roomId` при отправке; membership и существование комнаты заранее не проверяются.

**Исправление:** auth deadline 5–10 секунд, per-IP connection cap, heartbeat, payload schema на каждый event, rate limit всех событий, room membership, backpressure и закрытие slow consumers.

### P1-PRIV-01. Продукт псевдонимный, а не анонимный

Сервер хранит постоянное соответствие `tg_id → Student_{database_id}`, Telegram username/photo, профиль, соцссылки и сообщения. Псевдоним и числовой user ID стабильны и видимы в чате. Оператор БД может однозначно связать сообщения с Telegram-аккаунтом.

**Что требуется:** честно назвать модель псевдонимностью; определить доступ администраторов к deanonymization, срок хранения сообщений и профилей, процедуру удаления/экспорта, privacy notice, согласие и incident response. Не обещать пользователю техническую анонимность, которой нет.

## 6. Производительность и нагрузка 10 / 50 / 100

### 6.1 Главный bottleneck — receipts

После каждого нового сообщения каждый другой клиент сразу отправляет и `message_delivered`, и `message_read` (`client/src/pages/chat.tsx:241-245`). Каждый receipt выполняет `SELECT message` и затем `UPDATE` массива (`server/websocket.ts:566-636`). Обновления read-modify-write неатомарны и могут терять параллельные отметки.

При `U` онлайн одно сообщение создаёт приблизительно:

- `U` серверных отправок самого сообщения;
- `2 × (U − 1)` входящих receipt events;
- `4 × (U − 1)` запросов к БД только для receipts;
- ещё несколько запросов на комнату, пользователя и вставку сообщения.

| Онлайн | DB-запросы на одно сообщение только для receipts | Оценка |
|---:|---:|---|
| 10 | около 36 | уже избыточно, но вероятно терпимо при редких сообщениях |
| 50 | около 196 | риск задержек и pool queue даже при умеренной активности |
| 100 | около 396 | архитектурно неприемлемо для активного общего чата |

Массивы `delivered_to/read_by` растут внутри каждой строки сообщения. При 100 участниках они хранят до 200 ID и постоянно полностью перезаписываются. GIN-индексы не решают write amplification.

**Решение для общего чата:** не хранить персональную доставку каждому читателю. Достаточно `last_delivered_message_id` / `last_read_message_id` на пользователя и комнату либо вообще только локального признака для отправителя. Если нужны индивидуальные receipts — отдельная таблица с unique key и батчирование, а не массив и два UPDATE на клиента.

### 6.2 Typing amplification

Клиент отправляет `typing_start` на каждое изменение input, сервер перебирает всех клиентов. При 100 одновременно печатающих пользователях и 5 событиях/сек это теоретически около 49 500 серверных `send()` в секунду. Нужны client throttle 1–2 секунды, server throttle и отправка только участникам комнаты.

### 6.3 Connect storm

Каждая авторизация WebSocket делает запрос пользователя, запрос/создание комнаты, загрузку 50 сообщений и инициирует пересчёт total users. 100 одновременных входов создают резкий всплеск БД. Online count уже throttled, что хорошо, но total users всё равно следует кэшировать.

### 6.4 Практическая оценка

| Нагрузка | Idle connections | Активный чат | Итог в текущем состоянии |
|---|---|---|---|
| 10 человек | технически легко | вероятно работает при невысокой частоте сообщений | только закрытая демонстрация; security P0 всё равно блокирует пилот |
| 50 человек | один Node-инстанс удержит соединения | rate limit общего IP и receipts могут вызвать 429/DB latency | не готово без P0/P1 и теста staging |
| 100 человек | 100 WebSocket сами по себе не проблема | receipts/typing дают квадратичное усиление; один инстанс и Neon pool становятся риском | не готово |

**Важно:** 100 подключённых и молчащих пользователей — небольшая нагрузка. 100 активных пользователей — принципиально другой сценарий. Без измерения нельзя обещать устойчивость или SLA даже после оптимизаций.

### 6.5 Ограничения масштабирования

- WebSocket clients, online count и rate limits хранятся в памяти процесса.
- При двух инстансах сообщения не распространяются между ними, online count неверен, duplicate connection control и лимиты расходятся.
- Локальные uploads эфемерны на типичных PaaS и не разделяются между репликами.
- Нет Redis/pub-sub, sticky-session стратегии или внешнего realtime broker.
- Нет query timeout, измерения pool saturation и graceful shutdown HTTP/WebSocket/DB.

До 100 активных пользователей лучше сначала сделать один правильно настроенный инстанс и оптимизировать receipts, а не преждевременно добавлять горизонтальное масштабирование. Redis/pub-sub понадобится перед второй репликой.

## 7. Другие проблемы качества и корректности

### Backend/API

- `requireAuth` проверяет только подпись JWT и не загружает актуальный user/status из БД (`server/routes.ts:224-241`).
- Refresh rotation не инвалидирует предыдущий refresh token; logout только удаляет localStorage.
- Access/refresh JWT не имеют `aud`, `iss`, `jti` и полноценного session record.
- CORS сознательно разрешает любой origin при `credentials: true` (`server/index.ts:144-159`).
- Нет Helmet/CSP/HSTS/referrer policy/permissions policy; `X-Content-Type-Options` не установлен.
- Публичные `top-users` и chat statistics раскрывают стабильные user IDs/метрики без явного решения о приватности.
- `limit` в news/top-users не ограничен сверху; невалидные/отрицательные pagination параметры не проходят общей Zod-схемой.
- `getOrCreateGlobalRoom()` не использует unique constraint/upsert; параллельный первый запуск может создать несколько global rooms.
- Availability check и сохранение display name не атомарны; конфликт unique превращается в 500.
- Сервер доверяет `replyToAnonName` и `replyToContent` от клиента.
- Общий error middleware после отправки ответа делает `throw err` (`server/index.ts:263-276`), что усложняет предсказуемую обработку ошибок.
- `/api/health` не проверяет БД, migration state, webhook или готовность приложения.
- Telegram bot на каждом production startup сначала удаляет webhook, затем ставит новый; при деплое возникает окно потери и конфликт с несколькими репликами.

### Данные

- Булевы значения `profileCompleted` хранятся строкой `"true"/"false"`.
- Enum в Drizzle-конфигурации text columns не гарантирует DB constraint; фактическая БД не ограничивает многие статусы.
- Временные поля используют смесь timestamp without time zone; это риск неоднозначности при смене среды.
- `reply_to_id` не имеет foreign key.
- Нет политики cascade/set-null в schema.ts, хотя отдельные SQL-файлы предполагают иное.
- Нет retention/архивации сообщений, cleanup orphan uploads и квот пользователя.

### Frontend

- JWT и refresh token хранятся в `localStorage`; при XSS похищаются оба.
- WebSocket UI помечает соединение как connected уже на TCP/WebSocket `open`, до `auth_success`; ранняя отправка даёт ошибку.
- Комната `1` жёстко прописана в нескольких REST-запросах клиента.
- Основной bundle слишком крупный для первого открытия в мобильном WebView; нет route-level code splitting.
- `client/index.html` загружает большой набор Google Fonts и удалённый Telegram script без CSP.
- Много console/debug сообщений и несколько параллельных механизмов очистки cache/localStorage.
- Страница регистрации публична на уровне роутера, хотя её API защищено; UX состояния истёкшей сессии следует упростить.

### Тесты

- Unit tests проверяют auth и validation, но sanitization test копирует функции вместо импорта production-кода.
- Нет тестов REST routes, authorization/IDOR, Telegram webhook, WebSocket протокола, БД/миграций, upload polyglot, React UI и token refresh end-to-end.
- Нет CI workflow, coverage gate и отдельной test database.
- Нет нагрузочного/soak/reconnect-теста.
- Корневые `test_*.js`, `.ps1` и DB reset scripts выглядят историческими и требуют ревизии; часть сценариев потенциально работает с БД из текущего `.env`.

## 8. Состояние рабочей БД на дату аудита

Read-only проверка показала:

| Таблица | Строк |
|---|---:|
| users | 62 |
| rooms | 1 |
| messages | 0 |
| news | 5 |
| favorites | 2 |
| friend_requests | 0 |
| profile_views | 0 |

Из 62 пользователей профиль завершили 11, у 51 `profile_completed=false`; все имеют статус `approved`. Глобальная комната существует с ID 1. Нулевое число сообщений означает, что реальная эксплуатация основного чата и накопительная нагрузка этой базой ещё не подтверждены.

В БД отсутствуют важные unique constraints, которые заявлены отдельными SQL-файлами. Это прямое доказательство рассинхронизации schema/migrations/production DB.

## 9. Документация

В проекте 45 Markdown-файлов. Сильная сторона — история решений подробно записывалась. Слабая — документы стали журналом срезов, а не единственным актуальным источником истины.

Основные проблемы:

- `START_HERE.md`, `FINAL_REPORT.md`, `PROJECT_REPORT.md`, `PROJECT_AUDIT_AND_TASKS.md`, несколько `QUICK_*`, `FIXES_*` и русскоязычных «финальных» отчётов конфликтуют по статусу.
- Старый аудит считает CORS исправленным, хотя текущая реализация разрешает все origins.
- Документы сообщают о готовой статистике/уведомлениях, но контроллер использует неверное поле auth user, а создание friend request отсутствует.
- Есть обещания 100% покрытия и production readiness без измеренного coverage, integration/E2E/load tests.
- `migrations/README.md` перечисляет практически только migration 001 и не отражает реальный порядок.
- В исторических документах были вставлены credential-like значения. Даже отозванные секреты следует заменить на `[REDACTED]`.
- Отсутствует обычный актуальный `README.md` с одной поддерживаемой инструкцией.

После исправлений стоит оставить небольшой набор живых документов: `README.md`, `docs/architecture.md`, `docs/API.md`, `docs/security.md`, `docs/operations.md`, `docs/product-rules.md`; исторические отчёты перенести в `docs/archive/`.

## 10. Приоритетный план доработки

### Этап P0 — containment и блокеры запуска

**Цель:** исключить компрометацию и очевидный несанкционированный доступ.

- [x] Ротировать DB credential, Bot Token и JWT secret; удалить секреты из Git history.
  - [x] Удалить `.env` и `.local` из всей истории веток `main` и `replit-agent`.
  - [x] Удалить локальные backup/reflog-ссылки на старые объекты и выполнить garbage collection.
  - [x] Проверить все оставшиеся Git refs: 0 совпадений по обнаруженным секретам, 0 объектов `.env`/`.local`, 0 недостижимых объектов.
  - [x] Выполнить защищённый force-push очищенной `main` на GitHub (`c9b36a1`, 13.09.2026).
  - [x] Ротировать пароль/роль PostgreSQL и заменить `DATABASE_URL` локально и на платформе размещения.
  - [x] Отозвать старый Telegram Bot Token через `@BotFather`, выпустить новый и заменить `TELEGRAM_BOT_TOKEN` локально и на платформе.
  - [x] Сгенерировать новый `JWT_SECRET`, заменить его локально и на платформе; перезапустить приложение.
  - [x] Проверить новые credentials: PostgreSQL и Telegram API доступны, JWT secret имеет достаточную длину; новые значения отсутствуют в Git history (13.09.2026).
  - [x] Старые клоны не должны использоваться: единственный актуальный источник истории — очищенная ветка `origin/main`.
- [x] Строго разделить access и refresh token; добавить session/jti и отзыв refresh tokens.
  - [x] Использовать разные производные HMAC-ключи и обязательные claims `typ`, `iss`, `aud`, `sub`, `sid`, `jti`.
  - [x] Отклонять refresh token в REST/WebSocket access-проверке и access token в refresh endpoint.
  - [x] Хранить только SHA-256 hash refresh token и его текущий `jti` в таблице `auth_sessions`.
  - [x] Выполнять атомарную refresh rotation без продления исходного семидневного срока; отклонять повторное использование старого токена.
  - [x] Добавить серверный отзыв сессии через `POST /api/auth/logout` и клиентский метод logout.
  - [x] Применить migration 009 к текущей БД и проверить create → rotate → replay reject → revoke; `npm run check`, 67/67 тестов и production build успешны (13.09.2026).
- [x] Закрыть `/api/messages` и last-message авторизацией и room membership.
  - [x] Добавить обязательные `requireAuth` и проверку актуального пользователя/комнаты для обоих REST endpoint.
  - [x] Разрешить глобальную комнату только пользователю `approved` с завершённым профилем; остальные типы комнат закрывать до появления явной membership-модели.
  - [x] Применить ту же deny-by-default политику к WebSocket auth/join/send и ограничить broadcast текущей комнатой.
  - [x] Проверить HTTP-сценарии `401/403/400/404/200` и WebSocket auth deny/allow; добавить 6 unit-тестов политики (73/73 теста успешно, 14.09.2026).
- [x] Защитить Telegram webhook secret token.
  - [x] Проверять `X-Telegram-Bot-Api-Secret-Token` до CORS и JSON body parser с безопасным сравнением digest.
  - [x] Передавать `secret_token` при регистрации webhook и завершать production startup ошибкой без корректного секрета.
  - [x] Добавить отдельный лимит только для уже аутентифицированных webhook requests и redaction заголовка в логах.
  - [x] Добавить 8 unit-тестов и HTTP smoke-test: отсутствующий/неверный секрет — `401`, корректный — `200`; неверный секрет отклоняется до разбора повреждённого JSON.
  - [x] Добавить новый `TELEGRAM_WEBHOOK_SECRET` в локальный `.env` и Render Environment; значение отсутствует в Git history.
  - [x] Опубликовать код и проверить production: неверный secret получает `401`, правильный — `200`, `/api/health` — `200` (14.09.2026).
- [ ] Исправить IDOR friend request response.
- [ ] Закрыть stored-XSS класс в upload pipeline; временно можно отключить upload до безопасной реализации.
- [ ] Исправить rate limit/trust proxy, чтобы пилот не блокировался общим NAT.
- [ ] Создать воспроизводимый baseline миграций и выровнять staging/production schema.
- [ ] Не использовать текущий `WEBAPP_URL`; поднять новый staging после ротации секретов.

**Критерий выхода:** старые credentials не работают; security integration tests зелёные; новая пустая БД поднимается одной командой; сообщения невозможно читать без валидной сессии.

### Этап P1 — корректность core chat и минимальная безопасность сообщества

- [ ] Убрать персональные receipt arrays или заменить на last-read cursor/batched table.
- [ ] Добавить атомарные upsert/constraints для global room, favorites, profile views и friend requests.
- [ ] Добавить Zod schemas для всех REST/WS payload и общие error codes.
- [ ] Проверять актуальный status/session для чувствительных операций.
- [ ] Реализовать WebSocket auth timeout, heartbeat, backpressure, limits всех event types и настоящие rooms.
- [ ] Проверять reply server-side.
- [ ] Добавить report/block/mute/ban/delete-message и простую moderator queue.
- [ ] Ввести закрытый доступ к пилоту: инвайты/allowlist или выбранную проверку АГУ.
- [ ] Определить честное privacy-описание, retention и удаление аккаунта/данных.
- [ ] Перенести uploads в object storage на отдельный origin и добавить quota/cleanup.

**Критерий выхода:** закрытый пилот 10 человек можно проводить без доступа посторонних, с работающими жалобами и возможностью остановить нарушителя.

### Этап P2 — восстановить обещанный функционал

- [ ] Исправить `req.user.id/userId` и унифицировать тип `AuthenticatedRequest`.
- [ ] Реализовать и протестировать profile views; вернуть согласованный DTO статистики.
- [ ] Определить механику favorites → friend request; реализовать scheduled job идемпотентно либо удалить обещание из UI.
- [ ] Добавить admin role и защищённое создание/редактирование новостей.
- [ ] Завершить смену аватара/фото в профиле.
- [ ] Решить, нужны ли приватные чаты, или удалить неиспользуемую многокомнатную абстракцию.
- [ ] Добавить удаление/редактирование своих сообщений в рамках продуктовых правил.

### Этап P3 — тестирование, наблюдаемость и нагрузка

- [ ] CI: install, typecheck, test, build, audit, migration-up/down или clean-DB smoke.
- [ ] Integration tests с отдельной PostgreSQL: auth, authorization, races, pagination, constraints.
- [ ] WebSocket tests: auth timeout, invalid token, reconnect, rate limit, 10/50/100 clients.
- [ ] E2E в Telegram-like viewport: первый вход, регистрация, чат, refresh, профиль, жалоба.
- [ ] Метрики: event-loop lag, WS connections, message rate, DB pool wait, query latency, 4xx/5xx/429, memory, reconnect rate.
- [ ] Error tracking и alerting; request/correlation ID.
- [ ] Backup/restore drill и documented rollback.
- [ ] Graceful shutdown для HTTP, WebSocket, bot и DB pool.

### Этап P4 — производительность и UX

- [ ] Провести staging load test с тем же тарифом Node/Neon.
- [ ] Кэшировать total users и редко меняющиеся данные.
- [ ] Throttle typing client/server.
- [ ] Code splitting страниц и анализ bundle.
- [ ] Уменьшить набор шрифтов/неиспользуемых UI dependencies.
- [ ] Добавить Redis/pub-sub только если нужен второй app instance.
- [ ] Проверить accessibility, слабую сеть, reconnect/airplane mode и старые Telegram WebViews.

### Этап P5 — документация и сопровождение

- [ ] Создать один актуальный `README.md`.
- [ ] Обновить API/WS контракт по фактическим DTO.
- [ ] Описать threat model, роли, moderation runbook и incident response.
- [ ] Архивировать старые отчёты и удалить секреты/идентификаторы из примеров.
- [ ] Автоматически проверять ссылки, env schema и drift документации в CI.

## 11. План нагрузочного допуска

Нагрузку надо проверять после P0/P1 на отдельном staging, не на текущей БД.

### Сценарии

1. **Connect storm:** 10, 50, 100 клиентов входят за 10 секунд, получают историю и online count.
2. **Idle soak:** 100 соединений держатся 2–4 часа с heartbeat и периодическими reconnect.
3. **Normal chat:** 100 онлайн, суммарно 2–5 сообщений/сек, typing throttled.
4. **Burst:** 20 сообщений/сек в течение 30 секунд.
5. **History:** параллельная загрузка 5–10 страниц при таблице минимум 100 000 сообщений.
6. **Same NAT:** все виртуальные пользователи приходят с одним IP/proxy chain.
7. **Slow consumers:** 10% клиентов не читают сокет или имеют высокую задержку.
8. **Abuse:** unauth connections, invalid payloads, typing spam, oversized frames и repeated refresh.
9. **Failure:** рестарт app/DB, reconnect clients, повторная доставка без дублей.

### Предлагаемые критерии

- auth API p95 < 500 ms;
- WebSocket auth + history p95 < 1 s;
- delivery нового сообщения p95 < 300 ms внутри региона;
- error rate < 1%, неожиданных disconnect < 0,5%;
- нет потерянных/дублированных сообщений;
- нет lost updates receipts;
- DB pool wait и CPU не находятся устойчиво у предела;
- память стабилизируется и возвращается после disconnect;
- ни один нормальный сценарий не получает ложный `429`;
- после рестарта клиенты восстанавливаются без ручной перезагрузки.

## 12. Рекомендуемая последовательность запуска

1. **Не публиковать текущую среду.** Сначала ротация секретов и новый staging URL.
2. **P0 fix sprint.** Security/auth/upload/migrations/rate limit.
3. **Core reliability sprint.** Receipts, WebSocket lifecycle, constraints, moderation minimum.
4. **Автотесты и staging.** Seed без реальных персональных данных.
5. **Пилот 5–10 доверенных участников** на 2–3 дня с логами и модератором.
6. **Нагрузочный прогон 50**, исправление bottlenecks.
7. **Пилот 30–50** минимум на неделю.
8. **Нагрузочный прогон 100 + soak**, backup/restore и incident drill.
9. Только после прохождения gates — публичное приглашение.

## 13. Итоговая оценка

| Область | Оценка | Комментарий |
|---|---:|---|
| Идея и UX-прототип | 7/10 | продукт уже можно показать и обсуждать с пользователями |
| Frontend | 6/10 | функционален, но bundle и несколько фич требуют завершения |
| Backend correctness | 4/10 | core работает концептуально, есть auth DTO bug, IDOR и гонки |
| Security | 2/10 | секреты в истории и несколько прямых P0 уязвимостей |
| Database/migrations | 3/10 | рабочая БД существует, но схема невоспроизводима и drift подтверждён |
| Realtime scalability | 3/10 | 100 idle возможно, 100 active блокирует receipt/typing amplification |
| Tests/operations | 4/10 | unit/build есть, integration/E2E/load/monitoring отсутствуют |
| Documentation | 4/10 | много полезной истории, но нет актуального single source of truth |

**Общая зрелость:** примерно **4/10 — функциональный MVP-прототип, не production-ready**.

Самый короткий путь к ценности — не добавлять новые социальные функции, а сначала закрыть секреты, auth/authorization, uploads, миграции и квадратичную схему receipts. После этого провести закрытый пилот на 10 человек, собрать реальные сценарии использования и только затем оптимизировать под 50/100.
