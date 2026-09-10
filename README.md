# Warderobe — Telegram Mini App (TMA)

Telegram Mini App для оцифровки личного гардероба и составления образов (луков) с поддержкой режимов слотов и свободного холста, синхронизацией между ПК и смартфоном.

> 📖 **Полная документация по архитектуре, коду и подводным камням**: см. [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

## Стек технологий

- **Frontend**: React 19, TypeScript, Vite, Zustand, IndexedDB, Telegram WebApp SDK
- **Backend**: FastAPI, Python 3.11, PostgreSQL, Pillow, Uvicorn
- **Деплой**:
  - Фронтенд: GitHub Pages (`.github/workflows/deploy.yml`)
  - Бэкенд: Railway (`server/` + PostgreSQL + Persistent Volume `/data`)

## Быстрый старт

### Фронтенд:
```bash
npm install
npm run dev
```

### Бэкенд:
```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
```
