# PRD: Данные не сохраняются между сессиями (HTTP Caching Issue)

**Дата:** 2026-01-17  
**Статус:** Draft  
**Владелец:** Backend Tech Lead  
**Связан с:** [data-loss-after-reload.md](./data-loss-after-reload.md)

---

## Роли для реализации

| Роль | Ответственность |
|------|-----------------|
| **Backend Engineer** | Отключение ETag/кэширования для `/data/sync` и `/data/:type` |
| **Frontend Engineer** | Добавление cache-busting headers в fetch запросы (опционально) |
| **QA Engineer** | Тестирование сценария write → reload → read |

---

## Контекст и проблема

### Исходная ситуация
PRD `data-loss-after-reload.md` был реализован:
- ✅ Read-after-write проверка при POST `/data/:type`
- ✅ Metadata (`savedAt`, `checksum`, `itemCount`) возвращается клиенту
- ✅ Legacy fallback для миграции данных по email
- ✅ Recovery banner при пустом sync

### Проблема (не исправлена)
Несмотря на реализованные меры, данные всё ещё теряются после перезагрузки.

**Симптомы из логов:**
```
POST /data/readinessLogs: {success: true, savedAt: '2026-01-17T20:40:55.644Z', itemCount: 1}
POST /data/history: {success: true, savedAt: '2026-01-17T20:41:00.927Z', itemCount: 1}
...
[После login/reload]
GET /data/sync: {history: [], achievements: [], readinessLogs: [], ...}
```

---

## Диагностика и корневая причина

### Ключевое доказательство

Скриншот DevTools показывает:

![Screenshot showing 304 Not Modified](uploaded_image_1768682782468.png)

```
Status Code: 304 Not Modified
Etag: W/"306-LBDFU+nkxo5awV2ctgfEQ/clEbw"
```

> [!CAUTION]
> **Браузер возвращает закэшированный пустой ответ вместо реального запроса к серверу!**

### Корневая причина

**HTTP Caching via ETag**

1. При первом запросе `/data/sync` сервер возвращает пустые данные с ETag
2. Браузер сохраняет ответ и ETag в кэше
3. Пользователь выполняет тренировку — POST запросы успешно записывают данные
4. При reload браузер отправляет `If-None-Match: W/"306-..."` header
5. Сервер возвращает `304 Not Modified` (не проверяя реальные данные!)
6. Браузер использует закэшированный пустой ответ

### Почему ETag не меняется

Express генерирует ETag на основе **response body**. Но если сервер не делает реальный запрос к YDB при проверке ETag, он возвращает 304 на основе старого ETag значения.

**Проблема в Express/serverless-http:** По умолчанию Express включает ETag и conditional GET. Yandex Cloud API Gateway может дополнительно кэшировать ответы.

---

## Решение

### 1) Отключить ETag для data endpoints (Critical)

**В `server.js` добавить middleware для отключения кэширования:**

```javascript
// Отключить кэширование для /data/* endpoints
app.use('/data', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// Отключить ETag глобально для data routes
app.disable('etag');
// ИЛИ: app.set('etag', false);
```

### 2) Альтернатива: Отключить ETag только для GET /data/sync

```javascript
app.get('/data/sync', authMiddleware, async (req, res) => {
    res.set('ETag', ''); // Удалить ETag
    res.set('Cache-Control', 'no-store');
    // ... остальной код
});
```

### 3) Frontend: Cache-busting (дополнительная страховка)

```javascript
const apiRequest = async (endpoint, method = 'GET', body = null, token = null) => {
    const headers = { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'  // Добавить
    };
    // ...
    const response = await fetch(fullUrl, { 
        method, 
        headers, 
        body: body ? JSON.stringify(body) : null,
        cache: 'no-store'  // Добавить
    });
};
```

---

## Изменения в файлах

### Backend

#### [MODIFY] [server.js](file:///Users/xxrain/Documents/Projects/healthy-back-app/backend/server.js)

**Добавить после строки 10 (`app.use(cors());`):**

```javascript
// Disable caching for all /data/* endpoints
app.use('/data', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});
```

**Или отключить ETag глобально после строки 31:**

```javascript
app.set('etag', false);
```

---

### Frontend (опционально)

#### [MODIFY] [App.js](file:///Users/xxrain/Documents/Projects/healthy-back-app/frontend/src/App.js)

**Изменить функцию `apiRequest` (строка 219-244):**

```javascript
const response = await fetch(fullUrl, { 
    method, 
    headers, 
    body: body ? JSON.stringify(body) : null,
    cache: 'no-store'  // Добавить эту опцию
});
```

---

## Acceptance Criteria

1. ✅ GET `/data/sync` возвращает `200 OK` (не `304 Not Modified`) после записи данных
2. ✅ Response headers содержат `Cache-Control: no-store`
3. ✅ Response headers НЕ содержат `ETag`
4. ✅ Данные отображаются после reload страницы

---

## План верификации

### Автоматические тесты

```bash
cd backend && npm test
```

### Ручное тестирование

1. Открыть https://healthy-app.website.yandexcloud.net/
2. Залогиниться
3. Выполнить тренировку
4. **Открыть DevTools → Network**
5. Обновить страницу (Cmd+R / F5)
6. **Проверить:** GET `/data/sync` должен вернуть `200 OK` (не `304`)
7. **Проверить:** Данные отображаются

### Тест с curl

```bash
# Первый запрос
curl -i -H "Authorization: Bearer $TOKEN" \
  https://d5df48d7k10crckljv6m.g3ab4gln.apigw.yandexcloud.net/data/sync

# Проверить что нет ETag в ответе
# Проверить Cache-Control: no-store
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| Увеличение нагрузки на сервер из-за отсутствия кэширования | API Gateway Yandex Cloud обрабатывает запросы, нагрузка минимальна для персональных данных |
| Yandex API Gateway может добавлять свои cache headers | Проверить документацию API Gateway, при необходимости настроить там |

---

## Связанные события аналитики

- `sync_empty_after_write` — данные не найдены после write (должен исчезнуть после фикса)
- (новое) `sync_cache_bypass` — успешное получение свежих данных
