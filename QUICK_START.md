# 🚀 Быстрый старт после обновления v2.0.0

## Что исправлено
- ✅ Удалены все заглушки (student_999999)
- ✅ Исправлено кэширование Telegram
- ✅ Исправлена WebSocket аутентификация
- ✅ Добавлена автоочистка localStorage

## Запуск Development

```powershell
# Запустить dev сервер
npm run dev
```

Приложение откроется на http://localhost:5000

**Важно:** При первом запуске будет создан новый dev user ID и сохранен в localStorage.

## Запуск Production

```powershell
# 1. Пересобрать проект
npm run build

# 2. Запустить сервер
npm start
```

## Очистка кэша Telegram

### Если всё ещё видите старую версию:

**Самый быстрый способ (Telegram Desktop):**
1. Закройте Telegram полностью
2. Удалите папку кэша:
   - Windows: `%APPDATA%\Telegram Desktop\tdata\user_data`
3. Откройте Telegram снова

**На телефоне (iOS/Android):**
1. Settings → Data and Storage → Storage Usage
2. Clear Cache
3. Закройте Telegram полностью (свайп вверх)
4. Откройте снова

**Самый радикальный способ:**
1. Переустановите Telegram
2. Войдите заново
3. Запустите бота

## Проверка работы

1. Откройте бота в Telegram
2. Отправьте `/start`
3. Нажмите "Открыть приложение"
4. Откройте консоль разработчика (F12 или долгий тап)
5. Проверьте логи - НЕ должно быть `Student_999999`

**Правильный лог выглядит так:**
```
[App] Version 2.0.0 - cache valid
[Entry] Using dev authentication  
[Entry] Using existing dev user ID: 1739012345678
[Entry] Dev auth successful
[Chat] Connecting to WebSocket...
[Chat] WebSocket connected, authenticating...
```

## Типичные проблемы

### "WebSocket auth error"
- **Причина:** Старый кэш
- **Решение:** Очистите кэш Telegram (см. выше)

### Всё ещё вижу Student_999999
- **Причина:** Telegram кэширует мини-апп
- **Решение:** Переустановите Telegram или используйте Telegram Web

### Постоянно редиректит на /entry
- **Причина:** Токены не сохраняются
- **Решение:** 
  ```javascript
  // В консоли браузера:
  localStorage.clear()
  location.reload()
  ```

## Важные команды

```powershell
# Полная очистка и пересборка
Remove-Item -Recurse -Force dist, node_modules
npm install
npm run build
npm start

# Проверить версию приложения (в консоли браузера)
localStorage.getItem('app_version')  // должно быть "2.0.0"

# Сбросить dev user
localStorage.removeItem('dev_user_id')
location.reload()
```

## Дополнительная информация

- Полное руководство: `CACHE_CLEARING_GUIDE.md`
- Список изменений: `CHANGES_SUMMARY.md`
- Настройка проекта: `SETUP.md`

---

**Версия:** 2.0.0  
**Дата:** 2025-01-18  
**Статус:** ✅ Готово к использованию
