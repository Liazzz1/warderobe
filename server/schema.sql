-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    username TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица папок для луков
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);

-- Таблица вещей гардероба
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT NOT NULL,
    brand TEXT,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumb_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_items_user_category ON items(user_id, category);

-- Таблица созданных луков
CREATE TABLE IF NOT EXISTS looks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    layers JSONB NOT NULL DEFAULT '[]'::jsonb,
    preview_url TEXT,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mode TEXT DEFAULT 'canvas'
);
CREATE INDEX IF NOT EXISTS idx_looks_user ON looks(user_id);
CREATE INDEX IF NOT EXISTS idx_looks_folder ON looks(folder_id);

-- Миграция: добавить mode если не существует (для уже созданных БД)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='looks' AND column_name='mode'
    ) THEN
        ALTER TABLE looks ADD COLUMN mode TEXT DEFAULT 'canvas';
    END IF;
END $$;