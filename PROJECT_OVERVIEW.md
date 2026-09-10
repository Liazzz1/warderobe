# 🧥 Warderobe — Telegram Mini App (TMA) Overview

> **Документ для разработчиков и ИИ-ассистентов.**  
> Описывает назначение проекта, архитектуру, стек, модели данных, способы хранения, ключевые сценарии и критические подводные камни (gotchas).

---

## 1. О проекте

**Warderobe** — это Telegram Mini App для оцифровки личного гардероба и составления образов (outfit / луков).

### Ключевые возможности:
1. **Каталог вещей**: добавление фото с камеры/галереи, автоматическое удаление фона, авто-анализ и извлечение доминантных цветов прямо с фото вещи, расширенная палитра и выбор кастомного HEX-цвета, распределение по категориям (`outerwear`, `top`, `bottom`, `shoes`, `accessory`, `dress`) и брендам, редактирование параметров вещей.
2. **Создание образов (два режима)**:
   - 🔲 **По слотам (`slots`)**: составление лука по категориям через карусели вещей, кнопка «🎲 Случайно», закрепление вещей (pin). Превью генерируется как живой 4-квадрантный коллаж. При открытии показываются большие карточки вещей.
   - 🎨 **Коллаж на холсте (`canvas`)**: свободная раскладка, зум, вращение и слои (drag-and-drop холст). Превью генерируется в Canvas как цельное изображение.
3. **Поиск и фильтрация**: поиск вещей по названию и бренду в реальном времени в гардеробе.
4. **Шаринг и экспорт**: отправка луков в Telegram (`t.me/share/url`), системный Web Share API и скачивание превью на устройство.
5. **Аналитика гардероба**: визуальный разбор гардероба по цветам (процентное соотношение) и категориям в профиле.
6. **Папки и организация**: древовидная структура папок для луков (по сезонам, событиям и т.д.).
7. **Синхронизация между устройствами**: ПК (Telegram Desktop / Telegram Web) и смартфон (iOS / Android TMA) видят одну и ту же базу благодаря привязке к `telegram_id`.
8. **Offline-first**: локальный кэш на IndexedDB позволяет открывать вещи и образы даже при нестабильной сети.

---

## 2. Архитектура и стек технологий

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (GitHub Pages)                         │
│  React 19 + TypeScript + Vite + Zustand + IndexedDB                    │
│  Хостинг: GitHub Pages (автодеплой через .github/workflows/deploy.yml) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (API requests)
                                    │ Authorization: tma <initData>
┌───────────────────────────────────▼────────────────────────────────────┐
│                          BACKEND (Railway)                             │
│  FastAPI + Python 3.11 + Uvicorn + PostgreSQL (psycopg2) + Pillow      │
│  Хостинг: Railway (автодеплой из репозитория GitHub)                   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
         ┌───────────────────┐             ┌───────────────────┐
         │ PostgreSQL (БД)   │             │ Файлы на диске    │
         │ Таблицы: users,   │             │ /data/items/...   │
         │ items, looks,     │             │ (Railway Volume)  │
         │ folders           │             │                   │
         └───────────────────┘             └───────────────────┘
```

### Фронтенд (`/src`)
- **React 19** + **TypeScript**
- **Vite** (базовый путь `base: '/warderobe/'` для GitHub Pages)
- **Zustand** (`src/store/useWardrobeStore.ts`): централизованное состояние приложения
- **IndexedDB** (`src/lib/db.ts`): локальное хранилище `wardrobe_db` (хранилища `items`, `looks`, `folders`)
- **Telegram WebApp SDK** (`src/lib/telegram.ts`): доступ к `initData`, HapticFeedback, теме, MainButton
- **Удаление фона** (`src/lib/bgRemoval.ts`): ленивая загрузка `@imgly/background-removal` с CDN (выполняется на клиенте)

### Бэкенд (`/server`)
- **FastAPI** + **Uvicorn** (`server/main.py`)
- **PostgreSQL** (`server/schema.sql`): реляционная база данных
- **Pillow** (`PIL`): обработка и сжатие загружаемых изображений в PNG
- **CORSStaticFiles**: кастомная раздача статики `/files` с явными CORS-заголовками `Access-Control-Allow-Origin: *`

---

## 3. Модели данных

### Категории вещей (`Category`)
```ts
type Category = 'outerwear' | 'top' | 'dress' | 'bottom' | 'shoes' | 'accessory';
```

### Вещь (`ClothingItem`)
```ts
interface ClothingItem {
  id: string;          // UUID
  userId: string;      // Telegram ID (строка)
  category: Category;
  color: string;       // HEX
  brand?: string;
  name: string;
  imageUrl: string;    // URL на бэкенде: https://<domain>/files/items/<tg_id>/<id>.png
  createdAt: string;   // ISO timestamp
}
```

### Слой образа (`LookLayer`)
```ts
interface LookLayer {
  itemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}
