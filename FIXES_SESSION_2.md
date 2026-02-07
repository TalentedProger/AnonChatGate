# Исправления сессии 2

## Проблемы которые были исправлены:

### 1. Ошибка 401 "jwt expired" при редактировании профиля ✅

**Причина:** JWT токены истекают через 15 минут, но `getValidToken()` не проверял срок действия перед возвратом токена.

**Решение:** Добавлена проверка истечения токена в `client/src/lib/auth.ts`:
- Декодирование JWT для проверки `exp` (время истечения)
- Если токен истекает менее чем через 60 секунд - автоматически обновляем через refresh token
- Если refresh token недоступен - разлогиниваем пользователя

### 2. `apiRequest` бросал ошибки на не-2xx ответы ✅

**Причина:** Функция `apiRequest` вызывала `throwIfResNotOk()` что конфликтовало с кодом который проверяет `response.ok`.

**Решение:** Удален вызов `throwIfResNotOk()` из `client/src/lib/queryClient.ts`, теперь callers сами проверяют `response.ok`.

### 3. Отсутствует страница профиля другого пользователя ✅

**Требование:** При клике на аватар/никнейм в чате должна открываться анонимная страница пользователя.

**Решение:**
- Создан новый endpoint `/api/user/:userId/profile` в `server/routes.ts`
- Создана страница `client/src/pages/user-profile.tsx`
- Добавлен маршрут `/user/:userId` в `client/src/App.tsx`
- В `chat-interface.tsx` добавлен обработчик клика на аватар и никнейм

### 4. Социальные ссылки (telegram, vk, instagram) ✅

**Причина:** Frontend отправляет/ожидает отдельные поля `telegram`, `vk`, `instagram`, но backend хранит их в массиве `socialLinks`.

**Решение:**
- GET `/api/profile` - парсит массив `socialLinks` и извлекает отдельные поля
- PATCH `/api/profile` - принимает отдельные поля и преобразует в массив `socialLinks`

### 5. Мобильная загрузка в Telegram ✅

**Причина:** `import.meta.env.DEV` возвращает `false` в production build даже при запуске через ngrok.

**Решение:** Улучшена логика определения Telegram WebApp в `client/src/pages/entry.tsx`:
- Добавлено детальное логирование
- Добавлены alert'ы для отладки на мобильных устройствах
- Улучшена обработка ошибок авторизации

## Файлы изменённые:

1. `client/src/lib/auth.ts` - проверка истечения JWT и auto-refresh
2. `client/src/lib/queryClient.ts` - удален auto-throw на ошибках
3. `server/routes.ts` - новый endpoint + парсинг social links
4. `client/src/pages/user-profile.tsx` - НОВЫЙ ФАЙЛ
5. `client/src/components/chat-interface.tsx` - кликабельные аватары/ники
6. `client/src/App.tsx` - маршрут /user/:userId
7. `client/src/pages/entry.tsx` - улучшенная мобильная авторизация

## Тестирование:

1. **Token refresh:** Подождите 15+ минут и попробуйте редактировать профиль
2. **Профиль пользователя:** Кликните на аватар/ник в чате
3. **Мобильная версия:** Откройте бота в Telegram на телефоне
4. **Social links:** Измените telegram/vk/instagram в профиле

## Что делать если mobile не работает:

1. Проверьте что ngrok запущен и URL в .env актуальный
2. Обновите URL в BotFather через /setwebapp
3. Очистите кеш Telegram (Settings > Data and Storage > Clear Cache)
4. Проверьте консоль браузера в DevTools мобильного Telegram
