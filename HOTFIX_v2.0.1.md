# 🔥 HOTFIX v2.0.1 - Исправление ошибок запуска

## Проблемы, которые были исправлены

### 1. ❌ Ошибка Vite: "Invalid loader value: 0"
**Причина:** Параметр `?v=2.0.0` в пути к скрипту ломал Vite esbuild  
**Исправление:** ✅ Удален query parameter из `index.html`

### 2. ❌ WebSocket: бесконечный reconnect loop
**Причина:** WebSocket пытался переподключиться даже без токена  
**Исправление:** ✅ Добавлена проверка auth перед reconnect

### 3. ❌ JWT malformed errors
**Причина:** Старые битые токены в localStorage  
**Исправление:** ✅ Версия увеличена до 2.0.1 для принудительной очистки

## Как применить исправления

### Шаг 1: Остановить все процессы
```powershell
# Если dev сервер запущен - нажмите Ctrl+C
```

### Шаг 2: Очистить localStorage в браузере
```javascript
// Откройте консоль браузера (F12) и выполните:
localStorage.clear()
console.log('✅ localStorage очищен')
location.reload()
```

### Шаг 3: Перезапустить dev сервер
```powershell
npm run dev
```

### Шаг 4: Проверка
Откройте http://localhost:3000 и проверьте консоль:

**Должно быть:**
```
[App] Version changed from 2.0.0 to 2.0.1, clearing cache...
[App] Cache cleared successfully
[Entry] Using dev authentication
[Entry] Created new dev user ID: [число]
```

**НЕ должно быть:**
```
❌ Invalid loader value
❌ WebSocket: No token provided (бесконечный loop)
❌ jwt malformed
```

## Изменённые файлы в hotfix

1. **client/index.html**
   - Удален `?v=2.0.0` из script src
   - Обновлен meta-тег на v2.0.1

2. **client/src/main.tsx**
   - Версия изменена с 2.0.0 на 2.0.1

3. **client/src/pages/chat.tsx**
   - Исправлен reconnect loop
   - Добавлены проверки auth перед WebSocket операциями
   - Улучшено логирование

## Что делать если проблемы остались

### Проблема: "EADDRINUSE: address already in use"
```powershell
# Найти и убить процесс на порту 3000
netstat -ano | findstr :3000
taskkill /PID [номер_процесса] /F

# Или измените порт в .env
PORT=5000
```

### Проблема: Всё ещё "No token provided"
```javascript
// В консоли браузера:
localStorage.clear()
sessionStorage.clear()
// Закрыть все вкладки приложения
// Открыть заново
```

### Проблема: "jwt malformed" остался
```powershell
# Удалите папку .local
Remove-Item -Recurse -Force .local

# Перезапустите
npm run dev
```

## Быстрая проверка работоспособности

1. **Откройте консоль браузера** (F12)
2. **Проверьте версию:**
   ```javascript
   localStorage.getItem('app_version')
   // Должно быть: "2.0.1"
   ```

3. **Проверьте dev user:**
   ```javascript
   localStorage.getItem('dev_user_id')
   // Должно быть: число (например "1760795422082")
   ```

4. **Проверьте auth state:**
   ```javascript
   JSON.parse(localStorage.getItem('chat_auth_state'))
   // Должны быть: user, token, refreshToken
   ```

## Текущее состояние

- **Версия:** 2.0.1
- **Vite ошибка:** ✅ Исправлена
- **WebSocket loop:** ✅ Исправлен
- **localStorage:** ✅ Автоочистка работает
- **Готово к запуску:** ✅ Да

## Следующие шаги

После успешного запуска:

1. Проверьте что Entry page открывается
2. Нажмите "Start" - должен создаться пользователь
3. Заполните профиль на странице регистрации
4. Перейдите в чат
5. Проверьте что WebSocket подключается БЕЗ ошибок

## Команды для быстрого старта

```powershell
# 1. Очистить всё
Remove-Item -Recurse -Force .local, dist

# 2. Запустить dev
npm run dev

# 3. В браузере (F12 консоль)
localStorage.clear()
location.reload()
```

---

**Hotfix применён:** 2025-01-18  
**Версия:** 2.0.1  
**Критичность:** Высокая  
**Статус:** ✅ Готово к тестированию