```

### Образ (`Look`)
```ts
interface Look {
  id: string;
  userId: string;
  name: string;
  layers: LookLayer[];
  previewUrl?: string;       // Сгенерированный dataURL холста (для canvas) или undefined
  folderId?: string | null;  // Папка, в которой лежит лук
  createdAt: string;
  mode?: 'slots' | 'canvas'; // Режим создания
}
```

---

## 4. Разделение режимов: Слоты vs Холст (Canvas)

Это ключевая логика приложения, требующая особого внимания:

| Характеристика | По слотам (`slots`) | Коллаж на холсте (`canvas`) |
|---|---|---|
| **Выбор режима** | FAB `+` ➔ Шит выбора режима ➔ «По слотам» | FAB `+` ➔ Шит выбора режима ➔ «Коллаж (Холст)» |
| **Редактор** | Карусель вещей по слотам категорий | Перетаскивание, вращение, масштабирование на холсте |
| **Превью в библиотеке** | **Живой CSS 4-квадрантный коллаж** (`LookThumbnail` / `.slot-preview-grid`) с тегами `<img>` | Картинка `previewUrl` (с фолбэком на квадранты) |
| **Открытие (`LookDetailModal`)** | **Большие нумерованные карточки** (`1. ВЕРХ`, `2. НИЗ`...) с фото и брендом | Изображение холста + трей вещей внизу |
| **Бейдж на карточке** | 🔲 | 🎨 |

### Функция `isSlotLook(look)`
В `src/types.ts` реализован хелпер:
```ts
export function isSlotLook(look: Look): boolean {
  if (look.mode === 'slots') return true;
  if (look.mode === 'canvas') return false;
  // Фолбэк для старых записей из БД, созданных до добавления поля mode:
  return look.name.toLowerCase().includes('слот') || !look.previewUrl;
}
```
**Зачем это нужно:** Старые образы в базе данных на сервере могли быть сохранены с `mode = NULL`. Благодаря этому хелперу все слотовые образы (включая старые) всегда гарантированно открываются и отображаются как слоты, а не как пустой/черный холст.

---

## 5. Аутентификация и синхронизация

1. **Telegram `initData`**:
   - При каждом запросе в `src/lib/api.ts` отправляется заголовок `Authorization: tma <rawInitData>`.
   - Сервер валидирует HMAC-SHA256 подпись через `BOT_TOKEN`.
   - Вспомогательная функция `_upsert_user` автоматически создает или обновляет запись пользователя в таблице `users`.
2. **Идентификация пользователя**:
   - `user_id` во всех таблицах — это строковое представление `telegram_id`.
   - Телефон и ПК одного пользователя имеют один и тот же `telegram_id` ➔ видят единую базу вещей и образов.
3. **Кэширование и синхронизация (`fetchWithCache`)**:
   - При открытии экрана данные запрашиваются с сервера.
   - Свежие данные возвращаются сразу в UI.
   - Фоновый процесс удаляет из локального IndexedDB вещи/образы, удалённые на сервере другим устройством, и сохраняет актуальные.
   - Если сервер временно недоступен или нет сети (TypeError), отдаются закэшированные данные из IndexedDB.

---

## 6. Деплой и инфраструктура

### 1. Фронтенд (GitHub Pages)
- Репозиторий: ветка `main`.
- Workflow: `.github/workflows/deploy.yml`.
- Секреты репозитория GitHub:
  - `VITE_API_URL` — публичный URL бэкенда на Railway (например, `https://warderobe-production.up.railway.app`).

### 2. Бэкенд (Railway)
- Сервис строится через Nixpacks (`Procfile` / `server/railway.json`).
- Команда запуска: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Переменные окружения на Railway:
  - `DATABASE_URL` — ссылка на PostgreSQL (предоставляется плагином Postgres на Railway).
  - `BOT_TOKEN` — токен Telegram-бота для валидации `initData`.
  - `STORAGE_DIR` — путь к смонтированному диску (Volume), по умолчанию `/data`.
  - `PUBLIC_URL` — базовый публичный URL сервиса (если не задан, вычисляется из `RAILWAY_PUBLIC_DOMAIN`).

---

## 7. Критические подводные камни (Gotchas & Rules)

> ⚠️ **ОБЯЗАТЕЛЬНО К ПРОЧТЕНИЮ ПЕРЕД ВНЕСЕНИЕМ ИЗМЕНЕНИЙ**

### 1. Railway Volume и потеря картинок (`/data`)
- **Проблема**: Контейнеры на Railway имеют эфемерную файловую систему. Без подключенного Persistent Volume всё содержимое папки `/data` стирается при каждом редеплое бэкенда. При этом записи в PostgreSQL остаются, а картинки начинают отдавать 404 (на iPhone отображается синий квадрат со знаком вопроса `?`).
- **Правило**: В дашборде Railway к сервису бэкенда **должен быть примонтирован Volume** с точкой монтирования `/data`.

### 2. CORS на раздачу статики (`StaticFiles`)
- **Проблема**: В Starlette/FastAPI `app.mount("/files", StaticFiles(...))` **не наследует** `CORSMiddleware` от корневого приложения `app`. При попытке загрузить картинку в Canvas (`img.crossOrigin = 'anonymous'`) браузер блокирует ее из-за отсутствия заголовка `Access-Control-Allow-Origin: *`.
- **Решение**: В `server/main.py` используется класс `CORSStaticFiles`, который явно проставляет CORS-заголовки для всех статических файлов:
  ```python
  class CORSStaticFiles(StaticFiles):
      async def get_response(self, path: str, scope):
          response = await super().get_response(path, scope)
          response.headers["Access-Control-Allow-Origin"] = "*"
          response.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
          response.headers["Access-Control-Allow-Headers"] = "*"
          return response
  ```

### 3. Canvas `toDataURL` на мобильных (iOS WebKit / Telegram)
- **Проблема**: На iPhone внутри Telegram WebApp Canvas очень чувствителен к taint (загрязнению контекста). Если хоть одна картинка упала по CORS или сети, Canvas окрашивается в сплошной черный цвет или выбрасывает исключение.
- **Решение**: Для слот-образов **никогда не генерируйте Canvas-превью**. Используйте компонент `LookThumbnail`, который рисует живой CSS-коллаж нативных тегов `<img>`. Он работает молниеносно, не требует Canvas и не подвержен CORS-блокировкам.

### 4. Синхронность поля `mode`
- При добавлении или изменении параметров образа поле `mode` должно быть отражено во всех слоях:
  1. `src/types.ts` (`Look.mode: 'slots' | 'canvas'`)
  2. `server/schema.sql` (`ALTER TABLE looks ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'canvas'`)
  3. `server/main.py` (`SaveLookRequest.mode`, `UpdateLookRequest.mode`, SQL запросы `SELECT`, `INSERT`, `UPDATE`)
  4. Автомиграция `run_migrations` в `main.py` применяет `schema.sql` при каждом запуске сервера на Railway.

### 5. Обнуление `folderId` при перемещении лука в корень
- **Проблема**: Если переместить лук из папки в корень (`folderId: null`), в JSON уходит `{"folderId": null}`. Если бэкенд проверяет `if body.folderId is not None:`, то значение `null` проигнорируется, и лук останется в старой папке.
- **Решение**: В Pydantic v2 на бэкенде проверяется `'folderId' in body.model_fields_set`, что позволяет корректно устанавливать `folder_id = NULL` в базе данных.

### 6. Фотографии в формате HEIC с iPhone
- Камера iOS сохраняет фото в формате `.heic`. Библиотека `Pillow` в Python из коробки не поддерживает HEIC (требуется `pillow-heif`). На клиенте в `AddScreen.tsx` перед отправкой фото обрабатывается через `@imgly/background-removal`, которая возвращает стандартный PNG-Blob.

---

## 8. Чек-лист при проверке работы

- [ ] Нажатие `+` на экране «Луки» открывает шит с выбором: «По слотам» или «Коллаж (Холст)».
- [ ] Сохраненный слот-образ отображается в сетке луков как коллаж из 4 квадрантов с бейджем `🔲`.
- [ ] Нажатие на карточку слот-образа открывает модалку с большими пронумерованными карточками (`1. ВЕРХ`, `2. НИЗ`...).
- [ ] Кнопка «✏️ Редактировать» в модалке слот-образа открывает слотовый конструктор с теми же вещами.
- [ ] Сохраненный коллаж холста отображается с бейджем `🎨`.
- [ ] Добавленные вещи и образы видны одновременно на ПК и на телефоне.
